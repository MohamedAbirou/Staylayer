import type { Metadata } from "next";
import { OrbitAtmosphere } from "@/components/orbit-atmosphere";
import { RegisterForm } from "@/components/register-form";
import { getLegalDocuments } from "@/lib/public-api";
import { isMarketingPlanKey, PLAN_SELECTION_COPY } from "@/lib/pricing-flow";

export const metadata: Metadata = {
  title: "Create Your Workspace — StayLayer",
  description:
    "Create a StayLayer workspace, set up your hospitality site, and continue to billing from inside your account when you need a paid plan.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; returnTo?: string }>;
}) {
  const params = await searchParams;
  const documents = await getLegalDocuments();
  const requiredDocuments = documents.filter(
    (document) => document.requiresAcceptanceAtSignup,
  );
  const selectedPlanKey = isMarketingPlanKey(params.plan) ? params.plan : null;
  const planCopy = PLAN_SELECTION_COPY[selectedPlanKey || "free"];
  const badges =
    selectedPlanKey && selectedPlanKey !== "free"
      ? [planCopy.name, "Workspace first", "Billing inside account"]
      : ["Free plan", "First site", "No credit card"];
  const details =
    selectedPlanKey && selectedPlanKey !== "free"
      ? [
          {
            label: "Plan",
            value: planCopy.name,
          },
          {
            label: "Flow",
            value:
              "Create the workspace first, then continue to billing inside the account.",
          },
        ]
      : [
          {
            label: "Includes",
            value:
              "One workspace, one site, and onboarding for your first launch.",
          },
          {
            label: "Upgrade path",
            value:
              "Move to a paid plan later from billing inside the workspace.",
          },
        ];

  return (
    <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
      <section className="space-y-6 rounded-[2.4rem] bg-[rgba(255,255,255,0.62)] p-8 shadow-[0_18px_50px_rgba(16,42,54,0.08)] backdrop-blur sm:p-10">
        <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
          Workspace setup
        </p>
        <h2 className="orbit-heading text-5xl leading-[0.98] text-[var(--orbit-midnight)]">
          {planCopy.registerTitle}
        </h2>
        <p className="text-sm leading-6 text-[rgba(16,42,54,0.74)]">
          {planCopy.registerSummary}
        </p>

        <OrbitAtmosphere
          eyebrow="What happens next"
          title="A real workspace, ready for your first launch steps."
          summary="Sign-up creates your account, your workspace, and the first site context so the rest of the journey happens inside your own environment."
          badges={badges}
          details={details}
          className="mt-8"
        />
      </section>

      <RegisterForm
        legalDocuments={requiredDocuments}
        selectedPlanKey={selectedPlanKey}
        returnTo={params.returnTo || null}
      />
    </div>
  );
}
