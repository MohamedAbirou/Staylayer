/// <reference types="jest" />

import {
  BILLING_DEFAULT_TRIAL_DAYS,
  BILLING_ENFORCEMENT_POLICY,
  BILLING_PLANS,
  BILLING_PROVIDER,
  getBillingPlan,
} from "./billing-plans";

describe("billing plans", () => {
  it("uses Stripe as the billing provider for every hospitality plan", () => {
    expect(BILLING_PROVIDER).toBe("stripe");

    for (const plan of Object.values(BILLING_PLANS)) {
      expect(plan.provider).toBe("stripe");
      if (plan.isFree) {
        expect(plan.stripePriceIdEnvVar).toBeNull();
      } else {
        expect(plan.stripePriceIdEnvVar).not.toBeNull();
        expect(plan.stripePriceIdEnvVar!.startsWith("STRIPE_PRICE_")).toBe(
          true,
        );
      }
    }
  });

  it("keeps hospitality limits increasing by plan tier", () => {
    const starter = getBillingPlan("starter_stay");
    const boutique = getBillingPlan("boutique_growth");
    const portfolio = getBillingPlan("portfolio");

    expect(starter.limits.sites).toBeLessThanOrEqual(boutique.limits.sites);
    expect(boutique.limits.sites).toBeLessThanOrEqual(portfolio.limits.sites);
    expect(starter.limits.locales).toBeLessThan(boutique.limits.locales);
    expect(boutique.limits.locales).toBeLessThanOrEqual(
      portfolio.limits.locales,
    );
    expect(starter.limits.seats).toBeLessThan(boutique.limits.seats);
    expect(boutique.limits.seats).toBeLessThan(portfolio.limits.seats);
    expect(starter.limits.formSubmissions).toBeLessThan(
      boutique.limits.formSubmissions,
    );
    expect(boutique.limits.formSubmissions).toBeLessThan(
      portfolio.limits.formSubmissions,
    );
  });

  it("defines the past-due policy explicitly", () => {
    expect(BILLING_DEFAULT_TRIAL_DAYS).toBe(14);
    expect(BILLING_ENFORCEMENT_POLICY.gracePeriodDays).toBe(7);
    expect(BILLING_ENFORCEMENT_POLICY.editingAllowedDuringGracePeriod).toBe(
      true,
    );
    expect(BILLING_ENFORCEMENT_POLICY.publishingBlockedAfterGracePeriod).toBe(
      true,
    );
    expect(BILLING_ENFORCEMENT_POLICY.publicSitesRemainLiveDuringPastDue).toBe(
      true,
    );
    expect(BILLING_ENFORCEMENT_POLICY.operatorOverrideAvailable).toBe(true);
  });
});
