import type { Metadata } from "next";
import Link from "next/link";
import { OrbitAtmosphere } from "@/components/orbit-atmosphere";
import { OrbitLink } from "@/components/orbit-button";
import { VerifyEmailStatus } from "@/components/verify-email-status";

export const metadata: Metadata = {
  title: "Verify Email — StayLayer",
  description: "Email verification status for StayLayer customer access.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string; returnTo?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <section className="space-y-6 rounded-[2.4rem] bg-[rgba(255,255,255,0.62)] p-8 shadow-[0_18px_50px_rgba(16,42,54,0.08)] backdrop-blur sm:p-10">
        <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
          Verify email
        </p>
        <h1 className="orbit-heading text-5xl leading-[0.98] text-[var(--orbit-midnight)]">
          Verify your email and open the workspace.
        </h1>
        <p className="text-sm leading-6 text-[rgba(16,42,54,0.74)]">
          {params.email
            ? `This verification screen is prepared for ${params.email}. Use the secure email link to activate the workspace.`
            : "Use the secure email link we sent you to activate the workspace and continue into the dashboard."}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <OrbitLink href="/resend-verification" tone="primary">
            Request a new email
          </OrbitLink>
          <Link
            href="/login"
            className="text-sm text-[rgba(16,42,54,0.72)] hover:text-[var(--orbit-midnight)]"
          >
            Back to login
          </Link>
        </div>
      </section>

      <OrbitAtmosphere
        eyebrow="Verification support"
        title="Secure activation for the first dashboard session."
        summary="Verification now happens through a real email link so the first customer session starts on a confirmed address."
        badges={["Verify email", "Secure activation", "Real delivery"]}
        details={[
          {
            label: "Activation",
            value:
              "Verification confirms the email address before the dashboard session begins.",
          },
          {
            label: "If the link expires",
            value:
              "Request a fresh verification email from the resend page and continue from there.",
          },
        ]}
      />

      <VerifyEmailStatus
        token={params.token || null}
        email={params.email || null}
        returnTo={params.returnTo || null}
      />
    </div>
  );
}
