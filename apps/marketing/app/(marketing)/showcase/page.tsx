import type { Metadata } from "next";
import { OrbitLink } from "@/components/orbit-button";
import { Reveal } from "@/components/reveal";
import { getMarketingContent } from "@/lib/public-api";

export const metadata: Metadata = {
  title: "Showcase — StayLayer",
  description:
    "Anonymized examples of real hospitality websites built on StayLayer, shared without exposing customer identities.",
};

const CARD_GRADIENTS = [
  "linear-gradient(148deg, rgba(13,40,64,0.97) 0%, rgba(26,72,112,0.88) 55%, rgba(58,152,152,0.65) 100%)",
  "linear-gradient(148deg, rgba(13,40,64,0.97) 0%, rgba(60,22,5,0.5) 50%, rgba(224,112,56,0.55) 100%)",
  "linear-gradient(148deg, rgba(7,22,36,0.97) 0%, rgba(20,60,48,0.5) 50%, rgba(58,152,152,0.65) 100%)",
  "linear-gradient(148deg, rgba(13,40,64,0.97) 0%, rgba(50,35,5,0.5) 55%, rgba(240,176,48,0.5) 100%)",
];

export default async function ShowcasePage() {
  const content = await getMarketingContent();

  return (
    <div className="space-y-16">
      {/* ── HERO ── */}
      <Reveal>
        <p className="orbit-kicker text-xs text-[var(--sl-teal)]">Showcase</p>
        <h1 className="orbit-heading mt-4 max-w-4xl text-5xl leading-[0.94] text-[var(--sl-navy-deep)] sm:text-6xl">
          Real customer builds.
          <br />
          <span className="sl-gradient-text">Identity protected.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[rgba(26,72,112,0.7)]">
          These stories are drawn from live StayLayer sites. We hide the names,
          domains, and brand visuals while showing the actual footprint of what
          customers have launched.
        </p>
      </Reveal>

      {/* ── GALLERY — large cards ── */}
      <section className="grid gap-5 lg:grid-cols-2">
        {content.showcase.map((item, index) => (
          <Reveal
            key={item.id}
            delay={index * 0.08}
            className="group overflow-hidden rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.84)",
              border: "1px solid rgba(26,72,112,0.08)",
              boxShadow: "0 20px 60px rgba(13,40,64,0.08)",
            }}
          >
            {/* Gradient visual header */}
            <div
              className="relative p-7 pb-10"
              style={{
                background: CARD_GRADIENTS[index % CARD_GRADIENTS.length],
              }}
            >
              {/* Top-right label */}
              <div className="absolute top-5 right-5">
                <span
                  className="rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    color: "rgba(249,246,239,0.8)",
                  }}
                >
                  {item.category}
                </span>
              </div>

              {/* Title block */}
              <div className="max-w-[85%]">
                <h2 className="orbit-heading text-3xl text-white">
                  {item.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[rgba(249,246,239,0.78)]">
                  {item.summary}
                </p>
              </div>

              {/* Bottom tags */}
              <div className="absolute -bottom-3 left-7 flex gap-2">
                {item.highlights.slice(0, 3).map((highlight) => (
                  <span
                    key={highlight}
                    className="rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white"
                    style={{
                      background: "var(--sl-orange)",
                      boxShadow: "0 4px 12px rgba(224,112,56,0.4)",
                    }}
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            </div>

            {/* Card footer */}
            <div className="pt-6 px-7 pb-7">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {item.localeFootprint.map((locale) => (
                  <span
                    key={locale}
                    className="rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{
                      background: "rgba(58,152,152,0.1)",
                      border: "1px solid rgba(58,152,152,0.18)",
                      color: "var(--sl-teal)",
                    }}
                  >
                    {locale}
                  </span>
                ))}
                <span
                  className="rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    background: "rgba(26,72,112,0.06)",
                    border: "1px solid rgba(26,72,112,0.12)",
                    color: "var(--sl-navy)",
                  }}
                >
                  Privacy protected
                </span>
              </div>
              <p className="text-sm leading-6 text-[rgba(26,72,112,0.65)]">
                {item.proof}
              </p>
              <p className="mt-3 text-xs leading-5 text-[rgba(26,72,112,0.5)]">
                {item.privacy}
              </p>
            </div>
          </Reveal>
        ))}
      </section>

      {/* ── CTA BAND ── */}
      <Reveal>
        <div className="overflow-hidden rounded-3xl orbit-dark-band px-8 py-12 text-center">
          <div className="mb-5 flex justify-center">
            <div
              className="h-0.5 w-12 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, var(--sl-orange), var(--sl-gold))",
              }}
            />
          </div>
          <h2 className="orbit-heading text-4xl text-white">
            Your property. Your story.
          </h2>
          <p className="mt-3 text-sm leading-7 text-[rgba(249,246,239,0.6)] max-w-md mx-auto">
            Create your workspace, shape your guest experience, and publish a
            site that feels fully your own.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-4">
            <OrbitLink href="/register" tone="primary" className="px-7 py-3.5">
              Create free workspace
            </OrbitLink>
            <OrbitLink
              href="/pricing"
              tone="ghost"
              className="text-[rgba(249,246,239,0.7)] hover:text-white hover:bg-white/10"
            >
              Compare plans
            </OrbitLink>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
