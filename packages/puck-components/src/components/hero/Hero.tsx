import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import {
  backgroundColorField,
  textColorField,
  imageField,
} from "../../lib/fields";
import { applyPreset, buildPresetField } from "../../lib/presets";
import { parseMarkup } from "../../lib/parse-markup";

export interface HeroProps {
  preset: string;
  heading: string;
  subheading: string;
  alignment: string;
  minHeight: string;
  showActions: string;
  backgroundColor: string;
  backgroundImage: string;
  overlayOpacity: number;
  textColor: string; // ── Heading typography ───────────────────────────────────────────────
  headingColor: string;
  headingFontSize: number;
  headingWeight: string;
  headingMaxWidth: number;
  // ── Subheading typography ──────────────────────────────────────────
  subheadingColor: string;
  subheadingFontSize: number;
  subheadingWeight: string;
  subheadingOpacity: number;
  subheadingMaxWidth: number;
  // ── Animated highlight heading ──────────────────────────
  headingPrefix: string;
  headingHighlight: string;
  headingSuffix: string;
  highlightAnimation: string;
  showHighlightUnderline: boolean;
  highlightColors: string;
  highlightUnderlineColor: string;
  actions: ReactNode;
}

const alignMap: Record<string, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};

const heightValueMap: Record<string, string | undefined> = {
  auto: undefined, // let content decide
  sm: "40vh",
  md: "60vh",
  lg: "80vh",
  full: "100vh", // matches min-h-screen behaviour
};

const heroPresetMap: Record<string, Partial<HeroProps>> = {
  "lifestyle-photo": {
    minHeight: "lg",
    alignment: "left",
    backgroundColor: "#0f172a",
    textColor: "#ffffff",
    overlayOpacity: 55,
    headingWeight: "extrabold",
    headingMaxWidth: 820,
    subheadingMaxWidth: 580,
    subheadingOpacity: 92,
  },
  "minimal-editorial": {
    minHeight: "md",
    alignment: "center",
    backgroundColor: "#faf7f2",
    textColor: "#1a1a1a",
    overlayOpacity: 0,
    headingWeight: "semibold",
    headingMaxWidth: 760,
    subheadingMaxWidth: 620,
    subheadingOpacity: 85,
  },
  "inquiry-focus": {
    minHeight: "md",
    alignment: "center",
    backgroundColor: "#0b3d2e",
    textColor: "#ffffff",
    overlayOpacity: 65,
    headingWeight: "bold",
    headingMaxWidth: 780,
    subheadingMaxWidth: 640,
    subheadingOpacity: 95,
  },
};

