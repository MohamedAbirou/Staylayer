import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import {
  backgroundColorField,
  imageField,
  textColorField,
} from "../../lib/fields";
import { applyPreset, buildPresetField } from "../../lib/presets";
import { parseMarkup } from "../../lib/parse-markup";

export interface CTABannerProps {
  preset: string;
  heading: string;
  description: string;
  alignment: string;
  paddingY: string;
  showActions: string;
  backgroundColor: string;
  textColor: string;
  backgroundImage: string;
  backgroundImageOpacity: number;
  rounded: string;
  // ── Heading typography ──
  headingColor: string;
  headingFontSize: number;
  headingWeight: string;
  // ── Description typography ──
  descriptionColor: string;
  descriptionFontSize: number;
  descriptionOpacity: number;
  actions: ReactNode;
}

const alignMap: Record<string, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};

const paddingYMap: Record<string, string> = {
  none: "py-0",
  sm: "py-12 md:py-16",
  md: "py-16 md:py-24",
  lg: "py-24 md:py-28",
  xl: "py-28 md:py-32",
};

const roundedValueMap: Record<string, string | undefined> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
};

const ctaBannerPresetMap: Record<string, Partial<CTABannerProps>> = {
  "direct-inquiry": {
    alignment: "center",
    paddingY: "lg",
    rounded: "none",
    backgroundColor: "#0b3d2e",
    textColor: "#ffffff",
    backgroundImage: "",
    backgroundImageOpacity: 60,
    headingWeight: "bold",
    descriptionOpacity: 92,
  },
  "best-rate-promise": {
    alignment: "center",
    paddingY: "md",
    rounded: "xl",
    backgroundColor: "#fef6e4",
    textColor: "#1a1a1a",
    backgroundImage: "",
    backgroundImageOpacity: 40,
    headingWeight: "semibold",
    descriptionOpacity: 85,
  },
  "seasonal-stay": {
    alignment: "left",
    paddingY: "lg",
    rounded: "lg",
    backgroundColor: "#7a4a2a",
    textColor: "#fdf6ee",
    backgroundImage: "",
    backgroundImageOpacity: 70,
    headingWeight: "bold",
    descriptionOpacity: 90,
  },
  "contact-concierge": {
    alignment: "center",
    paddingY: "md",
    rounded: "none",
    backgroundColor: "#1f2937",
    textColor: "#ffffff",
    backgroundImage: "",
    backgroundImageOpacity: 60,
    headingWeight: "semibold",
    descriptionOpacity: 88,
  },
};

export const CTABanner = (rawProps: CTABannerProps) => {
  const {
    heading = "Ready to get started?",
    description = "Join thousands of businesses that already trust our platform.",
    alignment = "center",
    paddingY = "xl",
    showActions = "show",
    backgroundColor = "#2563eb",
    textColor = "#ffffff",
    backgroundImage = "",
    backgroundImageOpacity = 80,
    rounded = "none",
    headingColor = "",
    headingFontSize = 0,
    headingWeight = "bold",
    descriptionColor = "",
    descriptionFontSize = 0,
    descriptionOpacity = 90,
    actions: Actions,
  } = applyPreset(rawProps.preset, rawProps, ctaBannerPresetMap);
  const ActionsSlot = Actions as unknown as React.FC<{ className?: string }>;

  return (
    <section
      className={cn(
        "breakout-section relative w-full overflow-hidden bg-(--bg)",
        paddingYMap[paddingY] ?? "py-28 md:py-32",
        roundedValueMap[rounded],
      )}
      style={
        {
          "--bg": backgroundColor || "#2563eb",
          "--fg": textColor || "#ffffff",
        } as React.CSSProperties
      }
    >
      {/* Decorative background image */}
      {backgroundImage && (
        <img
          src={backgroundImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: (backgroundImageOpacity ?? 80) / 100 }}
          loading="lazy"
        />
      )}

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            "mx-auto flex max-w-3xl flex-col gap-4",
            alignMap[alignment] ?? "items-center text-center",
          )}
        >
          <h2
            style={{
              color: headingColor || textColor || undefined,
              ...(headingFontSize > 0
                ? { fontSize: `${headingFontSize}px` }
                : {}),
            }}
            className={`font-${headingWeight || "bold"} ${headingFontSize === 0 ? " text-2xl md:text-3xl" : ""}`}
          >
            {parseMarkup(heading)}
          </h2>
          {description && (
            <p
              style={{
                color: descriptionColor || textColor || undefined,
                opacity: descriptionOpacity / 100,
                ...(descriptionFontSize > 0
                  ? { fontSize: `${descriptionFontSize}px` }
                  : {}),
              }}
              className={`max-w-2xl leading-relaxed ${descriptionFontSize === 0 ? " text-base md:text-lg" : ""}`}
            >
              {parseMarkup(description)}
            </p>
          )}
          {showActions !== "hide" && (
            <ActionsSlot
              className={cn(
                "flex min-h-11 w-full flex-wrap items-center gap-3",
                alignment === "right"
                  ? "justify-end"
                  : alignment === "left"
                    ? "justify-start"
                    : "justify-center",
              )}
            />
          )}
        </div>
      </div>
    </section>
  );
};

