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

interface PricingPlan {
  planName: string;
  price: string;
  period: string;
  description: string;
  features: { text: string; included: boolean }[];
  ctaLabel: string;
  ctaUrl: string;
  highlighted: boolean;
  badge: string;
}

export interface PricingTableProps {
  heading: string;
  subheading: string;
  plans: PricingPlan[];
  backgroundColor: string;
  accentColor: string;
  animation: string;
  animationDuration: string;
  animationDelay: string;
  // ── Heading typography ──
  headingColor: string;
  headingFontSize: number;
  headingWeight: string;
  // ── Subheading typography ──
  subheadingColor: string;
  subheadingFontSize: number;
  subheadingOpacity: number;
}

export const PricingTable = ({
  heading = "Simple, transparent pricing",
  subheading = "Choose the plan that works for you. No hidden fees.",
  plans = [],
  backgroundColor = "",
  accentColor = "#2563eb",
  animation = "none",
  animationDuration = "normal",
  animationDelay = "none",
  headingColor = "",
  headingFontSize = 0,
  headingWeight = "bold",
  subheadingColor = "",
  subheadingFontSize = 0,
  subheadingOpacity = 70,
  puck,
}: PricingTableProps & { puck?: { isEditing?: boolean } }) => {
  const {
    ref: animRef,
    animationClassName,
    style: animStyle,
  } = useScrollAnimation(animation, animationDuration, animationDelay);

  return (
    <div
      ref={animRef}
      className={cn(
        "w-full px-4 py-12 md:px-6 md:py-20 bg-(--bg)",
        animationClassName,
      )}
      style={
        {
          "--bg": backgroundColor || "transparent",
          ...animStyle,
        } as React.CSSProperties
      }
    >
      <div className="mx-auto max-w-screen-xl">
        {(heading || subheading) && (
          <div className="mb-10 text-center md:mb-14">
            {heading && (
              <h2
                style={{
                  color: headingColor || undefined,
                  ...(headingFontSize > 0
                    ? { fontSize: `${headingFontSize}px` }
                    : {}),
                }}
                className={`font-${headingWeight || "bold"} tracking-tight ${headingFontSize === 0 ? " text-3xl md:text-4xl" : ""}`}
              >
                {parseMarkup(heading)}
              </h2>
            )}
            {subheading && (
              <p
                style={{
                  color: subheadingColor || undefined,
                  opacity: subheadingOpacity / 100,
                  ...(subheadingFontSize > 0
                    ? { fontSize: `${subheadingFontSize}px` }
                    : {}),
                }}
                className={`mt-3 text-gray-500 ${subheadingFontSize === 0 ? " text-base md:text-lg" : ""}`}
              >
                {parseMarkup(subheading)}
              </p>
            )}
          </div>
        )}
        <div
          className={cn(
            "mx-auto grid gap-6 md:gap-8",
            plans.length === 2
              ? "max-w-3xl grid-cols-1 md:grid-cols-2"
              : plans.length >= 4
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
                : "max-w-5xl grid-cols-1 md:grid-cols-3",
          )}
        >
          {plans.map((plan, i) => {
            const features = plan.features;
            return (
              <div
                key={i}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-6 md:p-8 transition-shadow duration-300 border-(--border-color) bg-(--plan-bg)",
                  plan.highlighted
                    ? "border-2 shadow-xl scale-[1.02]"
                    : "border-gray-200 shadow-sm hover:shadow-md",
                )}
                style={
                  {
                    "--border-color": plan.highlighted
                      ? accentColor
                      : "#e5e7eb",
                    "--plan-bg": "#ffffff",
                    "--accent": accentColor,
                  } as React.CSSProperties
                }
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold text-white bg-(--accent)">
                    {parseMarkup(plan.badge)}
                  </span>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold">
                    {parseMarkup(plan.planName)}
                  </h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight">
                      {parseMarkup(plan.price)}
                    </span>
                    {plan.period && (
                      <span className="text-sm text-gray-500">
                        {parseMarkup(plan.period)}
                      </span>
                    )}
                  </div>
                  {plan.description && (
                    <p className="mt-3 text-sm text-gray-500">
                      {parseMarkup(plan.description)}
                    </p>
                  )}
                </div>
                <ul className="mb-8 flex flex-1 flex-col gap-3">
                  {features &&
                    features.map((feature, fi) => (
                      <li key={fi} className="flex items-start gap-2 text-sm">
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
                        <span
                          className={cn(
                            !feature.included && "text-gray-400 line-through",
                          )}
                        >
                          {parseMarkup(feature.text)}
                        </span>
                      </li>
                    ))}
                </ul>
                {puck?.isEditing ? (
                  <button
                    type="button"
                    className={cn(
                      "w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
                      plan.highlighted
                        ? "text-white bg-(--accent)"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50",
                    )}
                  >
                    {parseMarkup(plan.ctaLabel)}
                  </button>
                ) : (
                  <a
                    href={plan.ctaUrl}
                    className={cn(
                      "block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors",
                      plan.highlighted
                        ? "text-white bg-(--accent)"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50",
                    )}
                  >
                    {parseMarkup(plan.ctaLabel)}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const pricingTableConfig: ComponentConfig<PricingTableProps> = {
  label: "Pricing Table",
  fields: {
    heading: { type: "text", label: "Heading", contentEditable: true },
    subheading: { type: "text", label: "Subheading", contentEditable: true },
    plans: {
      type: "array",
      label: "Plans",
      arrayFields: {
        planName: { type: "text", label: "Plan Name", contentEditable: true },
        price: { type: "text", label: "Price", contentEditable: true },
        period: { type: "text", label: "Period", contentEditable: true },
        description: {
          type: "text",
          label: "Description",
          contentEditable: true,
        },
        features: {
          type: "array",
          label: "Features",
          arrayFields: {
            text: {
              type: "text",
              label: "Feature text",
              contentEditable: true,
            },
            included: {
              type: "radio",
              label: "Included?",
              options: [
                { label: "Yes", value: true },
                { label: "No", value: false },
              ],
            },
          },
          defaultItemProps: {
            text: "New feature",
            included: true,
          },
          getItemSummary: (item) =>
            (item.included ? "✓ " : "✗ ") + (item.text || "Feature"),
        },
        ctaLabel: {
          type: "text",
          label: "Button Label",
          contentEditable: true,
        },
        ctaUrl: { type: "text", label: "Button URL" },
        highlighted: {
          type: "radio",
          label: "Highlighted",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        badge: {
          type: "text",
          label: "Badge (optional)",
        },
      },
      defaultItemProps: {
        planName: "Pro",
        price: "$49",
        period: "/month",
        description: "Everything you need",
        features: [
          { text: "Feature 1", included: true },
          { text: "Feature 2", included: true },
          { text: "Feature 3", included: false },
        ],
        ctaLabel: "Get Started",
        ctaUrl: "#",
        highlighted: false,
        badge: "",
      },
      getItemSummary: (item) => item.planName || "Plan",
    },
    accentColor: { ...textColorField, label: "Accent Color" },
    backgroundColor: backgroundColorField,
    // ── Heading typography ──
    headingColor: { ...textColorField, label: "Heading Color" },
    headingFontSize: {
      type: "number",
      label: "Heading Font Size (px, 0 = auto)",
      min: 0,
      max: 120,
    },
    headingWeight: {
      type: "select",
      label: "Heading Font Weight",
      options: [
        { label: "Normal", value: "normal" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
        { label: "Extra Bold", value: "extrabold" },
      ],
    },
    // ── Subheading typography ──
    subheadingColor: { ...textColorField, label: "Subheading Color" },
    subheadingFontSize: {
      type: "number",
      label: "Subheading Font Size (px, 0 = auto)",
      min: 0,
      max: 60,
    },
    subheadingOpacity: {
      type: "number",
      label: "Subheading Opacity (%)",
      min: 10,
      max: 100,
    },
    animation: animationField,
    animationDuration: animationDurationField,
    animationDelay: animationDelayField,
  },
  defaultProps: {
    heading: "Simple, transparent pricing",
    subheading: "Choose the plan that works for you. No hidden fees.",
    plans: [
      {
        planName: "Starter",
        price: "$19",
        period: "/month",
        description: "Perfect for small projects",
        features: [
          { text: "Up to 5 pages", included: true },
          { text: "Basic analytics", included: true },
          { text: "Email support", included: true },
          { text: "Custom domain", included: true },
        ],
        ctaLabel: "Start Free Trial",
        ctaUrl: "#",
        highlighted: false,
        badge: "",
      },
      {
        planName: "Pro",
        price: "$49",
        period: "/month",
        description: "Everything you need to grow",
        features: [
          { text: "Unlimited pages", included: true },
          { text: "Advanced analytics", included: true },
          { text: "Priority support", included: true },
          { text: "Custom domain", included: true },
          { text: "API access", included: true },
        ],
        ctaLabel: "Get Started",
        ctaUrl: "#",
        highlighted: true,
        badge: "Most Popular",
      },
      {
        planName: "Enterprise",
        price: "$99",
        period: "/month",
        description: "For large-scale operations",
        features: [
          { text: "Unlimited pages", included: true },
          { text: "Advanced analytics", included: true },
          { text: "Priority support", included: true },
          { text: "Custom domain", included: true },
          { text: "API access", included: true },
          { text: "Team collaboration", included: true },
        ],
        ctaLabel: "Contact Sales",
        ctaUrl: "#",
        highlighted: false,
        badge: "",
      },
    ],
    backgroundColor: "",
    accentColor: "#2563eb",
    headingColor: "",
    headingFontSize: 0,
    headingWeight: "bold",
    subheadingColor: "",
    subheadingFontSize: 0,
    subheadingOpacity: 70,
    animation: "none",
    animationDuration: "normal",
    animationDelay: "none",
  },
  render: PricingTable,
};