export const Hero = (rawProps: HeroProps) => {
  const props = applyPreset(rawProps.preset, rawProps, heroPresetMap);
  const {
    heading = "Your quiet escape, framed by pine and lake",
    subheading = "A handful of light-filled rooms and cabins, hosted in person, with breakfast on the porch and the trailhead five minutes from your door.",
    alignment = "center",
    minHeight = "md",
    showActions = "show",
    backgroundColor = "#0f172a",
    backgroundImage = "",
    overlayOpacity = 60,
    textColor = "#ffffff",
    headingColor = "",
    headingFontSize = 0,
    headingWeight = "extrabold",
    headingMaxWidth = 800,
    subheadingColor = "",
    subheadingFontSize = 0,
    subheadingWeight = "normal",
    subheadingOpacity = 90,
    subheadingMaxWidth = 850,
    headingPrefix = "",
    headingHighlight = "",
    headingSuffix = "",
    highlightAnimation = "none",
    showHighlightUnderline = false,
    highlightColors = "#3B82F6,#8B5CF6,#EC4899,#F59E0B",
    highlightUnderlineColor = "rgba(147,197,253,0.7)",
    actions: Actions,
  } = props;
  const hlColors = (highlightColors || "#3B82F6,#8B5CF6,#EC4899,#F59E0B")
    .split(",")
    .map((c) => c.trim());
  const ActionsSlot = Actions as unknown as React.FC<{ className?: string }>;
  return (
    <section
      className={cn(
        "relative flex w-full items-center justify-center px-4 py-16 md:px-6 md:py-24 bg-(--bg) min-h-(--min-h)",
      )}
      style={
        {
          "--bg": backgroundColor || "transparent",
          "--min-h": heightValueMap[minHeight] ?? "auto",
          "--subheading-max-w": `${subheadingMaxWidth}px`,
          "--heading-max-w": `${headingMaxWidth}px`,
          "--fg": textColor || "inherit",
        } as React.CSSProperties
      }
    >
      {backgroundImage && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
          <div
            className="absolute inset-0 bg-(--overlay)"
            style={
              {
                "--overlay": `rgba(0, 0, 0, ${overlayOpacity / 100})`,
              } as React.CSSProperties
            }
          />
        </>
      )}
      <div
        className={cn(
          "relative z-10 flex max-w-4xl flex-col gap-12",
          alignMap[alignment],
        )}
      >
        {headingHighlight ? (
          <h1
            style={{
              color: headingColor || textColor || undefined,
              ...(headingFontSize > 0
                ? { fontSize: `${headingFontSize}px` }
                : {}),
            }}
            className={`max-w-[var(--heading-max-w)] font-${headingWeight || "extrabold"} leading-tight tracking-tight ${headingFontSize === 0 ? " text-4xl md:text-5xl lg:text-6xl" : ""}`}
          >
            {headingPrefix && <>{parseMarkup(headingPrefix)} </>}
            <span className="relative inline-block whitespace-nowrap">
              {showHighlightUnderline && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 418 42"
                  className="absolute -bottom-4 left-0 h-[0.5em] w-full fill-(--underline-color)"
                  preserveAspectRatio="none"
                  style={
                    {
                      "--underline-color":
                        highlightUnderlineColor || "rgba(147,197,253,0.7)",
                    } as React.CSSProperties
                  }
                >
                  <path d="M203.371.916c-26.013-2.078-76.686 1.963-124.73 9.946L67.3 12.749C35.421 18.062 18.2 21.766 6.004 25.934 1.244 27.561.828 27.778.874 28.61c.07 1.214.828 1.121 9.595-1.176 9.072-2.377 17.15-3.92 39.246-7.496C123.565 7.986 157.869 4.492 195.942 5.046c7.461.108 19.25 1.696 19.17 2.582-.107 1.183-7.874 4.31-25.75 10.366-21.992 7.45-35.43 12.534-36.701 13.884-2.173 2.308-.202 4.407 4.442 4.734 2.654.187 3.263.157 15.593-.78 35.401-2.686 57.944-3.488 88.365-3.143 46.327.526 75.721 2.23 130.788 7.584 19.787 1.924 20.814 1.98 24.557 1.332l.066-.011c1.201-.203 1.53-1.825.399-2.335-2.911-1.31-4.893-1.604-22.048-3.261-57.509-5.556-87.871-7.36-132.059-7.842-23.239-.254-33.617-.116-50.627.674-11.629.54-42.371 2.494-46.696 2.967-2.359.259 8.133-3.625 26.504-9.81 23.239-7.825 27.934-10.149 28.304-14.005.417-4.348-3.529-6-16.878-7.066Z" />
                </svg>
              )}
              <span
                className={cn(
                  "relative max-w-[var(--heading-max-w)]",
                  highlightAnimation === "colorCycle" &&
                    "puck-highlight-color-cycle ",
                )}
                style={
                  {
                    "--h-c1": hlColors[0] || "#3B82F6",
                    "--h-c2": hlColors[1] || "#8B5CF6",
                    "--h-c3": hlColors[2] || "#EC4899",
                    "--h-c4": hlColors[3] || "#F59E0B",
                  } as React.CSSProperties
                }
              >
                {parseMarkup(headingHighlight)}
              </span>
            </span>
            {headingSuffix && <> {parseMarkup(headingSuffix)}</>}
          </h1>
        ) : (
          <h1
            style={{
              color: headingColor || textColor || undefined,
              ...(headingFontSize > 0
                ? { fontSize: `${headingFontSize}px` }
                : {}),
            }}
            className={`max-w-[var(--heading-max-w)] font-${headingWeight || "extrabold"} leading-tight tracking-tight ${headingFontSize === 0 ? " text-4xl md:text-5xl lg:text-6xl" : ""}`}
          >
            {parseMarkup(heading)}
          </h1>
        )}
        {subheading && (
          <p
            style={{
              color: subheadingColor || textColor || undefined,
              opacity: subheadingOpacity / 100,
              ...(subheadingFontSize > 0
                ? { fontSize: `${subheadingFontSize}px` }
                : {}),
            }}
            className={`max-w-[var(--subheading-max-w)] leading-relaxed ${subheadingFontSize === 0 ? " text-lg md:text-xl" : ""} font-${subheadingWeight || "extrabold"}`}
          >
            {parseMarkup(subheading)}
          </p>
        )}
        {showActions !== "hide" && (
          <div className="mt-2 w-full max-w-2xl rounded-md border border-dashed border-white/30 p-2">
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
          </div>
        )}
      </div>
    </section>
  );
};

