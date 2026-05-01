import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import {
  backgroundColorField,
  textColorField,
  imageField,
  resolvePaddingClasses,
} from "../../lib/fields";

export interface HeroSplitProps {
  heading: string;
  subheading: string;
  textAlignment: string;
  columnSpacing: number;
  imageUrl: string;
  imageAlt: string;
  imagePosition: string;
  imageRounded: string;
  imageShadow: boolean;
  paddingY: string;
  paddingX: string;
  backgroundColor: string;
  textColor: string;
  // ── Heading typography ──
  headingColor: string;
  headingFontSize: number;
  headingWeight: string;
  // ── Subheading typography ──
  subheadingColor: string;
  subheadingFontSize: number;
  subheadingOpacity: number;
  actions: ReactNode;
}

// ─── Maps ─────────────────────────────────────────────────────────────────────

const textAlignMap: Record<string, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};

const actionAlignMap: Record<string, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

const roundedMap: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
};

// ─── Component ───────────────────────────────────────────────────────────────

export const HeroSplit = ({
  heading = "Grow your business with the right tools",
  subheading = "Everything you need to manage your properties, automate your workflow, and increase your revenue.",
  textAlignment = "left",
  columnSpacing = 24,
  imageUrl = "https://placehold.co/600x500/e2e8f0/64748b?text=Your+Image",
  imageAlt = "Hero image",
  imagePosition = "right",
  imageRounded = "xl",
  imageShadow = true,
  paddingY = "md",
  paddingX = "md",
  backgroundColor = "#ffffff",
  textColor = "#0f172a",
  headingColor = "",
  headingFontSize = 0,
  headingWeight = "extrabold",
  subheadingColor = "",
  subheadingFontSize = 0,
  subheadingOpacity = 80,
  actions: Actions,
}: HeroSplitProps) => {
  const ActionsSlot = Actions as unknown as React.FC<{ className?: string }>;

  return (
    <section
      className={cn(
        "w-full bg-(--bg)",
        resolvePaddingClasses(paddingY, paddingX),
      )}
      style={
        {
          "--bg": backgroundColor || "transparent",
          "--fg": textColor || "inherit",
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          "mx-auto flex max-w-screen-xl items-center",
          "flex-col sm:flex-row gap-(--col-gap)",
          imagePosition === "left" && "md:flex-row-reverse",
        )}
        style={
          {
            "--col-gap": `calc(${columnSpacing ?? 24} * 0.25rem)`,
          } as React.CSSProperties
        }
      >
        {/* ── Text column ── */}
        <div
          className={cn(
            "flex flex-col gap-5 flex-1 min-w-0",
            textAlignMap[textAlignment] ?? "items-start text-left",
          )}
        >
          <h1
            style={{
              color: headingColor || textColor || undefined,
              ...(headingFontSize > 0
                ? { fontSize: `${headingFontSize}px` }
                : {}),
            }}
            className={`font-${headingWeight || "extrabold"} leading-tight tracking-tight ${headingFontSize === 0 ? " text-3xl md:text-4xl lg:text-5xl" : ""}`}
          >
            {heading}
          </h1>
          {subheading && (
            <p
              style={{
                color: subheadingColor || textColor || undefined,
                opacity: subheadingOpacity / 100,
                ...(subheadingFontSize > 0
                  ? { fontSize: `${subheadingFontSize}px` }
                  : {}),
              }}
              className={`leading-relaxed ${subheadingFontSize === 0 ? " text-lg" : ""}`}
            >
              {subheading}
            </p>
          )}
          <div className="mt-2">
            <ActionsSlot
              className={cn(
                "flex flex-wrap gap-3",
                actionAlignMap[textAlignment] ?? "justify-start",
              )}
            />
          </div>
        </div>

        {/* ── Image column ── */}
        <div className="flex-1 min-w-0 w-full">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={imageAlt}
              className={cn(
                "w-full object-cover",
                roundedMap[imageRounded] ?? "rounded-xl",
                imageShadow && "shadow-lg",
              )}
              loading="lazy"
            />
          )}
        </div>
      </div>
    </section>
  );
};

// ─── Config ──────────────────────────────────────────────────────────────────

export const heroSplitConfig: ComponentConfig<HeroSplitProps> = {
  label: "Hero (Split)",
  fields: {
    heading: { type: "text", label: "Heading", contentEditable: true },
    subheading: {
      type: "textarea",
      label: "Subheading",
      contentEditable: true,
    },
    actions: {
      type: "slot",
      allow: ["Button", "ButtonGroup"],
    },
    textAlignment: {
      type: "radio",
      label: "Text Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    columnSpacing: {
      type: "number",
      label: "Spacing Between Columns (px)",
      placeholder: "24",
      min: 0,
      max: 100,
    },
    imageUrl: { ...imageField, label: "Image" },
    imageAlt: { type: "text", label: "Image Alt Text" },
    imagePosition: {
      type: "radio",
      label: "Image Position",
      options: [
        { label: "Right of text", value: "right" },
        { label: "Left of text", value: "left" },
      ],
    },
    imageRounded: {
      type: "select",
      label: "Image Corners",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
        { label: "2X Large", value: "2xl" },
      ],
    },
    imageShadow: {
      type: "radio",
      label: "Image Shadow",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
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
        { label: "Extra Large", value: "xl" },
      ],
    },
    paddingX: {
      type: "select",
      label: "Horizontal Padding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
    backgroundColor: { ...backgroundColorField, label: "Background Color" },
    textColor: { ...textColorField, label: "Text Color (global fallback)" },
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
    // ── Subheading typography ──
    subheadingColor: {
      ...textColorField,
      label: "Subheading Color (overrides global)",
    },
    subheadingFontSize: {
      type: "number",
      label: "Subheading Font Size (px, 0 = responsive auto)",
      min: 0,
      max: 80,
    },
    subheadingOpacity: {
      type: "number",
      label: "Subheading Opacity (%)",
      min: 10,
      max: 100,
    },
  },
  defaultProps: {
    heading: "Grow your business with the right tools",
    subheading:
      "Everything you need to manage your properties, automate your workflow, and increase your revenue.",
    textAlignment: "left",
    columnSpacing: 24,
    imageUrl: "https://placehold.co/600x500/e2e8f0/64748b?text=Your+Image",
    imageAlt: "Hero image",
    imagePosition: "right",
    imageRounded: "xl",
    imageShadow: true,
    paddingY: "md",
    paddingX: "md",
    backgroundColor: "#ffffff",
    textColor: "#0f172a",
    headingColor: "",
    headingFontSize: 0,
    headingWeight: "extrabold",
    subheadingColor: "",
    subheadingFontSize: 0,
    subheadingOpacity: 80,
    actions: [],
  },
  render: HeroSplit,
};
