import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  NotificationCategory,
  Prisma,
  SiteStatus,
  Subscription,
  SubscriptionStatus,
  TenantMembershipRole,
} from "@prisma/client";
import Stripe = require("stripe");
import { TransactionalEmailService } from "../mail/transactional-email.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  BILLING_DEFAULT_PLAN_KEY,
  BILLING_ENFORCEMENT_POLICY,
  BILLING_PLANS,
  BILLING_PROVIDER,
  compareBillingPlanRank,
  getBillingPlan,
  isBillingPlanKey,
  isPaidPlanKey,
} from "./billing-plans";
import {
  AdminSubscriptionListItem,
  BillingPlanChangeDirection,
  BillingPlanKey,
  BillingPlanLimits,
  BillingPublicStatus,
  CreateBillingPortalSessionResult,
  BillingSupportTier,
  BillingUsageTotals,
  CreateCheckoutSessionResult,
  TenantBillingSnapshot,
} from "./billing.types";

type StripeSyncResult = {
  tenantId?: string;
  subscriptionId?: string;
};

type StripeCustomerReference = string | { id: string } | null;

type StripeSubscriptionRecord = {
  id: string;
  customer: StripeCustomerReference;
  metadata?: Record<string, string>;
  status: string;
  items: {
    data: Array<{
      id?: string | null;
      quantity?: number | null;
      price?: {
        id?: string | null;
      } | null;
    }>;
  };
  current_period_start: number | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  pending_update?: unknown;
};

type StripeCheckoutSessionRecord = {
  mode: string | null;
  metadata?: Record<string, string>;
  client_reference_id?: string | null;
  customer: StripeCustomerReference;
};

type StripeWebhookEventRecord = {
  id: string;
  type: string;
  created: number;
  data: {
    object: unknown;
  };
};

type StripeInvoiceRecord = {
  id: string;
  customer: StripeCustomerReference;
  customer_email?: string | null;
  subscription?: string | { id: string } | null;
  metadata?: Record<string, string>;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  amount_paid: number;
  amount_due?: number | null;
  amount_remaining?: number | null;
  total?: number | null;
  currency: string;
  status?: string | null;
  period_start?: number | null;
  period_end?: number | null;
  created?: number | null;
  charge?: string | { id: string } | null;
  payment_intent?: string | { id: string } | null;
};

type StripeSubscriptionUpdateSource = {
  id: string;
  metadata?: Record<string, string>;
  items: {
    data: Array<{
      id?: string | null;
      quantity?: number | null;
      price?: { id?: string | null } | null;
    }>;
  };
};

type StripeSubscriptionItemSource = {
  id?: string | null;
  quantity?: number | null;
  price?: { id?: string | null } | null;
};

type SubscriptionWithPendingPlanChange = Subscription & {
  pendingPlanKey?: string | null;
  pendingPlanEffectiveAt?: Date | null;
  pendingPlanDirection?: string | null;
  providerScheduleId?: string | null;
};

type CheckoutUser = {
  email?: string;
};

const ACTIVE_ADMIN_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
];

