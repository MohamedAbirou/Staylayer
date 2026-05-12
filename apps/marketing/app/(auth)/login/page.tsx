import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";
import { OrbitAtmosphere } from "@/components/orbit-atmosphere";

export const metadata: Metadata = {
  title: "Customer Login — StayLayer",
  description:
    "Sign in to your StayLayer hospitality workspace and continue with your site, inquiries, and billing.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <section className="space-y-6 rounded-[2.4rem] bg-[rgba(255,255,255,0.62)] p-8 shadow-[0_18px_50px_rgba(16,42,54,0.08)] backdrop-blur sm:p-10">
        <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
          Customer auth
        </p>
        <h2 className="orbit-heading text-5xl leading-[0.98] text-[var(--orbit-midnight)]">
          Sign back into your workspace.
        </h2>
        <p className="text-sm leading-6 text-[rgba(16,42,54,0.74)]">
          Pick up where you left off in your content, inquiries, domains, or
          billing without leaving the customer flow.
        </p>

        <OrbitAtmosphere
          eyebrow="Customer workspace"
          title="One sign-in for the hospitality workspace."
          summary="Your account takes you straight back to the workspace context that manages your site, inquiries, and billing decisions."
          badges={["Customer access", "Workspace billing", "Inquiry-first"]}
          details={[
            {
              label: "Audience",
              value:
                "Owners, marketers, and hospitality teams managing public sites.",
            },
            {
              label: "Handoff",
              value:
                "Successful auth returns you to the dashboard workspace context.",
            },
          ]}
          className="mt-8"
        />
      </section>

      <LoginForm returnTo={params.returnTo || null} />
    </div>
  );
}
