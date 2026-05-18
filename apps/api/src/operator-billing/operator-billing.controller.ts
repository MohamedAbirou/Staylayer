import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request } from "express";
import {
  OPERATOR_PERMISSIONS,
  getPermissionsForRole,
} from "../auth/operator/permissions/operator-permissions.registry";
import { OperatorJwtAuthGuard } from "../auth/operator/guards/operator-jwt-auth.guard";
import { OperatorPermissionGuard } from "../auth/operator/permissions/operator-permission.guard";
import { RequireOperatorPermissions } from "../auth/operator/permissions/require-operator-permissions.decorator";
import { OperatorAuditInterceptor } from "../auth/operator/audit/operator-audit.interceptor";
import { OperatorAudit } from "../auth/operator/audit/operator-audit.decorator";
import {
  OPERATOR_JWT_AUDIENCE,
  type OperatorAuthenticatedRequestUser,
} from "../auth/operator/operator-auth.types";
import {
  OperatorBillingService,
  type OperatorBillingActor,
} from "./operator-billing.service";
import {
  ApproveActionRequestDto,
  CancelAtPeriodEndDto,
  CancelPendingPlanChangeDto,
  ChangePlanDto,
  CreateBillingNoteDto,
  CreateEntitlementOverrideDto,
  ExtendGracePeriodDto,
  IssueCreditDto,
  ListBillingAccountsQueryDto,
  ListBillingActionRequestsQueryDto,
  ListWebhookEventsQueryDto,
  ReactivateSubscriptionDto,
  RefundInvoiceDto,
  RejectActionRequestDto,
  ReplayWebhookDto,
  RevokeEntitlementOverrideDto,
  SyncFromStripeDto,
  UpdateBillingNoteDto,
} from "./dto/operator-billing.dto";

/**
 * Phase 7 — billing control HTTP surface.
 *
 * Every mutation:
 *  - is permission-guarded by `OperatorPermissionGuard` +
 *    `@RequireOperatorPermissions(...)`.
 *  - declares `@OperatorAudit` so the operator audit interceptor writes
 *    a row to `operator_audit_logs` after the call succeeds. Sensitive
 *    actions (`sensitive: true`) additionally require a non-empty
 *    `reason` in the body — the interceptor rejects with 400 otherwise.
 *  - delegates to `OperatorBillingService`, which records a parallel
 *    `BillingActionRequest` row with before/after snapshots and (for
 *    high-risk actions) routes through the approval workflow.
 */
@Controller("operator/billing")
@UseGuards(OperatorJwtAuthGuard)
@UseInterceptors(OperatorAuditInterceptor)
export class OperatorBillingController {
  constructor(private readonly service: OperatorBillingService) {}

  // ── Overview / catalog ──────────────────────────────────────────────

