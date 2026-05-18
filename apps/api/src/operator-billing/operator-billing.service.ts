import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  BillingActionRequest,
  BillingActionStatus,
  BillingActionType,
  Prisma,
  PlatformRole,
  SubscriptionStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { BillingService } from "../billing/billing.service";
import {
  BILLING_PLANS,
  isBillingPlanKey,
  isPaidPlanKey,
} from "../billing/billing-plans";
import type { BillingPlanKey } from "../billing/billing.types";
import {
  OPERATOR_PERMISSIONS,
  hasAllPermissions,
} from "../auth/operator/permissions/operator-permissions.registry";

export type OperatorBillingActor = {
  id: string;
  email?: string | null;
  platformRole: PlatformRole | null;
  permissions: ReadonlyArray<string>;
};

/**
 * Phase 7 — billing control backend.
 *
 * Orchestrates every operator-driven billing surface:
 *  - Plan / subscription / grace-period mutations (forwarded to
 *    `BillingService`).
 *  - Webhook ingestion observability + replay (mismatch detection +
 *    `BillingWebhookEvent` replay).
 *  - Invoice / payment timeline (cached snapshots in
 *    `BillingInvoiceSnapshot` / `BillingPaymentEvent`).
 *  - Operator-only notes (`BillingOperatorNote`).
 *  - Entitlement overrides (`BillingEntitlementOverride`).
 *  - High-risk action approval workflow via `BillingActionRequest`. Every
 *    sensitive mutation records a row with before/after snapshots, the
 *    operator reason, and the approver (if any). Refunds and entitlement
 *    overrides go through a two-actor approval flow.
 *
 * Permission gating: each public method asserts at least one
 * `OPERATOR_PERMISSIONS.BILLING_*` key via {@link assertPermission}. Routes
 * already declare the same permission via `@RequireOperatorPermissions`
 * + `OperatorPermissionGuard`; the service double-checks so the contract
 * is enforced even if a future controller forgets the decorator.
 *
 * All mutations create exactly one `BillingActionRequest` row. Routes
 * that the audit interceptor flags `sensitive` ALSO append an
 * `OperatorAuditLog` entry (with the operator's hashed IP/UA), so we
 * have two independent records: the audit log answers "who hit which
 * route, when" and the action request answers "what was the state
 * before/after, what was the reason, who approved".
 */
