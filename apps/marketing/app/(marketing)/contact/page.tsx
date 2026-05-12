import type { Metadata } from "next";
import { OrbitLink } from "@/components/orbit-button";
import { ContactForm } from "@/components/contact-form";
import { Reveal } from "@/components/reveal";
import { getMarketingContent } from "@/lib/public-api";
import { isMarketingPlanKey } from "@/lib/pricing-flow";

export const metadata: Metadata = {
  title: "Contact — StayLayer",
  description:
    "Contact StayLayer about plan selection, migration support, or a multi-property rollout.",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const content = await getMarketingContent();
  const params = await searchParams;
  const { contact } = content;
  const selectedPlan = isMarketingPlanKey(params.plan) ? params.plan : null;

  return (
    <div className="space-y-16">
      {/* ── HERO ── */}
      <Reveal>
        <p className="orbit-kicker text-xs text-[var(--sl-orange)]">
          Contact StayLayer
        </p>
        <h1 className="orbit-heading mt-4 max-w-4xl text-5xl leading-[0.94] text-[var(--sl-navy-deep)] sm:text-6xl">
          {contact.heading}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[rgba(26,72,112,0.7)]">
          {contact.body}
        </p>
      </Reveal>

      {/* ── MAIN CONTACT PANEL ── */}
      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <Reveal>
          <ContactForm
            contactEmail={contact.contactEmail}
            defaultPlanInterest={selectedPlan}
          />
        </Reveal>

        <div className="space-y-4">
          <Reveal>
            <div className="orbit-card rounded-[2rem] p-6">
              <p className="orbit-kicker text-xs text-[var(--sl-teal)]">
                Good reasons to reach out
              </p>
              <div className="mt-4 space-y-4 text-sm leading-6 text-[rgba(16,42,54,0.72)]">
                {[
                  "You want help choosing the right plan for an upcoming launch.",
                  "You are migrating an existing hospitality site and want a cleaner setup.",
                  "You manage multiple properties and want guidance on the rollout path.",
                ].map((item) => (
                  <div key={item} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[var(--sl-orange)]" />
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="orbit-card rounded-[2rem] p-6">
              <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
                What happens next
              </p>
              <div className="mt-4 space-y-4 text-sm leading-6 text-[rgba(16,42,54,0.72)]">
                {[
                  {
                    title: "We review the launch context",
                    body: "Your plan interest, timing, and rollout details help us point you to the right next step.",
                  },
                  {
                    title: "We reply to the same inbox thread",
                    body: "Your email becomes the reply address so everything stays in one conversation.",
                  },
                  {
                    title: "We keep the next step practical",
                    body: "That may be a free workspace, a billing path, or a rollout discussion depending on what you need.",
                  },
                ].map((item) => (
                  <div key={item.title}>
                    <p className="font-semibold text-[var(--sl-navy)]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[rgba(16,42,54,0.68)]">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {contact.contactEmailConfigured && contact.contactEmail ? (
            <Reveal delay={0.12}>
              <div className="overflow-hidden rounded-[2rem] orbit-dark-band p-6">
                <p className="orbit-kicker text-xs text-[rgba(86,196,194,0.8)]">
                  Prefer direct email?
                </p>
                <p className="mt-3 text-sm leading-7 text-[rgba(249,246,239,0.68)]">
                  You can also write straight to {contact.contactEmail}.
                </p>
                <div className="mt-5">
                  <OrbitLink
                    href={`mailto:${contact.contactEmail}`}
                    tone="primary"
                  >
                    Email StayLayer
                  </OrbitLink>
                </div>
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>

      {/* ── ALTERNATIVE ACTIONS ── */}
      <section>
        <Reveal>
          <p className="orbit-kicker text-xs text-[var(--sl-navy)]">
            Not ready for sales?
          </p>
          <h2 className="orbit-heading mt-3 text-3xl text-[var(--sl-navy-deep)]">
            Start somewhere else.
          </h2>
        </Reveal>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Free workspace",
              body: "Start with the free tier. No credit card required. Upgrade when you're ready.",
              href: "/register",
              cta: "Create account",
              color: "orange",
            },
            {
              title: "Platform overview",
              body: "Learn how the brand site, the workspace, and the live guest website work together.",
              href: "/platform",
              cta: "Explore platform",
              color: "teal",
            },
            {
              title: "Pricing plans",
              body: "Review all plan tiers and capability comparisons before deciding.",
              href: "/pricing",
              cta: "See pricing",
              color: "navy",
            },
          ].map((item) => (
            <Reveal
              key={item.title}
              className="rounded-2xl p-6"
              style={{
                background:
                  item.color === "orange"
                    ? "rgba(224,112,56,0.06)"
                    : item.color === "teal"
                      ? "rgba(58,152,152,0.06)"
                      : "rgba(26,72,112,0.05)",
                border:
                  item.color === "orange"
                    ? "1px solid rgba(224,112,56,0.16)"
                    : item.color === "teal"
                      ? "1px solid rgba(58,152,152,0.14)"
                      : "1px solid rgba(26,72,112,0.1)",
              }}
            >
              <div
                className="mb-3 h-1 w-8 rounded-full"
                style={{
                  background:
                    item.color === "orange"
                      ? "var(--sl-orange)"
                      : item.color === "teal"
                        ? "var(--sl-teal)"
                        : "var(--sl-navy)",
                }}
              />
              <h3 className="orbit-heading text-xl text-[var(--sl-navy-deep)]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[rgba(26,72,112,0.65)]">
                {item.body}
              </p>
              <div className="mt-5">
                <OrbitLink
                  href={item.href}
                  tone={item.color === "orange" ? "primary" : "secondary"}
                  className="text-sm"
                >
                  {item.cta}
                </OrbitLink>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
