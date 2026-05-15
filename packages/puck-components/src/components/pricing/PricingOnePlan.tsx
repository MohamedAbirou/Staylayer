import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { backgroundColorField, textColorField } from "../../lib/fields";
import { useScrollAnimation } from "../../lib/use-animation";
import {
  animationField,
  animationDurationField,
  animationDelayField,
} from "../../lib/animations";
import { parseMarkup } from "../../lib/parse-markup";

interface OnePlanFeature {
  text: string;
}

interface OnePlanAccordion {
  title: string;
  body: string;
}

export interface PricingOnePlanProps {
  // ── Section badge ──
  badgeText: string;
  badgeDotColor: string;
  showBadge: boolean;
  // ── Heading ──
  heading: string;
  subheading: string;
  headingColor: string;
  headingFontSize: number;
  headingWeight: string;
  subheadingColor: string;
  subheadingFontSize: number;
  // ── Price display ──
  price: string;
  period: string;
  priceDescription: string;
  priceColor: string;
  priceFontSize: number;
  // ── Features ──
  features: OnePlanFeature[];
  featuresNote: string;
  featureAccentColor: string;
  // ── CTA ──
  ctaLabel: string;
  ctaUrl: string;
  ctaOpenInNewTab: boolean;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  // ── Card badge ──
  cardBadgeText: string;
  cardBadgeColor: string;
  showCardBadge: boolean;
  // ── Accordion ──
  accordions: OnePlanAccordion[];
  showAccordion: boolean;
  // ── Colors & layout ──
  sectionBackgroundColor: string;
  cardBackgroundColor: string;
  cardBorderColor: string;
  showDecorationBlobs: boolean;
  blobColor1: string;
  blobColor2: string;
  // ── Animation ──
  animation: string;
  animationDuration: string;
  animationDelay: string;
  // ── Vertical layout ──
  layoutVariant: string;
  planTitle: string;
  planSubtitle: string;
  priceNote: string;
  bodyText: string;
  showBodyText: boolean;
  featureListStyle: string;
  featureColumns: number;
  disclaimer: string;
  showDisclaimer: boolean;
  disclaimerBgColor: string;
  disclaimerTextColor: string;
}

