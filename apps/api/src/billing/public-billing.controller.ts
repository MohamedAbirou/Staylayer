import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BILLING_PLANS, getBillingPlan } from "./billing-plans";
import {
  BillingPlanDefinition,
  BillingPlanKey,
  BillingSupportTier,
} from "./billing.types";

const PUBLIC_PLAN_ORDER: BillingPlanKey[] = [
  "free",
  "starter_stay",
  "boutique_growth",
  "portfolio",
];

@Controller("public/billing")
export class PublicBillingController {
  constructor(private readonly configService: ConfigService) {}

  @Get("plans")
  listPlans() {
    return {
      generatedAt: new Date().toISOString(),
      plans: PUBLIC_PLAN_ORDER.map((planKey) => {
        const plan = getBillingPlan(planKey);

        return {
          key: plan.key,
          name: plan.name,
          description: plan.description,
          isFree: plan.isFree,
          audience: plan.catalog.audience,
          promise: plan.catalog.promise,
          upgradeTrigger: plan.catalog.upgradeTrigger,
          ctaLabel: plan.catalog.ctaLabel,
          salesMotion: plan.catalog.salesMotion,
          checkoutEnabled: this.isCheckoutEnabled(plan),
          featured: plan.catalog.featured,
          limits: plan.limits,
          comparison: this.buildComparison(plan),
        };
      }),
      planCount: Object.keys(BILLING_PLANS).length,
    };
  }

  private buildComparison(plan: BillingPlanDefinition) {
    return {
      siteCapacity: this.formatCount(plan.limits.sites, "site"),
      languageCoverage: this.formatCount(plan.limits.locales, "language"),
      seatCapacity: this.formatCount(plan.limits.seats, "seat"),
      inquiryCapacity: `${plan.limits.formSubmissions} inquiry submissions per month`,
      pageCapacity:
        plan.limits.pages === null
          ? "Unlimited pages"
          : this.formatCount(plan.limits.pages, "page"),
      domainCapacity:
        plan.limits.domains === 0
          ? "No branded domain included"
          : this.formatCount(plan.limits.domains, "branded domain"),
      analytics: plan.limits.analyticsEnabled
        ? "Analytics included"
        : "Analytics unlocks on paid plans",
      exports: plan.limits.exportEnabled
        ? plan.limits.scheduledExports
          ? "Exports and scheduled exports included"
          : "Exports included"
        : "No export workflows included",
      translationAllowance:
        plan.limits.translationCharactersPerMonth > 0
          ? `${plan.limits.translationCharactersPerMonth.toLocaleString()} translation characters per month`
          : "No translation allowance included",
      support: this.formatSupportTier(plan.limits.supportTier),
    };
  }

  private isCheckoutEnabled(plan: BillingPlanDefinition) {
    if (plan.isFree || !plan.stripePriceIdEnvVar) {
      return false;
    }

    return Boolean(
      this.configService.get<string>(plan.stripePriceIdEnvVar)?.trim(),
    );
  }

  private formatCount(value: number, singular: string): string {
    return `${value} ${singular}${value === 1 ? "" : "s"}`;
  }

  private formatSupportTier(supportTier: BillingSupportTier): string {
    switch (supportTier) {
      case "docs":
        return "Documentation-first support";
      case "email":
        return "Email support";
      case "priority":
        return "Priority support";
      case "white_glove":
        return "White-glove support";
      default:
        return "Support included";
    }
  }
}