const BILLABLE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
];

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripeClient: InstanceType<typeof Stripe> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly transactionalEmailService: TransactionalEmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getTenantPlanSnapshot(
    tenantId: string,
  ): Promise<TenantBillingSnapshot> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Tenant not found",
      });
    }

    const [subscription, usage] = await Promise.all([
      this.findCurrentSubscription(tenantId),
      this.getTenantUsage(tenantId),
    ]);

    if (!subscription) {
      return this.buildFreePlanSnapshot(tenant.id, usage);
    }

    const resolvedSubscription =
      await this.refreshStripeSubscriptionIfNeeded(subscription);

    const planKey = this.getPlanKeyOrThrow(resolvedSubscription.planKey);
    const plan = getBillingPlan(planKey);
    const limits =
      this.parseLimitsSnapshot(resolvedSubscription.limitsSnapshot) ??
      plan.limits;
    const status = this.toPublicStatus(resolvedSubscription.status);
    const pendingPlanChange = this.buildPendingPlanChange(
      resolvedSubscription as SubscriptionWithPendingPlanChange,
    );

    return {
      tenantId: tenant.id,
      planKey,
      planName: plan.name,
      description: plan.description,
      provider: BILLING_PROVIDER,
      status,
      renewsAt: resolvedSubscription.currentPeriodEnd,
      currentPeriodStart: resolvedSubscription.currentPeriodStart,
      gracePeriodEndsAt: resolvedSubscription.gracePeriodEndsAt,
      limits,
      usage,
      source: "stripe",
      providerCustomerId: resolvedSubscription.providerCustomerId,
      providerSubscriptionId: resolvedSubscription.providerSubscriptionId,
      cancelAtPeriodEnd: resolvedSubscription.cancelAtPeriodEnd,
      actions: this.buildActionState(
        status,
        resolvedSubscription.gracePeriodEndsAt,
      ),
      lastWebhookAt: resolvedSubscription.lastWebhookAt,
      subscriptionId: resolvedSubscription.id,
      isFreePlan: plan.isFree,
      pendingPlanChange,
    };
  }

  async createCheckoutSession(
    tenantId: string,
    planKey: BillingPlanKey,
    user: CheckoutUser,
    urls: { successUrl: string; cancelUrl: string },
  ): Promise<CreateCheckoutSessionResult> {
    if (!isPaidPlanKey(planKey)) {
      throw new BadRequestException({
        code: "CHECKOUT_NOT_AVAILABLE_FOR_FREE_PLAN",
        message:
          "Checkout is only available for paid hospitality plans. The Free plan is applied automatically.",
      });
    }

    const plan = getBillingPlan(planKey);
    const priceId = this.getStripePriceId(planKey);
    const stripe = this.getStripeClient();
    const snapshot = await this.getTenantPlanSnapshot(tenantId);

    if (
      snapshot.source === "stripe" &&
      ["active", "trialing", "past_due"].includes(snapshot.status) &&
      snapshot.providerSubscriptionId
    ) {
      throw new ConflictException({
        code: "SUBSCRIPTION_ALREADY_ACTIVE",
        message:
          "An active hospitality subscription already exists for this tenant",
      });
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Tenant not found",
      });
    }

    const customerId = await this.getOrCreateStripeCustomer(tenant, user.email);

    await this.persistCheckoutIntent(tenantId, customerId, planKey);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      client_reference_id: tenantId,
      allow_promotion_codes: true,
      metadata: {
        tenantId,
        planKey,
      },
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: {
          tenantId,
          planKey,
        },
      },
    });

    if (!session.url) {
      throw new InternalServerErrorException({
        code: "CHECKOUT_SESSION_ERROR",
        message: "Stripe did not return a hosted checkout URL",
      });
    }

    return {
      provider: plan.provider,
      sessionId: session.id,
      checkoutUrl: session.url,
      customerId,
      planKey,
    };
  }

  async updateSubscriptionPlan(
    tenantId: string,
    planKey: BillingPlanKey,
  ): Promise<TenantBillingSnapshot> {
    if (!isPaidPlanKey(planKey)) {
      throw new BadRequestException({
        code: "PLAN_CHANGE_NOT_AVAILABLE_FOR_FREE_PLAN",
        message:
          "Stripe-managed subscriptions can only be changed to paid hospitality plans.",
      });
    }

    const snapshot = await this.getTenantPlanSnapshot(tenantId);

    if (snapshot.planKey === planKey) {
      throw new ConflictException({
        code: "PLAN_ALREADY_ACTIVE",
        message: "This hospitality plan is already active for the workspace.",
      });
    }

    if (
      snapshot.source !== "stripe" ||
      !snapshot.providerSubscriptionId ||
      !["active", "trialing", "past_due"].includes(snapshot.status)
    ) {
      throw new ConflictException({
        code: "SUBSCRIPTION_CHANGE_UNAVAILABLE",
        message:
          "A live Stripe subscription is required before the plan can be changed.",
      });
    }

    if (snapshot.status === "past_due") {
      throw new ConflictException({
        code: "SUBSCRIPTION_PAYMENT_REQUIRED",
        message:
          "Resolve the past-due invoice before changing plans. This prevents accidental credits for unpaid time.",
      });
    }

    const stripe = this.getStripeClient();
    const priceId = this.getStripePriceId(planKey);
    const plan = getBillingPlan(planKey);
    const direction = compareBillingPlanRank(snapshot.planKey, planKey);

    if (direction === 0) {
      throw new ConflictException({
        code: "PLAN_ALREADY_ACTIVE",
        message: "This hospitality plan is already active for the workspace.",
      });
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(
      snapshot.providerSubscriptionId,
    );
    const subscriptionItem = stripeSubscription.items.data[0];

    if (!subscriptionItem?.id) {
      throw new ServiceUnavailableException({
        code: "STRIPE_SUBSCRIPTION_ITEM_MISSING",
        message:
          "Stripe did not return a subscription item that can be updated.",
      });
    }

    if (direction < 0) {
      await this.scheduleSubscriptionDowngrade({
        tenantId,
        snapshot,
        targetPlanKey: planKey,
        targetPriceId: priceId,
        stripeSubscription,
        subscriptionItem,
      });

      this.logger.log(
        `Scheduled tenant ${tenantId} subscription downgrade to ${plan.key}`,
      );

      return this.getTenantPlanSnapshot(tenantId);
    }

    if (snapshot.pendingPlanChange?.providerScheduleId) {
      await this.releaseSubscriptionScheduleIfPresent(
        snapshot.pendingPlanChange.providerScheduleId,
        true,
      );
    }

    const updatedSubscription = await stripe.subscriptions.update(
      snapshot.providerSubscriptionId,
      {
        items: [
          {
            id: subscriptionItem.id,
            price: priceId,
            quantity: subscriptionItem.quantity ?? 1,
          },
        ],
        metadata: {
          ...(stripeSubscription.metadata ?? {}),
          tenantId,
          planKey,
          pendingPlanKey: "",
          pendingPlanEffectiveAt: "",
          pendingPlanDirection: "",
        },
        payment_behavior: "pending_if_incomplete",
        proration_behavior: "always_invoice",
      },
    );

    if (this.hasStripePendingUpdate(updatedSubscription)) {
      await this.notifyBillingPaymentActionRequired({
        tenantId,
        planKey,
        reason:
          "Stripe could not collect the prorated upgrade invoice, so the plan was not changed.",
      });

      throw new ConflictException({
        code: "PLAN_CHANGE_PAYMENT_ACTION_REQUIRED",
        message:
          "Stripe could not collect the prorated upgrade invoice. Update the payment method or complete payment before the plan changes.",
      });
    }

    const updatedRecord = this.toStripeSubscriptionRecord(updatedSubscription);

    if (!updatedRecord) {
      throw new InternalServerErrorException({
        code: "STRIPE_SUBSCRIPTION_SYNC_ERROR",
        message: "Stripe returned an unreadable subscription response.",
      });
    }

    await this.syncSubscriptionFromStripe(
      updatedRecord,
      `stripe-local-plan-change:${updatedSubscription.id}:${Date.now()}`,
      Math.floor(Date.now() / 1000),
    );

    if (snapshot.subscriptionId) {
      await this.prisma.subscription.update({
        where: { id: snapshot.subscriptionId },
        data: this.clearPendingPlanChangeData() as unknown as Prisma.SubscriptionUpdateInput,
      });
    }

    this.logger.log(
      `Updated tenant ${tenantId} subscription to ${plan.key} with immediate Stripe proration`,
    );

    return this.getTenantPlanSnapshot(tenantId);
  }

  async cancelPendingSubscriptionPlanChange(
    tenantId: string,
  ): Promise<TenantBillingSnapshot> {
    const snapshot = await this.getTenantPlanSnapshot(tenantId);

    if (!snapshot.subscriptionId || !snapshot.pendingPlanChange) {
      throw new ConflictException({
        code: "NO_PENDING_PLAN_CHANGE",
        message: "There is no scheduled plan change to cancel.",
      });
    }

    if (snapshot.pendingPlanChange.providerScheduleId) {
      await this.releaseSubscriptionScheduleIfPresent(
        snapshot.pendingPlanChange.providerScheduleId,
        true,
      );
    }

    await this.prisma.subscription.update({
      where: { id: snapshot.subscriptionId },
      data: this.clearPendingPlanChangeData() as unknown as Prisma.SubscriptionUpdateInput,
    });

    await this.createBillingPlanChangeNotification({
      tenantId,
      title: "Scheduled plan change canceled",
      body: `${snapshot.planName} remains active for this workspace.`,
      metadata: {
        canceledPlanKey: snapshot.pendingPlanChange.planKey,
      },
    });

    return this.getTenantPlanSnapshot(tenantId);
  }

  private async scheduleSubscriptionDowngrade(input: {
    tenantId: string;
    snapshot: TenantBillingSnapshot;
    targetPlanKey: BillingPlanKey;
    targetPriceId: string;
    stripeSubscription: StripeSubscriptionUpdateSource;
    subscriptionItem: StripeSubscriptionItemSource;
  }): Promise<void> {
    if (!input.snapshot.subscriptionId) {
      throw new ConflictException({
        code: "LOCAL_SUBSCRIPTION_REQUIRED",
        message:
          "The local subscription record is required to schedule a plan change.",
      });
    }

    const currentPriceId = input.subscriptionItem.price?.id;
    const currentPeriodStart = this.toUnixTime(
      input.snapshot.currentPeriodStart,
    );
    const currentPeriodEnd = this.toUnixTime(input.snapshot.renewsAt);

    if (!currentPriceId || !currentPeriodStart || !currentPeriodEnd) {
      throw new ServiceUnavailableException({
        code: "STRIPE_SUBSCRIPTION_PERIOD_MISSING",
        message:
          "Stripe did not return enough billing-period data to schedule this downgrade safely.",
      });
    }

    if (input.snapshot.pendingPlanChange?.providerScheduleId) {
      await this.releaseSubscriptionScheduleIfPresent(
        input.snapshot.pendingPlanChange.providerScheduleId,
        true,
      );
    }

    const stripe = this.getStripeClient();
    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: input.snapshot.providerSubscriptionId!,
    });
    const quantity = input.subscriptionItem.quantity ?? 1;

    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      metadata: {
        tenantId: input.tenantId,
        pendingPlanKey: input.targetPlanKey,
        pendingPlanDirection: "downgrade",
      },
      phases: [
        {
          start_date: currentPeriodStart,
          end_date: currentPeriodEnd,
          items: [{ price: currentPriceId, quantity }],
          metadata: {
            tenantId: input.tenantId,
            planKey: input.snapshot.planKey,
          },
          proration_behavior: "none",
        },
        {
          start_date: currentPeriodEnd,
          iterations: 1,
          items: [{ price: input.targetPriceId, quantity }],
          metadata: {
            tenantId: input.tenantId,
            planKey: input.targetPlanKey,
            previousPlanKey: input.snapshot.planKey,
          },
          proration_behavior: "none",
        },
      ],
      proration_behavior: "none",
    } as never);

    const effectiveAt = input.snapshot.renewsAt;

    if (!effectiveAt) {
      throw new ServiceUnavailableException({
        code: "STRIPE_SUBSCRIPTION_PERIOD_MISSING",
        message: "Stripe did not return a renewal date for this downgrade.",
      });
    }

    await this.prisma.subscription.update({
      where: { id: input.snapshot.subscriptionId },
      data: {
        pendingPlanKey: input.targetPlanKey,
        pendingPlanEffectiveAt: effectiveAt,
        pendingPlanDirection: "downgrade",
        providerScheduleId: schedule.id,
      } as unknown as Prisma.SubscriptionUpdateInput,
    });

    const targetPlan = getBillingPlan(input.targetPlanKey);
    await this.safeSendScheduledPlanChangeEmail({
      tenantId: input.tenantId,
      currentPlanName: input.snapshot.planName,
      targetPlanName: targetPlan.name,
      effectiveAt,
    });
    await this.createBillingPlanChangeNotification({
      tenantId: input.tenantId,
      title: `${targetPlan.name} scheduled`,
      body: `${input.snapshot.planName} remains active until ${effectiveAt.toISOString().slice(0, 10)}. The lower plan starts at renewal with no immediate invoice.`,
      metadata: {
        planKey: input.targetPlanKey,
        previousPlanKey: input.snapshot.planKey,
        effectiveAt: effectiveAt.toISOString(),
      },
    });
  }

  private async releaseSubscriptionScheduleIfPresent(
    scheduleId: string,
    failClosed = false,
  ): Promise<void> {
    try {
      await this.getStripeClient().subscriptionSchedules.release(scheduleId);
    } catch (error) {
      if (failClosed) {
        throw new ServiceUnavailableException({
          code: "STRIPE_SCHEDULE_RELEASE_FAILED",
          message:
            "The existing scheduled plan change could not be released safely. Try again before changing the plan.",
        });
      }

      this.logger.warn(
        `Stripe schedule release skipped for ${scheduleId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async createPortalSession(
    tenantId: string,
    returnUrl: string,
  ): Promise<CreateBillingPortalSessionResult> {
    const snapshot = await this.getTenantPlanSnapshot(tenantId);

    if (snapshot.source !== "stripe" || !snapshot.providerCustomerId) {
      throw new ConflictException({
        code: "BILLING_PORTAL_UNAVAILABLE",
        message:
          "A Stripe-managed subscription is required before billing can be managed from the customer workspace",
      });
    }

    const session = await this.getStripeClient().billingPortal.sessions.create({
      customer: snapshot.providerCustomerId,
      return_url: returnUrl,
    });

    if (!session.url) {
      throw new InternalServerErrorException({
        code: "BILLING_PORTAL_ERROR",
        message: "Stripe did not return a hosted billing portal URL",
      });
    }

    return {
      provider: BILLING_PROVIDER,
      customerId: snapshot.providerCustomerId,
      portalUrl: session.url,
    };
  }

  async handleStripeWebhook(
    signature: string | string[] | undefined,
    rawBody: Buffer | string | undefined,
  ): Promise<{ received: true; duplicate: boolean; eventType: string | null }> {
    if (!signature || Array.isArray(signature)) {
      throw new BadRequestException({
        code: "STRIPE_SIGNATURE_REQUIRED",
        message: "A Stripe signature header is required",
      });
    }

    if (!rawBody) {
      throw new BadRequestException({
        code: "RAW_BODY_REQUIRED",
        message: "Stripe webhook verification requires the raw request body",
      });
    }

    const event = this.getStripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      this.getStripeWebhookSecret(),
    );

    const existingEvent = await this.prisma.billingWebhookEvent.findUnique({
      where: { providerEventId: event.id },
      select: { id: true },
    });

    if (existingEvent) {
      return { received: true, duplicate: true, eventType: event.type };
    }

    const eventRecord = await this.prisma.billingWebhookEvent.create({
      data: {
        provider: BILLING_PROVIDER,
        providerEventId: event.id,
        eventType: event.type,
        payload: event as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    try {
      const syncResult = await this.processStripeEvent(event);

      await this.prisma.billingWebhookEvent.update({
        where: { id: eventRecord.id },
        data: {
          processedAt: new Date(),
          tenantId: syncResult.tenantId,
          subscriptionId: syncResult.subscriptionId,
        },
      });

      return { received: true, duplicate: false, eventType: event.type };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Stripe webhook error";

      await this.prisma.billingWebhookEvent.update({
        where: { id: eventRecord.id },
        data: { errorMessage: message },
      });

      throw error;
    }
  }

  async listAdminSubscriptions(params: {
    status?: Exclude<BillingPublicStatus, "inactive">;
    page?: number;
    limit?: number;
  }): Promise<{
    data: AdminSubscriptionListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SubscriptionWhereInput = params.status
      ? { status: this.fromPublicStatus(params.status) }
      : {
          status: {
            in: [
              SubscriptionStatus.ACTIVE,
              SubscriptionStatus.TRIALING,
              SubscriptionStatus.PAST_DUE,
              SubscriptionStatus.CANCELED,
            ],
          },
        };

    const [rows, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          tenantId: true,
          planKey: true,
          status: true,
          currentPeriodEnd: true,
          lastWebhookAt: true,
          tenant: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      data: rows.reduce<AdminSubscriptionListItem[]>((accumulator, row) => {
        if (!isBillingPlanKey(row.planKey)) {
          return accumulator;
        }

        accumulator.push({
          id: row.id,
          tenantId: row.tenantId,
          tenantName: row.tenant.name,
          planKey: row.planKey,
          status: this.toPublicStatus(row.status) as Exclude<
            BillingPublicStatus,
            "inactive"
          >,
          renewsAt: row.currentPeriodEnd?.toISOString() ?? null,
          webhookSynced: !!row.lastWebhookAt,
        });

        return accumulator;
      }, []),
      total,
      page,
      limit,
    };
  }

  async assertCanUpdateSiteLocales(
    siteId: string,
    requestedLocales: string[],
  ): Promise<void> {
    const site = await this.requireSite(siteId);
    const snapshot = await this.getTenantPlanSnapshot(site.tenantId);
    const normalizedLocales = Array.from(new Set(requestedLocales));
    const projectedTotal =
      snapshot.usage.locales -
      site.enabledLocales.length +
      normalizedLocales.length;

    if (projectedTotal > snapshot.limits.locales) {
      throw new ConflictException({
        code: "PLAN_LIMIT_EXCEEDED",
        message:
          "This plan does not include enough enabled locale capacity for that change",
        limitType: "locales",
        limit: snapshot.limits.locales,
        current: snapshot.usage.locales,
        requested: projectedTotal,
      });
    }

    const disallowed = normalizedLocales.filter(
      (locale) => !snapshot.limits.allowedLanguages.includes(locale),
    );
    if (disallowed.length > 0) {
      throw new ConflictException({
        code: "PLAN_LANGUAGE_NOT_ALLOWED",
        message: `This plan does not include the following languages: ${disallowed.join(", ")}`,
        limitType: "allowedLanguages",
        allowed: snapshot.limits.allowedLanguages,
        requested: normalizedLocales,
      });
    }
  }

  async assertCanIncreasePageCount(
    siteId: string,
    additionalPages: number,
  ): Promise<void> {
    if (additionalPages <= 0) {
      return;
    }

    const site = await this.requireSite(siteId);
    const snapshot = await this.getTenantPlanSnapshot(site.tenantId);

    if (snapshot.limits.pages === null) {
      return;
    }

    const projectedTotal = snapshot.usage.pages + additionalPages;

    if (projectedTotal > snapshot.limits.pages) {
      throw new ConflictException({
        code: "PLAN_LIMIT_EXCEEDED",
        message:
          "This plan does not include enough published and draft page capacity",
        limitType: "pages",
        limit: snapshot.limits.pages,
        current: snapshot.usage.pages,
        requested: projectedTotal,
      });
    }
  }

  async assertCanPublishSite(siteId: string): Promise<void> {
    const site = await this.requireSite(siteId);
    const snapshot = await this.getTenantPlanSnapshot(site.tenantId);

    if (snapshot.actions.publishingBlocked) {
      throw new ForbiddenException({
        code: "PUBLISHING_BLOCKED",
        message:
          "Publishing is blocked for this tenant until the subscription returns to good standing",
        status: snapshot.status,
        gracePeriodEndsAt: snapshot.gracePeriodEndsAt?.toISOString() ?? null,
      });
    }
  }

  async assertCanProvisionSite(tenantId: string): Promise<void> {
    const snapshot = await this.getTenantPlanSnapshot(tenantId);

    if (snapshot.usage.sites + 1 > snapshot.limits.sites) {
      throw new ConflictException({
        code: "PLAN_LIMIT_EXCEEDED",
        message: "This plan does not include another active hospitality site",
        limitType: "sites",
        limit: snapshot.limits.sites,
        current: snapshot.usage.sites,
        requested: snapshot.usage.sites + 1,
      });
    }
  }

  async assertCanAddSeat(tenantId: string): Promise<void> {
    const snapshot = await this.getTenantPlanSnapshot(tenantId);

    if (snapshot.usage.seats + 1 > snapshot.limits.seats) {
      throw new ConflictException({
        code: "PLAN_LIMIT_EXCEEDED",
        message: "This plan does not include another editing seat",
        limitType: "seats",
        limit: snapshot.limits.seats,
        current: snapshot.usage.seats,
        requested: snapshot.usage.seats + 1,
      });
    }
  }

  async assertCanAddDomain(siteId: string): Promise<void> {
    const site = await this.requireSite(siteId);
    const snapshot = await this.getTenantPlanSnapshot(site.tenantId);

    if (snapshot.limits.domains <= 0) {
      throw new ConflictException({
        code: "PLAN_DOMAIN_NOT_INCLUDED",
        message:
          "Custom domains are not included on the Free plan. Upgrade to connect a domain.",
        limitType: "domains",
        limit: 0,
        current: snapshot.usage.domains,
        requested: snapshot.usage.domains + 1,
      });
    }

    if (snapshot.usage.domains + 1 > snapshot.limits.domains) {
      throw new ConflictException({
        code: "PLAN_LIMIT_EXCEEDED",
        message: "This plan does not include another custom domain",
        limitType: "domains",
        limit: snapshot.limits.domains,
        current: snapshot.usage.domains,
        requested: snapshot.usage.domains + 1,
      });
    }
  }

  async assertCanAcceptInquiry(siteId: string): Promise<void> {
    const site = await this.requireSite(siteId);
    const snapshot = await this.getTenantPlanSnapshot(site.tenantId);

    if (snapshot.usage.formSubmissions + 1 > snapshot.limits.formSubmissions) {
      throw new ConflictException({
        code: "PLAN_LIMIT_EXCEEDED",
        message:
          "This plan has reached its monthly inquiry allowance for the current period",
        limitType: "formSubmissions",
        limit: snapshot.limits.formSubmissions,
        current: snapshot.usage.formSubmissions,
        requested: snapshot.usage.formSubmissions + 1,
      });
    }
  }

  /**
   * Validates that the requested URL budget for an SEO crawler audit fits
   * within the plan's per-crawl ceiling. Returns the effective URL limit
   * (clamped to the plan ceiling) so callers can use it as the engine cap.
   */
  async assertCanRunCrawl(
    siteId: string,
    requestedUrlLimit: number,
  ): Promise<number> {
    const site = await this.requireSite(siteId);
    const snapshot = await this.getTenantPlanSnapshot(site.tenantId);
    const planLimit = snapshot.limits.seoCrawlerMaxUrlsPerCrawl;

    if (planLimit <= 0) {
      throw new ConflictException({
        code: "PLAN_SEO_CRAWLER_NOT_INCLUDED",
        message:
          "The SEO crawler is not available on this plan. Upgrade to unlock site audits.",
        limitType: "seoCrawlerMaxUrlsPerCrawl",
        limit: 0,
      });
    }

    if (requestedUrlLimit > planLimit) {
      throw new ConflictException({
        code: "PLAN_LIMIT_EXCEEDED",
        message: `The requested crawl budget exceeds this plan's per-audit URL limit (${planLimit}).`,
        limitType: "seoCrawlerMaxUrlsPerCrawl",
        limit: planLimit,
        requested: requestedUrlLimit,
      });
    }

    return Math.min(requestedUrlLimit, planLimit);
  }

  /**
   * Validates that the tenant has remaining PageSpeed Insights audit
   * budget for the current calendar month. Should be called once per
   * audit attempt before invoking the provider. Returns the remaining
   * budget after this audit would be counted.
   */
  async assertCanRunPsiAudit(siteId: string): Promise<{
    limit: number;
    used: number;
    remaining: number;
  }> {
    const site = await this.requireSite(siteId);
    const snapshot = await this.getTenantPlanSnapshot(site.tenantId);
    const planLimit = snapshot.limits.psiAuditsPerMonth;

    if (planLimit <= 0) {
      throw new ConflictException({
        code: "PLAN_PSI_NOT_INCLUDED",
        message:
          "PageSpeed Insights audits are not available on this plan. Upgrade to unlock performance monitoring.",
        limitType: "psiAuditsPerMonth",
        limit: 0,
      });
    }

    const used = snapshot.usage.psiAuditsThisMonth;
    if (used + 1 > planLimit) {
      throw new ConflictException({
        code: "PLAN_LIMIT_EXCEEDED",
        message:
          "This audit would exceed the plan's monthly PageSpeed Insights allowance.",
        limitType: "psiAuditsPerMonth",
        limit: planLimit,
        current: used,
        requested: used + 1,
      });
    }

    return {
      limit: planLimit,
      used,
      remaining: planLimit - used - 1,
    };
  }

  async assertCanConsumeTranslationCharacters(
    tenantId: string,
    charactersRequested: number,
  ): Promise<void> {
    if (charactersRequested <= 0) {
      return;
    }

    const snapshot = await this.getTenantPlanSnapshot(tenantId);

    if (snapshot.limits.translationCharactersPerMonth <= 0) {
      throw new ConflictException({
        code: "PLAN_TRANSLATION_NOT_INCLUDED",
        message:
          "Machine translation is not included on this plan. Upgrade to unlock multilingual publishing.",
        limitType: "translationCharactersPerMonth",
        limit: 0,
      });
    }

    const projected =
      snapshot.usage.translationCharactersThisMonth + charactersRequested;

    if (projected > snapshot.limits.translationCharactersPerMonth) {
      throw new ConflictException({
        code: "PLAN_LIMIT_EXCEEDED",
        message:
          "This translation request would exceed the plan's monthly translation allowance",
        limitType: "translationCharactersPerMonth",
        limit: snapshot.limits.translationCharactersPerMonth,
        current: snapshot.usage.translationCharactersThisMonth,
        requested: projected,
      });
    }
  }

  async syncSubscriptionFromStripe(
    stripeSubscription: StripeSubscriptionRecord,
    eventId: string,
    eventCreatedAt: number,
  ): Promise<StripeSyncResult> {
    const providerCustomerId = this.extractCustomerId(
      stripeSubscription.customer,
    );
    const existingByProviderId = await this.prisma.subscription.findUnique({
      where: { providerSubscriptionId: stripeSubscription.id },
      select: {
        id: true,
        tenantId: true,
        status: true,
        planKey: true,
        gracePeriodEndsAt: true,
        pendingPlanKey: true,
        providerScheduleId: true,
      },
    });
    const tenantId = await this.resolveTenantIdForStripeSubscription(
      stripeSubscription,
      existingByProviderId?.tenantId,
      providerCustomerId,
    );

    if (!tenantId) {
      this.logger.warn(
        `Ignoring Stripe subscription ${stripeSubscription.id} because no active tenant could be resolved`,
      );
      return {};
    }

    const planKey =
      this.resolvePlanKeyForStripeSubscription(stripeSubscription);
    const plan = getBillingPlan(planKey);
    const priceId = stripeSubscription.items.data[0]?.price?.id ?? null;
    const mappedStatus = this.mapStripeStatus(stripeSubscription.status);
    const gracePeriodEndsAt = this.computeGracePeriodEndsAt(
      mappedStatus,
      existingByProviderId?.gracePeriodEndsAt ?? null,
    );
    const lastWebhookAt = new Date(eventCreatedAt * 1000);

    const existingIntent = existingByProviderId
      ? null
      : await this.prisma.subscription.findFirst({
          where: {
            tenantId,
            provider: BILLING_PROVIDER,
            providerCustomerId,
            providerSubscriptionId: null,
          },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            status: true,
            planKey: true,
          },
        });

    const previousStatus =
      existingByProviderId?.status ?? existingIntent?.status ?? null;
    const previousPlanKey =
      existingByProviderId?.planKey ?? existingIntent?.planKey ?? null;
    const shouldClearPendingPlanChange =
      !existingByProviderId?.pendingPlanKey ||
      existingByProviderId.pendingPlanKey === planKey ||
      mappedStatus === SubscriptionStatus.CANCELED ||
      mappedStatus === SubscriptionStatus.INACTIVE;

    const subscriptionId = existingByProviderId?.id ?? existingIntent?.id;
    const baseData = {
      provider: BILLING_PROVIDER,
      providerCustomerId,
      providerSubscriptionId: stripeSubscription.id,
      providerPriceId: priceId,
      planKey,
      status: mappedStatus,
      currentPeriodStart: this.fromUnixTime(
        stripeSubscription.current_period_start,
      ),
      currentPeriodEnd: this.fromUnixTime(
        stripeSubscription.current_period_end,
      ),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      limitsSnapshot: plan.limits as unknown as Prisma.InputJsonValue,
      gracePeriodEndsAt,
      lastWebhookEventId: eventId,
      lastWebhookAt,
      ...(shouldClearPendingPlanChange
        ? this.clearPendingPlanChangeData()
        : {}),
    };

    const subscription = subscriptionId
      ? await this.prisma.subscription.update({
          where: { id: subscriptionId },
          data: baseData,
          select: { id: true },
        })
      : await this.prisma.subscription.create({
          data: {
            tenantId,
            ...baseData,
          },
          select: { id: true },
        });

    await this.safeSendSubscriptionConfirmationEmail({
      tenantId,
      planKey,
      nextStatus: mappedStatus,
      previousStatus,
      previousPlanKey,
      renewsAt: this.fromUnixTime(stripeSubscription.current_period_end),
    });

    await this.createSubscriptionLifecycleNotifications({
      tenantId,
      planKey,
      nextStatus: mappedStatus,
      previousStatus,
      previousPlanKey,
      renewsAt: this.fromUnixTime(stripeSubscription.current_period_end),
    });

    return {
      tenantId,
      subscriptionId: subscription.id,
    };
  }

  private async processStripeEvent(
    event: StripeWebhookEventRecord,
  ): Promise<StripeSyncResult> {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.pending_update_applied":
        return this.syncSubscriptionFromStripe(
          event.data.object as StripeSubscriptionRecord,
          event.id,
          event.created,
        );
      case "customer.subscription.pending_update_expired":
        return this.handlePendingSubscriptionUpdateExpired(
          event.data.object as StripeSubscriptionRecord,
        );
      case "checkout.session.completed":
        return this.recordCheckoutCompletion(
          event.data.object as StripeCheckoutSessionRecord,
        );
      case "invoice.payment_succeeded":
        return this.handleInvoicePaid(event.data.object as StripeInvoiceRecord);
      case "invoice.payment_failed":
        return this.handleInvoicePaymentFailed(
          event.data.object as StripeInvoiceRecord,
        );
      default:
        return {};
    }
  }

  private async recordCheckoutCompletion(
    session: StripeCheckoutSessionRecord,
  ): Promise<StripeSyncResult> {
    if (session.mode !== "subscription") {
      return {};
    }

    const tenantId =
      session.metadata?.tenantId ?? session.client_reference_id ?? undefined;
    const customerId = this.extractCustomerId(session.customer);

    if (!tenantId || !customerId) {
      return {};
    }

    const planKey = session.metadata?.planKey;

    if (!planKey || !isBillingPlanKey(planKey) || !isPaidPlanKey(planKey)) {
      return { tenantId };
    }

    await this.persistCheckoutIntent(tenantId, customerId, planKey);

    return { tenantId };
  }

  private async handleInvoicePaid(
    invoice: StripeInvoiceRecord,
  ): Promise<StripeSyncResult> {
    const tenantId = await this.resolveTenantIdForInvoice(invoice);

    if (!tenantId) {
      return {};
    }

    await this.persistInvoiceSnapshot(tenantId, invoice);
    await this.recordInvoicePaymentEvent(tenantId, invoice, "paid");

    await this.safeSendInvoicePaidEmail({
      tenantId,
      customerEmail: invoice.customer_email ?? null,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdfUrl: invoice.invoice_pdf ?? null,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
    });

    await this.createInvoicePaidNotification({
      tenantId,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
    });

    return { tenantId };
  }

  private async handleInvoicePaymentFailed(
    invoice: StripeInvoiceRecord,
  ): Promise<StripeSyncResult> {
    const tenantId = await this.resolveTenantIdForInvoice(invoice);

    if (!tenantId) {
      return {};
    }

    await this.persistInvoiceSnapshot(tenantId, invoice);
    await this.recordInvoicePaymentEvent(tenantId, invoice, "payment_failed");

    await this.notifyBillingPaymentActionRequired({
      tenantId,
      reason:
        "Stripe could not collect a subscription invoice. Ask the billing contact to update the payment method or complete authentication.",
    });

    return { tenantId };
  }

  private async handlePendingSubscriptionUpdateExpired(
    stripeSubscription: StripeSubscriptionRecord,
  ): Promise<StripeSyncResult> {
    const providerCustomerId = this.extractCustomerId(
      stripeSubscription.customer,
    );
    const tenantId = await this.resolveTenantIdForStripeSubscription(
      stripeSubscription,
      undefined,
      providerCustomerId,
    );

    if (!tenantId) {
      return {};
    }

    await this.notifyBillingPaymentActionRequired({
      tenantId,
      reason:
        "A requested paid plan change expired because Stripe could not complete the payment in time. The current plan remains active.",
    });

    return { tenantId };
  }

  private async getTenantUsage(tenantId: string): Promise<BillingUsageTotals> {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [
      sites,
      seats,
      pages,
      formSubmissions,
      domains,
      translationUsage,
      psiAudits,
    ] = await Promise.all([
      this.prisma.site.findMany({
        where: {
          tenantId,
          status: { not: SiteStatus.ARCHIVED },
        },
        select: {
          id: true,
          enabledLocales: true,
        },
      }),
      this.prisma.tenantMembership.count({ where: { tenantId } }),
      this.prisma.page.count({
        where: {
          deletedAt: null,
          site: {
            tenantId,
            status: { not: SiteStatus.ARCHIVED },
          },
        },
      }),
      this.prisma.formSubmission.count({
        where: {
          createdAt: { gte: monthStart },
          site: {
            tenantId,
            status: { not: SiteStatus.ARCHIVED },
          },
        },
      }),
      this.prisma.domain.count({
        where: {
          site: {
            tenantId,
            status: { not: SiteStatus.ARCHIVED },
          },
        },
      }),
      this.getTranslationUsageForMonth(tenantId, monthStart),
      this.getPsiAuditUsageForMonth(tenantId, monthStart),
    ]);

    return {
      sites: sites.length,
      locales: sites.reduce(
        (total, site) => total + site.enabledLocales.length,
        0,
      ),
      seats,
      formSubmissions,
      pages,
      domains,
      translationCharactersThisMonth: translationUsage,
      psiAuditsThisMonth: psiAudits,
    };
  }

  private async getTranslationUsageForMonth(
    tenantId: string,
    monthStart: Date,
  ): Promise<number> {
    // Safe no-op if the TranslationUsage model is not yet present on the client.
    const client = this.prisma as unknown as {
      translationUsage?: {
        aggregate: (args: {
          where: { tenantId: string; periodStart: { gte: Date } };
          _sum: { characters: true };
        }) => Promise<{ _sum: { characters: number | null } }>;
      };
    };
    if (!client.translationUsage) {
      return 0;
    }

    try {
      const aggregate = await client.translationUsage.aggregate({
        where: { tenantId, periodStart: { gte: monthStart } },
        _sum: { characters: true },
      });
      return aggregate._sum.characters ?? 0;
    } catch {
      return 0;
    }
  }

  private async getPsiAuditUsageForMonth(
    tenantId: string,
    monthStart: Date,
  ): Promise<number> {
    // Safe no-op if PsiAudit model is not yet present on the generated client.
    const client = this.prisma as unknown as {
      psiAudit?: {
        count: (args: {
          where: {
            createdAt: { gte: Date };
            site: { tenantId: string; status: { not: SiteStatus } };
            status: { not: "FAILED" };
          };
        }) => Promise<number>;
      };
    };
    if (!client.psiAudit) {
      return 0;
    }

    try {
      return await client.psiAudit.count({
        where: {
          createdAt: { gte: monthStart },
          site: {
            tenantId,
            status: { not: SiteStatus.ARCHIVED },
          },
          status: { not: "FAILED" },
        },
      });
    } catch {
      return 0;
    }
  }

  private async findCurrentSubscription(
    tenantId: string,
  ): Promise<Subscription | null> {
    const active = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ACTIVE_ADMIN_STATUSES },
      },
      orderBy: [{ currentPeriodEnd: "desc" }, { updatedAt: "desc" }],
    });

    if (active) {
      return active;
    }

    return this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
  }

  private buildFreePlanSnapshot(
    tenantId: string,
    usage: BillingUsageTotals,
  ): TenantBillingSnapshot {
    const plan = getBillingPlan(BILLING_DEFAULT_PLAN_KEY);
    const status: BillingPublicStatus = "active";

    return {
      tenantId,
      planKey: plan.key,
      planName: plan.name,
      description: plan.description,
      provider: BILLING_PROVIDER,
      status,
      renewsAt: null,
      currentPeriodStart: null,
      gracePeriodEndsAt: null,
      limits: plan.limits,
      usage,
      source: "free",
      providerCustomerId: null,
      providerSubscriptionId: null,
      cancelAtPeriodEnd: false,
      actions: this.buildActionState(status, null),
      lastWebhookAt: null,
      subscriptionId: null,
      isFreePlan: true,
      pendingPlanChange: null,
    };
  }

  private async refreshStripeSubscriptionIfNeeded(
    subscription: Subscription,
  ): Promise<Subscription> {
    if (!subscription.providerCustomerId) {
      return subscription;
    }

    const shouldRefreshFromStripe =
      !subscription.providerSubscriptionId ||
      subscription.status === SubscriptionStatus.INACTIVE;

    if (!shouldRefreshFromStripe) {
      return subscription;
    }

    try {
      const stripeSubscription =
        await this.findStripeSubscriptionForLocalRecord(subscription);

      if (!stripeSubscription) {
        return subscription;
      }

      const syncResult = await this.syncSubscriptionFromStripe(
        stripeSubscription,
        `stripe-sync:${stripeSubscription.id}`,
        Math.floor(Date.now() / 1000),
      );

      if (!syncResult.subscriptionId) {
        return subscription;
      }

      const refreshed = await this.prisma.subscription.findUnique({
        where: { id: syncResult.subscriptionId },
      });

      return refreshed ?? subscription;
    } catch (error) {
      this.logger.warn(
        `Stripe backfill skipped for tenant ${subscription.tenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return subscription;
    }
  }

  private buildActionState(
    status: BillingPublicStatus,
    gracePeriodEndsAt: Date | null,
  ) {
    const now = new Date();
    const gracePeriodActive =
      status === "past_due" &&
      !!gracePeriodEndsAt &&
      gracePeriodEndsAt.getTime() > now.getTime();

    return {
      editingAllowed:
        gracePeriodActive ||
        status === "active" ||
        status === "trialing" ||
        status === "canceled" ||
        status === "inactive",
      publishingBlocked:
        status === "canceled" ||
        status === "inactive" ||
        (status === "past_due" && !gracePeriodActive),
      publicSitesRemainLive:
        status === "past_due" ||
        status === "canceled" ||
        status === "inactive" ||
        status === "active" ||
        status === "trialing"
          ? BILLING_ENFORCEMENT_POLICY.publicSitesRemainLiveDuringPastDue
          : true,
      operatorOverrideAvailable:
        BILLING_ENFORCEMENT_POLICY.operatorOverrideAvailable,
      gracePeriodActive,
    };
  }

  private clearPendingPlanChangeData(): Record<string, null> {
    return {
      pendingPlanKey: null,
      pendingPlanEffectiveAt: null,
      pendingPlanDirection: null,
      providerScheduleId: null,
    };
  }

  private hasStripePendingUpdate(subscription: unknown): boolean {
    return Boolean(
      subscription &&
      typeof subscription === "object" &&
      (subscription as { pending_update?: unknown }).pending_update,
    );
  }

  private toUnixTime(value: Date | null): number | null {
    return value ? Math.floor(value.getTime() / 1000) : null;
  }

  private buildPendingPlanChange(
    subscription: SubscriptionWithPendingPlanChange,
  ) {
    if (
      !subscription.pendingPlanKey ||
      !subscription.pendingPlanEffectiveAt ||
      !isBillingPlanKey(subscription.pendingPlanKey)
    ) {
      return null;
    }

    const plan = getBillingPlan(subscription.pendingPlanKey);
    const direction: BillingPlanChangeDirection =
      subscription.pendingPlanDirection === "upgrade" ? "upgrade" : "downgrade";

    return {
      planKey: plan.key,
      planName: plan.name,
      direction,
      effectiveAt: subscription.pendingPlanEffectiveAt,
      providerScheduleId: subscription.providerScheduleId ?? null,
    };
  }

  private getPlanKeyOrThrow(planKey: string): BillingPlanKey {
    if (!isBillingPlanKey(planKey)) {
      throw new InternalServerErrorException({
        code: "UNKNOWN_PLAN_KEY",
        message: `Unknown billing plan '${planKey}'`,
      });
    }

    return planKey;
  }

  private parseLimitsSnapshot(
    snapshot: Prisma.JsonValue | null | undefined,
  ): BillingPlanLimits | null {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return null;
    }

    const value = snapshot as Record<string, unknown>;

    if (
      typeof value.sites !== "number" ||
      typeof value.locales !== "number" ||
      typeof value.seats !== "number" ||
      typeof value.formSubmissions !== "number" ||
      typeof value.domains !== "number"
    ) {
      return null;
    }

    if (value.pages !== null && typeof value.pages !== "number") {
      return null;
    }

    const allowedLanguages = Array.isArray(value.allowedLanguages)
      ? (value.allowedLanguages as unknown[]).filter(
          (entry): entry is string => typeof entry === "string",
        )
      : ["en"];

    const translationCharactersPerMonth =
      typeof value.translationCharactersPerMonth === "number"
        ? value.translationCharactersPerMonth
        : 0;
    const deploymentRetention =
      typeof value.deploymentRetention === "number"
        ? value.deploymentRetention
        : 10;
    const rollbackEnabled =
      typeof value.rollbackEnabled === "boolean" ? value.rollbackEnabled : true;
    const analyticsEnabled =
      typeof value.analyticsEnabled === "boolean"
        ? value.analyticsEnabled
        : true;
    const exportEnabled =
      typeof value.exportEnabled === "boolean" ? value.exportEnabled : true;
    const scheduledExports =
      typeof value.scheduledExports === "boolean"
        ? value.scheduledExports
        : false;
    const supportTier: BillingSupportTier =
      value.supportTier === "docs" ||
      value.supportTier === "email" ||
      value.supportTier === "priority" ||
      value.supportTier === "white_glove"
        ? value.supportTier
        : "email";

    const seoCrawlerMaxUrlsPerCrawl =
      typeof value.seoCrawlerMaxUrlsPerCrawl === "number" &&
      value.seoCrawlerMaxUrlsPerCrawl >= 0
        ? value.seoCrawlerMaxUrlsPerCrawl
        : 100;

    const psiAuditsPerMonth =
      typeof value.psiAuditsPerMonth === "number" &&
      value.psiAuditsPerMonth >= 0
        ? value.psiAuditsPerMonth
        : 20;

    return {
      sites: value.sites,
      locales: value.locales,
      seats: value.seats,
      formSubmissions: value.formSubmissions,
      pages: value.pages as number | null,
      domains: value.domains,
      allowedLanguages,
      translationCharactersPerMonth,
      deploymentRetention,
      rollbackEnabled,
      analyticsEnabled,
      exportEnabled,
      scheduledExports,
      supportTier,
      seoCrawlerMaxUrlsPerCrawl,
      psiAuditsPerMonth,
    };
  }

  private toPublicStatus(status: SubscriptionStatus): BillingPublicStatus {
    switch (status) {
      case SubscriptionStatus.TRIALING:
        return "trialing";
      case SubscriptionStatus.ACTIVE:
        return "active";
      case SubscriptionStatus.PAST_DUE:
        return "past_due";
      case SubscriptionStatus.CANCELED:
        return "canceled";
      case SubscriptionStatus.INACTIVE:
      default:
        return "inactive";
    }
  }

  private fromPublicStatus(
    status: Exclude<BillingPublicStatus, "inactive">,
  ): SubscriptionStatus {
    switch (status) {
      case "trialing":
        return SubscriptionStatus.TRIALING;
      case "active":
        return SubscriptionStatus.ACTIVE;
      case "past_due":
        return SubscriptionStatus.PAST_DUE;
      case "canceled":
        return SubscriptionStatus.CANCELED;
    }
  }

  private mapStripeStatus(status: string): SubscriptionStatus {
    switch (status) {
      case "trialing":
        return SubscriptionStatus.TRIALING;
      case "active":
        return SubscriptionStatus.ACTIVE;
      case "past_due":
      case "unpaid":
      case "paused":
        return SubscriptionStatus.PAST_DUE;
      case "canceled":
        return SubscriptionStatus.CANCELED;
      case "incomplete":
      case "incomplete_expired":
      default:
        return SubscriptionStatus.INACTIVE;
    }
  }

  private computeGracePeriodEndsAt(
    status: SubscriptionStatus,
    currentGracePeriodEndsAt: Date | null,
  ): Date | null {
    if (status !== SubscriptionStatus.PAST_DUE) {
      return null;
    }

    const now = new Date();

    if (
      currentGracePeriodEndsAt &&
      currentGracePeriodEndsAt.getTime() > now.getTime()
    ) {
      return currentGracePeriodEndsAt;
    }

    const gracePeriodEndsAt = new Date(now);
    gracePeriodEndsAt.setUTCDate(
      gracePeriodEndsAt.getUTCDate() +
        BILLING_ENFORCEMENT_POLICY.gracePeriodDays,
    );
    return gracePeriodEndsAt;
  }

  private async resolveTenantIdForStripeSubscription(
    stripeSubscription: StripeSubscriptionRecord,
    existingTenantId: string | undefined,
    providerCustomerId: string | null,
  ): Promise<string | null> {
    const metadataTenantId = await this.resolveExistingTenantId(
      stripeSubscription.metadata?.tenantId,
    );

    if (metadataTenantId) {
      return metadataTenantId;
    }

    const resolvedExistingTenantId =
      await this.resolveExistingTenantId(existingTenantId);

    if (resolvedExistingTenantId) {
      return resolvedExistingTenantId;
    }

    if (providerCustomerId) {
      const previousSubscription = await this.prisma.subscription.findFirst({
        where: {
          provider: BILLING_PROVIDER,
          providerCustomerId,
        },
        orderBy: { updatedAt: "desc" },
        select: { tenantId: true },
      });

      const resolvedPreviousTenantId = await this.resolveExistingTenantId(
        previousSubscription?.tenantId,
      );

      if (resolvedPreviousTenantId) {
        return resolvedPreviousTenantId;
      }
    }

    return null;
  }

  private async resolveTenantIdForInvoice(
    invoice: StripeInvoiceRecord,
  ): Promise<string | null> {
    const metadataTenantId = await this.resolveExistingTenantId(
      invoice.metadata?.tenantId,
    );

    if (metadataTenantId) {
      return metadataTenantId;
    }

    const subscriptionId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : (invoice.subscription?.id ?? null);

    if (subscriptionId) {
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          provider: BILLING_PROVIDER,
          providerSubscriptionId: subscriptionId,
        },
        select: { tenantId: true },
      });

      const resolvedSubscriptionTenantId = await this.resolveExistingTenantId(
        subscription?.tenantId,
      );

      if (resolvedSubscriptionTenantId) {
        return resolvedSubscriptionTenantId;
      }
    }

    const customerId = this.extractCustomerId(invoice.customer);
    if (!customerId) {
      return null;
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        provider: BILLING_PROVIDER,
        providerCustomerId: customerId,
      },
      orderBy: { updatedAt: "desc" },
      select: { tenantId: true },
    });

    return this.resolveExistingTenantId(subscription?.tenantId);
  }

  private async resolveExistingTenantId(
    tenantId: string | null | undefined,
  ): Promise<string | null> {
    if (!tenantId) {
      return null;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    return tenant?.id ?? null;
  }

  private resolvePlanKeyForStripeSubscription(
    stripeSubscription: StripeSubscriptionRecord,
  ): BillingPlanKey {
    const metadataPlanKey = stripeSubscription.metadata?.planKey;

    if (
      metadataPlanKey &&
      isBillingPlanKey(metadataPlanKey) &&
      isPaidPlanKey(metadataPlanKey)
    ) {
      return metadataPlanKey;
    }

    const priceId = stripeSubscription.items.data[0]?.price?.id;

    if (!priceId) {
      throw new BadRequestException({
        code: "PRICE_ID_REQUIRED",
        message: "Stripe subscription did not include a price id",
      });
    }

    for (const [planKey, plan] of Object.entries(BILLING_PLANS) as [
      BillingPlanKey,
      (typeof BILLING_PLANS)[BillingPlanKey],
    ][]) {
      if (
        plan.stripePriceIdEnvVar &&
        this.configService.get<string>(plan.stripePriceIdEnvVar) === priceId
      ) {
        return planKey;
      }
    }

    throw new BadRequestException({
      code: "UNKNOWN_PRICE_ID",
      message: `No billing plan is configured for Stripe price '${priceId}'`,
    });
  }

  private async findStripeSubscriptionForLocalRecord(
    subscription: Subscription,
  ): Promise<StripeSubscriptionRecord | null> {
    const stripe = this.getStripeClient();

    if (subscription.providerSubscriptionId) {
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.providerSubscriptionId,
      );

      return this.toStripeSubscriptionRecord(stripeSubscription);
    }

    if (!subscription.providerCustomerId) {
      return null;
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: subscription.providerCustomerId,
      status: "all",
      limit: 10,
    });

    const preferred = subscriptions.data.find(
      (candidate) =>
        candidate.metadata?.tenantId === subscription.tenantId &&
        [
          "active",
          "trialing",
          "past_due",
          "unpaid",
          "paused",
          "canceled",
        ].includes(candidate.status),
    );
    const matchingTenant = subscriptions.data.find(
      (candidate) => candidate.metadata?.tenantId === subscription.tenantId,
    );

    return this.toStripeSubscriptionRecord(
      preferred ?? matchingTenant ?? subscriptions.data[0] ?? null,
    );
  }

  private toStripeSubscriptionRecord(
    subscription: unknown,
  ): StripeSubscriptionRecord | null {
    if (!subscription || typeof subscription !== "object") {
      return null;
    }

    const value = subscription as Record<string, unknown>;
    const items =
      value.items && typeof value.items === "object"
        ? (value.items as { data?: Array<Record<string, unknown>> }).data
        : [];

    if (typeof value.id !== "string" || typeof value.status !== "string") {
      return null;
    }

    return {
      id: value.id,
      customer: (value.customer as StripeCustomerReference) ?? null,
      metadata:
        value.metadata && typeof value.metadata === "object"
          ? (value.metadata as Record<string, string>)
          : undefined,
      status: value.status,
      items: {
        data: (items ?? []).map((item) => ({
          id: typeof item.id === "string" ? (item.id as string) : null,
          quantity:
            typeof item.quantity === "number"
              ? (item.quantity as number)
              : null,
          price:
            item.price && typeof item.price === "object"
              ? {
                  id:
                    typeof (item.price as { id?: unknown }).id === "string"
                      ? ((item.price as { id: string }).id as string)
                      : null,
                }
              : null,
        })),
      },
      current_period_start:
        typeof value.current_period_start === "number"
          ? value.current_period_start
          : null,
      current_period_end:
        typeof value.current_period_end === "number"
          ? value.current_period_end
          : null,
      cancel_at_period_end: value.cancel_at_period_end === true,
      pending_update: value.pending_update,
    };
  }

  private async getOrCreateStripeCustomer(
    tenant: { id: string; name: string },
    customerEmail?: string,
  ): Promise<string> {
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId: tenant.id,
        provider: BILLING_PROVIDER,
        providerCustomerId: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      select: { providerCustomerId: true },
    });

    if (existingSubscription?.providerCustomerId) {
      return existingSubscription.providerCustomerId;
    }

    const customer = await this.getStripeClient().customers.create({
      name: tenant.name,
      email: customerEmail,
      metadata: {
        tenantId: tenant.id,
      },
    });

    return customer.id;
  }

  private async safeSendSubscriptionConfirmationEmail(input: {
    tenantId: string;
    planKey: BillingPlanKey;
    nextStatus: SubscriptionStatus;
    previousStatus: SubscriptionStatus | null;
    previousPlanKey: string | null;
    renewsAt: Date | null;
  }): Promise<void> {
    if (!this.transactionalEmailService.isConfigured()) {
      return;
    }

    const becameBillable = BILLABLE_SUBSCRIPTION_STATUSES.includes(
      input.nextStatus,
    );
    const wasBillable =
      input.previousStatus !== null &&
      BILLABLE_SUBSCRIPTION_STATUSES.includes(input.previousStatus);
    const planChanged =
      input.previousPlanKey !== null && input.previousPlanKey !== input.planKey;

    if (!becameBillable || (wasBillable && !planChanged)) {
      return;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { name: true },
    });
    const email = await this.findTenantBillingContactEmail(input.tenantId);

    if (!tenant || !email) {
      return;
    }

    const plan = getBillingPlan(input.planKey);
    const billingUrl = `${this.getDashboardBaseUrl()}/billing`;
    const renewalLine = input.renewsAt
      ? `Your next billing date is ${input.renewsAt.toISOString().slice(0, 10)}.`
      : "Your billing schedule is now attached to the workspace.";

    try {
      await this.transactionalEmailService.send({
        to: email,
        subject: `StayLayer billing confirmed for ${tenant.name}`,
        text: [
          `Your ${plan.name} plan is active for ${tenant.name}.`,
          renewalLine,
          `Manage billing: ${billingUrl}`,
        ].join("\n\n"),
        html: this.buildBillingEmailHtml({
          eyebrow: "Billing confirmed",
          title: `${plan.name} is active for ${tenant.name}`,
          body: `${renewalLine} You can review the subscription, invoices, and payment method from workspace billing.`,
          ctaLabel: "Open billing",
          ctaUrl: billingUrl,
        }),
      });
    } catch (error) {
      this.logger.warn(
        `Billing confirmation email skipped for tenant ${input.tenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async createSubscriptionLifecycleNotifications(input: {
    tenantId: string;
    planKey: BillingPlanKey;
    nextStatus: SubscriptionStatus;
    previousStatus: SubscriptionStatus | null;
    previousPlanKey: string | null;
    renewsAt: Date | null;
  }): Promise<void> {
    const plan = getBillingPlan(input.planKey);
    const becameBillable = BILLABLE_SUBSCRIPTION_STATUSES.includes(
      input.nextStatus,
    );
    const wasBillable =
      input.previousStatus !== null &&
      BILLABLE_SUBSCRIPTION_STATUSES.includes(input.previousStatus);
    const planChanged =
      input.previousPlanKey !== null && input.previousPlanKey !== input.planKey;

    let title: string | null = null;
    let body: string | null = null;

    if (becameBillable && (!wasBillable || planChanged)) {
      title = planChanged
        ? `Plan updated to ${plan.name}`
        : `${plan.name} is active`;
      body = input.renewsAt
        ? `Billing is synced and the workspace renews on ${input.renewsAt.toISOString().slice(0, 10)}.`
        : "Billing is synced and the workspace subscription is active.";
    } else if (
      input.nextStatus === SubscriptionStatus.PAST_DUE &&
      input.previousStatus !== SubscriptionStatus.PAST_DUE
    ) {
      title = "Billing requires attention";
      body =
        "Stripe marked the subscription as past due. Review billing to protect publishing and workspace access.";
    } else if (
      input.nextStatus === SubscriptionStatus.CANCELED &&
      input.previousStatus !== SubscriptionStatus.CANCELED
    ) {
      title = "Subscription canceled";
      body =
        "The workspace subscription was canceled. Review billing to restore paid features or confirm the plan change.";
    }

    if (!title || !body) {
      return;
    }

    await this.notificationsService.createForTenantRoles({
      tenantId: input.tenantId,
      roles: [
        TenantMembershipRole.OWNER,
        TenantMembershipRole.ADMIN,
        TenantMembershipRole.BILLING,
      ],
      category: NotificationCategory.BILLING,
      title,
      body,
      actionUrl: "/billing",
      metadata: {
        planKey: input.planKey,
        nextStatus: input.nextStatus,
        previousStatus: input.previousStatus,
      },
    });
  }

  private async safeSendScheduledPlanChangeEmail(input: {
    tenantId: string;
    currentPlanName: string;
    targetPlanName: string;
    effectiveAt: Date;
  }): Promise<void> {
    if (!this.transactionalEmailService.isConfigured()) {
      return;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { name: true },
    });
    const email = await this.findTenantBillingContactEmail(input.tenantId);

    if (!tenant || !email) {
      return;
    }

    const billingUrl = `${this.getDashboardBaseUrl()}/billing`;
    const effectiveDate = input.effectiveAt.toISOString().slice(0, 10);

    try {
      await this.transactionalEmailService.send({
        to: email,
        subject: `StayLayer plan change scheduled for ${tenant.name}`,
        text: [
          `${tenant.name} stays on ${input.currentPlanName} until ${effectiveDate}.`,
          `${input.targetPlanName} starts at renewal. There is no immediate charge or credit invoice for this downgrade.`,
          `Manage billing: ${billingUrl}`,
        ].join("\n\n"),
        html: this.buildBillingEmailHtml({
          eyebrow: "Plan change scheduled",
          title: `${input.targetPlanName} starts on ${effectiveDate}`,
          body: `${tenant.name} keeps ${input.currentPlanName} limits through the paid period. The lower plan begins at renewal, so there is no immediate charge or credit invoice for this downgrade.`,
          ctaLabel: "Review billing",
          ctaUrl: billingUrl,
        }),
      });
    } catch (error) {
      this.logger.warn(
        `Scheduled plan change email skipped for tenant ${input.tenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async notifyBillingPaymentActionRequired(input: {
    tenantId: string;
    planKey?: BillingPlanKey;
    reason: string;
  }): Promise<void> {
    await this.safeSendBillingActionRequiredEmail(input);
    await this.createBillingPlanChangeNotification({
      tenantId: input.tenantId,
      title: "Billing needs payment attention",
      body: input.reason,
      metadata: {
        planKey: input.planKey,
        reason: input.reason,
      },
    });
  }

  private async safeSendBillingActionRequiredEmail(input: {
    tenantId: string;
    planKey?: BillingPlanKey;
    reason: string;
  }): Promise<void> {
    if (!this.transactionalEmailService.isConfigured()) {
      return;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { name: true },
    });
    const email = await this.findTenantBillingContactEmail(input.tenantId);

    if (!tenant || !email) {
      return;
    }

    const billingUrl = `${this.getDashboardBaseUrl()}/billing`;
    const planLine = input.planKey
      ? `Requested plan: ${getBillingPlan(input.planKey).name}.`
      : null;

    try {
      await this.transactionalEmailService.send({
        to: email,
        subject: `Billing attention needed for ${tenant.name}`,
        text: [input.reason, planLine, `Manage billing: ${billingUrl}`]
          .filter(Boolean)
          .join("\n\n"),
        html: this.buildBillingEmailHtml({
          eyebrow: "Billing attention needed",
          title: `Payment action required for ${tenant.name}`,
          body: `${input.reason}${planLine ? ` ${planLine}` : ""} Review billing to keep the workspace in good standing.`,
          ctaLabel: "Open billing",
          ctaUrl: billingUrl,
        }),
      });
    } catch (error) {
      this.logger.warn(
        `Billing action email skipped for tenant ${input.tenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async createBillingPlanChangeNotification(input: {
    tenantId: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.notificationsService.createForTenantRoles({
      tenantId: input.tenantId,
      roles: [
        TenantMembershipRole.OWNER,
        TenantMembershipRole.ADMIN,
        TenantMembershipRole.BILLING,
      ],
      category: NotificationCategory.BILLING,
      title: input.title,
      body: input.body,
      actionUrl: "/billing",
      metadata: input.metadata ?? null,
    });
  }

  private async safeSendInvoicePaidEmail(input: {
    tenantId: string;
    customerEmail: string | null;
    hostedInvoiceUrl: string | null;
    invoicePdfUrl: string | null;
    amountPaid: number;
    currency: string;
  }): Promise<void> {
    if (input.amountPaid <= 0) {
      return;
    }

    if (!this.transactionalEmailService.isConfigured()) {
      return;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { name: true },
    });
    const email =
      input.customerEmail ??
      (await this.findTenantBillingContactEmail(input.tenantId));

    if (!tenant || !email) {
      return;
    }

    const amount = this.formatMoney(input.amountPaid, input.currency);
    const billingUrl = `${this.getDashboardBaseUrl()}/billing`;
    const invoiceUrl =
      input.hostedInvoiceUrl ?? input.invoicePdfUrl ?? billingUrl;

    try {
      await this.transactionalEmailService.send({
        to: email,
        subject: `Invoice paid for ${tenant.name}`,
        text: [
          `We received ${amount} for ${tenant.name}.`,
          `View the invoice: ${invoiceUrl}`,
          `Manage billing: ${billingUrl}`,
        ].join("\n\n"),
        html: this.buildBillingEmailHtml({
          eyebrow: "Invoice paid",
          title: `Payment received for ${tenant.name}`,
          body: `We received ${amount}. Use the link below to review the invoice and keep billing details in one place.`,
          ctaLabel: "View invoice",
          ctaUrl: invoiceUrl,
        }),
      });
    } catch (error) {
      this.logger.warn(
        `Invoice email skipped for tenant ${input.tenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async createInvoicePaidNotification(input: {
    tenantId: string;
    amountPaid: number;
    currency: string;
  }): Promise<void> {
    if (input.amountPaid <= 0) {
      return;
    }

    const amount = this.formatMoney(input.amountPaid, input.currency);

    await this.notificationsService.createForTenantRoles({
      tenantId: input.tenantId,
      roles: [
        TenantMembershipRole.OWNER,
        TenantMembershipRole.ADMIN,
        TenantMembershipRole.BILLING,
      ],
      category: NotificationCategory.BILLING,
      title: `Invoice paid: ${amount}`,
      body: `Payment was received and the billing record is up to date for this workspace.`,
      actionUrl: "/billing",
      metadata: {
        amountPaid: input.amountPaid,
        currency: input.currency,
      },
    });
  }

  private async findTenantBillingContactEmail(
    tenantId: string,
  ): Promise<string | null> {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: {
        tenantId,
        role: {
          in: [
            TenantMembershipRole.BILLING,
            TenantMembershipRole.OWNER,
            TenantMembershipRole.ADMIN,
          ],
        },
      },
      select: {
        role: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    const priority = [
      TenantMembershipRole.BILLING,
      TenantMembershipRole.OWNER,
      TenantMembershipRole.ADMIN,
    ];

    for (const role of priority) {
      const membership = memberships.find((entry) => entry.role === role);
      if (membership?.user.email) {
        return membership.user.email;
      }
    }

    return null;
  }

  private buildBillingEmailHtml(input: {
    eyebrow: string;
    title: string;
    body: string;
    ctaLabel: string;
    ctaUrl: string;
  }): string {
    return [
      "<!doctype html>",
      '<html><body style="margin:0;padding:24px;background:#f7f2eb;font-family:Arial,sans-serif;color:#102a36;">',
      '<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid rgba(26,72,112,0.12);">',
      `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#E07038;">${this.escapeHtml(input.eyebrow)}</p>`,
      `<h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#0D2840;">${this.escapeHtml(input.title)}</h1>`,
      `<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#102a36;">${this.escapeHtml(input.body)}</p>`,
      `<a href="${this.escapeHtml(input.ctaUrl)}" style="display:inline-block;border-radius:999px;background:#0D2840;color:#ffffff;padding:14px 22px;text-decoration:none;font-weight:700;">${this.escapeHtml(input.ctaLabel)}</a>`,
      "</div></body></html>",
    ].join("");
  }

  private getDashboardBaseUrl(): string {
    return (
      this.configService
        .get<string>("DASHBOARD_APP_URL")
        ?.trim()
        .replace(/\/$/, "") || "http://localhost:5173"
    );
  }

  private formatMoney(amountInMinorUnits: number, currency: string): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountInMinorUnits / 100);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private async persistCheckoutIntent(
    tenantId: string,
    providerCustomerId: string,
    planKey: BillingPlanKey,
  ): Promise<void> {
    const existingIntent = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        provider: BILLING_PROVIDER,
        providerCustomerId,
        providerSubscriptionId: null,
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    const data = {
      provider: BILLING_PROVIDER,
      providerCustomerId,
      planKey,
      status: SubscriptionStatus.INACTIVE,
      limitsSnapshot: getBillingPlan(planKey)
        .limits as unknown as Prisma.InputJsonValue,
    };

    if (existingIntent) {
      await this.prisma.subscription.update({
        where: { id: existingIntent.id },
        data,
      });
      return;
    }

    await this.prisma.subscription.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  private requireSite(siteId: string): Promise<{
    id: string;
    tenantId: string;
    enabledLocales: string[];
    primaryLocale: string;
  }> {
    return this.prisma.site
      .findUnique({
        where: { id: siteId },
        select: {
          id: true,
          tenantId: true,
          enabledLocales: true,
          primaryLocale: true,
        },
      })
      .then((site) => {
        if (!site) {
          throw new NotFoundException({
            code: "NOT_FOUND",
            message: "Site not found",
          });
        }

        return site;
      });
  }

  private getStripePriceId(planKey: BillingPlanKey): string {
    const plan = getBillingPlan(planKey);
    if (!plan.stripePriceIdEnvVar) {
      throw new ServiceUnavailableException({
        code: "BILLING_CONFIG_ERROR",
        message: `Plan '${planKey}' is not billable through Stripe`,
      });
    }
    const priceId = this.configService.get<string>(plan.stripePriceIdEnvVar);

    if (!priceId) {
      throw new ServiceUnavailableException({
        code: "BILLING_CONFIG_ERROR",
        message: `Missing Stripe price configuration for plan '${planKey}'`,
        envVar: plan.stripePriceIdEnvVar,
      });
    }

    return priceId;
  }

  private getStripeWebhookSecret(): string {
    const webhookSecret = this.configService.get<string>(
      "STRIPE_WEBHOOK_SECRET",
    );

    if (!webhookSecret) {
      throw new ServiceUnavailableException({
        code: "BILLING_CONFIG_ERROR",
        message: "Missing STRIPE_WEBHOOK_SECRET configuration",
      });
    }

    return webhookSecret;
  }

  private getStripeClient(): InstanceType<typeof Stripe> {
    if (this.stripeClient) {
      return this.stripeClient;
    }

    const secretKey = this.configService.get<string>("STRIPE_SECRET_KEY");

    if (!secretKey) {
      throw new ServiceUnavailableException({
        code: "BILLING_CONFIG_ERROR",
        message: "Missing STRIPE_SECRET_KEY configuration",
      });
    }

    this.stripeClient = new Stripe(secretKey);
    return this.stripeClient;
  }

  private extractCustomerId(customer: StripeCustomerReference): string | null {
    if (!customer) {
      return null;
    }

    if (typeof customer === "string") {
      return customer;
    }

    return customer.id;
  }

  private fromUnixTime(value: number | null): Date | null {
    if (!value) {
      return null;
    }

    return new Date(value * 1000);
  }

  // ── Phase 7 — operator billing surface ───────────────────────────────
  //
  // The methods below are consumed exclusively by `OperatorBillingService`.
  // They live here so the existing Stripe client, webhook deduplication
  // contract, and snapshot persistence helpers can be reused without
  // duplicating Stripe SDK setup. None of the customer-facing controllers
  // call into them.

  /**
   * Persist a Stripe invoice as a queryable snapshot. Idempotent — the
   * provider invoice id is the natural key. Safe to call from both webhook
   * handlers and operator-triggered Stripe syncs.
   */
  async persistInvoiceSnapshot(
    tenantId: string,
    invoice: StripeInvoiceRecord,
  ): Promise<void> {
    const providerInvoiceId = invoice.id;
    if (!providerInvoiceId) {
      return;
    }

    const subscriptionId = await this.resolveLocalSubscriptionIdForInvoice(
      tenantId,
      invoice,
    );
    const providerCustomerId = this.extractCustomerId(invoice.customer);
    const amountDue = invoice.amount_due ?? invoice.total ?? 0;
    const amountRemaining =
      invoice.amount_remaining ?? Math.max(amountDue - invoice.amount_paid, 0);

    const data = {
      tenantId,
      subscriptionId,
      provider: BILLING_PROVIDER,
      providerCustomerId,
      status: invoice.status ?? "open",
      amountDue,
      amountPaid: invoice.amount_paid,
      amountRemaining,
      currency: invoice.currency,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdfUrl: invoice.invoice_pdf ?? null,
      periodStart: this.fromUnixTime(invoice.period_start ?? null),
      periodEnd: this.fromUnixTime(invoice.period_end ?? null),
      providerCreatedAt: this.fromUnixTime(invoice.created ?? null),
      syncedAt: new Date(),
      raw: invoice as unknown as Prisma.InputJsonValue,
    } satisfies Prisma.BillingInvoiceSnapshotUncheckedUpdateInput;

    await this.prisma.billingInvoiceSnapshot.upsert({
      where: { providerInvoiceId },
      create: { providerInvoiceId, ...data },
      update: data,
    });
  }

  private async resolveLocalSubscriptionIdForInvoice(
    tenantId: string,
    invoice: StripeInvoiceRecord,
  ): Promise<string | null> {
    const providerSubscriptionId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : (invoice.subscription?.id ?? null);
    if (!providerSubscriptionId) {
      return null;
    }
    const row = await this.prisma.subscription.findFirst({
      where: { tenantId, providerSubscriptionId },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  /**
   * Persist a payment event derived from an invoice webhook. Idempotent on
   * `providerEventId` so retries are safe.
   */
  async recordInvoicePaymentEvent(
    tenantId: string,
    invoice: StripeInvoiceRecord,
    eventType: "paid" | "payment_failed" | "refunded",
  ): Promise<void> {
    const providerEventId = `${invoice.id}:${eventType}`;
    const subscriptionId = await this.resolveLocalSubscriptionIdForInvoice(
      tenantId,
      invoice,
    );
    const invoiceSnapshot = await this.prisma.billingInvoiceSnapshot.findUnique(
      {
        where: { providerInvoiceId: invoice.id },
        select: { id: true },
      },
    );
    const data = {
      tenantId,
      subscriptionId,
      invoiceSnapshotId: invoiceSnapshot?.id ?? null,
      provider: BILLING_PROVIDER,
      providerEventId,
      eventType,
      amount: invoice.amount_paid ?? null,
      currency: invoice.currency ?? null,
      status: invoice.status ?? eventType,
      occurredAt: new Date(),
      metadata: {
        chargeId:
          typeof invoice.charge === "string"
            ? invoice.charge
            : (invoice.charge?.id ?? null),
        paymentIntentId:
          typeof invoice.payment_intent === "string"
            ? invoice.payment_intent
            : (invoice.payment_intent?.id ?? null),
      } as unknown as Prisma.InputJsonValue,
    } satisfies Prisma.BillingPaymentEventUncheckedCreateInput;

    await this.prisma.billingPaymentEvent
      .create({ data })
      .catch((err: unknown) => {
        // Unique constraint on providerEventId — swallow duplicates so retries
        // don't 500 the webhook.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          return null;
        }
        throw err;
      });
  }

  /**
   * Replay a previously stored Stripe webhook event by id. The original
   * payload is re-parsed and `processStripeEvent` re-runs. Only the
   * operator console calls this — customer flows never need replay.
   */
  async replayStoredWebhookEvent(eventRowId: string): Promise<{
    eventId: string;
    eventType: string;
    duplicate: boolean;
  }> {
    const row = await this.prisma.billingWebhookEvent.findUnique({
      where: { id: eventRowId },
    });
    if (!row) {
      throw new NotFoundException({
        code: "WEBHOOK_EVENT_NOT_FOUND",
        message: "Webhook event not found",
      });
    }

    const payload = row.payload as unknown as StripeWebhookEventRecord | null;
    if (!payload || typeof payload !== "object") {
      throw new BadRequestException({
        code: "WEBHOOK_EVENT_PAYLOAD_MISSING",
        message: "Stored webhook payload is missing or unreadable",
      });
    }

    try {
      const syncResult = await this.processStripeEvent(payload);
      await this.prisma.billingWebhookEvent.update({
        where: { id: row.id },
        data: {
          processedAt: new Date(),
          errorMessage: null,
          tenantId: syncResult.tenantId ?? row.tenantId,
          subscriptionId: syncResult.subscriptionId ?? row.subscriptionId,
        },
      });
      return {
        eventId: row.providerEventId,
        eventType: row.eventType,
        duplicate: false,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown webhook replay error";
      await this.prisma.billingWebhookEvent.update({
        where: { id: row.id },
        data: { errorMessage: message },
      });
      throw err;
    }
  }

  /**
   * Force a Stripe → local sync for one tenant. Fetches the current Stripe
   * subscription (if any) plus recent invoices and persists snapshots.
   * Returns the refreshed local snapshot.
   */
  async syncTenantFromStripe(tenantId: string): Promise<TenantBillingSnapshot> {
    const subscription = await this.findCurrentSubscription(tenantId);
    if (subscription) {
      const stripeSubscription =
        await this.findStripeSubscriptionForLocalRecord(subscription);
      if (stripeSubscription) {
        await this.syncSubscriptionFromStripe(
          stripeSubscription,
          `manual:${tenantId}:${Date.now()}`,
          Math.floor(Date.now() / 1000),
        );
      }
      if (subscription.providerCustomerId) {
        await this.syncRecentInvoicesForCustomer(
          tenantId,
          subscription.providerCustomerId,
        );
      }
    }
    return this.getTenantPlanSnapshot(tenantId);
  }

  private async syncRecentInvoicesForCustomer(
    tenantId: string,
    customerId: string,
    limit = 20,
  ): Promise<void> {
    const stripe = this.getStripeClient();
    const result = await stripe.invoices.list({
      customer: customerId,
      limit,
    });
    for (const invoice of result.data) {
      await this.persistInvoiceSnapshot(
        tenantId,
        invoice as unknown as StripeInvoiceRecord,
      );
    }
  }

  /**
   * Operator-only: extend the local grace period for a tenant. Does NOT
   * mutate Stripe — the customer-facing entitlement gate reads
   * `Subscription.gracePeriodEndsAt`, so this is enough to keep publishing
   * unlocked while finance follows up.
   */
  async operatorExtendGracePeriod(
    tenantId: string,
    until: Date,
  ): Promise<TenantBillingSnapshot> {
    const subscription = await this.findCurrentSubscription(tenantId);
    if (!subscription) {
      throw new NotFoundException({
        code: "SUBSCRIPTION_NOT_FOUND",
        message: "No subscription exists for this tenant",
      });
    }
    if (until.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: "GRACE_PERIOD_INVALID",
        message: "Grace period must end in the future",
      });
    }
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { gracePeriodEndsAt: until },
    });
    return this.getTenantPlanSnapshot(tenantId);
  }

  /**
   * Operator-only: set `cancel_at_period_end=true` on the Stripe
   * subscription. The tenant keeps publishing through the period end; the
   * downstream webhook will flip the local row.
   */
  async operatorCancelAtPeriodEnd(
    tenantId: string,
  ): Promise<TenantBillingSnapshot> {
    const subscription = await this.findCurrentSubscription(tenantId);
    if (!subscription?.providerSubscriptionId) {
      throw new NotFoundException({
        code: "SUBSCRIPTION_NOT_FOUND",
        message: "Tenant has no active Stripe subscription",
      });
    }
    const stripe = this.getStripeClient();
    await stripe.subscriptions.update(subscription.providerSubscriptionId, {
      cancel_at_period_end: true,
    });
    return this.syncTenantFromStripe(tenantId);
  }

  /**
   * Operator-only: clear a pending `cancel_at_period_end` flag in Stripe.
   */
  async operatorReactivateSubscription(
    tenantId: string,
  ): Promise<TenantBillingSnapshot> {
    const subscription = await this.findCurrentSubscription(tenantId);
    if (!subscription?.providerSubscriptionId) {
      throw new NotFoundException({
        code: "SUBSCRIPTION_NOT_FOUND",
        message: "Tenant has no Stripe subscription to reactivate",
      });
    }
    const stripe = this.getStripeClient();
    await stripe.subscriptions.update(subscription.providerSubscriptionId, {
      cancel_at_period_end: false,
    });
    return this.syncTenantFromStripe(tenantId);
  }

  /**
   * Operator-only: refund a Stripe invoice. Resolves the underlying
   * `payment_intent` / `charge` and dispatches `stripe.refunds.create`.
   * Idempotency is enforced by an upstream `BillingActionRequest` so
   * approver-driven retries don't double refund.
   */
  async operatorRefundInvoice(
    tenantId: string,
    providerInvoiceId: string,
    options: { amount?: number | null; idempotencyKey: string; reason: string },
  ): Promise<{ refundId: string; status: string; amount: number | null }> {
    const stripe = this.getStripeClient();
    const invoiceResponse = await stripe.invoices.retrieve(providerInvoiceId);
    const invoice = invoiceResponse as unknown as StripeInvoiceRecord;
    const invoiceTenantId =
      invoice.metadata?.tenantId ??
      (await this.resolveTenantIdForInvoice(invoice));
    if (invoiceTenantId && invoiceTenantId !== tenantId) {
      throw new BadRequestException({
        code: "INVOICE_TENANT_MISMATCH",
        message: "Invoice does not belong to the selected tenant",
      });
    }
    const paymentIntent =
      typeof invoice.payment_intent === "string"
        ? invoice.payment_intent
        : (invoice.payment_intent?.id ?? null);
    const charge =
      typeof invoice.charge === "string"
        ? invoice.charge
        : (invoice.charge?.id ?? null);
    if (!paymentIntent && !charge) {
      throw new BadRequestException({
        code: "INVOICE_NOT_REFUNDABLE",
        message: "Invoice has no associated payment to refund",
      });
    }
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntent ?? undefined,
        charge: paymentIntent ? undefined : (charge ?? undefined),
        amount: options.amount ?? undefined,
        reason: "requested_by_customer",
        metadata: {
          tenantId,
          providerInvoiceId,
          operatorReason: options.reason.slice(0, 480),
        },
      },
      { idempotencyKey: options.idempotencyKey },
    );

    // Re-persist invoice snapshot to capture the new amount_remaining.
    await this.persistInvoiceSnapshot(tenantId, invoice);
    await this.recordInvoicePaymentEvent(tenantId, invoice, "refunded");

    return {
      refundId: refund.id,
      status: refund.status ?? "unknown",
      amount: refund.amount ?? null,
    };
  }
}
