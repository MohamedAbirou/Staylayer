import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Prisma,
  SiteStatus,
  Subscription,
  SubscriptionStatus,
} from "@prisma/client";
import Stripe = require("stripe");
import { PrismaService } from "../prisma/prisma.service";
import {
  BILLING_DEFAULT_PLAN_KEY,
  BILLING_ENFORCEMENT_POLICY,
  BILLING_PLANS,
  BILLING_PROVIDER,
  getBillingPlan,
  isBillingPlanKey,
  isPaidPlanKey,
} from "./billing-plans";
import {
  AdminSubscriptionListItem,
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
      price?: {
        id?: string | null;
      } | null;
    }>;
  };
  current_period_start: number | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
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

type CheckoutUser = {
  email?: string;
};

const ACTIVE_ADMIN_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
];

@Injectable()
export class BillingService {
  private stripeClient: InstanceType<typeof Stripe> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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

    const planKey = this.getPlanKeyOrThrow(subscription.planKey);
    const plan = getBillingPlan(planKey);
    const limits =
      this.parseLimitsSnapshot(subscription.limitsSnapshot) ?? plan.limits;
    const status = this.toPublicStatus(subscription.status);

    return {
      tenantId: tenant.id,
      planKey,
      planName: plan.name,
      description: plan.description,
      provider: BILLING_PROVIDER,
      status,
      renewsAt: subscription.currentPeriodEnd,
      currentPeriodStart: subscription.currentPeriodStart,
      gracePeriodEndsAt: subscription.gracePeriodEndsAt,
      limits,
      usage,
      source: "stripe",
      providerCustomerId: subscription.providerCustomerId,
      providerSubscriptionId: subscription.providerSubscriptionId,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      actions: this.buildActionState(status, subscription.gracePeriodEndsAt),
      lastWebhookAt: subscription.lastWebhookAt,
      subscriptionId: subscription.id,
      isFreePlan: plan.isFree,
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
        gracePeriodEndsAt: true,
      },
    });
    const tenantId = await this.resolveTenantIdForStripeSubscription(
      stripeSubscription,
      existingByProviderId?.tenantId,
      providerCustomerId,
    );
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
          select: { id: true },
        });

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
        return this.syncSubscriptionFromStripe(
          event.data.object as StripeSubscriptionRecord,
          event.id,
          event.created,
        );
      case "checkout.session.completed":
        return this.recordCheckoutCompletion(
          event.data.object as StripeCheckoutSessionRecord,
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

  private async getTenantUsage(tenantId: string): Promise<BillingUsageTotals> {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [sites, seats, pages, formSubmissions, domains, translationUsage] =
      await Promise.all([
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
    };
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
  ): Promise<string> {
    const metadataTenantId = stripeSubscription.metadata?.tenantId;

    if (metadataTenantId) {
      return metadataTenantId;
    }

    if (existingTenantId) {
      return existingTenantId;
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

      if (previousSubscription) {
        return previousSubscription.tenantId;
      }
    }

    throw new BadRequestException({
      code: "TENANT_ID_REQUIRED",
      message: "Stripe subscription metadata did not include a tenant id",
    });
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
}
