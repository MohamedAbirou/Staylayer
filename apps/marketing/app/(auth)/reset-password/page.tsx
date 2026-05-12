import type { Metadata } from "next";
import { OrbitAtmosphere } from "@/components/orbit-atmosphere";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = {
  title: "Choose New Password — StayLayer",
  description: "Set a new password for your StayLayer customer workspace.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
      <section className="space-y-6 rounded-[2.4rem] bg-[rgba(255,255,255,0.62)] p-8 shadow-[0_18px_50px_rgba(16,42,54,0.08)] backdrop-blur sm:p-10">
        <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
          Password reset
        </p>
        <h2 className="orbit-heading text-5xl leading-[0.98] text-[var(--orbit-midnight)]">
          Set a new password and return to the workspace.
        </h2>
        <p className="text-sm leading-6 text-[rgba(16,42,54,0.74)]">
          Use the secure email link to choose a new password and continue with
          customer access.
        </p>

        <OrbitAtmosphere
          eyebrow="Recovery flow"
          title="One secure reset link, then back to the dashboard."
          summary="Password reset stays tied to an expiring email link so customer recovery remains explicit and safe."
          badges={["Secure reset", "Expiring link", "Customer access"]}
          details={[
            {
              label: "Link behavior",
              value:
                "Each reset email contains a time-limited token that is consumed after use.",
            },
            {
              label: "After reset",
              value:
                "Sign in with the new password and return to the workspace immediately.",
            },
          ]}
          className="mt-8"
        />
      </section>

      <ResetPasswordForm
        token={params.token || null}
        email={params.email || null}
      />
    </div>
  );
}
