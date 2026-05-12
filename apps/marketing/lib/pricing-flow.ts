import type { MarketingPlanKey, PublicBillingPlan } from "@/lib/public-api";

export type { MarketingPlanKey };

export const MARKETING_PLAN_KEYS: MarketingPlanKey[] = [
  "free",
  "starter_stay",
  "boutique_growth",
  "portfolio",
];

export const PLAN_SELECTION_COPY: Record<
  MarketingPlanKey,
  {
    name: string;
    registerTitle: string;
    registerSummary: string;
  }
> = {
  free: {
    name: "Free",
    registerTitle: "Start with the free workspace.",
    registerSummary:
      "Create your workspace, shape your first site, and upgrade later when you are ready for more capacity.",
  },
  starter_stay: {
    name: "Starter Stay",
    registerTitle: "Create your workspace for Starter Stay.",
    registerSummary:
      "We create your account and workspace first, then handle the paid plan from inside billing where your subscription belongs.",
  },
  boutique_growth: {
    name: "Boutique Growth",
    registerTitle: "Create your workspace for Boutique Growth.",
    registerSummary:
      "Your workspace comes first. Billing, seats, and plan activation are handled after sign-up inside the account.",
  },
  portfolio: {
    name: "Portfolio",
    registerTitle: "Create your workspace for Portfolio.",
    registerSummary:
      "Set up the workspace first so portfolio billing and rollout decisions stay attached to the right account context.",
  },
};

type PlanRoutingShape = Pick<
  PublicBillingPlan,
  "key" | "isFree" | "salesMotion" | "checkoutEnabled"
>;

export function isMarketingPlanKey(
  value: string | null | undefined,
): value is MarketingPlanKey {
  return Boolean(
    value && MARKETING_PLAN_KEYS.includes(value as MarketingPlanKey),
  );
}

export function buildBillingReturnTo(
  planKey: MarketingPlanKey,
  checkoutEnabled: boolean,
) {
  const params = new URLSearchParams({ plan: planKey });

  if (checkoutEnabled) {
    params.set("intent", "checkout");
  }

  return `/billing?${params.toString()}`;
}

export function buildPlanRegisterHref(plan: PlanRoutingShape) {
  if (plan.isFree) {
    return "/register";
  }

  if (plan.salesMotion === "contact_sales") {
    return `/contact?plan=${plan.key}`;
  }

  const params = new URLSearchParams({
    plan: plan.key,
    returnTo: buildBillingReturnTo(plan.key, plan.checkoutEnabled),
  });

  return `/register?${params.toString()}`;
}

export function buildPlanLoginHref(plan: PlanRoutingShape) {
  if (plan.isFree) {
    return "/login";
  }

  if (plan.salesMotion === "contact_sales") {
    return `/contact?plan=${plan.key}`;
  }

  const params = new URLSearchParams({
    returnTo: buildBillingReturnTo(plan.key, plan.checkoutEnabled),
  });

  return `/login?${params.toString()}`;
}

export function getPlanMotionBadge(plan: PlanRoutingShape) {
  switch (plan.salesMotion) {
    case "self_serve":
      return "Start free";
    case "workspace_checkout":
      return plan.checkoutEnabled ? "Workspace checkout" : "Workspace setup";
    case "contact_sales":
      return "Talk to us";
    default:
      return "Choose plan";
  }
}

export function getPlanSupportCopy(plan: PlanRoutingShape) {
  switch (plan.salesMotion) {
    case "self_serve":
      return "Create your workspace now and start shaping your site without a credit card.";
    case "workspace_checkout":
      return plan.checkoutEnabled
        ? "Create your workspace first, then continue to secure Stripe checkout from billing."
        : "Create your workspace first. Paid billing is completed from inside the account once checkout is live for this plan.";
    case "contact_sales":
      return "Tell us about your rollout and we will help scope the right setup.";
    default:
      return "Choose the plan that fits your launch stage.";
  }
}
