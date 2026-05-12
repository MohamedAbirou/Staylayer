import type { Metadata } from "next";
import { Reveal } from "@/components/reveal";
import { getLegalDocument, getMarketingContent } from "@/lib/public-api";

export const metadata: Metadata = {
  title: "Security and Trust — StayLayer",
  description:
    "How StayLayer protects customer data, secures public entry points, and keeps hospitality workspaces private and auditable.",
};

const HIGHLIGHT_COLORS = [
  { icon: "🔒", color: "var(--sl-orange)" },
  { icon: "🛡️", color: "var(--sl-teal)" },
  { icon: "⚡", color: "var(--sl-gold)" },
  { icon: "✓", color: "var(--sl-navy)" },
];

export default async function SecurityPage() {
  const [content, securityDocument] = await Promise.all([
    getMarketingContent(),
    getLegalDocument("security-data-handling"),
  ]);

  return (
    <div className="space-y-16">
      {/* ── HERO ── */}
      <Reveal>
        <p className="orbit-kicker text-xs text-[var(--sl-teal)]">
          Security and trust
        </p>
        <h1 className="orbit-heading mt-4 max-w-4xl text-5xl leading-[0.94] text-[var(--sl-navy-deep)] sm:text-6xl">
          {content.security.heading}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[rgba(26,72,112,0.7)]">
          {content.security.body}
        </p>
      </Reveal>

      {/* ── SECURITY HIGHLIGHTS GRID ── */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {content.security.highlights.map((highlight, index) => {
          const accent = HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length];
          return (
            <Reveal
              key={highlight}
              delay={index * 0.07}
              className="relative overflow-hidden rounded-2xl p-6"
              style={{
                background: "rgba(255,255,255,0.84)",
                border: "1px solid rgba(26,72,112,0.08)",
                boxShadow: "0 16px 48px rgba(13,40,64,0.07)",
              }}
            >
              {/* Accent bar */}
              <div
                className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                style={{ background: accent.color }}
              />
              <p className="text-2xl mb-3">{accent.icon}</p>
              <p className="orbit-heading text-lg text-[var(--sl-navy-deep)]">
                {highlight}
              </p>
            </Reveal>
          );
        })}
      </section>

      {/* ── DOCUMENT ── */}
      <section className="space-y-6">
        <Reveal>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="orbit-kicker text-xs text-[var(--sl-orange)]">
                {securityDocument.title}
              </p>
              <h2 className="orbit-heading mt-3 text-3xl text-[var(--sl-navy-deep)]">
                Full security documentation.
              </h2>
            </div>
            <div
              className="rounded-xl px-4 py-2 text-xs font-semibold"
              style={{
                background: "rgba(58,152,152,0.08)",
                border: "1px solid rgba(58,152,152,0.18)",
                color: "var(--sl-teal)",
              }}
            >
              Version {securityDocument.version} · Effective{" "}
              {securityDocument.effectiveAt.slice(0, 10)}
            </div>
          </div>
        </Reveal>

        <div className="space-y-4">
          {securityDocument.sections.map((section, index) => (
            <Reveal
              key={section.title}
              delay={index * 0.05}
              className="overflow-hidden rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.84)",
                border: "1px solid rgba(26,72,112,0.08)",
                boxShadow: "0 16px 48px rgba(13,40,64,0.06)",
              }}
            >
              {/* Colored left border stripe */}
              <div className="flex">
                <div
                  className="w-1 shrink-0 rounded-l-2xl"
                  style={{
                    background:
                      index % 3 === 0
                        ? "linear-gradient(180deg, var(--sl-orange), var(--sl-gold))"
                        : index % 3 === 1
                          ? "linear-gradient(180deg, var(--sl-teal), var(--sl-teal-bright))"
                          : "linear-gradient(180deg, var(--sl-navy), var(--sl-teal))",
                  }}
                />
                <div className="flex-1 p-6">
                  <h3 className="orbit-heading text-2xl text-[var(--sl-navy-deep)]">
                    {section.title}
                  </h3>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-[rgba(26,72,112,0.68)]">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── TRUST BAND ── */}
      <Reveal>
        <div className="overflow-hidden rounded-3xl orbit-dark-band px-8 py-12">
          <div
            className="mb-5 h-0.5 w-12 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, var(--sl-teal), var(--sl-teal-bright))",
            }}
          />
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="orbit-kicker text-xs text-[rgba(86,196,194,0.8)]">
                Our commitment
              </p>
              <h2 className="orbit-heading mt-4 text-4xl text-white leading-tight">
                Transparency is a feature, not an afterthought.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[rgba(249,246,239,0.6)]">
                Customer work stays private. Public entry points are protected.
                Important workspace changes stay traceable.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  title: "Workspace isolation",
                  body: "Each customer workspace stays separated from the others.",
                },
                {
                  title: "Rate limiting",
                  body: "Public login, signup, and contact paths are protected against abuse.",
                },
                {
                  title: "Versioned docs",
                  body: "Every legal change is published with an effective date.",
                },
                {
                  title: "Audit logging",
                  body: "Important workspace changes remain traceable over time.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <p className="text-sm font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-[rgba(249,246,239,0.58)]">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
