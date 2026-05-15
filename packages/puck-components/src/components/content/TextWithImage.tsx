import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import {
  backgroundColorField,
  textColorField,
  imageField,
} from "../../lib/fields";
import { parseMarkup } from "../../lib/parse-markup";

const gradientDirMap: Record<string, string> = {
  "to-r": "bg-gradient-to-r",
  "to-br": "bg-gradient-to-br",
  "to-b": "bg-gradient-to-b",
  "to-bl": "bg-gradient-to-bl",
  "to-l": "bg-gradient-to-l",
  "to-tl": "bg-gradient-to-tl",
  "to-t": "bg-gradient-to-t",
  "to-tr": "bg-gradient-to-tr",
};

export interface TextWithImageProps {
  heading: string;
  imageUrl: string;
  imageAlt: string;
  imagePosition: string;
  imageBrowserFrame: boolean;
  imageOverflow: boolean;
  backgroundColor: string;
  textColor: string;
  backgroundImage: string;
  backgroundImageOpacity: number;
  gradient: boolean;
  gradientFrom: string;
  gradientTo: string;
  gradientDirection: string;
  sectionTitle?: string;
  titleFontSize: number;
  titleFontWeight: string;
  titleMaxWidth: number;
  paddingY: string;
  panelStyle: string;
  body: string;
  // ── Heading typography ──
  headingColor: string;
  headingFontSize: number;
  headingWeight: string;
  // actions: ReactNode;
  richContent: ReactNode;
  imageWidthPx: number;
}

const paddingYMap: Record<string, string> = {
  none: "py-0",
  sm: "py-8",
  md: "py-12 md:py-20",
  lg: "py-16 md:py-24",
  xl: "py-24 md:py-32",
};