  @Get("overview")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_ACCOUNT_READ_ALL)
  async overview(@Req() req: Request) {
    return this.service.getOverview(this.requireActor(req));
  }

  @Get("plans")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_ACCOUNT_READ_ALL)
  async plans(@Req() req: Request) {
    return this.service.listPlanCatalog(this.requireActor(req));
  }

  // ── Account listing / detail ────────────────────────────────────────

  @Get("accounts")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_ACCOUNT_READ_ALL)
  async listAccounts(
    @Req() req: Request,
    @Query() query: ListBillingAccountsQueryDto,
  ) {
    return this.service.listAccounts(this.requireActor(req), query);
  }

  @Get("accounts/:tenantId")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_ACCOUNT_READ_ALL)
  async accountDetail(
    @Req() req: Request,
    @Param("tenantId") tenantId: string,
  ) {
    return this.service.getAccountDetail(this.requireActor(req), tenantId);
  }

  // ── Plan / subscription mutations ───────────────────────────────────

  @Post("accounts/:tenantId/plan")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(
    OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_CHANGE_PLAN_ALL,
  )
  @OperatorAudit({
    action: "billing.subscription.change_plan",
    targetType: "tenant",
    targetIdParam: "tenantId",
    sensitive: true,
  })
  async changePlan(
    @Req() req: Request,
    @Param("tenantId") tenantId: string,
    @Body() body: ChangePlanDto,
  ) {
    return this.service.changePlan(
      this.requireActor(req),
      tenantId,
      body.targetPlanKey,
      body.reason,
    );
  }

  @Delete("accounts/:tenantId/pending-plan")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(
    OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_CHANGE_PLAN_ALL,
  )
  @OperatorAudit({
    action: "billing.subscription.cancel_pending_plan_change",
    targetType: "tenant",
    targetIdParam: "tenantId",
    sensitive: true,
  })
  async cancelPendingPlanChange(
    @Req() req: Request,
    @Param("tenantId") tenantId: string,
    @Body() body: CancelPendingPlanChangeDto,
  ) {
    return this.service.cancelPendingPlanChange(
      this.requireActor(req),
      tenantId,
      body.reason,
    );
  }

  @Post("accounts/:tenantId/cancel")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(
    OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_CANCEL_ALL,
  )
  @OperatorAudit({
    action: "billing.subscription.cancel_at_period_end",
    targetType: "tenant",
    targetIdParam: "tenantId",
    sensitive: true,
  })
  async cancelAtPeriodEnd(
    @Req() req: Request,
    @Param("tenantId") tenantId: string,
    @Body() body: CancelAtPeriodEndDto,
  ) {
    return this.service.cancelAtPeriodEnd(
      this.requireActor(req),
      tenantId,
      body.reason,
    );
  }

  @Post("accounts/:tenantId/reactivate")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(
    OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_CANCEL_ALL,
  )
  @OperatorAudit({
    action: "billing.subscription.reactivate",
    targetType: "tenant",
    targetIdParam: "tenantId",
    sensitive: true,
  })
  async reactivate(
    @Req() req: Request,
    @Param("tenantId") tenantId: string,
    @Body() body: ReactivateSubscriptionDto,
  ) {
    return this.service.reactivateSubscription(
      this.requireActor(req),
      tenantId,
      body.reason,
    );
  }

  @Post("accounts/:tenantId/grace-period")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(
    OPERATOR_PERMISSIONS.BILLING_GRACE_PERIOD_EXTEND_ALL,
  )
  @OperatorAudit({
    action: "billing.grace_period.extend",
    targetType: "tenant",
    targetIdParam: "tenantId",
    sensitive: true,
  })
  async extendGracePeriod(
    @Req() req: Request,
    @Param("tenantId") tenantId: string,
    @Body() body: ExtendGracePeriodDto,
  ) {
    return this.service.extendGracePeriod(
      this.requireActor(req),
      tenantId,
      new Date(body.until),
      body.reason,
    );
  }

  @Post("accounts/:tenantId/sync")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_STRIPE_SYNC_ALL)
  @OperatorAudit({
    action: "billing.stripe.sync",
    targetType: "tenant",
    targetIdParam: "tenantId",
    sensitive: true,
  })
  async syncFromStripe(
    @Req() req: Request,
    @Param("tenantId") tenantId: string,
    @Body() body: SyncFromStripeDto,
  ) {
    return this.service.syncFromStripe(
      this.requireActor(req),
      tenantId,
      body.reason,
    );
  }

  // ── Invoices / payments ─────────────────────────────────────────────

  @Get("accounts/:tenantId/invoices")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_INVOICE_READ_ALL)
  async listInvoices(@Req() req: Request, @Param("tenantId") tenantId: string) {
    return this.service.listInvoices(this.requireActor(req), tenantId);
  }

  @Get("accounts/:tenantId/payments")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_PAYMENT_READ_ALL)
  async listPayments(@Req() req: Request, @Param("tenantId") tenantId: string) {
    return this.service.listPayments(this.requireActor(req), tenantId);
  }

  @Post("accounts/:tenantId/invoices/:invoiceId/refund")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_INVOICE_REFUND_ALL)
  @OperatorAudit({
    action: "billing.invoice.refund.request",
    targetType: "invoice",
    targetIdParam: "invoiceId",
    sensitive: true,
  })
  async requestRefund(
    @Req() req: Request,
    @Param("tenantId") tenantId: string,
    @Param("invoiceId") invoiceId: string,
    @Body() body: RefundInvoiceDto,
  ) {
    return this.service.requestRefund(
      this.requireActor(req),
      tenantId,
      invoiceId,
      body.amount ?? null,
      body.reason,
    );
  }

  @Post("accounts/:tenantId/credits")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_CREDIT_ISSUE_ALL)
  @OperatorAudit({
    action: "billing.credit.issue.request",
    targetType: "tenant",
    targetIdParam: "tenantId",
    sensitive: true,
  })
  async requestCredit(
    @Req() req: Request,
    @Param("tenantId") tenantId: string,
    @Body() body: IssueCreditDto,
  ) {
    return this.service.requestIssueCredit(
      this.requireActor(req),
      tenantId,
      body.amount,
      body.currency,
      body.reason,
    );
  }

  // ── Notes ───────────────────────────────────────────────────────────

  @Get("accounts/:tenantId/notes")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_NOTE_ALL)
  async listNotes(@Req() req: Request, @Param("tenantId") tenantId: string) {
    return this.service.listNotes(this.requireActor(req), tenantId);
  }

  @Post("accounts/:tenantId/notes")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_NOTE_ALL)
  @OperatorAudit({
    action: "billing.note.create",
    targetType: "tenant",
    targetIdParam: "tenantId",
  })
  async createNote(
    @Req() req: Request,
    @Param("tenantId") tenantId: string,
    @Body() body: CreateBillingNoteDto,
  ) {
    return this.service.createNote(
      this.requireActor(req),
      tenantId,
      body.body,
      body.pinned ?? false,
    );
  }

  @Patch("accounts/:tenantId/notes/:noteId")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_NOTE_ALL)
  @OperatorAudit({
    action: "billing.note.update",
    targetType: "billing_note",
    targetIdParam: "noteId",
  })
  async updateNote(
    @Req() req: Request,
    @Param("tenantId") tenantId: string,
    @Param("noteId") noteId: string,
    @Body() body: UpdateBillingNoteDto,
  ) {
    return this.service.updateNote(
      this.requireActor(req),
      tenantId,
      noteId,
      body,
    );
  }

  @Delete("accounts/:tenantId/notes/:noteId")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_NOTE_ALL)
  @OperatorAudit({
    action: "billing.note.delete",
    targetType: "billing_note",
    targetIdParam: "noteId",
  })
  async deleteNote(
    @Req() req: Request,
    @Param("tenantId") tenantId: string,
    @Param("noteId") noteId: string,
  ) {
    return this.service.deleteNote(this.requireActor(req), tenantId, noteId);
  }

  // ── Entitlement overrides ───────────────────────────────────────────

  @Get("accounts/:tenantId/overrides")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(
    OPERATOR_PERMISSIONS.BILLING_ENTITLEMENT_OVERRIDE_ALL,
  )
  async listOverrides(
    @Req() req: Request,
    @Param("tenantId") tenantId: string,
  ) {
    return this.service.listOverrides(this.requireActor(req), tenantId);
  }

  @Post("accounts/:tenantId/overrides")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(
    OPERATOR_PERMISSIONS.BILLING_ENTITLEMENT_OVERRIDE_ALL,
  )
  @OperatorAudit({
    action: "billing.entitlement.override.request",
    targetType: "tenant",
    targetIdParam: "tenantId",
    sensitive: true,
  })
  async requestOverride(
    @Req() req: Request,
    @Param("tenantId") tenantId: string,
    @Body() body: CreateEntitlementOverrideDto,
  ) {
    return this.service.requestOverrideCreate(
      this.requireActor(req),
      tenantId,
      {
        limitKey: body.limitKey,
        intValue: body.intValue ?? null,
        jsonValue: body.jsonValue ?? null,
        expiresAt: body.expiresAt,
      },
      body.reason,
    );
  }

  @Delete("accounts/:tenantId/overrides/:overrideId")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(
    OPERATOR_PERMISSIONS.BILLING_ENTITLEMENT_OVERRIDE_ALL,
  )
  @OperatorAudit({
    action: "billing.entitlement.override.revoke.request",
    targetType: "billing_override",
    targetIdParam: "overrideId",
    sensitive: true,
  })
  async requestOverrideRevoke(
    @Req() req: Request,
    @Param("tenantId") tenantId: string,
    @Param("overrideId") overrideId: string,
    @Body() body: RevokeEntitlementOverrideDto,
  ) {
    return this.service.requestOverrideRevoke(
      this.requireActor(req),
      tenantId,
      overrideId,
      body.reason,
    );
  }

  // ── Webhooks ────────────────────────────────────────────────────────

  @Get("webhooks")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_STRIPE_REPLAY_ALL)
  async listWebhooks(
    @Req() req: Request,
    @Query() query: ListWebhookEventsQueryDto,
  ) {
    return this.service.listWebhookEvents(this.requireActor(req), query);
  }

  @Post("webhooks/:eventId/replay")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_STRIPE_REPLAY_ALL)
  @OperatorAudit({
    action: "billing.stripe.webhook.replay",
    targetType: "stripe_webhook_event",
    targetIdParam: "eventId",
    sensitive: true,
  })
  async replayWebhook(
    @Req() req: Request,
    @Param("eventId") eventId: string,
    @Body() body: ReplayWebhookDto,
  ) {
    return this.service.replayWebhook(
      this.requireActor(req),
      eventId,
      body.reason,
    );
  }

  // ── Action requests (approval workflow) ─────────────────────────────

  @Get("action-requests")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_ACCOUNT_READ_ALL)
  async listActionRequests(
    @Req() req: Request,
    @Query() query: ListBillingActionRequestsQueryDto,
  ) {
    return this.service.listActionRequests(this.requireActor(req), query);
  }

  @Post("action-requests/:requestId/approve")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_ACTION_APPROVE_ALL)
  @OperatorAudit({
    action: "billing.action.approve",
    targetType: "billing_action_request",
    targetIdParam: "requestId",
    sensitive: true,
  })
  async approve(
    @Req() req: Request,
    @Param("requestId") requestId: string,
    @Body() body: ApproveActionRequestDto,
  ) {
    return this.service.approveActionRequest(
      this.requireActor(req),
      requestId,
      body.reason,
    );
  }

  @Post("action-requests/:requestId/reject")
  @UseGuards(OperatorPermissionGuard)
  @RequireOperatorPermissions(OPERATOR_PERMISSIONS.BILLING_ACTION_APPROVE_ALL)
  @OperatorAudit({
    action: "billing.action.reject",
    targetType: "billing_action_request",
    targetIdParam: "requestId",
    sensitive: true,
  })
  async reject(
    @Req() req: Request,
    @Param("requestId") requestId: string,
    @Body() body: RejectActionRequestDto,
  ) {
    return this.service.rejectActionRequest(
      this.requireActor(req),
      requestId,
      body.reason,
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private requireActor(req: Request): OperatorBillingActor {
    const user = req.user as OperatorAuthenticatedRequestUser | undefined;
    if (!user || user.aud !== OPERATOR_JWT_AUDIENCE) {
      throw new UnauthorizedException({
        code: "OPERATOR_UNAUTHENTICATED",
        message: "Operator authentication is required.",
      });
    }
    return {
      id: user.id,
      email: user.email,
      platformRole: user.platformRole,
      permissions: getPermissionsForRole(user.platformRole),
    };
  }
}
