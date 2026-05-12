/// <reference types="jest" />

import { BILLING_PLANS } from "./billing-plans";
import { PublicBillingController } from "./public-billing.controller";

describe("PublicBillingController", () => {
  let controller: PublicBillingController;

  beforeEach(() => {
    controller = new PublicBillingController({
      get: jest.fn().mockReturnValue(undefined),
    } as never);
  });

  it("publishes a public-safe catalog derived from backend billing truth", () => {
    const result = controller.listPlans();

    expect(result.planCount).toBe(Object.keys(BILLING_PLANS).length);
    expect(result.generatedAt).toEqual(expect.any(String));

    const freePlan = result.plans.find((plan) => plan.key === "free");

    expect(freePlan).toEqual(
      expect.objectContaining({
        name: BILLING_PLANS.free.name,
        description: BILLING_PLANS.free.description,
        isFree: true,
        ctaLabel: "Start free",
        salesMotion: "self_serve",
        checkoutEnabled: false,
        limits: BILLING_PLANS.free.limits,
      }),
    );
    expect(result.plans.every((plan) => !("stripePriceIdEnvVar" in plan))).toBe(
      true,
    );
  });

  it("marks paid tiers for workspace checkout in the public funnel", () => {
    const result = controller.listPlans();
    const paidPlans = result.plans.filter((plan) => !plan.isFree);

    expect(paidPlans).toHaveLength(3);
    expect(paidPlans.map((plan) => plan.key)).toEqual([
      "starter_stay",
      "boutique_growth",
      "portfolio",
    ]);
    expect(
      paidPlans.every((plan) => plan.salesMotion === "workspace_checkout"),
    ).toBe(true);
    expect(paidPlans.every((plan) => plan.checkoutEnabled === false)).toBe(
      true,
    );
    expect(paidPlans[0]?.featured).toBe(true);
  });
});