export const heroConfig: ComponentConfig<HeroProps> = {
  label: "Hero",
  fields: {
    preset: buildPresetField({
      label: "Preset look",
      options: [
        {
          label: "Lifestyle photo",
          value: "lifestyle-photo",
          description: "Full-bleed image, left-aligned, dark overlay",
        },
        {
          label: "Minimal editorial",
          value: "minimal-editorial",
          description: "Warm off-white, centered, refined type",
        },
        {
          label: "Inquiry focus",
          value: "inquiry-focus",
          description: "Forest-green band, centered, calls to act",
        },
      ],
    }),
    heading: {
      type: "text",
      label: "Heading",
      contentEditable: true,
    },
    subheading: {
      type: "textarea",
      label: "Subheading",
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
    minHeight: {
      type: "select",
      label: "Height",
      options: [
        { label: "Auto", value: "auto" },
        { label: "Small (40vh)", value: "sm" },
        { label: "Medium (60vh)", value: "md" },
        { label: "Large (80vh)", value: "lg" },
        { label: "Full Screen", value: "full" },
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
    backgroundImage: {
      ...imageField,
      label: "Background Image",
    },
    overlayOpacity: {
      type: "number",
      label: "Overlay Darkness (%)",
      min: 0,
      max: 100,
    },
    textColor: {
      ...textColorField,
      label: "Text Color (global fallback)",
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
    headingMaxWidth: {
      type: "number",
      label: "Heading Max Width (px)",
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
    subheadingWeight: {
      type: "select",
      label: "Subheading Font Weight",
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
    subheadingOpacity: {
      type: "number",
      label: "Subheading Opacity (%)",
      min: 10,
      max: 100,
    },
    subheadingMaxWidth: {
      type: "number",
      label: "Subheading Max Width (px)",
      min: 200,
      max: 1200,
    },
    // ── Animated highlight heading ──────────────────────────────────────────
    headingPrefix: {
      type: "text",
      label: "Heading Prefix (text before the highlight)",
      contentEditable: true,
    },
    headingHighlight: {
      type: "text",
      label: "Highlighted Word / Phrase (leave empty to use plain heading)",
      contentEditable: true,
    },
    headingSuffix: {
      type: "text",
      label: "Heading Suffix (text after the highlight)",
      contentEditable: true,
    },
    highlightAnimation: {
      type: "select",
      label: "Highlight Animation",
      options: [
        { label: "None (static color)", value: "none" },
        { label: "Color Cycle", value: "colorCycle" },
      ],
    },
    showHighlightUnderline: {
      type: "radio",
      label: "Show Squiggle Underline",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    highlightColors: {
      type: "text",
      label:
        "Color Cycle Colors (comma-separated hex, e.g. #3B82F6,#8B5CF6,#EC4899,#F59E0B)",
    },
    highlightUnderlineColor: {
      ...textColorField,
      label: "Squiggle Underline Color",
    },
  },
  defaultProps: {
    preset: "lifestyle-photo",
    heading: "Your quiet escape, framed by pine and lake",
    subheading:
      "A handful of light-filled rooms and cabins, hosted in person, with breakfast on the porch and the trailhead five minutes from your door.",
    alignment: "center",
    minHeight: "lg",
    showActions: "show",
    backgroundColor: "#0f172a",
    backgroundImage: "",
    overlayOpacity: 50,
    textColor: "#ffffff",
    headingColor: "",
    headingFontSize: 0,
    headingWeight: "extrabold",
    subheadingColor: "",
    subheadingFontSize: 0,
    subheadingOpacity: 90,
    subheadingWeight: "normal",
    headingPrefix: "",
    headingHighlight: "",
    headingSuffix: "",
    highlightAnimation: "none",
    showHighlightUnderline: false,
    highlightColors: "#3B82F6,#8B5CF6,#EC4899,#F59E0B",
    highlightUnderlineColor: "rgba(147,197,253,0.7)",
    headingMaxWidth: 800,
    subheadingMaxWidth: 850,
    actions: [],
  },
  render: Hero,
};
