import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import {
  backgroundColorField,
  textColorField,
  maxWidthMap,
  resolvePaddingClasses,
} from "../../lib/fields";
import { parseMarkup } from "../../lib/parse-markup";

export interface AmenityItem {
  icon: string;
  title: string;
  description: string;
}

export interface AmenitiesGridProps {
  eyebrow: string;
  heading: string;
  subheading: string;
  alignment: "left" | "center";
  items: AmenityItem[];
  columns: "2" | "3" | "4";
  layout: "card" | "minimal" | "tinted";
  iconColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  maxWidth: keyof typeof maxWidthMap | string;
  paddingY: string;
  paddingX: string;
}

const colsMap: Record<string, string> = {
  "2": "grid-cols-1 sm:grid-cols-2",
  "3": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  "4": "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4",
};

// Hospitality-relevant inline icons (heroicon style)
const amenityIcons: Record<string, React.ReactNode> = {
  breakfast: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path
        d="M4 11h13a3 3 0 010 6h-1M4 11v4a4 4 0 004 4h4a4 4 0 004-4M7 7s-1-1 0-2 0 2 1 2-1-1 0-2M11 7s-1-1 0-2 0 2 1 2-1-1 0-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  coffee: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path
        d="M4 9h12v6a4 4 0 01-4 4H8a4 4 0 01-4-4V9zM16 11h2a2 2 0 010 4h-2M8 4s-1 1 0 2M12 4s-1 1 0 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  pool: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path
        d="M2 18c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1M2 21c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1M7 14V6a2 2 0 012-2M17 14V6a2 2 0 00-2-2M7 9h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  wifi: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path
        d="M2 9a15 15 0 0120 0M5 13a10 10 0 0114 0M8.5 16.5a5 5 0 017 0M12 20h.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  parking: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10 17V8h3a2.5 2.5 0 010 5h-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  pet: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path
        d="M6 10a2 2 0 110-4 2 2 0 010 4zm12 0a2 2 0 110-4 2 2 0 010 4zM9 6a2 2 0 110-4 2 2 0 010 4zm6 0a2 2 0 110-4 2 2 0 010 4zM7 17.5C7 14 9.5 12 12 12s5 2 5 5.5c0 2-1.5 3-3 3-1 0-1.5-.5-2-.5s-1 .5-2 .5c-1.5 0-3-1-3-3z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  ),
  spa: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path
        d="M12 12c0-4 3-7 8-7-1 5-4 8-8 8s-7-3-8-8c5 0 8 3 8 7zM4 20c2-2 4-3 8-3s6 1 8 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  workspace: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <rect
        x="3"
        y="5"
        width="18"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 20h8M12 16v4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  local: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path
        d="M12 22s-7-7-7-12a7 7 0 1114 0c0 5-7 12-7 12z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  fire: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path
        d="M12 22a6 6 0 006-6c0-3-2-4-3-7-1 2-2 3-4 3 0-3 1-5 3-10-7 3-10 8-10 14a6 6 0 006 6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
  bed: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path
        d="M3 18V7m18 11v-6a3 3 0 00-3-3H3m18 9H3m6-6h.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  view: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path
        d="M2 20l5-7 4 5 3-3 8 10M2 20h20M5 7a2 2 0 100-4 2 2 0 000 4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

const iconOptions = [
  { label: "Breakfast", value: "breakfast" },
  { label: "Coffee / Honesty bar", value: "coffee" },
  { label: "Pool / Sauna", value: "pool" },
  { label: "Wi-Fi", value: "wifi" },
  { label: "Parking", value: "parking" },
  { label: "Pet-friendly", value: "pet" },
  { label: "Spa", value: "spa" },
  { label: "Workspace", value: "workspace" },
  { label: "Local experiences", value: "local" },
  { label: "Fire / Wood stove", value: "fire" },
  { label: "Comfortable beds", value: "bed" },
  { label: "Scenic view", value: "view" },
];

export const AmenitiesGrid = ({
  eyebrow = "What's included",
  heading = "Comforts you'll actually use",
  subheading = "Everything is included in your stay — no resort fees, no surprises.",
  alignment = "left",
  items = [],
  columns = "4",
  layout = "card",
  iconColor = "#6b5b3e",
  accentColor = "#6b5b3e",
  backgroundColor = "#ffffff",
  textColor = "#0f172a",
  maxWidth = "xl",
  paddingY = "lg",
  paddingX = "md",
}: AmenitiesGridProps) => {
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
          "--icon": iconColor || "currentColor",
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

        <ul className={cn("grid gap-4 md:gap-6", colsMap[columns])}>
          {items.map((item, i) => (
            <li
              key={i}
              className={cn(
                "flex flex-col gap-3",
                layout === "card" &&
                  "rounded-2xl bg-white/80 p-5 md:p-6 ring-1 ring-stone-200/60 shadow-sm",
                layout === "tinted" &&
                  "rounded-2xl bg-stone-50 p-5 md:p-6 ring-1 ring-stone-200/60",
                layout === "minimal" && "py-2",
              )}
            >
              <div className="w-9 h-9 flex items-center justify-center text-(--icon)">
                {amenityIcons[item.icon] || amenityIcons.bed}
              </div>
              {item.title && (
                <h3 className="text-base md:text-lg font-semibold tracking-tight">
                  {parseMarkup(item.title)}
                </h3>
              )}
              {item.description && (
                <p className="text-sm leading-relaxed opacity-75">
                  {parseMarkup(item.description)}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export const amenitiesGridConfig: ComponentConfig<AmenitiesGridProps> = {
  label: "Amenities Grid",
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
      label: "Amenities",
      arrayFields: {
        icon: {
          type: "select",
          label: "Icon",
          options: iconOptions,
        },
        title: { type: "text", label: "Title", contentEditable: true },
        description: {
          type: "textarea",
          label: "Description",
          contentEditable: true,
        },
      },
      defaultItemProps: {
        icon: "bed",
        title: "Amenity",
        description: "Short description.",
      },
      getItemSummary: (it) => it.title || "Amenity",
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
    layout: {
      type: "radio",
      label: "Layout",
      options: [
        { label: "Card", value: "card" },
        { label: "Tinted", value: "tinted" },
        { label: "Minimal", value: "minimal" },
      ],
    },
    iconColor: { ...textColorField, label: "Icon Color" },
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
    eyebrow: "What's included",
    heading: "Comforts you'll actually use",
    subheading:
      "Everything is included in your stay — no resort fees, no surprises.",
    alignment: "left",
    items: [
      {
        icon: "breakfast",
        title: "Sourdough breakfast",
        description:
          "Slow breakfast each morning with sourdough, garden fruit, and local cheeses.",
      },
      {
        icon: "pool",
        title: "Wood-fired sauna",
        description:
          "Heated each evening, with a cold plunge under the pines.",
      },
      {
        icon: "coffee",
        title: "Honesty bar",
        description:
          "Local wines, amari, and craft beers from the village down the hill.",
      },
      {
        icon: "wifi",
        title: "Fast Wi-Fi everywhere",
        description: "Full-property mesh — works just as well on the terrace.",
      },
      {
        icon: "parking",
        title: "Free on-site parking",
        description: "Shaded spaces beside your room — no need to move the car.",
      },
      {
        icon: "pet",
        title: "Pet-friendly cabins",
        description: "Two cabins welcome dogs at no extra charge.",
      },
      {
        icon: "local",
        title: "Local experiences desk",
        description:
          "We'll book the boat trip, the truffle hunt, or just point you toward the right bakery.",
      },
      {
        icon: "fire",
        title: "Evening fire pit",
        description: "Logs and blankets out by the olive grove from 8pm.",
      },
    ],
    columns: "4",
    layout: "card",
    iconColor: "#6b5b3e",
    accentColor: "#6b5b3e",
    backgroundColor: "#ffffff",
    textColor: "#0f172a",
    maxWidth: "xl",
    paddingY: "lg",
    paddingX: "md",
  },
  render: AmenitiesGrid,
};
