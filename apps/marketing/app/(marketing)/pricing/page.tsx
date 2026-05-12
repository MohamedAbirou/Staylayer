import type { Metadata } from "next";
import { OrbitLink } from "@/components/orbit-button";
import { Reveal } from "@/components/reveal";
import { getPublicBillingCatalog } from "@/lib/public-api";
import {
  buildPlanLoginHref,
  buildPlanRegisterHref,
  getPlanMotionBadge,
  getPlanSupportCopy,
} from "@/lib/pricing-flow";

export const metadata: Metadata = {
  title: "Pricing — StayLayer",
  description:
    "Clear pricing paths for hospitality teams. Start free, create your workspace first, and handle paid billing from inside your account.",
};

const COMPARISON_ROWS = [
  ["Sites", "siteCapacity"],
  ["Languages", "languageCoverage"],
  ["Seats", "seatCapacity"],
  ["Inquiry volume", "inquiryCapacity"],
  ["Pages", "pageCapacity"],
  ["Domains", "domainCapacity"],
  ["Analytics", "analytics"],
  ["Exports", "exports"],
  ["Translation", "translationAllowance"],
  ["Support", "support"],
] as const;

export default async function PricingPage() {
  const pricing = await getPublicBillingCatalog();

  return (
    <div className="space-y-16">
      {/* ── HERO ── */}
      <Reveal>
        <p className="orbit-kicker text-xs text-[var(--sl-orange)]">Pricing</p>
        <h1 className="orbit-heading mt-4 max-w-4xl text-5xl leading-[0.94] text-[var(--sl-navy-deep)] sm:text-6xl">
          Plans that match
          <br />
          <span className="sl-gradient-text">real operator scale.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[rgba(26,72,112,0.7)]">
          Start with the free workspace or choose a paid plan and continue from
          billing inside your account. That keeps subscriptions attached to the
          right workspace from the very beginning.
        </p>
      </Reveal>

      {/* ── PLAN CARDS ── */}
      <section className="grid gap-5 lg:grid-cols-4">
        {pricing.plans.map((plan, index) => (
          <Reveal key={plan.key} delay={index * 0.07}>
            <div
              className={`relative h-full rounded-2xl p-6 flex flex-col ${plan.featured ? "sl-card-featured" : "orbit-card"}`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white"
                    style={{
                      background:
                        "linear-gradient(90deg, var(--sl-orange), var(--sl-gold))",
                    }}
                  >
                    Most popular
                  </span>
                </div>
              )}

              <div>
                <h2 className="orbit-heading text-2xl text-[var(--sl-navy-deep)]">
                  {plan.name}
                </h2>
                <span
                  className="mt-2 inline-block rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    background:
                      plan.salesMotion === "self_serve"
                        ? "rgba(58,152,152,0.1)"
                        : plan.checkoutEnabled
                          ? "rgba(224,112,56,0.1)"
                          : "rgba(240,176,48,0.1)",
                    color:
                      plan.salesMotion === "self_serve"
                        ? "var(--sl-teal)"
                        : plan.checkoutEnabled
                          ? "var(--sl-orange)"
                          : "#9a7010",
                  }}
                >
                  {getPlanMotionBadge(plan)}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-[rgba(26,72,112,0.68)]">
                {plan.audience}
              </p>
              <p className="mt-3 text-sm leading-6 text-[rgba(26,72,112,0.72)] font-medium">
                {plan.promise}
              </p>

              <div className="mt-5 space-y-2 text-xs text-[rgba(26,72,112,0.65)] flex-1">
                {[
                  plan.comparison.siteCapacity,
                  plan.comparison.languageCoverage,
                  plan.comparison.seatCapacity,
                  plan.comparison.support,
                ].map((item) => (
                  <div key={item} className="flex items-start gap-1.5">
                    <svg
                      className="mt-0.5 h-3 w-3 shrink-0"
                      style={{
                        color: plan.featured
                          ? "var(--sl-orange)"
                          : "var(--sl-teal)",
                      }}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div
                className="mt-5 rounded-xl p-3.5 text-xs leading-5 text-[rgba(26,72,112,0.6)]"
                style={{
                  background: "rgba(26,72,112,0.04)",
                  border: "1px solid rgba(26,72,112,0.07)",
                }}
              >
                {getPlanSupportCopy(plan)}
              </div>

              <div className="mt-5">
                <OrbitLink
                  href={buildPlanRegisterHref(plan)}
                  tone={plan.featured ? "primary" : "secondary"}
                  className="w-full justify-center"
                >
                  {plan.ctaLabel}
                </OrbitLink>
                {!plan.isFree ? (
                  <div className="mt-3 text-center text-xs text-[rgba(26,72,112,0.56)]">
                    Already have a workspace?{" "}
                    <a
                      href={buildPlanLoginHref(plan)}
                      className="font-semibold text-[var(--sl-navy)] hover:text-[var(--sl-orange)]"
                    >
                      Sign in to billing
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="space-y-5">
        <Reveal>
          <p className="orbit-kicker text-xs text-[var(--sl-teal)]">
            How paid activation works
          </p>
          <h2 className="orbit-heading mt-3 text-3xl text-[var(--sl-navy-deep)]">
            Choose a plan publicly. Activate it privately.
          </h2>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "1. Choose your plan",
              body: "Use the pricing page to decide what level of capacity and support fits your launch stage.",
            },
            {
              title: "2. Create your workspace",
              body: "We create the account and workspace first so billing, permissions, and domains are attached to the correct team context.",
            },
            {
              title: "3. Continue in billing",
              body: "Paid activation happens from billing inside the account, which is the standard flow for tenant-based SaaS products.",
            },
          ].map((step, index) => (
            <Reveal
              key={step.title}
              delay={index * 0.06}
              className="orbit-card rounded-2xl p-6"
            >
              <div
                className="mb-4 h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold text-white"
                style={{
                  background:
                    index === 0
                      ? "linear-gradient(135deg, var(--sl-orange), var(--sl-gold))"
                      : index === 1
                        ? "linear-gradient(135deg, var(--sl-teal), var(--sl-teal-bright))"
                        : "linear-gradient(135deg, var(--sl-navy), var(--sl-teal))",
                }}
              >
                0{index + 1}
              </div>
              <h3 className="orbit-heading text-xl text-[var(--sl-navy-deep)]">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[rgba(26,72,112,0.68)]">
                {step.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section className="space-y-4">
        <Reveal>
          <p className="orbit-kicker text-xs text-[var(--sl-teal)]">
            Feature comparison
          </p>
          <h2 className="orbit-heading mt-3 text-3xl text-[var(--sl-navy-deep)]">
            Side-by-side breakdown.
          </h2>
        </Reveal>

        <Reveal>
          <div
            className="overflow-hidden rounded-2xl"
            style={{
              border: "1px solid rgba(26,72,112,0.09)",
              boxShadow: "0 20px 60px rgba(13,40,64,0.08)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(13,40,64,0.97) 0%, rgba(26,72,112,0.92) 100%)",
                    }}
                  >
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(249,246,239,0.55)]">
                      Capability
                    </th>
                    {pricing.plans.map((plan) => (
                      <th
                        key={plan.key}
                        className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em]"
                        style={{
                          color: plan.featured
                            ? "var(--sl-orange)"
                            : "rgba(249,246,239,0.7)",
                        }}
                      >
                        {plan.name}
                        {plan.featured && (
                          <span className="ml-2 text-[9px] text-[var(--sl-gold)]">
                            ★
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map(([label, key], rowIndex) => (
                    <tr
                      key={label}
                      style={{
                        background:
                          rowIndex % 2 === 0
                            ? "rgba(255,255,255,0.95)"
                            : "rgba(26,72,112,0.025)",
                      }}
                    >
                      <td className="px-6 py-3.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--sl-navy)]">
                        {label}
                      </td>
                      {pricing.plans.map((plan) => (
                        <td
                          key={`${plan.key}-${key}`}
                          className="px-6 py-3.5 text-sm text-[rgba(26,72,112,0.72)]"
                        >
                          {plan.comparison[key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── BOTTOM CTA ── */}
      <Reveal>
        <div className="rounded-2xl px-8 py-10 text-center orbit-dark-band">
          <h2 className="orbit-heading text-3xl text-white">
            Start with your workspace.
          </h2>
          <p className="mt-3 text-sm leading-7 text-[rgba(249,246,239,0.62)]">
            Free if you want to begin light. Paid activation happens from inside
            billing when you are ready.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <OrbitLink href="/register" tone="primary">
              Create workspace
            </OrbitLink>
            <OrbitLink
              href="/login"
              tone="ghost"
              className="text-[rgba(249,246,239,0.7)] hover:text-white hover:bg-white/10"
            >
              Sign in to billing
            </OrbitLink>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
