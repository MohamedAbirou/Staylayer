import type { Metadata } from "next";
import { AcceptInviteForm } from "@/components/accept-invite-form";
import { OrbitAtmosphere } from "@/components/orbit-atmosphere";

export const metadata: Metadata = {
  title: "Accept Workspace Invitation — StayLayer",
  description:
    "Accept a StayLayer workspace invitation and continue into the customer dashboard.",
};

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <section className="space-y-6 rounded-[2.4rem] bg-[rgba(255,255,255,0.62)] p-8 shadow-[0_18px_50px_rgba(16,42,54,0.08)] backdrop-blur sm:p-10">
        <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
          Workspace invitation
        </p>
        <h2 className="orbit-heading text-5xl leading-[0.98] text-[var(--orbit-midnight)]">
          Join the invited workspace.
        </h2>
        <p className="text-sm leading-6 text-[rgba(16,42,54,0.74)]">
          Accept your invitation through the secure email link and go straight
          into the shared customer workspace.
        </p>

        <OrbitAtmosphere
          eyebrow="Team access"
          title="Invite first, then the dashboard handoff."
          summary="Workspace invitations now arrive by email and only become active after the recipient accepts the secure link."
          badges={["Email invite", "Secure accept", "Workspace handoff"]}
          details={[
            {
              label: "Existing account",
              value:
                "Recipients with an existing account confirm the invite with their password.",
            },
            {
              label: "New collaborator",
              value:
                "New recipients create their password during acceptance and enter the workspace immediately.",
            },
          ]}
          className="mt-8"
        />
      </section>

      <AcceptInviteForm token={params.token || null} />
    </div>
  );
}