export const PricingOnePlan = ({
  badgeText = "All access plan",
  badgeDotColor = "#34d399",
  showBadge = true,
  heading = "One simple plan",
  subheading = "Clear and predictable pricing. No tiers to compare. No hidden fees. You get the full suite from day one.",
  headingColor = "",
  headingFontSize = 0,
  headingWeight = "semibold",
  subheadingColor = "",
  subheadingFontSize = 0,
  price = "$99",
  period = "per month",
  priceDescription = "Full feature access for a flat monthly rate. Cancel any time.",
  priceColor = "",
  priceFontSize = 0,
  features = [
    { text: "All features included" },
    { text: "No commission" },
    { text: "Chat support" },
    { text: "Quick setup" },
  ],
  featuresNote = "Everything from automation to analytics is included with your subscription.",
  featureAccentColor = "#10b981",
  ctaLabel = "Subscribe now",
  ctaUrl = "#",
  ctaOpenInNewTab = false,
  ctaBackgroundColor = "#0f172a",
  ctaTextColor = "#ffffff",
  cardBadgeText = "Best value",
  cardBadgeColor = "#34d399",
  showCardBadge = true,
  accordions = [
    {
      title: "What is included",
      body: "The plan covers property management, channel syncing, automated messaging, invoicing, housekeeping, and reporting. You can add and manage as many properties as you need. Support is available through email and chat.",
    },
  ],
  showAccordion = true,
  sectionBackgroundColor = "#ffffff",
  cardBackgroundColor = "#ffffff",
  cardBorderColor = "#e2e8f0",
  showDecorationBlobs = true,
  blobColor1 = "#67e8f9",
  blobColor2 = "#e879f9",
  animation = "none",
  animationDuration = "normal",
  animationDelay = "none",
  layoutVariant = "classic",
  planTitle = "One plan.",
  planSubtitle = "All features unlocked.",
  priceNote = "",
  bodyText = "",
  showBodyText = false,
  featureListStyle = "pills",
  featureColumns = 2,
  disclaimer = "",
  showDisclaimer = false,
  disclaimerBgColor = "#f9fafb",
  disclaimerTextColor = "#4b5563",
  puck,
}: PricingOnePlanProps & { puck?: { isEditing?: boolean } }) => {
  const { ref, animationClassName } = useScrollAnimation(
    animation,
    animationDuration,
    animationDelay,
  );

  const isEditor = puck?.isEditing;
  const Tag = isEditor ? "button" : "a";
  const ctaProps = isEditor
    ? {
        type: "button" as const,
        onClick: (e: React.MouseEvent) => e.preventDefault(),
      }
    : {
        href: ctaUrl,
        ...(ctaOpenInNewTab
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {}),
      };

  const fontWeightMap: Record<string, string> = {
    normal: "font-normal",
    medium: "font-medium",
    semibold: "font-semibold",
    bold: "font-bold",
    extrabold: "font-extrabold",
  };

  return (
    <section
      ref={ref}
      className={cn("relative isolate overflow-hidden", animationClassName)}
      style={
        {
          "--section-bg": sectionBackgroundColor || "#ffffff",
          "--card-bg": cardBackgroundColor || "#ffffff",
          "--card-border": cardBorderColor || "#e2e8f0",
          "--cta-bg": ctaBackgroundColor || "#0f172a",
          "--cta-fg": ctaTextColor || "#ffffff",
          "--feature-accent": featureAccentColor || "#10b981",
          "--badge-dot": badgeDotColor || "#34d399",
          "--card-badge-bg": cardBadgeColor || "#34d399",
          "--blob1": blobColor1 || "#67e8f9",
          "--blob2": blobColor2 || "#e879f9",
          backgroundColor: "var(--section-bg)",
        } as React.CSSProperties
      }
    >
      {/* ── Decorative background blobs ── */}
      {showDecorationBlobs && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
        >
          <div
            className="absolute -top-24 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full blur-[120px]"
            style={{ backgroundColor: "var(--blob1)" }}
          />
          <div
            className="absolute bottom-0 right-0 h-72 w-72 rounded-full blur-[120px]"
            style={{ backgroundColor: "var(--blob2)" }}
          />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        {/* ── Section header ── */}
        <div className="mx-auto max-w-3xl text-center">
          {showBadge && badgeText && (
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/70 px-4 py-1.5 text-sm text-slate-600 backdrop-blur">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: "var(--badge-dot)" }}
              />
              {parseMarkup(badgeText)}
            </div>
          )}

          {heading && (
            <h2
              className={cn(
                "mt-4 tracking-tight text-slate-900",
                headingFontSize === 0 && "text-3xl sm:text-4xl",
                fontWeightMap[headingWeight] ?? "font-semibold",
              )}
              style={{
                ...(headingColor ? { color: headingColor } : {}),
                ...(headingFontSize > 0
                  ? { fontSize: `${headingFontSize}px` }
                  : {}),
              }}
            >
              {parseMarkup(heading)}
            </h2>
          )}

          {subheading && (
            <p
              className={cn(
                "mt-3 leading-7 text-slate-600",
                subheadingFontSize === 0 && "text-base sm:text-lg",
              )}
              style={{
                ...(subheadingColor ? { color: subheadingColor } : {}),
                ...(subheadingFontSize > 0
                  ? { fontSize: `${subheadingFontSize}px` }
                  : {}),
              }}
            >
              {parseMarkup(subheading)}
            </p>
          )}
        </div>

        {/* ── Main card ── */}
        {layoutVariant === "vertical" ? (
          /* ── Vertical "one plan" card ── */
          <div className="mx-auto mt-10 max-w-4xl">
            <div
              className="relative rounded-2xl border p-6 shadow-sm sm:p-8"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
              }}
            >
              {/* Card header: title left, price right */}
              <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  {planTitle && (
                    <h3
                      className="text-xl font-semibold mb-0.5 leading-none"
                      style={headingColor ? { color: headingColor } : {}}
                    >
                      {parseMarkup(planTitle)}
                    </h3>
                  )}
                  {planSubtitle && (
                    <p className="text-sm text-slate-500">
                      {parseMarkup(planSubtitle)}
                    </p>
                  )}
                </div>
                <div className="text-left sm:text-right">
                  <div
                    className={cn(
                      "font-bold leading-none",
                      priceFontSize === 0 && "text-2xl",
                    )}
                    style={{
                      ...(priceColor ? { color: priceColor } : {}),
                      ...(priceFontSize > 0
                        ? { fontSize: `${priceFontSize}px` }
                        : {}),
                    }}
                  >
                    {parseMarkup(price)}
                    {period && (
                      <span className="ml-1 text-base font-normal text-slate-500">
                        {parseMarkup(period)}
                      </span>
                    )}
                  </div>
                  {priceNote && (
                    <div className="text-xs text-slate-500 mt-1">
                      {parseMarkup(priceNote)}
                    </div>
                  )}
                </div>
              </header>

              {/* Body paragraph */}
              {showBodyText && bodyText && (
                <p className="mt-4 text-sm leading-7 text-slate-700">
                  {parseMarkup(bodyText)}
                </p>
              )}

              {/* Feature list */}
              {features.length > 0 &&
                (featureListStyle === "bullets" ? (
                  <ul
                    className={cn(
                      "mt-6 grid list-disc gap-3 pl-5",
                      featureColumns === 2 && "md:grid-cols-2",
                    )}
                  >
                    {features.map((item, i) => (
                      <li key={i} className="text-sm text-slate-700">
                        {item.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {features.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800"
                      >
                        <span
                          className="shrink-0 mt-0.5 text-sm font-bold"
                          style={{ color: "var(--feature-accent)" }}
                        >
                          ✓
                        </span>
                        <span className="text-sm leading-6">
                          {parseMarkup(item.text)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ))}

              {featuresNote && (
                <p className="mt-4 text-sm text-slate-500">
                  {parseMarkup(featuresNote)}
                </p>
              )}

              {/* Disclaimer / note box */}
              {showDisclaimer && disclaimer && (
                <div
                  className="mt-6 rounded-xl p-4 text-sm"
                  style={{
                    backgroundColor: disclaimerBgColor,
                    color: disclaimerTextColor,
                  }}
                >
                  {parseMarkup(disclaimer)}
                </div>
              )}

              {/* Card badge */}
              {showCardBadge && cardBadgeText && (
                <div
                  className="absolute -right-2 -top-2 rounded-full px-3 py-1 text-xs font-semibold text-white shadow"
                  style={{ backgroundColor: "var(--card-badge-bg)" }}
                >
                  {parseMarkup(cardBadgeText)}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Classic layout ── */
          <div className="mx-auto mt-10 max-w-3xl">
            <div
              className="relative rounded-3xl border p-6 shadow-2xl ring-1 ring-slate-100 sm:p-10"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
              }}
            >
              <div className="grid items-center gap-8 sm:grid-cols-5">
                {/* ── Left: price + CTA ── */}
                <div className="sm:col-span-2">
                  <div className="flex items-end gap-2 text-slate-900">
                    <span
                      className={cn(
                        "font-semibold tracking-tight",
                        priceFontSize === 0 && "text-5xl",
                      )}
                      style={{
                        ...(priceColor ? { color: priceColor } : {}),
                        ...(priceFontSize > 0
                          ? { fontSize: `${priceFontSize}px` }
                          : {}),
                      }}
                    >
                      {parseMarkup(price)}
                    </span>
                    {period && (
                      <span className="text-slate-500 pb-1">
                        {parseMarkup(period)}
                      </span>
                    )}
                  </div>

                  {priceDescription && (
                    <p className="mt-3 text-slate-600 text-sm leading-6">
                      {parseMarkup(priceDescription)}
                    </p>
                  )}

                  <div className="mt-6">
                    <Tag
                      {...ctaProps}
                      className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold shadow transition-all duration-200 hover:opacity-85 no-underline"
                      style={{
                        backgroundColor: "var(--cta-bg)",
                        color: "var(--cta-fg)",
                      }}
                    >
                      {parseMarkup(ctaLabel)}
                    </Tag>
                  </div>
                </div>

                {/* ── Right: feature pills ── */}
                <div className="sm:col-span-3">
                  {features.length > 0 && (
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {features.map((item, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800"
                        >
                          <span
                            className="shrink-0 mt-0.5 text-sm font-bold"
                            style={{ color: "var(--feature-accent)" }}
                          >
                            ✓
                          </span>
                          <span className="text-sm leading-6">
                            {parseMarkup(item.text)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {featuresNote && (
                    <p className="mt-4 text-sm text-slate-500">
                      {parseMarkup(featuresNote)}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Card badge ── */}
              {showCardBadge && cardBadgeText && (
                <div
                  className="absolute -right-2 -top-2 rounded-full px-3 py-1 text-xs font-semibold text-white shadow"
                  style={{ backgroundColor: "var(--card-badge-bg)" }}
                >
                  {parseMarkup(cardBadgeText)}
                </div>
              )}
            </div>

            {/* ── Accordions ── */}
            {showAccordion && accordions.length > 0 && (
              <div className="mx-auto mt-8 max-w-3xl flex flex-col gap-3 text-slate-700">
                {accordions.map((item, i) => (
                  <details
                    key={i}
                    className="group rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <summary className="cursor-pointer select-none text-base font-semibold text-slate-900 group-open:mb-3 list-none flex items-center justify-between">
                      <span>{parseMarkup(item.title)}</span>
                      <svg
                        className="w-4 h-4 shrink-0 transition-transform duration-200 group-open:rotate-180 text-slate-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </summary>
                    <p className="text-sm leading-7 text-slate-600">
                      {parseMarkup(item.body)}
                    </p>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export const pricingOnePlanConfig: ComponentConfig<PricingOnePlanProps> = {
  label: "Pricing — One Plan",
  fields: {
    // ── Section badge ──
    showBadge: {
      type: "radio",
      label: "Show Top Badge",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    badgeText: { type: "text", label: "Badge Text", contentEditable: true },
    badgeDotColor: { ...textColorField, label: "Badge Dot Color" },

    // ── Heading ──
    heading: { type: "text", label: "Heading", contentEditable: true },
    headingFontSize: {
      type: "number",
      label: "Heading Font Size (px, 0 = auto)",
      min: 0,
      max: 96,
    },
    headingWeight: {
      type: "select",
      label: "Heading Weight",
      options: [
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semi Bold", value: "semibold" },
        { label: "Bold", value: "bold" },
        { label: "Extra Bold", value: "extrabold" },
      ],
    },
    headingColor: { ...textColorField, label: "Heading Color" },
    subheading: {
      type: "textarea",
      label: "Subheading",
      contentEditable: true,
    },
    subheadingFontSize: {
      type: "number",
      label: "Subheading Font Size (px, 0 = auto)",
      min: 0,
      max: 48,
    },
    subheadingColor: { ...textColorField, label: "Subheading Color" },

    // ── Price ──
    price: { type: "text", label: "Price", contentEditable: true },
    priceFontSize: {
      type: "number",
      label: "Price Font Size (px, 0 = auto)",
      min: 0,
      max: 120,
    },
    priceColor: { ...textColorField, label: "Price Color" },
    period: {
      type: "text",
      label: "Period (e.g. per month)",
      contentEditable: true,
    },
    priceDescription: {
      type: "textarea",
      label: "Price Description",
      contentEditable: true,
    },

    // ── Features ──
    features: {
      type: "array",
      label: "Feature Pills",
      arrayFields: {
        text: { type: "text", label: "Feature Text", contentEditable: true },
      },
      defaultItemProps: { text: "Feature name" },
      getItemSummary: (item: OnePlanFeature) => item.text || "Feature",
    },
    featuresNote: {
      type: "textarea",
      label: "Note Below Features",
      contentEditable: true,
    },
    featureAccentColor: { ...textColorField, label: "Checkmark Color" },

    // ── CTA ──
    ctaLabel: { type: "text", label: "Button Label", contentEditable: true },
    ctaUrl: { type: "text", label: "Button URL" },
    ctaOpenInNewTab: {
      type: "radio",
      label: "Open in New Tab",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    ctaBackgroundColor: { ...backgroundColorField, label: "Button Background" },
    ctaTextColor: { ...textColorField, label: "Button Text Color" },

    // ── Card badge ──
    showCardBadge: {
      type: "radio",
      label: "Show Card Badge",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    cardBadgeText: {
      type: "text",
      label: "Card Badge Text",
      contentEditable: true,
    },
    cardBadgeColor: { ...backgroundColorField, label: "Card Badge Color" },

    // ── Accordion ──
    showAccordion: {
      type: "radio",
      label: "Show Accordions",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    accordions: {
      type: "array",
      label: "Accordion Items",
      arrayFields: {
        title: { type: "text", label: "Title", contentEditable: true },
        body: { type: "textarea", label: "Body Text", contentEditable: true },
      },
      defaultItemProps: { title: "New section", body: "" },
      getItemSummary: (item: OnePlanAccordion) => item.title || "Accordion",
    },

    // ── Colors ──
    sectionBackgroundColor: {
      ...backgroundColorField,
      label: "Section Background",
    },
    cardBackgroundColor: { ...backgroundColorField, label: "Card Background" },
    cardBorderColor: { ...textColorField, label: "Card Border Color" },

    // ── Background blobs ──
    showDecorationBlobs: {
      type: "radio",
      label: "Show Background Decoration",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    blobColor1: { ...backgroundColorField, label: "Blob Color 1 (top)" },
    blobColor2: {
      ...backgroundColorField,
      label: "Blob Color 2 (bottom-right)",
    },

    // ── Vertical layout ──
    layoutVariant: {
      type: "radio",
      label: "Layout Style",
      options: [
        { label: "Classic", value: "classic" },
        { label: "Vertical (Card)", value: "vertical" },
      ],
    },
    planTitle: { type: "text", label: "Plan Title", contentEditable: true },
    planSubtitle: {
      type: "text",
      label: "Plan Subtitle",
      contentEditable: true,
    },
    priceNote: {
      type: "text",
      label: "Price Note (e.g. 0% booking fee*)",
      contentEditable: true,
    },
    showBodyText: {
      type: "radio",
      label: "Show Body Paragraph",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    bodyText: {
      type: "textarea",
      label: "Body Paragraph (use **text** for bold)",
    },
    featureListStyle: {
      type: "radio",
      label: "Feature List Style",
      options: [
        { label: "Pills", value: "pills" },
        { label: "Bullets", value: "bullets" },
      ],
    },
    featureColumns: {
      type: "radio",
      label: "Feature Columns (bullets only)",
      options: [
        { label: "1 column", value: 1 },
        { label: "2 columns", value: 2 },
      ],
    },
    showDisclaimer: {
      type: "radio",
      label: "Show Disclaimer Box",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    disclaimer: {
      type: "textarea",
      label: "Disclaimer / Note Box Text",
      contentEditable: true,
    },
    disclaimerBgColor: {
      ...backgroundColorField,
      label: "Disclaimer Background",
    },
    disclaimerTextColor: { ...textColorField, label: "Disclaimer Text Color" },

    // ── Animation ──
    animation: animationField,
    animationDuration: animationDurationField,
    animationDelay: animationDelayField,
  },
  defaultProps: {
    showBadge: true,
    badgeText: "All access plan",
    badgeDotColor: "#34d399",
    heading: "One simple plan",
    headingFontSize: 0,
    headingWeight: "semibold",
    headingColor: "",
    subheading:
      "Clear and predictable pricing. No tiers to compare. No hidden fees. You get the full suite from day one.",
    subheadingFontSize: 0,
    subheadingColor: "",
    price: "$99",
    priceFontSize: 0,
    priceColor: "",
    period: "per month",
    priceDescription:
      "Full feature access for a flat monthly rate. Cancel any time.",
    features: [
      { text: "All features included" },
      { text: "No commission" },
      { text: "Chat support" },
      { text: "Quick setup" },
    ],
    featuresNote:
      "Everything from automation to analytics is included with your subscription.",
    featureAccentColor: "#10b981",
    ctaLabel: "Subscribe now",
    ctaUrl: "#",
    ctaOpenInNewTab: false,
    ctaBackgroundColor: "#0f172a",
    ctaTextColor: "#ffffff",
    showCardBadge: true,
    cardBadgeText: "Best value",
    cardBadgeColor: "#34d399",
    showAccordion: true,
    accordions: [
      {
        title: "What is included",
        body: "The plan covers property management, channel syncing, automated messaging, invoicing, housekeeping, and reporting. You can add and manage as many properties as you need. Support is available through email and chat.",
      },
    ],
    sectionBackgroundColor: "#ffffff",
    cardBackgroundColor: "#ffffff",
    cardBorderColor: "#e2e8f0",
    showDecorationBlobs: true,
    blobColor1: "#67e8f9",
    blobColor2: "#e879f9",
    layoutVariant: "classic",
    planTitle: "One plan.",
    planSubtitle: "All features unlocked.",
    priceNote: "",
    bodyText: "",
    showBodyText: false,
    featureListStyle: "pills",
    featureColumns: 2,
    disclaimer: "",
    showDisclaimer: false,
    disclaimerBgColor: "#f9fafb",
    disclaimerTextColor: "#4b5563",
    animation: "none",
    animationDuration: "normal",
    animationDelay: "none",
  },
  render: PricingOnePlan,
};
