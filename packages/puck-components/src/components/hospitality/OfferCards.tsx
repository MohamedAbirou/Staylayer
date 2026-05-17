import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import {
  backgroundColorField,
  textColorField,
  maxWidthMap,
  resolvePaddingClasses,
} from "../../lib/fields";
import { parseMarkup } from "../../lib/parse-markup";

export interface OfferInclusion {
  text: string;
}

export interface OfferItem {
  badge: string;
  title: string;
  description: string;
  inclusions: OfferInclusion[];
  validity: string;
  priceNote: string;
  ctaLabel: string;
  ctaUrl: string;
  ctaOpenInNewTab: boolean;
}

export interface OfferCardsProps {
  eyebrow: string;
  heading: string;
  subheading: string;
  alignment: "left" | "center";
  items: OfferItem[];
  columns: "1" | "2" | "3";
  variant: "outlined" | "filled" | "highlight";
  accentColor: string;
  cardBackgroundColor: string;
  cardTextColor: string;
  backgroundColor: string;
  textColor: string;
  maxWidth: keyof typeof maxWidthMap | string;
  paddingY: string;
  paddingX: string;
}

const colsMap: Record<string, string> = {
  "1": "grid-cols-1 max-w-2xl mx-auto",
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
};

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 shrink-0 mt-0.5">
    <path
      d="M5 12.5l4.5 4.5L19 7.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const OfferCards = ({
  eyebrow = "Direct-stay offers",
  heading = "Stay longer, stay slower",
  subheading = "Seasonal stays and direct-booking perks you won't find on the big travel sites.",
  alignment = "left",
  items = [],
  columns = "3",
  variant = "outlined",
  accentColor = "#6b5b3e",
  cardBackgroundColor = "#ffffff",
  cardTextColor = "#0f172a",
  backgroundColor = "#ffffff",
  textColor = "#0f172a",
  maxWidth = "xl",
  paddingY = "lg",
  paddingX = "md",
  puck,
}: OfferCardsProps & { puck?: { isEditing?: boolean } }) => {
  const isEditor = puck?.isEditing;
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
          "--card-bg": cardBackgroundColor || "#ffffff",
          "--card-fg": cardTextColor || "#0f172a",
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

        <div className={cn("grid gap-6 md:gap-8", colsMap[columns])}>
          {items.map((item, i) => {
            const isHighlight = variant === "highlight" && i === 0;
            const Tag: any = isEditor ? "button" : "a";
            const linkProps = isEditor
              ? {
                  type: "button",
                  onClick: (e: React.MouseEvent) => e.preventDefault(),
                }
              : {
                  href: item.ctaUrl,
                  ...(item.ctaOpenInNewTab
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {}),
                };

            return (
              <article
                key={i}
                className={cn(
                  "flex flex-col gap-4 rounded-2xl p-6 md:p-7 bg-(--card-bg) text-(--card-fg)",
                  variant === "outlined" && "ring-1 ring-stone-200",
                  variant === "filled" && "shadow-md ring-1 ring-stone-200/60",
                  isHighlight &&
                    "ring-2 ring-(--accent) shadow-lg relative",
                )}
              >
                {isHighlight && (
                  <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-(--accent) text-white px-3 py-1 text-[11px] font-medium tracking-wide">
                    Most popular
                  </span>
                )}
                {item.badge && (
                  <span className="self-start inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-[11px] font-medium tracking-wide text-stone-700">
                    {parseMarkup(item.badge)}
                  </span>
                )}
                <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
                  {parseMarkup(item.title)}
                </h3>
                {item.description && (
                  <p className="text-[15px] leading-relaxed opacity-80">
                    {parseMarkup(item.description)}
                  </p>
                )}
                {item.inclusions && item.inclusions.length > 0 && (
                  <ul className="flex flex-col gap-2 text-sm">
                    {item.inclusions.map((inc, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-2 text-(--card-fg)"
                      >
                        <span className="text-(--accent)">
                          <Check />
                        </span>
                        <span className="opacity-90">
                          {parseMarkup(inc.text)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto flex flex-col gap-3 pt-2">
                  {item.priceNote && (
                    <div className="text-sm opacity-80">
                      {parseMarkup(item.priceNote)}
                    </div>
                  )}
                  {item.validity && (
                    <div className="text-[12px] opacity-60">
                      {parseMarkup(item.validity)}
                    </div>
                  )}
                  {item.ctaLabel && (
                    <Tag
                      {...linkProps}
                      className={cn(
                        "inline-flex justify-center items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition",
                        isHighlight
                          ? "bg-(--accent) text-white hover:opacity-90"
                          : "ring-1 ring-stone-300 hover:bg-stone-50",
                      )}
                    >
                      {item.ctaLabel}
                    </Tag>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export const offerCardsConfig: ComponentConfig<OfferCardsProps> = {
  label: "Offer Cards",
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
      label: "Offers",
      arrayFields: {
        badge: {
          type: "text",
          label: "Badge (e.g. Autumn, 3+ nights)",
          contentEditable: true,
        },
        title: { type: "text", label: "Title", contentEditable: true },
        description: {
          type: "textarea",
          label: "Description",
          contentEditable: true,
        },
        inclusions: {
          type: "array",
          label: "Inclusions",
          arrayFields: {
            text: { type: "text", label: "Inclusion", contentEditable: true },
          },
          defaultItemProps: { text: "Inclusion" },
          getItemSummary: (it) => it.text || "Inclusion",
        },
        priceNote: {
          type: "text",
          label: "Price note (e.g. From €540 for 3 nights)",
          contentEditable: true,
        },
        validity: {
          type: "text",
          label: "Validity note (e.g. Sep–Nov, subject to availability)",
          contentEditable: true,
        },
        ctaLabel: { type: "text", label: "CTA Label" },
        ctaUrl: { type: "text", label: "CTA URL" },
        ctaOpenInNewTab: {
          type: "radio",
          label: "Open in new tab",
          options: [
            { label: "No", value: false },
            { label: "Yes", value: true },
          ],
        },
      },
      defaultItemProps: {
        badge: "",
        title: "Offer title",
        description: "Short description of this offer.",
        inclusions: [{ text: "Inclusion one" }, { text: "Inclusion two" }],
        priceNote: "From €0",
        validity: "",
        ctaLabel: "Send inquiry",
        ctaUrl: "/contact",
        ctaOpenInNewTab: false,
      },
      getItemSummary: (it) => it.title || "Offer",
    },
    columns: {
      type: "radio",
      label: "Columns",
      options: [
        { label: "1", value: "1" },
        { label: "2", value: "2" },
        { label: "3", value: "3" },
      ],
    },
    variant: {
      type: "radio",
      label: "Card style",
      options: [
        { label: "Outlined", value: "outlined" },
        { label: "Filled (shadow)", value: "filled" },
        { label: "Highlight first card", value: "highlight" },
      ],
    },
    accentColor: { ...textColorField, label: "Accent Color" },
    cardBackgroundColor: {
      ...backgroundColorField,
      label: "Card Background",
    },
    cardTextColor: { ...textColorField, label: "Card Text" },
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
    eyebrow: "Direct-stay offers",
    heading: "Stay longer, stay slower",
    subheading:
      "Seasonal stays and direct-booking perks you won't find on the big travel sites.",
    alignment: "left",
    items: [
      {
        badge: "Autumn",
        title: "Three nights in the olive grove",
        description:
          "Slow autumn stay with breakfast, sauna, and one guided walk in the hills.",
        inclusions: [
          { text: "3 nights in any garden room or suite" },
          { text: "Slow breakfast each morning" },
          { text: "Wood-fired sauna evenings" },
          { text: "One guided ridge walk with our host" },
        ],
        priceNote: "From €540 for 3 nights",
        validity: "Available Sep–Nov, subject to availability",
        ctaLabel: "Send inquiry",
        ctaUrl: "/contact?offer=autumn",
        ctaOpenInNewTab: false,
      },
      {
        badge: "Direct only",
        title: "Best rate promise",
        description:
          "Book direct and we'll match any rate you find online — plus a welcome bottle and late checkout.",
        inclusions: [
          { text: "Lowest available rate, guaranteed" },
          { text: "Welcome bottle of local wine" },
          { text: "Late checkout (12pm) when available" },
          { text: "Flexible date changes up to 7 days before" },
        ],
        priceNote: "From €180 / night",
        validity: "All year",
        ctaLabel: "Check availability",
        ctaUrl: "/contact?offer=direct",
        ctaOpenInNewTab: false,
      },
      {
        badge: "Winter",
        title: "Long-stay writer's retreat",
        description:
          "Seven or more nights with a private workspace, slow mornings, and a quiet house.",
        inclusions: [
          { text: "7+ nights at a reduced nightly rate" },
          { text: "Private workspace in your room" },
          { text: "Daily breakfast & one weekly dinner" },
          { text: "Laundry service included" },
        ],
        priceNote: "From €130 / night on 7+ nights",
        validity: "Available Jan–Mar",
        ctaLabel: "Plan a long stay",
        ctaUrl: "/contact?offer=retreat",
        ctaOpenInNewTab: false,
      },
    ],
    columns: "3",
    variant: "highlight",
    accentColor: "#6b5b3e",
    cardBackgroundColor: "#ffffff",
    cardTextColor: "#0f172a",
    backgroundColor: "#fafaf9",
    textColor: "#0f172a",
    maxWidth: "xl",
    paddingY: "lg",
    paddingX: "md",
  },
  render: OfferCards,
};
