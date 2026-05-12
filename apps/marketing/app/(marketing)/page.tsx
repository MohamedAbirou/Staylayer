import Image from "next/image";
import { OrbitLink } from "@/components/orbit-button";
import { OrbitAtmosphere } from "@/components/orbit-atmosphere";
import { Reveal } from "@/components/reveal";
import { getMarketingContent, getPublicBillingCatalog } from "@/lib/public-api";
import {
  buildPlanRegisterHref,
  getPlanMotionBadge,
  getPlanSupportCopy,
} from "@/lib/pricing-flow";

export default async function HomePage() {
  const [content, pricing] = await Promise.all([
    getMarketingContent(),
    getPublicBillingCatalog(),
  ]);

  return (
    <div className="space-y-20 pb-8">
      {/* ── HERO ── */}
      <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <Reveal className="space-y-8">
          {/* Kicker */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{
              background: "rgba(224,112,56,0.1)",
              border: "1px solid rgba(224,112,56,0.22)",
              color: "var(--sl-orange)",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--sl-orange)] animate-pulse" />
            Inquiry-First Platform
          </div>

          {/* Headline */}
          <h1 className="orbit-heading max-w-3xl text-5xl leading-[0.94] text-[var(--sl-navy-deep)] sm:text-6xl lg:text-7xl">
            {content.home.hero.heading.split(" ").map((word, i) =>
              i === 0 ? (
                <span key={i} className="sl-gradient-text">
                  {word}{" "}
                </span>
              ) : (
                <span key={i}>{word} </span>
              ),
            )}
          </h1>

          <p className="max-w-xl text-lg leading-8 text-[rgba(26,72,112,0.7)]">
            {content.home.hero.body}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <OrbitLink
              href={content.home.hero.primaryCta.href}
              tone="primary"
              className="px-7 py-3.5 text-base"
            >
              {content.home.hero.primaryCta.label}
            </OrbitLink>
            <OrbitLink
              href={content.home.hero.secondaryCta.href}
              tone="secondary"
              className="px-7 py-3.5 text-base"
            >
              {content.home.hero.secondaryCta.label}
            </OrbitLink>
          </div>

          {/* Social proof strip */}
          <div className="flex flex-wrap items-center gap-6 pt-2">
            {[
              { label: "Free tier", note: "No credit card" },
              { label: "Multi-lingual", note: "Built-in i18n" },
              { label: "Custom domains", note: "Your brand" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-1.5 text-sm"
              >
                <svg
                  className="h-4 w-4 text-[var(--sl-teal)]"
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
                <span className="font-semibold text-[var(--sl-navy)]">
                  {item.label}
                </span>
                <span className="text-[rgba(26,72,112,0.55)]">{item.note}</span>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <OrbitAtmosphere
            eyebrow="Platform preview"
            title="Three focused layers. One hospitality platform."
            summary="Your public brand site, your private workspace, and your live guest website each stay focused on a single job."
            badges={content.solutions.map((s) => s.title)}
            details={[
              {
                label: "Brand site",
                value: "Pricing, trust, contact, signup, and login.",
              },
              {
                label: "Workspace",
                value: "Publishing, domains, inquiries, and billing.",
              },
              {
                label: "Live website",
                value: "Guest-facing pages on your own domain.",
              },
              {
                label: "Promise",
                value: "Direct demand without operational clutter.",
              },
            ]}
          />
        </Reveal>
      </section>

      {/* ── PILLARS — bento grid ── */}
      <section className="space-y-5">
        <Reveal>
          <p className="orbit-kicker text-xs text-[var(--sl-orange)]">
            Why StayLayer
          </p>
          <h2 className="orbit-heading mt-3 text-4xl text-[var(--sl-navy-deep)]">
            Built differently from the start.
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {content.home.pillars.map((pillar, index) => (
            <Reveal
              key={pillar.title}
              delay={index * 0.08}
              className="group relative overflow-hidden rounded-2xl p-6"
              style={{
                background:
                  index === 0
                    ? "linear-gradient(145deg, rgba(224,112,56,0.08) 0%, rgba(240,176,48,0.06) 100%)"
                    : index === 1
                      ? "linear-gradient(145deg, rgba(58,152,152,0.08) 0%, rgba(86,196,194,0.06) 100%)"
                      : "linear-gradient(145deg, rgba(26,72,112,0.07) 0%, rgba(13,40,64,0.05) 100%)",
                border:
                  index === 0
                    ? "1px solid rgba(224,112,56,0.18)"
                    : index === 1
                      ? "1px solid rgba(58,152,152,0.16)"
                      : "1px solid rgba(26,72,112,0.1)",
              }}
            >
              {/* Colored accent dot */}
              <div
                className="mb-4 h-8 w-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
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
              <p className="orbit-heading text-xl text-[var(--sl-navy-deep)]">
                {pillar.title}
              </p>
              <p className="mt-3 text-sm leading-6 text-[rgba(26,72,112,0.68)]">
                {pillar.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS — dark navy band ── */}
      <section className="orbit-dark-band overflow-hidden rounded-3xl px-6 py-10 sm:px-10 sm:py-14">
        {/* Top orange accent */}
        <div
          className="mb-8 h-0.5 w-16 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, var(--sl-orange), var(--sl-gold))",
          }}
        />

        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
          <Reveal>
            <p className="orbit-kicker text-xs text-[rgba(86,196,194,0.8)]">
              How it works
            </p>
            <h2 className="orbit-heading mt-4 text-4xl leading-tight text-white sm:text-5xl">
              Every layer has a single job.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[rgba(249,246,239,0.62)]">
              Guests see your brand. Your team sees the workspace. Each part of
              the platform stays clean because it is built for one audience at a
              time.
            </p>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-3">
            {content.home.bands.map((band, index) => (
              <Reveal
                key={band.title}
                delay={index * 0.1}
                className="rounded-2xl p-5"
                style={{
                  background:
                    index === 0
                      ? "rgba(224,112,56,0.12)"
                      : index === 1
                        ? "rgba(58,152,152,0.12)"
                        : "rgba(255,255,255,0.06)",
                  border:
                    index === 0
                      ? "1px solid rgba(224,112,56,0.22)"
                      : index === 1
                        ? "1px solid rgba(58,152,152,0.22)"
                        : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div
                  className="mb-3 text-2xl font-bold"
                  style={{
                    color:
                      index === 0
                        ? "var(--sl-orange)"
                        : index === 1
                          ? "var(--sl-teal-bright)"
                          : "rgba(255,255,255,0.6)",
                  }}
                >
                  0{index + 1}
                </div>
                <p className="orbit-heading text-xl text-white">{band.title}</p>
                <p className="mt-2 text-sm leading-6 text-[rgba(249,246,239,0.72)]">
                  {band.body}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SHOWCASE ── */}
      <section className="space-y-6">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="orbit-kicker text-xs text-[var(--sl-teal)]">
                Customer showcase
              </p>
              <h2 className="orbit-heading mt-3 text-4xl text-[var(--sl-navy-deep)]">
                Real customer footprints, shared privately.
              </h2>
            </div>
            <OrbitLink href="/showcase" tone="secondary">
              Browse all →
            </OrbitLink>
          </div>
        </Reveal>

        <div className="grid gap-5 lg:grid-cols-2">
          {content.showcase.map((item, index) => (
            <Reveal
              key={item.id}
              delay={index * 0.08}
              className="group overflow-hidden rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.82)",
                border: "1px solid rgba(26,72,112,0.08)",
                boxShadow: "0 20px 60px rgba(13,40,64,0.08)",
              }}
            >
              {/* Header gradient panel */}
              <div
                className="relative p-6 pb-8"
                style={{
                  background:
                    index % 2 === 0
                      ? "linear-gradient(145deg, rgba(13,40,64,0.97) 0%, rgba(26,72,112,0.9) 55%, rgba(58,152,152,0.7) 100%)"
                      : "linear-gradient(145deg, rgba(13,40,64,0.97) 0%, rgba(80,32,8,0.4) 55%, rgba(224,112,56,0.5) 100%)",
                }}
              >
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    color: "rgba(249,246,239,0.75)",
                  }}
                >
                  {item.category}
                </span>
                <h3 className="orbit-heading mt-3 text-3xl text-white">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[rgba(249,246,239,0.78)]">
                  {item.summary}
                </p>
              </div>

              {/* Footer strip */}
              <div className="space-y-4 px-6 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  {item.highlights.map((highlight) => (
                    <span
                      key={highlight}
                      className="rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.14em]"
                      style={{
                        background: "rgba(224,112,56,0.08)",
                        border: "1px solid rgba(224,112,56,0.16)",
                        color: "var(--sl-orange)",
                      }}
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.localeFootprint.map((locale) => (
                    <span
                      key={locale}
                      className="rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.14em]"
                      style={{
                        background: "rgba(58,152,152,0.08)",
                        border: "1px solid rgba(58,152,152,0.18)",
                        color: "var(--sl-teal)",
                      }}
                    >
                      {locale}
                    </span>
                  ))}
                </div>
                <div className="grid gap-2 text-xs leading-5 text-[rgba(26,72,112,0.58)] md:grid-cols-[1.2fr_0.8fr]">
                  <p>{item.proof}</p>
                  <p className="text-[rgba(26,72,112,0.48)] md:text-right">
                    {item.privacy}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── PRICING PREVIEW ── */}
      <section className="space-y-6">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="orbit-kicker text-xs text-[var(--sl-orange)]">
                Pricing
              </p>
              <h2 className="orbit-heading mt-3 text-4xl text-[var(--sl-navy-deep)]">
                Clear plans. Clean activation path.
              </h2>
            </div>
            <OrbitLink href="/pricing" tone="secondary">
              Full pricing →
            </OrbitLink>
          </div>
        </Reveal>

        <div className="grid gap-5 lg:grid-cols-4">
          {pricing.plans.map((plan, index) => (
            <Reveal key={plan.key} delay={index * 0.06}>
              <div
                className={`h-full rounded-2xl p-6 ${plan.featured ? "sl-card-featured" : "orbit-card"}`}
              >
                {plan.featured && (
                  <div
                    className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                    style={{
                      background: "rgba(224,112,56,0.1)",
                      border: "1px solid rgba(224,112,56,0.25)",
                      color: "var(--sl-orange)",
                    }}
                  >
                    <span className="h-1 w-1 rounded-full bg-[var(--sl-orange)]" />
                    Popular
                  </div>
                )}
                <h3 className="orbit-heading text-2xl text-[var(--sl-navy-deep)]">
                  {plan.name}
                </h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(26,72,112,0.5)]">
                  {getPlanMotionBadge(plan)}
                </p>
                <p className="mt-3 text-sm leading-6 text-[rgba(26,72,112,0.68)]">
                  {plan.promise}
                </p>
                <div className="mt-4 space-y-1.5 text-xs text-[rgba(26,72,112,0.72)]">
                  <p>↗ {plan.comparison.siteCapacity}</p>
                  <p>↗ {plan.comparison.languageCoverage}</p>
                  <p>↗ {plan.comparison.inquiryCapacity}</p>
                </div>
                <p className="mt-4 text-xs leading-5 text-[rgba(26,72,112,0.58)]">
                  {getPlanSupportCopy(plan)}
                </p>
                <div className="mt-5">
                  <OrbitLink
                    href={buildPlanRegisterHref(plan)}
                    tone={plan.featured ? "primary" : "secondary"}
                    className="w-full justify-center"
                  >
                    {plan.ctaLabel}
                  </OrbitLink>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="space-y-6">
        <Reveal>
          <p className="orbit-kicker text-xs text-[var(--sl-navy)]">FAQ</p>
          <h2 className="orbit-heading mt-3 text-4xl text-[var(--sl-navy-deep)]">
            Only answer what the platform can support.
          </h2>
        </Reveal>

        <div className="grid gap-4 lg:grid-cols-3">
          {content.home.faqs.map((faq, index) => (
            <Reveal
              key={faq.question}
              delay={index * 0.07}
              className="orbit-card rounded-2xl p-6"
            >
              <div
                className="mb-3 h-0.5 w-8 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, var(--sl-orange), var(--sl-gold))",
                }}
              />
              <h3 className="orbit-heading text-xl text-[var(--sl-navy-deep)]">
                {faq.question}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[rgba(26,72,112,0.68)]">
                {faq.answer}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <Reveal>
        <div
          className="overflow-hidden rounded-3xl px-8 py-14 text-center"
          style={{
            background:
              "linear-gradient(148deg, rgba(13,40,64,0.97) 0%, rgba(26,72,112,0.92) 55%, rgba(58,152,152,0.7) 100%)",
            boxShadow: "0 4px 0 var(--sl-orange) inset",
          }}
        >
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="flex justify-center">
              <Image
                src="/logo-icon.png"
                alt="StayLayer"
                width={56}
                height={56}
                className="rounded-2xl opacity-90"
              />
            </div>
            <h2 className="orbit-heading text-4xl text-white sm:text-5xl">
              Ready to publish your
              <br />
              <span style={{ color: "var(--sl-orange)" }}>
                hospitality
              </span>{" "}
              website?
            </h2>
            <p className="text-base leading-7 text-[rgba(249,246,239,0.65)]">
              Free workspace. No credit card. Custom domain when you're ready.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <OrbitLink
                href="/register"
                tone="primary"
                className="px-8 py-4 text-base"
              >
                Create free workspace
              </OrbitLink>
              <OrbitLink
                href="/pricing"
                tone="ghost"
                className="text-[rgba(249,246,239,0.78)] hover:text-white hover:bg-white/10"
              >
                Compare plans
              </OrbitLink>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
