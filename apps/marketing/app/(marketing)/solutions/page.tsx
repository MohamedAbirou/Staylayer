import type { Metadata } from "next";
import { OrbitLink } from "@/components/orbit-button";
import { Reveal } from "@/components/reveal";
import { getMarketingContent } from "@/lib/public-api";

export const metadata: Metadata = {
  title: "Solutions — StayLayer",
  description:
    "Inquiry-first website publishing for villas, boutique hotels, B&Bs, guest houses, and glamping operators.",
};

const ACCENT_COLORS = [
  {
    bg: "rgba(224,112,56,0.08)",
    border: "rgba(224,112,56,0.2)",
    dot: "var(--sl-orange)",
  },
  {
    bg: "rgba(58,152,152,0.08)",
    border: "rgba(58,152,152,0.18)",
    dot: "var(--sl-teal)",
  },
  {
    bg: "rgba(240,176,48,0.08)",
    border: "rgba(240,176,48,0.2)",
    dot: "var(--sl-gold)",
  },
  {
    bg: "rgba(26,72,112,0.07)",
    border: "rgba(26,72,112,0.12)",
    dot: "var(--sl-navy)",
  },
  {
    bg: "rgba(224,112,56,0.08)",
    border: "rgba(224,112,56,0.2)",
    dot: "var(--sl-orange)",
  },
  {
    bg: "rgba(58,152,152,0.08)",
    border: "rgba(58,152,152,0.18)",
    dot: "var(--sl-teal)",
  },
];

export default async function SolutionsPage() {
  const content = await getMarketingContent();

  return (
    <div className="space-y-16">
      {/* ── HERO ── */}
      <Reveal>
        <p className="orbit-kicker text-xs text-[var(--sl-orange)]">
          Solutions
        </p>
        <h1 className="orbit-heading mt-4 max-w-4xl text-5xl leading-[0.94] text-[var(--sl-navy-deep)] sm:text-6xl">
          Every type of hospitality operator.
          <br />
          <span className="sl-gradient-text-teal">
            One inquiry-first promise.
          </span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[rgba(26,72,112,0.7)]">
          Whether you're running a boutique villa, a collection of holiday
          homes, or a glamping operation—StayLayer adapts to your business
          without forcing you into a generic travel checkout flow.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <OrbitLink href="/register" tone="primary">
            Start free
          </OrbitLink>
          <OrbitLink href="/platform" tone="secondary">
            Platform overview
          </OrbitLink>
        </div>
      </Reveal>

      {/* ── SOLUTIONS GRID ── */}
      <section>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {content.solutions.map((solution, index) => {
            const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
            return (
              <Reveal
                key={solution.slug}
                delay={index * 0.07}
                className="group relative overflow-hidden rounded-2xl p-7"
                style={{
                  background: accent.bg,
                  border: `1px solid ${accent.border}`,
                }}
              >
                {/* Corner dot accent */}
                <div
                  className="absolute top-5 right-5 h-2 w-2 rounded-full"
                  style={{ background: accent.dot }}
                />

                <p className="orbit-kicker text-[10px] text-[rgba(26,72,112,0.45)]">
                  {solution.slug}
                </p>
                <h2 className="orbit-heading mt-3 text-2xl text-[var(--sl-navy-deep)]">
                  {solution.title}
                </h2>
                <div
                  className="my-4 h-px"
                  style={{
                    background: `linear-gradient(90deg, ${accent.dot}40, transparent)`,
                  }}
                />
                <p className="text-sm leading-6 text-[rgba(26,72,112,0.72)]">
                  {solution.body}
                </p>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── PROMISE BAND ── */}
      <section className="orbit-dark-band overflow-hidden rounded-3xl px-8 py-12">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <div
              className="mb-5 h-0.5 w-12 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, var(--sl-orange), var(--sl-gold))",
              }}
            />
            <p className="orbit-kicker text-xs text-[rgba(86,196,194,0.8)]">
              The StayLayer promise
            </p>
            <h2 className="orbit-heading mt-4 text-4xl text-white leading-tight">
              Inquiry before booking. Always.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[rgba(249,246,239,0.62)]">
              We believe the best hospitality bookings start with a
              conversation—not a checkbox flow. StayLayer is built around that
              belief at every layer of the platform.
            </p>
            <div className="mt-8">
              <OrbitLink href="/register" tone="primary">
                Get started free
              </OrbitLink>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  title: "Conversation-led demand",
                  body: "Every inquiry starts a real guest conversation instead of forcing a generic booking flow.",
                },
                {
                  title: "Your brand",
                  body: "Custom domain, your design, your editorial voice.",
                },
                {
                  title: "Multi-language",
                  body: "Reach international guests in their own language.",
                },
                {
                  title: "Direct inquiries",
                  body: "Guest requests land directly with your team and your workflow.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <p className="font-semibold text-sm text-white">
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-[rgba(249,246,239,0.62)]">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
