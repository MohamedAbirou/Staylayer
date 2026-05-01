import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { backgroundColorField, textColorField } from "../../lib/fields";

interface PricingFeature {
  text: string;
  included: boolean;
}

export interface PricingCardProps {
  planName: string;
  price: string;
  period: string;
  description: string;
  features: PricingFeature[];
  ctaLabel: string;
  ctaUrl: string;
  highlighted: boolean;
  badge: string;
  backgroundColor: string;
  accentColor: string;
  // ── Typography customization ──
  planNameFontSize: number;
  planNameColor: string;
  priceFontSize: number;
  priceColor: string;
  descriptionFontSize: number;
  descriptionColor: string;
}

export const PricingCard = ({
  planName = "Pro",
  price = "$49",
  period = "/month",
  description = "Everything you need to grow your business",
  features = [],
  ctaLabel = "Get Started",
  ctaUrl = "#",
  highlighted = false,
  badge = "",
  backgroundColor = "#ffffff",
  accentColor = "#2563eb",
  planNameFontSize = 0,
  planNameColor = "",
  priceFontSize = 0,
  priceColor = "",
  descriptionFontSize = 0,
  descriptionColor = "",
  puck,
}: PricingCardProps & { puck?: { isEditing?: boolean } }) => {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-6 md:p-8 bg-(--bg) border-(--border-color)",
        highlighted ? "border-2 shadow-xl" : "border-gray-200 shadow-sm",
      )}
      style={
        {
          "--bg": backgroundColor || "#ffffff",
          "--border-color": highlighted ? accentColor : "#e5e7eb",
          "--accent": accentColor,
        } as React.CSSProperties
      }
    >
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold text-white bg-(--accent)">
          {badge}
        </span>
      )}
      <div className="mb-6">
        <h3
          style={{
            color: planNameColor || undefined,
            ...(planNameFontSize > 0
              ? { fontSize: `${planNameFontSize}px` }
              : {}),
          }}
          className={`font-semibold text-gray-900 ${planNameFontSize === 0 ? " text-lg" : ""}`}
        >
          {planName}
        </h3>
        <div className="mt-3 flex items-baseline gap-1">
          <span
            style={{
              color: priceColor || undefined,
              ...(priceFontSize > 0 ? { fontSize: `${priceFontSize}px` } : {}),
            }}
            className={`font-extrabold tracking-tight text-gray-900 ${priceFontSize === 0 ? " text-4xl" : ""}`}
          >
            {price}
          </span>
          {period && <span className="text-sm text-gray-500">{period}</span>}
        </div>
        {description && (
          <p
            style={{
              color: descriptionColor || undefined,
              ...(descriptionFontSize > 0
                ? { fontSize: `${descriptionFontSize}px` }
                : {}),
            }}
            className={`mt-3 text-gray-500 ${descriptionFontSize === 0 ? " text-sm" : ""}`}
          >
            {description}
          </p>
        )}
      </div>
      <ul className="mb-8 flex flex-1 flex-col gap-3">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            {feature.included ? (
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-(--accent)"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            ) : (
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
            <span className={cn(!feature.included && "text-gray-400")}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>
      {puck?.isEditing ? (
        <button
          type="button"
          className={cn(
            "w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
            highlighted
              ? "text-white bg-(--accent)"
              : "border border-gray-300 text-gray-700 hover:bg-gray-50",
          )}
        >
          {ctaLabel}
        </button>
      ) : (
        <a
          href={ctaUrl}
          className={cn(
            "block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors",
            highlighted
              ? "text-white bg-(--accent)"
              : "border border-gray-300 text-gray-700 hover:bg-gray-50",
          )}
        >
          {ctaLabel}
        </a>
      )}
    </div>
  );
};

export const pricingCardConfig: ComponentConfig<PricingCardProps> = {
  label: "Pricing Card",
  fields: {
    planName: { type: "text", label: "Plan Name", contentEditable: true },
    price: { type: "text", label: "Price", contentEditable: true },
    period: {
      type: "text",
      label: "Period (e.g. /month)",
      contentEditable: true,
    },
    description: { type: "text", label: "Description", contentEditable: true },
    features: {
      type: "array",
      label: "Features",
      arrayFields: {
        text: { type: "text", label: "Feature Text", contentEditable: true },
        included: {
          type: "radio",
          label: "Included",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
      },
      defaultItemProps: { text: "Feature name", included: true },
    },
    ctaLabel: { type: "text", label: "Button Label", contentEditable: true },
    ctaUrl: { type: "text", label: "Button URL" },
    highlighted: {
      type: "radio",
      label: "Highlighted",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    badge: { type: "text", label: "Badge Text (optional)" },
    accentColor: {
      ...textColorField,
      label: "Accent Color",
    },
    backgroundColor: backgroundColorField,
    // ── Typography customization ──
    planNameColor: { ...textColorField, label: "Plan Name Color" },
    planNameFontSize: {
      type: "number",
      label: "Plan Name Font Size (px, 0 = auto)",
      min: 0,
      max: 60,
    },
    priceColor: { ...textColorField, label: "Price Color" },
    priceFontSize: {
      type: "number",
      label: "Price Font Size (px, 0 = auto)",
      min: 0,
      max: 120,
    },
    descriptionColor: { ...textColorField, label: "Description Color" },
    descriptionFontSize: {
      type: "number",
      label: "Description Font Size (px, 0 = auto)",
      min: 0,
      max: 40,
    },
  },
  defaultProps: {
    planName: "Pro",
    price: "$49",
    period: "/month",
    description: "Everything you need to grow your business",
    features: [
      { text: "Unlimited properties", included: true },
      { text: "Channel manager", included: true },
      { text: "Revenue analytics", included: true },
      { text: "Priority support", included: true },
      { text: "Custom integrations", included: false },
    ],
    ctaLabel: "Get Started",
    ctaUrl: "#",
    highlighted: false,
    badge: "",
    backgroundColor: "#ffffff",
    accentColor: "#2563eb",
    planNameFontSize: 0,
    planNameColor: "",
    priceFontSize: 0,
    priceColor: "",
    descriptionFontSize: 0,
    descriptionColor: "",
  },
  render: PricingCard,
};
