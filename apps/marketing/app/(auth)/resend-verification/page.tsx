import type { Metadata } from "next";
import { OrbitAtmosphere } from "@/components/orbit-atmosphere";
import { VerificationRequestPlaceholder } from "@/components/verification-request-placeholder";

export const metadata: Metadata = {
  title: "Resend Verification — StayLayer",
  description:
    "Request another verification email for your StayLayer customer workspace.",
};

export default async function ResendVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
      <section className="space-y-6 rounded-[2.4rem] bg-[rgba(255,255,255,0.62)] p-8 shadow-[0_18px_50px_rgba(16,42,54,0.08)] backdrop-blur sm:p-10">
        <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
          Verification support
        </p>
        <h2 className="orbit-heading text-5xl leading-[0.98] text-[var(--orbit-midnight)]">
          Send a fresh verification link.
        </h2>
        <p className="text-sm leading-6 text-[rgba(16,42,54,0.74)]">
          Ask for a fresh verification link if the original email expired or
          never reached you.
        </p>

        <OrbitAtmosphere
          eyebrow="Verification state"
          title="Customer-facing support with live delivery."
          summary="The resend route now issues a real verification email without exposing whether the address exists in the system."
          badges={["Customer auth", "Real delivery", "Privacy-safe"]}
          details={[
            {
              label: "Current behavior",
              value:
                "Issues a fresh verification email for unverified accounts.",
            },
            {
              label: "Privacy",
              value:
                "The response stays generic so the screen never leaks whether an address exists.",
            },
          ]}
          className="mt-8"
        />
      </section>

      <VerificationRequestPlaceholder initialEmail={params.email || ""} />
    </div>
  );
}
