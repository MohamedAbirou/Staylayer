/// <reference types="jest" />

import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Request } from "express";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { WorkspaceAccessService } from "../auth/workspace-access.service";

function buildRequest(overrides: Partial<Request> = {}): Request {
  return {
    user: {
      id: "user-1",
      email: "owner@harbor.test",
      activeTenantId: "tenant-a",
      activeMembershipRole: "OWNER",
    },
    query: {},
    headers: {},
    params: {},
    ...overrides,
  } as Request;
}

describe("BillingController", () => {
  let controller: BillingController;
  let billingService: {
    getTenantPlanSnapshot: jest.Mock;
    createCheckoutSession: jest.Mock;
    updateSubscriptionPlan: jest.Mock;
    createPortalSession: jest.Mock;
  };
  let workspaceAccessService: {
    ensureTenantAccess: jest.Mock;
  };

  beforeEach(() => {
    billingService = {
      getTenantPlanSnapshot: jest.fn(),
      createCheckoutSession: jest.fn(),
      updateSubscriptionPlan: jest.fn(),
      createPortalSession: jest.fn(),
    };
    workspaceAccessService = {
      ensureTenantAccess: jest.fn(),
    };

    controller = new BillingController(
      billingService as unknown as BillingService,
      workspaceAccessService as unknown as WorkspaceAccessService,
    );
  });

  it("uses the resolved tenant scope when reading the plan", async () => {
    workspaceAccessService.ensureTenantAccess.mockResolvedValue("tenant-a");
    billingService.getTenantPlanSnapshot.mockResolvedValue({
      planKey: "starter_stay",
      planName: "Starter Stay",
      description: "For independent hospitality operators",
      status: "trialing",
      renewsAt: null,
      currentPeriodStart: null,
      gracePeriodEndsAt: null,
      limits: {
        sites: 1,
        locales: 1,
        pages: 10,
        seats: 2,
        formSubmissions: 100,
      },
      usage: {
        sites: 1,
        locales: 1,
        pages: 3,
        seats: 1,
        formSubmissions: 12,
      },
      provider: "stripe",
      providerCustomerId: null,
      providerSubscriptionId: null,
      cancelAtPeriodEnd: false,
      actions: {
        canStartCheckout: true,
        canManageBilling: true,
        publishingBlocked: false,
      },
      lastWebhookAt: null,
      source: "trial",
      subscriptionId: null,
    });

    await controller.getPlan("tenant-b", buildRequest());

    expect(workspaceAccessService.ensureTenantAccess).toHaveBeenCalledWith(
      expect.objectContaining({ params: {} }),
      "tenant-b",
    );
    expect(billingService.getTenantPlanSnapshot).toHaveBeenCalledWith(
      "tenant-a",
    );
  });

  it("fails closed before checkout when tenant access is denied", async () => {
    const error = new ForbiddenException();
    workspaceAccessService.ensureTenantAccess.mockRejectedValue(error);

    await expect(
      controller.createCheckoutSession(
        "tenant-b",
        {
          planKey: "starter_stay",
          successUrl: "http://localhost:5173/billing/success",
          cancelUrl: "http://localhost:5173/billing/cancel",
        },
        buildRequest(),
      ),
    ).rejects.toBe(error);

    expect(billingService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects unsupported plan keys before calling the billing service", async () => {
    workspaceAccessService.ensureTenantAccess.mockResolvedValue("tenant-a");

    await expect(
      controller.createCheckoutSession(
        "tenant-a",
        {
          planKey: "unknown_plan",
          successUrl: "http://localhost:5173/billing/success",
          cancelUrl: "http://localhost:5173/billing/cancel",
        },
        buildRequest(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(billingService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("uses the resolved tenant scope when creating a checkout session", async () => {
    workspaceAccessService.ensureTenantAccess.mockResolvedValue("tenant-a");
    billingService.createCheckoutSession.mockResolvedValue({
      provider: "stripe",
      sessionId: "cs_test_123",
      checkoutUrl: "https://checkout.stripe.com/c/pay/test",
      customerId: "cus_test_123",
      planKey: "starter_stay",
    });

    await controller.createCheckoutSession(
      "tenant-b",
      {
        planKey: "starter_stay",
        successUrl: "http://localhost:5173/billing/success",
        cancelUrl: "http://localhost:5173/billing/cancel",
      },
      buildRequest(),
    );

    expect(billingService.createCheckoutSession).toHaveBeenCalledWith(
      "tenant-a",
      "starter_stay",
      expect.objectContaining({ email: "owner@harbor.test" }),
      {
        successUrl: "http://localhost:5173/billing/success",
        cancelUrl: "http://localhost:5173/billing/cancel",
      },
    );
  });

  it("uses the resolved tenant scope when creating a billing portal session", async () => {
    workspaceAccessService.ensureTenantAccess.mockResolvedValue("tenant-a");
    billingService.createPortalSession.mockResolvedValue({
      provider: "stripe",
      customerId: "cus_test_123",
      portalUrl: "https://billing.stripe.com/p/session/test",
    });

    await controller.createPortalSession(
      "tenant-b",
      {
        returnUrl: "http://localhost:5173/billing",
      },
      buildRequest(),
    );

    expect(billingService.createPortalSession).toHaveBeenCalledWith(
      "tenant-a",
      "http://localhost:5173/billing",
    );
  });

  it("uses the resolved tenant scope when changing a subscription plan", async () => {
    workspaceAccessService.ensureTenantAccess.mockResolvedValue("tenant-a");
    billingService.updateSubscriptionPlan.mockResolvedValue({
      planKey: "boutique_growth",
      planName: "Boutique Growth",
      description: "Growth plan",
      status: "active",
      renewsAt: null,
      currentPeriodStart: null,
      gracePeriodEndsAt: null,
      limits: {},
      usage: {},
      provider: "stripe",
      providerCustomerId: "cus_test_123",
      providerSubscriptionId: "sub_test_123",
      cancelAtPeriodEnd: false,
      actions: {},
      lastWebhookAt: null,
      source: "stripe",
      subscriptionId: "db-sub-1",
      isFreePlan: false,
    });

    await controller.updateSubscriptionPlan(
      "tenant-b",
      { planKey: "boutique_growth" },
      buildRequest(),
    );

    expect(billingService.updateSubscriptionPlan).toHaveBeenCalledWith(
      "tenant-a",
      "boutique_growth",
    );
  });
});