export const TextWithImage = ({
  heading = "Why choose us",
  imageUrl = "https://placehold.co/960x720/e2e8f0/64748b?text=Feature+Image",
  imageAlt = "Feature illustration",
  imagePosition = "right",
  imageBrowserFrame = false,
  imageOverflow = true,
  backgroundColor = "#2563eb",
  textColor = "#ffffff",
  backgroundImage = "/background-call-to-action.6a5a5672.jpg",
  backgroundImageOpacity = 80,
  gradient = false,
  gradientFrom = "#2563eb",
  gradientTo = "#7c3aed",
  gradientDirection = "to-br",
  sectionTitle = "",
  titleFontSize = 0,
  titleFontWeight = "bold",
  titleMaxWidth = 0,
  paddingY = "lg",
  panelStyle = "translucent",
  body = "",
  headingColor = "",
  headingFontSize = 0,
  headingWeight = "bold",
  // actions: Actions,
  richContent: RichContent,
  imageWidthPx = 0,
}: TextWithImageProps) => {
  // const ActionsSlot = Actions as unknown as React.FC<{ className?: string }>;
  const RichContentSlot = RichContent as unknown as React.FC;
  const imageOnRight = imagePosition !== "left";

  const bgStyle = gradient
    ? ({
        "--grad-from": gradientFrom,
        "--grad-to": gradientTo,
        "--fg": textColor || "#ffffff",
        "--bg-img-opacity": (backgroundImageOpacity ?? 80) / 100,
      } as React.CSSProperties)
    : ({
        "--bg": backgroundColor || "#2563eb",
        "--fg": textColor || "#ffffff",
        "--bg-img-opacity": (backgroundImageOpacity ?? 80) / 100,
      } as React.CSSProperties);

  return (
    <section
      className={cn(
        "breakout-section relative overflow-hidden",
        paddingYMap[paddingY] ?? "py-16 md:py-24",
        gradient
          ? cn(
              gradientDirMap[gradientDirection] ?? "bg-gradient-to-br",
              "from-(--grad-from) to-(--grad-to)",
            )
          : "bg-(--bg)",
      )}
      style={bgStyle}
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

      {/* Optional full-width section title */}
      {((sectionTitle as any)?.props?.value || sectionTitle) && (
        <div className="relative z-10 text-center pt-8 pb-2">
          <h2
            style={{
              ...(titleFontSize > 0 ? { fontSize: `${titleFontSize}px` } : {}),
              ...(titleMaxWidth > 0 ? { maxWidth: `${titleMaxWidth}px` } : {}),
            }}
            className={`font-${titleFontWeight} mx-auto text-white`}
          >
            {parseMarkup(sectionTitle)}
          </h2>
        </div>
      )}

      {/* Main grid */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <div
          className={cn(
            "mt-0 grid grid-cols-1 items-center gap-y-2 pt-10 sm:gap-y-6",
            "lg:grid-cols-2 lg:pt-0",
            `${sectionTitle ? "md:mt-8 lg:mt-16" : ""}`,
          )}
        >
          {/* ── Text column ── */}
          <div
            className={cn(
              "title",
              imageOnRight
                ? "lg:mr-auto lg:pr-4 lg:pt-4"
                : "lg:ml-auto lg:pl-4 lg:pt-4 lg:order-last",
            )}
          >
            <div className="lg:max-w-lg">
              {heading && (
                <h2
                  style={{
                    color: headingColor || textColor || undefined,
                    ...(headingFontSize > 0
                      ? { fontSize: `${headingFontSize}px` }
                      : {}),
                  }}
                  className={`font-${headingWeight || "bold"} leading-tight`}
                >
                  {parseMarkup(heading)}
                </h2>
              )}

              <div
                className={cn(
                  "mt-6 text-start text-(--fg)",
                  panelStyle === "translucent" &&
                    "group relative rounded-xl bg-white/10 px-4 py-1 ring-inset lg:p-6",
                  panelStyle === "opaque" &&
                    "rounded-xl bg-white px-4 py-4 shadow-md text-gray-800",
                  panelStyle === "none" && "opacity-90",
                )}
              >
                <RichContentSlot />
                {body && (
                  <div
                    className="prose prose-sm max-w-none prose-invert"
                    dangerouslySetInnerHTML={{
                      __html: body
                        .replace(/\n\n/g, "</p><p>")
                        .replace(/\n• /g, "</p><ul><li>")
                        .replace(/\n\u2022 /g, "</p><ul><li>")
                        .replace(/<\/li>(?=<ul>)/g, "</li></ul>")
                        .replace(/^(?!<)/, "<p>")
                        .replace(/(?!>)$/, "</p>"),
                    }}
                  />
                )}
              </div>

              {/* CTA actions */}
              {/* <div className="mt-6">
                <ActionsSlot className="flex flex-wrap gap-3" />
              </div> */}
            </div>
          </div>

          {/* ── Image column ── */}
          <div
            className={cn(
              "flex items-start",
              imageOnRight
                ? "justify-start lg:order-last"
                : "justify-end lg:order-first",
            )}
          >
            {imageUrl && (
              <>
                {imageBrowserFrame ? (
                  <div
                    className={cn(
                      "overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-gray-400/10",
                      imageOverflow &&
                        imageWidthPx === 0 &&
                        "w-[48rem] max-w-none sm:w-[57rem]",
                    )}
                    style={
                      imageWidthPx > 0
                        ? { width: `${imageWidthPx}px`, maxWidth: "none" }
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-2 border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white px-4 py-2.5">
                      <div className="flex shrink-0 items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                        <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                      </div>
                    </div>
                    <img
                      src={imageUrl}
                      alt={imageAlt}
                      className="w-full"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl bg-gray-900/5 p-2 ring-1 ring-inset ring-gray-900/10 lg:rounded-2xl lg:p-4">
                    <img
                      src={imageUrl}
                      alt={imageAlt}
                      className={cn(
                        "rounded-xl shadow-2xl ring-1 ring-gray-400/10",
                        imageOverflow &&
                          imageWidthPx === 0 &&
                          "w-[48rem] max-w-none sm:w-[57rem]",
                      )}
                      style={
                        imageWidthPx > 0
                          ? { width: `${imageWidthPx}px`, maxWidth: "none" }
                          : undefined
                      }
                      loading="lazy"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export const textWithImageConfig: ComponentConfig<TextWithImageProps> = {
  label: "Text + Image",
  fields: {
    heading: {
      type: "text",
      label: "Heading",
      contentEditable: true,
    },
    richContent: {
      type: "slot",
      label: "Rich Content (lists, buttons…)",
    },
    body: {
      type: "textarea",
      label: "Body Text (fallback when rich content slot is empty)",
    }, // actions: {
    //   type: "slot",
    //   label: "CTA Buttons",
    //   allow: ["Button", "ButtonGroup"],
    // },
    sectionTitle: {
      type: "text",
      label: "Section Title (above grid)",
      contentEditable: true,
    },
    titleFontSize: {
      type: "number",
      label: "Section Title Font Size",
      min: 0,
      max: 120,
    },
    titleFontWeight: {
      type: "select",
      label: "Section Title Font Weight",
      options: [
        { label: "Light", value: "light" },
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
        { label: "Extra Bold", value: "extrabold" },
      ],
    },
    titleMaxWidth: {
      type: "number",
      label: "Section Title Max Width (px, 0 = no limit)",
      min: 0,
      max: 2000,
    },
    // ── Heading typography ──
    headingColor: {
      ...textColorField,
      label: "Heading Color (overrides global text color)",
    },
    headingFontSize: {
      type: "number",
      label: "Heading Font Size",
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
    panelStyle: {
      type: "select",
      label: "Text Panel Style",
      options: [
        { label: "None", value: "none" },
        { label: "Translucent (glass)", value: "translucent" },
        { label: "Opaque (white)", value: "opaque" },
      ],
    },
    imageUrl: { ...imageField, label: "Image" },
    imageAlt: { type: "text", label: "Image Alt Text" },
    imageWidthPx: {
      type: "number",
      label: "Image Width (px, 0 = auto)",
      min: 0,
      max: 2000,
    },
    imagePosition: {
      type: "radio",
      label: "Image Position",
      options: [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ],
    },
    imageBrowserFrame: {
      type: "radio",
      label: "Browser Frame",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    imageOverflow: {
      type: "radio",
      label: "Image Large/Overflow Style",
      options: [
        { label: "Yes (w-[48rem])", value: true },
        { label: "No (fit container)", value: false },
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
    gradient: {
      type: "radio",
      label: "Background Type",
      options: [
        { label: "Solid", value: false },
        { label: "Gradient", value: true },
      ],
    },
    backgroundColor: backgroundColorField,
    gradientFrom: { ...backgroundColorField, label: "Gradient From" },
    gradientTo: { ...backgroundColorField, label: "Gradient To" },
    gradientDirection: {
      type: "select",
      label: "Gradient Direction",
      options: [
        { label: "→ Right", value: "to-r" },
        { label: "↘ Bottom-Right", value: "to-br" },
        { label: "↓ Bottom", value: "to-b" },
        { label: "↙ Bottom-Left", value: "to-bl" },
        { label: "← Left", value: "to-l" },
        { label: "↑ Top", value: "to-t" },
        { label: "↗ Top-Right", value: "to-tr" },
      ],
    },
    backgroundImage: { ...imageField, label: "Background Image" },
    backgroundImageOpacity: {
      type: "number",
      label: "Background Image Opacity (%)",
      min: 0,
      max: 100,
    },
    textColor: textColorField,
  },
  defaultProps: {
    heading: "Why choose us",
    imageUrl: "https://placehold.co/960x720/e2e8f0/64748b?text=Feature+Image",
    imageAlt: "Feature illustration",
    imagePosition: "right",
    imageBrowserFrame: false,
    imageOverflow: true,
    backgroundColor: "#2563eb",
    textColor: "#ffffff",
    backgroundImage: "/background-call-to-action.6a5a5672.jpg",
    backgroundImageOpacity: 80,
    gradient: false,
    gradientFrom: "#2563eb",
    gradientTo: "#7c3aed",
    gradientDirection: "to-br",
    sectionTitle: "",
    titleFontSize: 0,
    titleFontWeight: "bold",
    titleMaxWidth: 0,
    headingColor: "",
    headingFontSize: 0,
    headingWeight: "bold",
    panelStyle: "translucent",
    paddingY: "lg",
    body: "",
    // actions: [],
    richContent: [],
    imageWidthPx: 0,
  },
  render: TextWithImage,
};