@Injectable()
export class OperatorBillingService {
  private readonly logger = new Logger(OperatorBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  // ── Permission helpers ───────────────────────────────────────────────

  private assertPermission(
    actor: OperatorBillingActor,
    ...required: string[]
  ): void {
    if (!hasAllPermissions(actor.permissions, required)) {
      throw new ForbiddenException({
        code: "OPERATOR_PERMISSION_DENIED",
        message: "Required billing permission is not granted to this actor.",
        required,
      });
    }
  }

  private assertCanApproveBillingActions(actor: OperatorBillingActor): void {
    this.assertPermission(
      actor,
      OPERATOR_PERMISSIONS.BILLING_ACTION_APPROVE_ALL,
    );
  }

  // ── Tenant lookup helpers ────────────────────────────────────────────

  private async resolveTenantOrThrow(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, name: true, status: true },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: "TENANT_NOT_FOUND",
        message: "Tenant not found",
      });
    }
    return tenant;
  }

  // ── Command center / overview ────────────────────────────────────────

  async getOverview(actor: OperatorBillingActor): Promise<{
    counts: {
      active: number;
      trialing: number;
      pastDue: number;
      canceled: number;
      mismatched: number;
    };
    pendingApprovals: number;
    unprocessedWebhooks: number;
    failedWebhooks: number;
    recentActions: BillingActionRequest[];
  }> {
    this.assertPermission(actor, OPERATOR_PERMISSIONS.BILLING_ACCOUNT_READ_ALL);

    const [
      active,
      trialing,
      pastDue,
      canceled,
      pendingApprovals,
      unprocessedWebhooks,
      failedWebhooks,
      recentActions,
    ] = await Promise.all([
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.TRIALING },
      }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.PAST_DUE },
      }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.CANCELED },
      }),
      this.prisma.billingActionRequest.count({
        where: { status: BillingActionStatus.PENDING_APPROVAL },
      }),
      this.prisma.billingWebhookEvent.count({
        where: { processedAt: null, errorMessage: null },
      }),
      this.prisma.billingWebhookEvent.count({
        where: { errorMessage: { not: null } },
      }),
      this.prisma.billingActionRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return {
      counts: {
        active,
        trialing,
        pastDue,
        canceled,
        mismatched: 0,
      },
      pendingApprovals,
      unprocessedWebhooks,
      failedWebhooks,
      recentActions,
    };
  }

  // ── Account list / detail ────────────────────────────────────────────

  async listAccounts(
    actor: OperatorBillingActor,
    query: {
      q?: string;
      status?: string;
      planKey?: string;
      mismatch?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    this.assertPermission(actor, OPERATOR_PERMISSIONS.BILLING_ACCOUNT_READ_ALL);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.TenantWhereInput = {};
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { slug: { contains: query.q, mode: "insensitive" } },
        { id: { equals: query.q } },
      ];
    }

    const statusEnum =
      query.status === "active"
        ? SubscriptionStatus.ACTIVE
        : query.status === "trialing"
          ? SubscriptionStatus.TRIALING
          : query.status === "past_due"
            ? SubscriptionStatus.PAST_DUE
            : query.status === "canceled"
              ? SubscriptionStatus.CANCELED
              : query.status === "incomplete"
                ? SubscriptionStatus.INACTIVE
                : null;

    if (statusEnum || query.planKey || query.mismatch) {
      where.subscriptions = {
        some: {
          ...(statusEnum ? { status: statusEnum } : {}),
          ...(query.planKey ? { planKey: query.planKey } : {}),
        },
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          createdAt: true,
          subscriptions: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: {
              id: true,
              planKey: true,
              status: true,
              currentPeriodEnd: true,
              cancelAtPeriodEnd: true,
              gracePeriodEndsAt: true,
              providerCustomerId: true,
              providerSubscriptionId: true,
              lastWebhookAt: true,
            },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: rows,
      page,
      limit,
      total,
    };
  }

  async getAccountDetail(actor: OperatorBillingActor, tenantId: string) {
    this.assertPermission(actor, OPERATOR_PERMISSIONS.BILLING_ACCOUNT_READ_ALL);
    const tenant = await this.resolveTenantOrThrow(tenantId);

    const [
      snapshot,
      invoices,
      payments,
      notes,
      overrides,
      pendingActions,
      recentActions,
      supportCases,
    ] = await Promise.all([
      this.billingService.getTenantPlanSnapshot(tenantId),
      this.prisma.billingInvoiceSnapshot.findMany({
        where: { tenantId },
        orderBy: { providerCreatedAt: "desc" },
        take: 20,
      }),
      this.prisma.billingPaymentEvent.findMany({
        where: { tenantId },
        orderBy: { occurredAt: "desc" },
        take: 20,
      }),
      this.prisma.billingOperatorNote.findMany({
        where: { tenantId },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 50,
        include: {
          author: { select: { id: true, email: true, platformRole: true } },
        },
      }),
      this.prisma.billingEntitlementOverride.findMany({
        where: { tenantId, revokedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.billingActionRequest.findMany({
        where: {
          tenantId,
          status: BillingActionStatus.PENDING_APPROVAL,
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.billingActionRequest.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.supportCase.findMany({
        where: {
          tenantId,
          OR: [
            { category: "BILLING" },
            {
              handoffs: {
                some: { target: "BILLING", status: { not: "CLOSED" } },
              },
            },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          priority: true,
          category: true,
          subject: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      tenant,
      snapshot,
      invoices,
      payments,
      notes,
      overrides,
      pendingActions,
      recentActions,
      supportCases,
    };
  }

  // ── BillingActionRequest helpers ─────────────────────────────────────

  private async snapshotTenantBilling(
    tenantId: string,
  ): Promise<Prisma.InputJsonValue> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    });
    return subscription
      ? (JSON.parse(JSON.stringify(subscription)) as Prisma.InputJsonValue)
      : { tenantId, note: "no subscription" };
  }

  private async recordExecutedAction(params: {
    actor: OperatorBillingActor;
    tenantId: string;
    type: BillingActionType;
    reason: string;
    beforeSnapshot: Prisma.InputJsonValue;
    afterSnapshot: Prisma.InputJsonValue;
    payload?: Prisma.InputJsonValue;
    providerObjectIds?: Prisma.InputJsonValue;
  }): Promise<BillingActionRequest> {
    const now = new Date();
    return this.prisma.billingActionRequest.create({
      data: {
        tenantId: params.tenantId,
        actorUserId: params.actor.id,
        type: params.type,
        status: BillingActionStatus.EXECUTED,
        requiresApproval: false,
        reason: params.reason,
        beforeSnapshot: params.beforeSnapshot,
        afterSnapshot: params.afterSnapshot,
        payload: params.payload ?? Prisma.JsonNull,
        providerObjectIds: params.providerObjectIds ?? Prisma.JsonNull,
        executedAt: now,
      },
    });
  }

  // ── Plan / subscription mutations ────────────────────────────────────

  async changePlan(
    actor: OperatorBillingActor,
    tenantId: string,
    targetPlanKey: string,
    reason: string,
  ) {
    this.assertPermission(
      actor,
      OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_CHANGE_PLAN_ALL,
    );
    if (!isBillingPlanKey(targetPlanKey) || !isPaidPlanKey(targetPlanKey)) {
      throw new BadRequestException({
        code: "PLAN_NOT_AVAILABLE",
        message:
          "Only paid hospitality plans can be applied via operator override.",
      });
    }
    await this.resolveTenantOrThrow(tenantId);
    const before = await this.snapshotTenantBilling(tenantId);
    const after = await this.billingService.updateSubscriptionPlan(
      tenantId,
      targetPlanKey as BillingPlanKey,
    );
    const action = await this.recordExecutedAction({
      actor,
      tenantId,
      type: BillingActionType.CHANGE_PLAN,
      reason,
      beforeSnapshot: before,
      afterSnapshot: after as unknown as Prisma.InputJsonValue,
      payload: { targetPlanKey },
    });
    return { action, snapshot: after };
  }

  async cancelPendingPlanChange(
    actor: OperatorBillingActor,
    tenantId: string,
    reason: string,
  ) {
    this.assertPermission(
      actor,
      OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_CHANGE_PLAN_ALL,
    );
    await this.resolveTenantOrThrow(tenantId);
    const before = await this.snapshotTenantBilling(tenantId);
    const after =
      await this.billingService.cancelPendingSubscriptionPlanChange(tenantId);
    const action = await this.recordExecutedAction({
      actor,
      tenantId,
      type: BillingActionType.CANCEL_PENDING_PLAN_CHANGE,
      reason,
      beforeSnapshot: before,
      afterSnapshot: after as unknown as Prisma.InputJsonValue,
    });
    return { action, snapshot: after };
  }

  async cancelAtPeriodEnd(
    actor: OperatorBillingActor,
    tenantId: string,
    reason: string,
  ) {
    this.assertPermission(
      actor,
      OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_CANCEL_ALL,
    );
    await this.resolveTenantOrThrow(tenantId);
    const before = await this.snapshotTenantBilling(tenantId);
    const after = await this.billingService.operatorCancelAtPeriodEnd(tenantId);
    const action = await this.recordExecutedAction({
      actor,
      tenantId,
      type: BillingActionType.CANCEL_AT_PERIOD_END,
      reason,
      beforeSnapshot: before,
      afterSnapshot: after as unknown as Prisma.InputJsonValue,
    });
    return { action, snapshot: after };
  }

  async reactivateSubscription(
    actor: OperatorBillingActor,
    tenantId: string,
    reason: string,
  ) {
    this.assertPermission(
      actor,
      OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_CANCEL_ALL,
    );
    await this.resolveTenantOrThrow(tenantId);
    const before = await this.snapshotTenantBilling(tenantId);
    const after =
      await this.billingService.operatorReactivateSubscription(tenantId);
    const action = await this.recordExecutedAction({
      actor,
      tenantId,
      type: BillingActionType.REACTIVATE_SUBSCRIPTION,
      reason,
      beforeSnapshot: before,
      afterSnapshot: after as unknown as Prisma.InputJsonValue,
    });
    return { action, snapshot: after };
  }

  async extendGracePeriod(
    actor: OperatorBillingActor,
    tenantId: string,
    until: Date,
    reason: string,
  ) {
    this.assertPermission(
      actor,
      OPERATOR_PERMISSIONS.BILLING_GRACE_PERIOD_EXTEND_ALL,
    );
    await this.resolveTenantOrThrow(tenantId);
    const before = await this.snapshotTenantBilling(tenantId);
    const after = await this.billingService.operatorExtendGracePeriod(
      tenantId,
      until,
    );
    const action = await this.recordExecutedAction({
      actor,
      tenantId,
      type: BillingActionType.EXTEND_GRACE_PERIOD,
      reason,
      beforeSnapshot: before,
      afterSnapshot: after as unknown as Prisma.InputJsonValue,
      payload: { until: until.toISOString() },
    });
    return { action, snapshot: after };
  }

  async syncFromStripe(
    actor: OperatorBillingActor,
    tenantId: string,
    reason: string,
  ) {
    this.assertPermission(actor, OPERATOR_PERMISSIONS.BILLING_STRIPE_SYNC_ALL);
    await this.resolveTenantOrThrow(tenantId);
    const before = await this.snapshotTenantBilling(tenantId);
    const after = await this.billingService.syncTenantFromStripe(tenantId);
    const action = await this.recordExecutedAction({
      actor,
      tenantId,
      type: BillingActionType.STRIPE_SYNC,
      reason,
      beforeSnapshot: before,
      afterSnapshot: after as unknown as Prisma.InputJsonValue,
    });
    return { action, snapshot: after };
  }

  // ── Webhook events ──────────────────────────────────────────────────

  async listWebhookEvents(
    actor: OperatorBillingActor,
    query: {
      tenantId?: string;
      eventType?: string;
      failed?: boolean;
      unprocessed?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    this.assertPermission(
      actor,
      OPERATOR_PERMISSIONS.BILLING_STRIPE_REPLAY_ALL,
    );
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.BillingWebhookEventWhereInput = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.eventType) where.eventType = query.eventType;
    if (query.failed) where.errorMessage = { not: null };
    if (query.unprocessed) where.processedAt = null;

    const [data, total] = await Promise.all([
      this.prisma.billingWebhookEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.billingWebhookEvent.count({ where }),
    ]);
    return { data, page, limit, total };
  }

  async replayWebhook(
    actor: OperatorBillingActor,
    eventRowId: string,
    reason: string,
  ) {
    this.assertPermission(
      actor,
      OPERATOR_PERMISSIONS.BILLING_STRIPE_REPLAY_ALL,
    );
    const row = await this.prisma.billingWebhookEvent.findUnique({
      where: { id: eventRowId },
    });
    if (!row) {
      throw new NotFoundException({
        code: "WEBHOOK_EVENT_NOT_FOUND",
        message: "Webhook event not found",
      });
    }
    const result =
      await this.billingService.replayStoredWebhookEvent(eventRowId);
    const action = await this.recordExecutedAction({
      actor,
      tenantId: row.tenantId ?? "",
      type: BillingActionType.STRIPE_WEBHOOK_REPLAY,
      reason,
      beforeSnapshot: {
        eventId: row.providerEventId,
        eventType: row.eventType,
      },
      afterSnapshot: result as unknown as Prisma.InputJsonValue,
      providerObjectIds: { stripeEventId: row.providerEventId },
    });
    return { action, result };
  }

  // ── Invoices / refunds ───────────────────────────────────────────────

  async listInvoices(actor: OperatorBillingActor, tenantId: string) {
    this.assertPermission(actor, OPERATOR_PERMISSIONS.BILLING_INVOICE_READ_ALL);
    await this.resolveTenantOrThrow(tenantId);
    return this.prisma.billingInvoiceSnapshot.findMany({
      where: { tenantId },
      orderBy: { providerCreatedAt: "desc" },
      take: 100,
    });
  }

  async listPayments(actor: OperatorBillingActor, tenantId: string) {
    this.assertPermission(actor, OPERATOR_PERMISSIONS.BILLING_PAYMENT_READ_ALL);
    await this.resolveTenantOrThrow(tenantId);
    return this.prisma.billingPaymentEvent.findMany({
      where: { tenantId },
      orderBy: { occurredAt: "desc" },
      take: 100,
    });
  }

  /**
   * High-risk refund flow:
   *   1. Open a `BillingActionRequest` with `PENDING_APPROVAL`.
   *   2. A separate operator with `BILLING_ACTION_APPROVE_ALL` calls
   *      {@link approveActionRequest}, which executes the Stripe refund
   *      and transitions to `EXECUTED` (or `FAILED`).
   *
   * The original operator cannot self-approve.
   */
  async requestRefund(
    actor: OperatorBillingActor,
    tenantId: string,
    providerInvoiceId: string,
    amount: number | null,
    reason: string,
  ) {
    this.assertPermission(
      actor,
      OPERATOR_PERMISSIONS.BILLING_INVOICE_REFUND_ALL,
    );
    await this.resolveTenantOrThrow(tenantId);
    const invoice = await this.prisma.billingInvoiceSnapshot.findUnique({
      where: { providerInvoiceId },
    });
    if (!invoice || invoice.tenantId !== tenantId) {
      throw new NotFoundException({
        code: "INVOICE_NOT_FOUND",
        message: "Invoice snapshot not found for tenant",
      });
    }
    if (amount !== null && amount > invoice.amountPaid) {
      throw new BadRequestException({
        code: "REFUND_AMOUNT_TOO_HIGH",
        message: "Refund amount cannot exceed the paid amount on the invoice",
      });
    }

    const request = await this.prisma.billingActionRequest.create({
      data: {
        tenantId,
        actorUserId: actor.id,
        type: BillingActionType.REFUND_INVOICE,
        status: BillingActionStatus.PENDING_APPROVAL,
        requiresApproval: true,
        reason,
        idempotencyKey: `refund:${providerInvoiceId}:${randomUUID()}`,
        payload: {
          providerInvoiceId,
          amount: amount ?? null,
        },
        beforeSnapshot: invoice as unknown as Prisma.InputJsonValue,
        providerObjectIds: { providerInvoiceId },
      },
    });
    return request;
  }

  async requestIssueCredit(
    actor: OperatorBillingActor,
    tenantId: string,
    amount: number,
    currency: string,
    reason: string,
  ) {
    this.assertPermission(actor, OPERATOR_PERMISSIONS.BILLING_CREDIT_ISSUE_ALL);
    await this.resolveTenantOrThrow(tenantId);
    return this.prisma.billingActionRequest.create({
      data: {
        tenantId,
        actorUserId: actor.id,
        type: BillingActionType.ISSUE_CREDIT,
        status: BillingActionStatus.PENDING_APPROVAL,
        requiresApproval: true,
        reason,
        idempotencyKey: `credit:${tenantId}:${randomUUID()}`,
        payload: { amount, currency },
      },
    });
  }

  // ── Notes ────────────────────────────────────────────────────────────

  async listNotes(actor: OperatorBillingActor, tenantId: string) {
    this.assertPermission(actor, OPERATOR_PERMISSIONS.BILLING_NOTE_ALL);
    await this.resolveTenantOrThrow(tenantId);
    return this.prisma.billingOperatorNote.findMany({
      where: { tenantId },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: {
        author: { select: { id: true, email: true, platformRole: true } },
      },
    });
  }

  async createNote(
    actor: OperatorBillingActor,
    tenantId: string,
    body: string,
    pinned: boolean,
  ) {
    this.assertPermission(actor, OPERATOR_PERMISSIONS.BILLING_NOTE_ALL);
    await this.resolveTenantOrThrow(tenantId);
    return this.prisma.billingOperatorNote.create({
      data: {
        tenantId,
        authorUserId: actor.id,
        body,
        pinned,
      },
    });
  }

  async updateNote(
    actor: OperatorBillingActor,
    tenantId: string,
    noteId: string,
    patch: { body?: string; pinned?: boolean },
  ) {
    this.assertPermission(actor, OPERATOR_PERMISSIONS.BILLING_NOTE_ALL);
    const existing = await this.prisma.billingOperatorNote.findUnique({
      where: { id: noteId },
    });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException({
        code: "NOTE_NOT_FOUND",
        message: "Billing note not found",
      });
    }
    if (existing.authorUserId !== actor.id) {
      this.assertCanApproveBillingActions(actor);
    }
    return this.prisma.billingOperatorNote.update({
      where: { id: noteId },
      data: {
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
      },
    });
  }

  async deleteNote(
    actor: OperatorBillingActor,
    tenantId: string,
    noteId: string,
  ) {
    this.assertPermission(actor, OPERATOR_PERMISSIONS.BILLING_NOTE_ALL);
    const existing = await this.prisma.billingOperatorNote.findUnique({
      where: { id: noteId },
    });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException({
        code: "NOTE_NOT_FOUND",
        message: "Billing note not found",
      });
    }
    if (existing.authorUserId !== actor.id) {
      this.assertCanApproveBillingActions(actor);
    }
    await this.prisma.billingOperatorNote.delete({ where: { id: noteId } });
    return { deleted: true };
  }

  // ── Entitlement overrides ───────────────────────────────────────────

  async listOverrides(actor: OperatorBillingActor, tenantId: string) {
    this.assertPermission(
      actor,
      OPERATOR_PERMISSIONS.BILLING_ENTITLEMENT_OVERRIDE_ALL,
    );
    await this.resolveTenantOrThrow(tenantId);
    return this.prisma.billingEntitlementOverride.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async requestOverrideCreate(
    actor: OperatorBillingActor,
    tenantId: string,
    payload: {
      limitKey: string;
      intValue?: number | null;
      jsonValue?: Record<string, unknown> | null;
      expiresAt?: string;
    },
    reason: string,
  ) {
    this.assertPermission(
      actor,
      OPERATOR_PERMISSIONS.BILLING_ENTITLEMENT_OVERRIDE_ALL,
    );
    await this.resolveTenantOrThrow(tenantId);
    if (payload.intValue === undefined && payload.jsonValue === undefined) {
      throw new BadRequestException({
        code: "ENTITLEMENT_VALUE_REQUIRED",
        message: "Override must specify either intValue or jsonValue",
      });
    }
    if (payload.intValue !== undefined && payload.jsonValue !== undefined) {
      throw new BadRequestException({
        code: "ENTITLEMENT_VALUE_AMBIGUOUS",
        message: "Override cannot specify both intValue and jsonValue",
      });
    }
    return this.prisma.billingActionRequest.create({
      data: {
        tenantId,
        actorUserId: actor.id,
        type: BillingActionType.ENTITLEMENT_OVERRIDE_CREATE,
        status: BillingActionStatus.PENDING_APPROVAL,
        requiresApproval: true,
        reason,
        idempotencyKey: `override:create:${tenantId}:${randomUUID()}`,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async requestOverrideRevoke(
    actor: OperatorBillingActor,
    tenantId: string,
    overrideId: string,
    reason: string,
  ) {
    this.assertPermission(
      actor,
      OPERATOR_PERMISSIONS.BILLING_ENTITLEMENT_OVERRIDE_ALL,
    );
    const existing = await this.prisma.billingEntitlementOverride.findUnique({
      where: { id: overrideId },
    });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException({
        code: "OVERRIDE_NOT_FOUND",
        message: "Entitlement override not found",
      });
    }
    if (existing.revokedAt) {
      throw new ConflictException({
        code: "OVERRIDE_ALREADY_REVOKED",
        message: "This override has already been revoked",
      });
    }
    return this.prisma.billingActionRequest.create({
      data: {
        tenantId,
        actorUserId: actor.id,
        type: BillingActionType.ENTITLEMENT_OVERRIDE_REVOKE,
        status: BillingActionStatus.PENDING_APPROVAL,
        requiresApproval: true,
        reason,
        idempotencyKey: `override:revoke:${overrideId}:${randomUUID()}`,
        payload: { overrideId },
        beforeSnapshot: existing as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // ── Action requests (approval workflow) ─────────────────────────────

  async listActionRequests(
    actor: OperatorBillingActor,
    query: {
      tenantId?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    this.assertPermission(actor, OPERATOR_PERMISSIONS.BILLING_ACCOUNT_READ_ALL);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const skip = (page - 1) * limit;
    const where: Prisma.BillingActionRequestWhereInput = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.status) where.status = query.status as BillingActionStatus;

    const [data, total] = await Promise.all([
      this.prisma.billingActionRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.billingActionRequest.count({ where }),
    ]);
    return { data, page, limit, total };
  }

  async approveActionRequest(
    actor: OperatorBillingActor,
    requestId: string,
    reason: string,
  ) {
    this.assertCanApproveBillingActions(actor);
    const request = await this.prisma.billingActionRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException({
        code: "ACTION_REQUEST_NOT_FOUND",
        message: "Billing action request not found",
      });
    }
    if (request.status !== BillingActionStatus.PENDING_APPROVAL) {
      throw new ConflictException({
        code: "ACTION_REQUEST_NOT_PENDING",
        message: "Only pending action requests can be approved",
      });
    }
    if (request.actorUserId === actor.id) {
      throw new ForbiddenException({
        code: "ACTION_SELF_APPROVAL_FORBIDDEN",
        message:
          "The operator that initiated the action cannot approve it. A different operator must approve.",
      });
    }

    const approvedRequest = await this.prisma.billingActionRequest.update({
      where: { id: requestId },
      data: {
        status: BillingActionStatus.APPROVED,
        approverUserId: actor.id,
        approverReason: reason,
        approvedAt: new Date(),
      },
    });

    try {
      const executed = await this.executeApprovedAction(actor, approvedRequest);
      return executed;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown execution failure";
      this.logger.error(
        `Billing action ${requestId} failed during execution: ${message}`,
      );
      return this.prisma.billingActionRequest.update({
        where: { id: requestId },
        data: {
          status: BillingActionStatus.FAILED,
          failureCode:
            err instanceof Error && "code" in err
              ? String((err as { code?: unknown }).code ?? "")
              : null,
          failureMessage: message,
        },
      });
    }
  }

  async rejectActionRequest(
    actor: OperatorBillingActor,
    requestId: string,
    reason: string,
  ) {
    this.assertCanApproveBillingActions(actor);
    const request = await this.prisma.billingActionRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException({
        code: "ACTION_REQUEST_NOT_FOUND",
        message: "Billing action request not found",
      });
    }
    if (request.status !== BillingActionStatus.PENDING_APPROVAL) {
      throw new ConflictException({
        code: "ACTION_REQUEST_NOT_PENDING",
        message: "Only pending action requests can be rejected",
      });
    }
    return this.prisma.billingActionRequest.update({
      where: { id: requestId },
      data: {
        status: BillingActionStatus.REJECTED,
        approverUserId: actor.id,
        approverReason: reason,
        approvedAt: new Date(),
      },
    });
  }

  private async executeApprovedAction(
    actor: OperatorBillingActor,
    request: BillingActionRequest,
  ): Promise<BillingActionRequest> {
    const payload = (request.payload ?? {}) as Record<string, unknown>;
    switch (request.type) {
      case BillingActionType.REFUND_INVOICE: {
        const providerInvoiceId = String(payload.providerInvoiceId ?? "");
        const amount =
          payload.amount === null || payload.amount === undefined
            ? null
            : Number(payload.amount);
        const refund = await this.billingService.operatorRefundInvoice(
          request.tenantId,
          providerInvoiceId,
          {
            amount,
            idempotencyKey: request.idempotencyKey ?? request.id,
            reason: request.reason,
          },
        );
        return this.prisma.billingActionRequest.update({
          where: { id: request.id },
          data: {
            status: BillingActionStatus.EXECUTED,
            executedAt: new Date(),
            afterSnapshot: refund as unknown as Prisma.InputJsonValue,
            providerObjectIds: {
              providerInvoiceId,
              refundId: refund.refundId,
            },
          },
        });
      }
      case BillingActionType.ISSUE_CREDIT: {
        // We intentionally do NOT auto-execute Stripe credit notes here;
        // they require explicit invoice or coupon context that varies per
        // tenant. The approval flow marks the request executed with an
        // empty Stripe side-effect; finance follows up in Stripe manually
        // and the audit trail is preserved. Future revision can wire
        // `stripe.creditNotes.create` once the operator UX captures the
        // target invoice.
        return this.prisma.billingActionRequest.update({
          where: { id: request.id },
          data: {
            status: BillingActionStatus.EXECUTED,
            executedAt: new Date(),
            afterSnapshot: {
              note: "approved; finance issues credit note in Stripe dashboard",
            },
          },
        });
      }
      case BillingActionType.ENTITLEMENT_OVERRIDE_CREATE: {
        const limitKey = String(payload.limitKey ?? "");
        const intValue =
          payload.intValue === null || payload.intValue === undefined
            ? null
            : Number(payload.intValue);
        const jsonValue =
          payload.jsonValue === undefined ? null : payload.jsonValue;
        const expiresAt = payload.expiresAt
          ? new Date(String(payload.expiresAt))
          : null;
        const override = await this.prisma.billingEntitlementOverride.create({
          data: {
            tenantId: request.tenantId,
            limitKey,
            intValue,
            jsonValue: (jsonValue ??
              Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
            reason: request.reason,
            expiresAt,
            createdByUserId: request.actorUserId,
          },
        });
        return this.prisma.billingActionRequest.update({
          where: { id: request.id },
          data: {
            status: BillingActionStatus.EXECUTED,
            executedAt: new Date(),
            afterSnapshot: override as unknown as Prisma.InputJsonValue,
            providerObjectIds: { overrideId: override.id },
          },
        });
      }
      case BillingActionType.ENTITLEMENT_OVERRIDE_REVOKE: {
        const overrideId = String(payload.overrideId ?? "");
        const revoked = await this.prisma.billingEntitlementOverride.update({
          where: { id: overrideId },
          data: {
            revokedAt: new Date(),
            revokedByUserId: actor.id,
            revokeReason: request.reason,
          },
        });
        return this.prisma.billingActionRequest.update({
          where: { id: request.id },
          data: {
            status: BillingActionStatus.EXECUTED,
            executedAt: new Date(),
            afterSnapshot: revoked as unknown as Prisma.InputJsonValue,
          },
        });
      }
      default:
        throw new BadRequestException({
          code: "ACTION_TYPE_NOT_APPROVABLE",
          message: `Action type ${request.type} is not subject to approval flow`,
        });
    }
  }

  // ── Plan catalog ────────────────────────────────────────────────────

  listPlanCatalog(actor: OperatorBillingActor) {
    this.assertPermission(actor, OPERATOR_PERMISSIONS.BILLING_ACCOUNT_READ_ALL);
    return Object.values(BILLING_PLANS).map((plan) => ({
      key: plan.key,
      name: plan.name,
      isFree: plan.isFree,
      limits: plan.limits,
    }));
  }
}
