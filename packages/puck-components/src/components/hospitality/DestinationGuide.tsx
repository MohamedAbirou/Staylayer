import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import {
  backgroundColorField,
  textColorField,
  imageField,
  maxWidthMap,
  resolvePaddingClasses,
} from "../../lib/fields";
import { parseMarkup } from "../../lib/parse-markup";

export interface GuideItem {
  category: string;
  title: string;
  description: string;
  distance: string;
  imageUrl: string;
  imageAlt: string;
}

export interface DestinationGuideProps {
  eyebrow: string;
  heading: string;
  subheading: string;
  alignment: "left" | "center";
  items: GuideItem[];
  variant: "cards" | "list" | "with-image";
  columns: "2" | "3" | "4";
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  maxWidth: keyof typeof maxWidthMap | string;
  paddingY: string;
  paddingX: string;
  ctaLabel: string;
  ctaUrl: string;
  ctaOpenInNewTab: boolean;
}

const colsMap: Record<string, string> = {
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  "4": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

const Pin = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
    <path
      d="M12 22s-7-7-7-12a7 7 0 1114 0c0 5-7 12-7 12z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const DestinationGuide = ({
  eyebrow = "What's nearby",
  heading = "Within a slow walk or short drive",
  subheading = "Hand-picked places we'd send our own friends to — beaches, trails, restaurants, and the quiet corners.",
  alignment = "left",
  items = [],
  variant = "with-image",
  columns = "3",
  accentColor = "#6b5b3e",
  backgroundColor = "#ffffff",
  textColor = "#0f172a",
  maxWidth = "xl",
  paddingY = "lg",
  paddingX = "md",
  ctaLabel = "Read the full local guide",
  ctaUrl = "/local-guide",
  ctaOpenInNewTab = false,
  puck,
}: DestinationGuideProps & { puck?: { isEditing?: boolean } }) => {
  const isEditor = puck?.isEditing;
  const Tag: any = isEditor ? "button" : "a";
  const linkProps = isEditor
    ? { type: "button", onClick: (e: React.MouseEvent) => e.preventDefault() }
    : {
        href: ctaUrl,
        ...(ctaOpenInNewTab
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {}),
      };

  const isCentered = alignment === "center";

  return (
    <section
      className={cn(
        "w-full bg-(--bg) text-(--fg)",
        resolvePaddingClasses(paddingY, paddingX),
      )}
      style={
        {
          "--bg": backgroundColor || "transparent",
          "--fg": textColor || "inherit",
          "--accent": accentColor || "currentColor",
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          "mx-auto w-full",
          maxWidthMap[maxWidth as string] || "max-w-[1280px]",
        )}
      >
        {(eyebrow || heading || subheading) && (
          <header
            className={cn(
              "flex flex-col gap-3 mb-10 md:mb-14",
              isCentered ? "items-center text-center" : "items-start text-left",
            )}
          >
            {eyebrow && (
              <span className="text-xs font-medium uppercase tracking-[0.18em] opacity-70">
                {parseMarkup(eyebrow)}
              </span>
            )}
            {heading && (
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight max-w-2xl">
                {parseMarkup(heading)}
              </h2>
            )}
            {subheading && (
              <p className="text-base md:text-lg opacity-80 max-w-2xl">
                {parseMarkup(subheading)}
              </p>
            )}
          </header>
        )}

        {variant === "list" ? (
          <ul className="flex flex-col divide-y divide-stone-200/70">
            {items.map((item, i) => (
              <li
                key={i}
                className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 py-5 md:py-6"
              >
                <div className="md:w-40 shrink-0">
                  {item.category && (
                    <span className="text-[11px] uppercase tracking-[0.16em] font-medium text-(--accent)">
                      {parseMarkup(item.category)}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {parseMarkup(item.title)}
                  </h3>
                  {item.description && (
                    <p className="text-sm leading-relaxed opacity-80 mt-1">
                      {parseMarkup(item.description)}
                    </p>
                  )}
                </div>
                {item.distance && (
                  <div className="text-sm opacity-70 inline-flex items-center gap-1.5 shrink-0">
                    <Pin />
                    {item.distance}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <ul className={cn("grid gap-6 md:gap-8", colsMap[columns])}>
            {items.map((item, i) => (
              <li
                key={i}
                className="rounded-2xl bg-white ring-1 ring-stone-200/70 overflow-hidden flex flex-col"
              >
                {variant === "with-image" && item.imageUrl && (
                  <div className="aspect-[4/3] overflow-hidden bg-stone-100">
                    <img
                      src={item.imageUrl}
                      alt={item.imageAlt || item.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition duration-700 hover:scale-105"
                    />
                  </div>
                )}
                <div className="flex flex-col gap-2 p-5 md:p-6">
                  <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em]">
                    {item.category && (
                      <span className="font-medium text-(--accent)">
                        {parseMarkup(item.category)}
                      </span>
                    )}
                    {item.distance && (
                      <span className="opacity-70 inline-flex items-center gap-1">
                        <Pin />
                        {item.distance}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg md:text-xl font-semibold tracking-tight">
                    {parseMarkup(item.title)}
                  </h3>
                  {item.description && (
                    <p className="text-sm leading-relaxed opacity-80">
                      {parseMarkup(item.description)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {ctaLabel && (
          <div
            className={cn(
              "mt-10 md:mt-12 flex",
              isCentered ? "justify-center" : "justify-start",
            )}
          >
            <Tag
              {...linkProps}
              className="inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline text-(--accent)"
            >
              {ctaLabel}
              <span aria-hidden>→</span>
            </Tag>
          </div>
        )}
      </div>
    </section>
  );
};

export const destinationGuideConfig: ComponentConfig<DestinationGuideProps> = {
  label: "Destination Guide",
  fields: {
    eyebrow: {
      type: "text",
      label: "Eyebrow (optional)",
      contentEditable: true,
    },
    heading: { type: "text", label: "Heading", contentEditable: true },
    subheading: {
      type: "textarea",
      label: "Subheading",
      contentEditable: true,
    },
    alignment: {
      type: "radio",
      label: "Header alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
      ],
    },
    items: {
      type: "array",
      label: "Guide entries",
      arrayFields: {
        category: {
          type: "text",
          label: "Category (e.g. Beach, Eat, Hike)",
          contentEditable: true,
        },
        title: { type: "text", label: "Title", contentEditable: true },
        description: {
          type: "textarea",
          label: "Description",
          contentEditable: true,
        },
        distance: {
          type: "text",
          label: "Distance / time (e.g. 6 min drive)",
        },
        imageUrl: { ...imageField, label: "Photo (optional)" },
        imageAlt: { type: "text", label: "Photo description (alt text)" },
      },
      defaultItemProps: {
        category: "Nearby",
        title: "Place name",
        description: "A short note about why we send guests there.",
        distance: "10 min walk",
        imageUrl: "",
        imageAlt: "",
      },
      getItemSummary: (it) => it.title || "Guide entry",
    },
    variant: {
      type: "radio",
      label: "Variant",
      options: [
        { label: "Cards with image", value: "with-image" },
        { label: "Cards (text only)", value: "cards" },
        { label: "Simple list", value: "list" },
      ],
    },
    columns: {
      type: "radio",
      label: "Columns",
      options: [
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
      ],
    },
    ctaLabel: { type: "text", label: "CTA Label (optional)" },
    ctaUrl: { type: "text", label: "CTA URL" },
    ctaOpenInNewTab: {
      type: "radio",
      label: "Open CTA in new tab",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    accentColor: { ...textColorField, label: "Accent Color" },
    backgroundColor: backgroundColorField,
    textColor: textColorField,
    maxWidth: {
      type: "select",
      label: "Max Width",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
        { label: "2XL", value: "2xl" },
        { label: "Full", value: "full" },
      ],
    },
    paddingY: {
      type: "select",
      label: "Vertical padding",
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
      label: "Horizontal padding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
  },
  defaultProps: {
    eyebrow: "What's nearby",
    heading: "Within a slow walk or short drive",
    subheading:
      "Hand-picked places we'd send our own friends to — beaches, trails, restaurants, and the quiet corners.",
    alignment: "left",
    items: [
      {
        category: "Swim",
        title: "Cala dei Pini",
        description:
          "A small cove framed by parasol pines. Quiet outside July and August.",
        distance: "8 min drive",
        imageUrl:
          "https://placehold.co/1200x900/cfd9d7/3f5853?text=Cala+dei+Pini",
        imageAlt: "Cala dei Pini cove",
      },
      {
        category: "Eat",
        title: "Trattoria del Borgo",
        description:
          "Family-run trattoria with handmade pasta and a garden out back. Book ahead.",
        distance: "12 min walk",
        imageUrl: "https://placehold.co/1200x900/efeae2/8b6f4e?text=Trattoria",
        imageAlt: "Trattoria interior",
      },
      {
        category: "Walk",
        title: "Sunset ridge trail",
        description:
          "A gentle one-hour loop with sweeping views over the valley and sea.",
        distance: "From the door",
        imageUrl:
          "https://placehold.co/1200x900/c9d6c4/3f5340?text=Ridge+Trail",
        imageAlt: "Ridge trail at sunset",
      },
      {
        category: "Market",
        title: "Saturday market square",
        description:
          "Farmers, cheese, olive oil, and the best focaccia in the region. Mornings only.",
        distance: "15 min drive",
        imageUrl: "https://placehold.co/1200x900/e7dccb/6a4b1f?text=Market",
        imageAlt: "Saturday market square",
      },
    ],
    variant: "with-image",
    columns: "4",
    accentColor: "#6b5b3e",
    backgroundColor: "#fafaf9",
    textColor: "#0f172a",
    maxWidth: "xl",
    paddingY: "lg",
    paddingX: "md",
    ctaLabel: "Read the full local guide",
    ctaUrl: "/local-guide",
    ctaOpenInNewTab: false,
  },
  render: DestinationGuide,
};
