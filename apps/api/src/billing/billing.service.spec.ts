/// <reference types="jest" />

import { ConflictException, ForbiddenException } from "@nestjs/common";
import { SubscriptionStatus } from "@prisma/client";
import { BillingService } from "./billing.service";

function buildPrismaMock() {
  return {
    tenant: {
      findUnique: jest.fn(),
    },
    site: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    domain: {
      count: jest.fn(),
    },
    tenantMembership: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    page: {
      count: jest.fn(),
    },
    formSubmission: {
      count: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    billingWebhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

function buildConfigMock() {
  return {
    get: jest.fn((key: string) => {
      if (key === "STRIPE_WEBHOOK_SECRET") {
        return "whsec_test";
      }

      if (key === "STRIPE_SECRET_KEY") {
        return "sk_test_123";
      }

      if (key === "STRIPE_PRICE_STARTER_STAY") {
        return "price_starter";
      }

      if (key === "STRIPE_PRICE_BOUTIQUE_GROWTH") {
        return "price_boutique";
      }

      if (key === "STRIPE_PRICE_PORTFOLIO") {
        return "price_portfolio";
      }

      return undefined;
    }),
  };
}

function buildMailMock() {
  return {
    isConfigured: jest.fn().mockReturnValue(false),
    send: jest.fn(),
  };
}

function buildNotificationsMock() {
  return {
    createForTenantRoles: jest.fn().mockResolvedValue([]),
  };
}

function buildSubscription(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "db-sub-1",
    tenantId: "tenant-1",
    provider: "stripe",
    providerCustomerId: "cus_123",
    providerSubscriptionId: "sub_123",
    providerPriceId: "price_123",
    planKey: "starter_stay",
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date("2026-05-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
    pendingPlanKey: null,
    pendingPlanEffectiveAt: null,
    pendingPlanDirection: null,
    providerScheduleId: null,
    limitsSnapshot: null,
    gracePeriodEndsAt: null,
    lastWebhookEventId: null,
    lastWebhookAt: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("BillingService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let config: ReturnType<typeof buildConfigMock>;
  let mailer: ReturnType<typeof buildMailMock>;
  let notifications: ReturnType<typeof buildNotificationsMock>;
  let service: BillingService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-02T00:00:00.000Z"));
    prisma = buildPrismaMock();
    config = buildConfigMock();
    mailer = buildMailMock();
    notifications = buildNotificationsMock();
    service = new BillingService(
      prisma as never,
      config as never,
      mailer as never,
      notifications as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("falls back to a starter trial snapshot when a tenant has no Stripe subscription yet", async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: "tenant-1",
      name: "Harbor House",
      createdAt: new Date("2026-04-29T00:00:00.000Z"),
    });
    prisma.subscription.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.site.findMany.mockResolvedValue([
      { id: "site-1", enabledLocales: ["en"] },
    ]);
    prisma.tenantMembership.count.mockResolvedValue(2);
    prisma.page.count.mockResolvedValue(4);
    prisma.formSubmission.count.mockResolvedValue(12);
    prisma.domain.count.mockResolvedValue(0);

    const snapshot = await service.getTenantPlanSnapshot("tenant-1");

    expect(snapshot.planKey).toBe("free");
    expect(snapshot.status).toBe("active");
    expect(snapshot.usage).toEqual({
      sites: 1,
      locales: 1,
      seats: 2,
      formSubmissions: 12,
      pages: 4,
      domains: 0,
      translationCharactersThisMonth: 0,
      psiAuditsThisMonth: 0,
    });
    expect(snapshot.actions.publishingBlocked).toBe(false);
    expect(snapshot.isFreePlan).toBe(true);
  });

  it("blocks locale increases that exceed the current plan capacity", async () => {
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      tenantId: "tenant-1",
      enabledLocales: ["en"],
      primaryLocale: "en",
    });
    prisma.tenant.findUnique.mockResolvedValue({
      id: "tenant-1",
      name: "Harbor House",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    prisma.subscription.findFirst.mockResolvedValue(buildSubscription());
    prisma.site.findMany.mockResolvedValue([
      { id: "site-1", enabledLocales: ["en", "es"] },
    ]);
    prisma.tenantMembership.count.mockResolvedValue(2);
    prisma.page.count.mockResolvedValue(4);
    prisma.formSubmission.count.mockResolvedValue(12);
    prisma.domain.count.mockResolvedValue(0);

    await expect(
      service.assertCanUpdateSiteLocales("site-1", ["en", "es", "fr"]),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("blocks publishing after the billing grace period expires", async () => {
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      tenantId: "tenant-1",
      enabledLocales: ["en"],
      primaryLocale: "en",
    });
    prisma.tenant.findUnique.mockResolvedValue({
      id: "tenant-1",
      name: "Harbor House",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    prisma.subscription.findFirst.mockResolvedValue(
      buildSubscription({
        status: SubscriptionStatus.PAST_DUE,
        gracePeriodEndsAt: new Date("2026-05-01T00:00:00.000Z"),
      }),
    );
    prisma.site.findMany.mockResolvedValue([
      { id: "site-1", enabledLocales: ["en"] },
    ]);
    prisma.tenantMembership.count.mockResolvedValue(2);
    prisma.page.count.mockResolvedValue(4);
    prisma.formSubmission.count.mockResolvedValue(12);
    prisma.domain.count.mockResolvedValue(0);

    await expect(service.assertCanPublishSite("site-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("enforces the monthly inquiry limit from the hospitality plan", async () => {
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      tenantId: "tenant-1",
      enabledLocales: ["en"],
      primaryLocale: "en",
    });
    prisma.tenant.findUnique.mockResolvedValue({
      id: "tenant-1",
      name: "Harbor House",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    prisma.subscription.findFirst.mockResolvedValue(buildSubscription());
    prisma.site.findMany.mockResolvedValue([
      { id: "site-1", enabledLocales: ["en"] },
    ]);
    prisma.tenantMembership.count.mockResolvedValue(2);
    prisma.page.count.mockResolvedValue(4);
    prisma.formSubmission.count.mockResolvedValue(250);
    prisma.domain.count.mockResolvedValue(0);

    await expect(
      service.assertCanAcceptInquiry("site-1"),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("enforces the tenant domain limit from the hospitality plan", async () => {
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      tenantId: "tenant-1",
      enabledLocales: ["en"],
      primaryLocale: "en",
    });
    prisma.tenant.findUnique.mockResolvedValue({
      id: "tenant-1",
      name: "Harbor House",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    prisma.subscription.findFirst.mockResolvedValue(buildSubscription());
    prisma.site.findMany.mockResolvedValue([
      { id: "site-1", enabledLocales: ["en"] },
    ]);
    prisma.tenantMembership.count.mockResolvedValue(2);
    prisma.page.count.mockResolvedValue(4);
    prisma.formSubmission.count.mockResolvedValue(12);
    prisma.domain.count.mockResolvedValue(1);

    await expect(service.assertCanAddDomain("site-1")).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("records and applies a Stripe subscription webhook update", async () => {
    const stripeEvent = {
      id: "evt_123",
      type: "customer.subscription.updated",
      created: 1_777_000_000,
      data: {
        object: {
          id: "sub_stripe_123",
          customer: "cus_123",
          metadata: {
            tenantId: "tenant-1",
            planKey: "boutique_growth",
          },
          status: "active",
          items: {
            data: [{ price: { id: "price_bg_123" } }],
          },
          current_period_start: 1_777_000_000,
          current_period_end: 1_779_592_000,
          cancel_at_period_end: false,
        },
      },
    };

    prisma.billingWebhookEvent.findUnique.mockResolvedValue(null);
    prisma.billingWebhookEvent.create.mockResolvedValue({ id: "receipt-1" });
    prisma.subscription.findUnique.mockResolvedValue(null);
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.subscription.create.mockResolvedValue({ id: "db-sub-2" });
    prisma.tenant.findUnique.mockResolvedValue({ id: "tenant-1" });

    (service as unknown as { getStripeClient: jest.Mock }).getStripeClient =
      jest.fn().mockReturnValue({
        webhooks: {
          constructEvent: jest.fn().mockReturnValue(stripeEvent),
        },
      });

    const result = await service.handleStripeWebhook(
      "sig_test",
      Buffer.from("{}"),
    );

    expect(result).toEqual({
      received: true,
      duplicate: false,
      eventType: "customer.subscription.updated",
    });
    expect(prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          provider: "stripe",
          providerSubscriptionId: "sub_stripe_123",
          planKey: "boutique_growth",
          status: SubscriptionStatus.ACTIVE,
        }),
      }),
    );
    expect(prisma.billingWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          subscriptionId: "db-sub-2",
        }),
      }),
    );
  });

  it("backfills an active Stripe subscription when checkout intent exists but the webhook has not synced yet", async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: "tenant-1",
      name: "Harbor House",
      createdAt: new Date("2026-04-29T00:00:00.000Z"),
    });
    prisma.subscription.findFirst.mockResolvedValue(
      buildSubscription({
        planKey: "portfolio",
        status: SubscriptionStatus.INACTIVE,
        providerSubscriptionId: null,
        providerPriceId: null,
      }),
    );
    prisma.site.findMany.mockResolvedValue([
      { id: "site-1", enabledLocales: ["en"] },
    ]);
    prisma.tenantMembership.count.mockResolvedValue(2);
    prisma.page.count.mockResolvedValue(4);
    prisma.formSubmission.count.mockResolvedValue(12);
    prisma.domain.count.mockResolvedValue(0);
    prisma.subscription.update.mockResolvedValue({ id: "db-sub-1" });
    prisma.subscription.findUnique.mockResolvedValue(
      buildSubscription({
        id: "db-sub-1",
        planKey: "portfolio",
        status: SubscriptionStatus.ACTIVE,
        providerSubscriptionId: "sub_live_123",
        providerPriceId: "price_1TUwbaABhhopzfYDSGg2XVZX",
        currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
        lastWebhookAt: new Date("2026-05-02T00:00:00.000Z"),
      }),
    );

    (service as unknown as { getStripeClient: jest.Mock }).getStripeClient =
      jest.fn().mockReturnValue({
        subscriptions: {
          list: jest.fn().mockResolvedValue({
            data: [
              {
                id: "sub_live_123",
                customer: "cus_123",
                metadata: {
                  tenantId: "tenant-1",
                  planKey: "portfolio",
                },
                status: "active",
                items: {
                  data: [{ price: { id: "price_1TUwbaABhhopzfYDSGg2XVZX" } }],
                },
                current_period_start: 1_777_000_000,
                current_period_end: 1_779_592_000,
                cancel_at_period_end: false,
              },
            ],
          }),
        },
      });

    const snapshot = await service.getTenantPlanSnapshot("tenant-1");

    expect(snapshot.planKey).toBe("portfolio");
    expect(snapshot.status).toBe("active");
    expect(snapshot.actions.publishingBlocked).toBe(false);
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          planKey: "portfolio",
          status: SubscriptionStatus.ACTIVE,
          providerSubscriptionId: "sub_live_123",
        }),
      }),
    );
  });

  it("updates an active Stripe subscription with immediate proration", async () => {
    const currentSnapshot = {
      tenantId: "tenant-1",
      planKey: "starter_stay",
      planName: "Starter Stay",
      description: "Single-property plan",
      provider: "stripe",
      status: "active",
      renewsAt: new Date("2026-06-01T00:00:00.000Z"),
      currentPeriodStart: new Date("2026-05-01T00:00:00.000Z"),
      gracePeriodEndsAt: null,
      limits: {},
      usage: {},
      source: "stripe",
      providerCustomerId: "cus_123",
      providerSubscriptionId: "sub_live_123",
      cancelAtPeriodEnd: false,
      actions: {},
      lastWebhookAt: null,
      subscriptionId: "db-sub-1",
      isFreePlan: false,
    };
    const updatedSnapshot = {
      ...currentSnapshot,
      planKey: "boutique_growth",
      planName: "Boutique Growth",
    };
    const retrieve = jest.fn().mockResolvedValue({
      id: "sub_live_123",
      metadata: { tenantId: "tenant-1", planKey: "starter_stay" },
      items: {
        data: [{ id: "si_123", quantity: 1, price: { id: "price_starter" } }],
      },
    });
    const update = jest.fn().mockResolvedValue({
      id: "sub_live_123",
      customer: "cus_123",
      metadata: { tenantId: "tenant-1", planKey: "boutique_growth" },
      status: "active",
      items: {
        data: [{ price: { id: "price_boutique" } }],
      },
      current_period_start: 1_777_000_000,
      current_period_end: 1_779_592_000,
      cancel_at_period_end: false,
    });

    jest
      .spyOn(service, "getTenantPlanSnapshot")
      .mockResolvedValueOnce(currentSnapshot as never)
      .mockResolvedValueOnce(updatedSnapshot as never);
    jest
      .spyOn(service, "syncSubscriptionFromStripe")
      .mockResolvedValue({ tenantId: "tenant-1", subscriptionId: "db-sub-1" });
    (service as unknown as { getStripeClient: jest.Mock }).getStripeClient =
      jest.fn().mockReturnValue({
        subscriptions: {
          retrieve,
          update,
        },
      });

    const snapshot = await service.updateSubscriptionPlan(
      "tenant-1",
      "boutique_growth",
    );

    expect(update).toHaveBeenCalledWith("sub_live_123", {
      cancel_at_period_end: false,
      items: [{ id: "si_123", price: "price_boutique", quantity: 1 }],
      metadata: {
        tenantId: "tenant-1",
        planKey: "boutique_growth",
        pendingPlanKey: "",
        pendingPlanEffectiveAt: "",
        pendingPlanDirection: "",
      },
      payment_behavior: "pending_if_incomplete",
      proration_behavior: "always_invoice",
    });
    expect(snapshot.planKey).toBe("boutique_growth");
  });

  it("schedules downgrades at period end without immediate invoicing", async () => {
    const currentSnapshot = {
      tenantId: "tenant-1",
      planKey: "portfolio",
      planName: "Portfolio",
      description: "Portfolio plan",
      provider: "stripe",
      status: "active",
      renewsAt: new Date("2026-06-01T00:00:00.000Z"),
      currentPeriodStart: new Date("2026-05-01T00:00:00.000Z"),
      gracePeriodEndsAt: null,
      limits: {},
      usage: {},
      source: "stripe",
      providerCustomerId: "cus_123",
      providerSubscriptionId: "sub_live_123",
      cancelAtPeriodEnd: false,
      actions: {},
      lastWebhookAt: null,
      subscriptionId: "db-sub-1",
      isFreePlan: false,
      pendingPlanChange: null,
    };
    const scheduledSnapshot = {
      ...currentSnapshot,
      pendingPlanChange: {
        planKey: "boutique_growth",
        planName: "Boutique Growth",
        direction: "downgrade",
        effectiveAt: new Date("2026-06-01T00:00:00.000Z"),
        providerScheduleId: "sub_sched_123",
      },
    };
    const retrieve = jest.fn().mockResolvedValue({
      id: "sub_live_123",
      metadata: { tenantId: "tenant-1", planKey: "portfolio" },
      items: {
        data: [{ id: "si_123", quantity: 1, price: { id: "price_portfolio" } }],
      },
    });
    const createSchedule = jest.fn().mockResolvedValue({ id: "sub_sched_123" });
    const updateSchedule = jest.fn().mockResolvedValue({ id: "sub_sched_123" });

    jest
      .spyOn(service, "getTenantPlanSnapshot")
      .mockResolvedValueOnce(currentSnapshot as never)
      .mockResolvedValueOnce(scheduledSnapshot as never);
    (service as unknown as { getStripeClient: jest.Mock }).getStripeClient =
      jest.fn().mockReturnValue({
        subscriptions: { retrieve },
        subscriptionSchedules: {
          create: createSchedule,
          update: updateSchedule,
        },
      });

    const snapshot = await service.updateSubscriptionPlan(
      "tenant-1",
      "boutique_growth",
    );

    expect(createSchedule).toHaveBeenCalledWith({
      from_subscription: "sub_live_123",
    });
    expect(updateSchedule).toHaveBeenCalledWith(
      "sub_sched_123",
      expect.objectContaining({
        end_behavior: "release",
        proration_behavior: "none",
        phases: expect.arrayContaining([
          expect.objectContaining({
            items: [{ price: "price_portfolio", quantity: 1 }],
            proration_behavior: "none",
          }),
          expect.objectContaining({
            items: [{ price: "price_boutique", quantity: 1 }],
            proration_behavior: "none",
          }),
        ]),
      }),
    );
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "db-sub-1" },
        data: expect.objectContaining({
          pendingPlanKey: "boutique_growth",
          pendingPlanDirection: "downgrade",
          providerScheduleId: "sub_sched_123",
        }),
      }),
    );
    expect(snapshot.pendingPlanChange?.planKey).toBe("boutique_growth");
  });

  it("cancels a scheduled downgrade by releasing the Stripe schedule", async () => {
    const currentSnapshot = {
      tenantId: "tenant-1",
      planKey: "portfolio",
      planName: "Portfolio",
      description: "Portfolio plan",
      provider: "stripe",
      status: "active",
      renewsAt: new Date("2026-06-01T00:00:00.000Z"),
      currentPeriodStart: new Date("2026-05-01T00:00:00.000Z"),
      gracePeriodEndsAt: null,
      limits: {},
      usage: {},
      source: "stripe",
      providerCustomerId: "cus_123",
      providerSubscriptionId: "sub_live_123",
      cancelAtPeriodEnd: false,
      actions: {},
      lastWebhookAt: null,
      subscriptionId: "db-sub-1",
      isFreePlan: false,
      pendingPlanChange: {
        planKey: "boutique_growth",
        planName: "Boutique Growth",
        direction: "downgrade",
        effectiveAt: new Date("2026-06-01T00:00:00.000Z"),
        providerScheduleId: "sub_sched_123",
      },
    };
    const releaseSchedule = jest
      .fn()
      .mockResolvedValue({ id: "sub_sched_123" });

    jest
      .spyOn(service, "getTenantPlanSnapshot")
      .mockResolvedValueOnce(currentSnapshot as never)
      .mockResolvedValueOnce({
        ...currentSnapshot,
        pendingPlanChange: null,
      } as never);
    (service as unknown as { getStripeClient: jest.Mock }).getStripeClient =
      jest.fn().mockReturnValue({
        subscriptionSchedules: { release: releaseSchedule },
      });

    const snapshot =
      await service.cancelPendingSubscriptionPlanChange("tenant-1");

    expect(releaseSchedule).toHaveBeenCalledWith("sub_sched_123");
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "db-sub-1" },
      }),
    );
    expect(snapshot.pendingPlanChange).toBeNull();
  });

  // ── Launch checklist: "billing webhooks are reliable and idempotent" ──────────
  it("returns duplicate:true without re-processing a webhook event it has already seen", async () => {
    const stripeEvent = {
      id: "evt_already_seen",
      type: "customer.subscription.updated",
      data: { object: {} },
    };

    prisma.billingWebhookEvent.findUnique.mockResolvedValue({
      id: "receipt-existing",
    });

    (service as unknown as { getStripeClient: jest.Mock }).getStripeClient =
      jest.fn().mockReturnValue({
        webhooks: {
          constructEvent: jest.fn().mockReturnValue(stripeEvent),
        },
      });

    const result = await service.handleStripeWebhook(
      "sig_test",
      Buffer.from("{}"),
    );

    expect(result).toEqual({
      received: true,
      duplicate: true,
      eventType: "customer.subscription.updated",
    });
    // Must not touch subscriptions when replaying a seen event
    expect(prisma.billingWebhookEvent.create).not.toHaveBeenCalled();
    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  // ── E2E path #4: "failed payment -> plan state changes -> restricted behavior" ─
  it("updates a subscription to PAST_DUE and sets a grace period when Stripe reports payment failure", async () => {
    const stripeEvent = {
      id: "evt_payment_fail",
      type: "customer.subscription.updated",
      created: 1_777_000_000,
      data: {
        object: {
          id: "sub_stripe_456",
          customer: "cus_456",
          metadata: { tenantId: "tenant-2", planKey: "starter_stay" },
          status: "past_due",
          items: { data: [{ price: { id: "price_starter_123" } }] },
          current_period_start: 1_777_000_000,
          current_period_end: 1_779_592_000,
          cancel_at_period_end: false,
        },
      },
    };

    prisma.billingWebhookEvent.findUnique.mockResolvedValue(null);
    prisma.billingWebhookEvent.create.mockResolvedValue({ id: "receipt-2" });
    // Existing subscription on record — triggers update path
    prisma.subscription.findUnique.mockResolvedValue({
      id: "db-sub-existing",
      tenantId: "tenant-2",
      gracePeriodEndsAt: null,
    });
    prisma.subscription.update.mockResolvedValue({ id: "db-sub-existing" });
    prisma.tenant.findUnique.mockResolvedValue({ id: "tenant-2" });

    (service as unknown as { getStripeClient: jest.Mock }).getStripeClient =
      jest.fn().mockReturnValue({
        webhooks: {
          constructEvent: jest.fn().mockReturnValue(stripeEvent),
        },
      });

    const result = await service.handleStripeWebhook(
      "sig_test",
      Buffer.from("{}"),
    );

    expect(result).toEqual({
      received: true,
      duplicate: false,
      eventType: "customer.subscription.updated",
    });
    // Grace period must be set (7 days from the mocked "now" = 2026-05-02)
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "db-sub-existing" },
        data: expect.objectContaining({
          status: SubscriptionStatus.PAST_DUE,
          gracePeriodEndsAt: new Date("2026-05-09T00:00:00.000Z"),
        }),
      }),
    );
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it("ignores a Stripe subscription webhook when the referenced tenant no longer exists", async () => {
    const stripeEvent = {
      id: "evt_stale_tenant",
      type: "customer.subscription.updated",
      created: 1_777_000_000,
      data: {
        object: {
          id: "sub_stripe_stale",
          customer: "cus_stale",
          metadata: {
            tenantId: "tenant-missing",
            planKey: "starter_stay",
          },
          status: "active",
          items: {
            data: [{ price: { id: "price_starter_123" } }],
          },
          current_period_start: 1_777_000_000,
          current_period_end: 1_779_592_000,
          cancel_at_period_end: false,
        },
      },
    };

    prisma.billingWebhookEvent.findUnique.mockResolvedValue(null);
    prisma.billingWebhookEvent.create.mockResolvedValue({
      id: "receipt-stale",
    });
    prisma.subscription.findUnique.mockResolvedValue(null);
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.tenant.findUnique.mockResolvedValue(null);

    (service as unknown as { getStripeClient: jest.Mock }).getStripeClient =
      jest.fn().mockReturnValue({
        webhooks: {
          constructEvent: jest.fn().mockReturnValue(stripeEvent),
        },
      });

    const result = await service.handleStripeWebhook(
      "sig_test",
      Buffer.from("{}"),
    );

    expect(result).toEqual({
      received: true,
      duplicate: false,
      eventType: "customer.subscription.updated",
    });
    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(prisma.billingWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "receipt-stale" },
        data: expect.objectContaining({
          processedAt: expect.any(Date),
        }),
      }),
    );
  });
});
