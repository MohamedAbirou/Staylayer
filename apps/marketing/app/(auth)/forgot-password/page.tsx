import type { Metadata } from "next";
import { OrbitAtmosphere } from "@/components/orbit-atmosphere";
import { ResetRequestPlaceholder } from "@/components/reset-request-placeholder";

export const metadata: Metadata = {
  title: "Reset Password — StayLayer",
  description:
    "Request a password reset link for your StayLayer customer workspace.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
      <section className="space-y-6 rounded-[2.4rem] bg-[rgba(255,255,255,0.62)] p-8 shadow-[0_18px_50px_rgba(16,42,54,0.08)] backdrop-blur sm:p-10">
        <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
          Reset request
        </p>
        <h2 className="orbit-heading text-5xl leading-[0.98] text-[var(--orbit-midnight)]">
          Request a secure password reset.
        </h2>
        <p className="text-sm leading-6 text-[rgba(16,42,54,0.74)]">
          Request a secure password reset link and finish recovery from your
          inbox.
        </p>

        <OrbitAtmosphere
          eyebrow="Recovery support"
          title="Email-based recovery for customer access."
          summary="Reset delivery now runs through the real customer auth flow without revealing whether the address exists."
          badges={["Public route", "Real delivery", "Privacy-safe"]}
          details={[
            {
              label: "Current state",
              value:
                "Recovery requests now issue secure reset links for matching accounts.",
            },
            {
              label: "Privacy",
              value:
                "The response is intentionally generic so account existence is never exposed.",
            },
          ]}
          className="mt-8"
        />
      </section>

      <ResetRequestPlaceholder />
    </div>
  );
}
