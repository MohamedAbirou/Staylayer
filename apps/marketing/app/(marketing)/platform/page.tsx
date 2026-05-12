import type { Metadata } from "next";
import { OrbitLink } from "@/components/orbit-button";
import { Reveal } from "@/components/reveal";
import { getMarketingContent } from "@/lib/public-api";

export const metadata: Metadata = {
  title: "Platform — StayLayer",
  description:
    "How StayLayer keeps the public brand site, the private team workspace, and the live guest website focused on distinct jobs.",
};

const APPS = [
  {
    name: "Brand site",
    subtitle: "Public-facing",
    color: "orange" as const,
    icon: "◎",
    owns: [
      "Pricing & plans",
      "Legal documents",
      "Customer stories",
      "Login & signup",
    ],
  },
  {
    name: "Workspace",
    subtitle: "Team operations",
    color: "teal" as const,
    icon: "◈",
    owns: [
      "Site builder",
      "Content management",
      "Inquiry handling",
      "Billing & domains",
    ],
  },
  {
    name: "Live website",
    subtitle: "Guest experience",
    color: "navy" as const,
    icon: "◇",
    owns: [
      "Published website",
      "Inquiry forms",
      "Multi-language pages",
      "Custom domains",
    ],
  },
] as const;

export default async function PlatformPage() {
  const content = await getMarketingContent();

  return (
    <div className="space-y-16">
      {/* ── HERO ── */}
      <Reveal>
        <p className="orbit-kicker text-xs text-[var(--sl-orange)]">
          Platform overview
        </p>
        <h1 className="orbit-heading mt-4 max-w-4xl text-5xl leading-[0.94] text-[var(--sl-navy-deep)] sm:text-6xl">
          Three focused layers.
          <br />
          <span className="sl-gradient-text">One smooth experience.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[rgba(26,72,112,0.7)]">
          {content.platform.intro}
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <OrbitLink href="/register" tone="primary">
            Get started free
          </OrbitLink>
          <OrbitLink href="/pricing" tone="secondary">
            View pricing
          </OrbitLink>
        </div>
      </Reveal>

      {/* ── THREE APPS — large bento cards ── */}
      <section className="grid gap-5 lg:grid-cols-3">
        {APPS.map((app, index) => (
          <Reveal
            key={app.name}
            delay={index * 0.1}
            className="overflow-hidden rounded-2xl"
            style={{
              background:
                app.color === "orange"
                  ? "linear-gradient(158deg, rgba(224,112,56,0.08) 0%, rgba(240,176,48,0.05) 100%)"
                  : app.color === "teal"
                    ? "linear-gradient(158deg, rgba(58,152,152,0.08) 0%, rgba(86,196,194,0.05) 100%)"
                    : "linear-gradient(158deg, rgba(26,72,112,0.08) 0%, rgba(13,40,64,0.05) 100%)",
              border:
                app.color === "orange"
                  ? "1px solid rgba(224,112,56,0.2)"
                  : app.color === "teal"
                    ? "1px solid rgba(58,152,152,0.18)"
                    : "1px solid rgba(26,72,112,0.12)",
            }}
          >
            {/* Top accent bar */}
            <div
              className="h-1 w-full"
              style={{
                background:
                  app.color === "orange"
                    ? "linear-gradient(90deg, var(--sl-orange), var(--sl-gold))"
                    : app.color === "teal"
                      ? "linear-gradient(90deg, var(--sl-teal), var(--sl-teal-bright))"
                      : "linear-gradient(90deg, var(--sl-navy), var(--sl-teal))",
              }}
            />

            <div className="p-7">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <span className="text-3xl">{app.icon}</span>
                  <p className="orbit-heading mt-2 text-2xl text-[var(--sl-navy-deep)]">
                    {app.name}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(26,72,112,0.5)]">
                    {app.subtitle}
                  </p>
                </div>
                <span
                  className="rounded-xl px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    background:
                      app.color === "orange"
                        ? "rgba(224,112,56,0.1)"
                        : app.color === "teal"
                          ? "rgba(58,152,152,0.1)"
                          : "rgba(26,72,112,0.08)",
                    color:
                      app.color === "orange"
                        ? "var(--sl-orange)"
                        : app.color === "teal"
                          ? "var(--sl-teal)"
                          : "var(--sl-navy)",
                  }}
                >
                  Layer {index + 1}
                </span>
              </div>

              <ul className="space-y-2.5">
                {app.owns.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2.5 text-sm text-[rgba(26,72,112,0.75)]"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{
                        background:
                          app.color === "orange"
                            ? "var(--sl-orange)"
                            : app.color === "teal"
                              ? "var(--sl-teal)"
                              : "var(--sl-navy)",
                      }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </section>

      {/* ── CAPABILITIES GRID ── */}
      <section className="space-y-5">
        <Reveal>
          <p className="orbit-kicker text-xs text-[var(--sl-teal)]">
            What's included
          </p>
          <h2 className="orbit-heading mt-3 text-4xl text-[var(--sl-navy-deep)]">
            Capabilities across all layers.
          </h2>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {content.platform.capabilities.map((capability, index) => (
            <Reveal
              key={capability}
              delay={index * 0.06}
              className="orbit-card rounded-2xl p-5"
            >
              <div
                className="mb-3 text-3xl font-bold orbit-heading"
                style={{
                  color:
                    index % 3 === 0
                      ? "var(--sl-orange)"
                      : index % 3 === 1
                        ? "var(--sl-teal)"
                        : "var(--sl-navy)",
                }}
              >
                {String(index + 1).padStart(2, "0")}
              </div>
              <p className="text-sm leading-6 text-[rgba(26,72,112,0.75)]">
                {capability}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── DARK ARCHITECTURE SECTION ── */}
      <section className="orbit-dark-band overflow-hidden rounded-3xl px-8 py-12">
        <div
          className="mb-8 h-0.5 w-12 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, var(--sl-orange), var(--sl-gold))",
          }}
        />
        <Reveal>
          <p className="orbit-kicker text-xs text-[rgba(86,196,194,0.8)]">
            Operating principle
          </p>
          <h2 className="orbit-heading mt-4 max-w-2xl text-4xl text-white leading-tight">
            Each layer stays focused on one audience.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[rgba(249,246,239,0.62)]">
            Guests get a clean website. Your team gets a private workspace. The
            public brand site handles discovery, trust, and signup without
            leaking into day-to-day operations.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Brand site",
              color: "orange",
              body: "Owns pricing, trust, contact, login, signup, and the public story of the product.",
            },
            {
              title: "Workspace",
              color: "teal",
              body: "Owns the team workspace for content, inquiries, domains, billing, and operational decisions.",
            },
            {
              title: "Live website",
              color: "navy",
              body: "Owns the guest-facing pages, forms, and domains that represent the hospitality brand itself.",
            },
          ].map((item) => (
            <Reveal
              key={item.title}
              className="rounded-2xl p-6"
              style={{
                background:
                  item.color === "orange"
                    ? "rgba(224,112,56,0.14)"
                    : item.color === "teal"
                      ? "rgba(58,152,152,0.12)"
                      : "rgba(255,255,255,0.06)",
                border:
                  item.color === "orange"
                    ? "1px solid rgba(224,112,56,0.24)"
                    : item.color === "teal"
                      ? "1px solid rgba(58,152,152,0.22)"
                      : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <p className="orbit-heading text-2xl text-white">{item.title}</p>
              <p className="mt-3 text-sm leading-6 text-[rgba(249,246,239,0.72)]">
                {item.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