export const ctaBannerConfig: ComponentConfig<CTABannerProps> = {
  label: "CTA Banner",
  fields: {
    preset: buildPresetField({
      label: "Preset look",
      options: [
        {
          label: "Direct inquiry",
          value: "direct-inquiry",
          description: "Forest-green band, centered, action-first",
        },
        {
          label: "Best-rate promise",
          value: "best-rate-promise",
          description: "Warm cream card, refined, gentle",
        },
        {
          label: "Seasonal stay",
          value: "seasonal-stay",
          description: "Earthy clay, editorial, left-aligned",
        },
        {
          label: "Contact concierge",
          value: "contact-concierge",
          description: "Deep slate, refined, calls to write",
        },
      ],
    }),
    heading: {
      type: "text",
      label: "Heading",
      contentEditable: true,
    },
    description: {
      type: "textarea",
      label: "Description",
      contentEditable: true,
    },
    actions: {
      type: "slot",
      allow: ["Button", "ButtonGroup", "Link"],
    },
    alignment: {
      type: "radio",
      label: "Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    paddingY: {
      type: "select",
      label: "Vertical Padding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large (py-32)", value: "xl" },
      ],
    },
    rounded: {
      type: "select",
      label: "Border Radius",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
        { label: "2 Extra Large", value: "2xl" },
      ],
    },
    showActions: {
      type: "radio",
      label: "Show Actions",
      options: [
        { label: "Show", value: "show" },
        { label: "Hide", value: "hide" },
      ],
    },
    backgroundColor: {
      ...backgroundColorField,
      label: "Background Color",
    },
    textColor: {
      ...textColorField,
      label: "Text Color (global fallback)",
    },
    backgroundImage: { ...imageField, label: "Background Image" },
    backgroundImageOpacity: {
      type: "number",
      label: "Background Image Opacity (%)",
      min: 0,
      max: 100,
    },
    // ── Heading typography ──
    headingColor: {
      ...textColorField,
      label: "Heading Color (overrides global)",
    },
    headingFontSize: {
      type: "number",
      label: "Heading Font Size (px, 0 = responsive auto)",
      min: 0,
      max: 120,
    },
    headingWeight: {
      type: "select",
      label: "Heading Font Weight",
      options: [
        { label: "Light", value: "light" },
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
        { label: "Extra Bold", value: "extrabold" },
        { label: "Black", value: "black" },
      ],
    },
    // ── Description typography ──
    descriptionColor: {
      ...textColorField,
      label: "Description Color (overrides global)",
    },
    descriptionFontSize: {
      type: "number",
      label: "Description Font Size (px, 0 = responsive auto)",
      min: 0,
      max: 80,
    },
    descriptionOpacity: {
      type: "number",
      label: "Description Opacity (%)",
      min: 10,
      max: 100,
    },
  },
  defaultProps: {
    preset: "direct-inquiry",
    heading: "Ready to plan your stay?",
    description:
      "Tell us your dates and what you have in mind. We'll personally help you choose the right room and put together the perfect stay.",
    alignment: "center",
    paddingY: "lg",
    rounded: "none",
    showActions: "show",
    backgroundColor: "#0f172a",
    textColor: "#FFFFFF",
    backgroundImage: "",
    backgroundImageOpacity: 70,
    headingColor: "",
    headingFontSize: 40,
    headingWeight: "semibold",
    descriptionColor: "",
    descriptionFontSize: 0,
    descriptionOpacity: 85,
    actions: [],
  },
  render: CTABanner,
};
