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
import {
  AccommodationCard,
  type AccommodationCardProps,
} from "./AccommodationCard";

type AccommodationItem = Omit<
  AccommodationCardProps,
  | "variant"
  | "backgroundColor"
  | "textColor"
  | "accentColor"
  | "rounded"
  | "shadow"
>;

export interface AccommodationGridProps {
  eyebrow: string;
  heading: string;
  subheading: string;
  alignment: "left" | "center";
  columns: "1" | "2" | "3";
  cardVariant: AccommodationCardProps["variant"];
  cardRounded: AccommodationCardProps["rounded"];
  cardShadow: AccommodationCardProps["shadow"];
  cardBackgroundColor: string;
  cardTextColor: string;
  cardAccentColor: string;
  items: AccommodationItem[];
  showFooterCta: boolean;
  footerCtaLabel: string;
  footerCtaUrl: string;
  footerCtaOpenInNewTab: boolean;
  backgroundColor: string;
  textColor: string;
  maxWidth: keyof typeof maxWidthMap | string;
  paddingY: string;
  paddingX: string;
}

const colsMap: Record<string, string> = {
  "1": "grid-cols-1",
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
};

export const AccommodationGrid = ({
  eyebrow = "Where you'll stay",
  heading = "Rooms, suites & cabins",
  subheading = "Twelve individually designed spaces, from intimate garden rooms to family cabins under the pines.",
  alignment = "left",
  columns = "3",
  cardVariant = "editorial",
  cardRounded = "2xl",
  cardShadow = "md",
  cardBackgroundColor = "#ffffff",
  cardTextColor = "#0f172a",
  cardAccentColor = "#0f172a",
  items = [],
  showFooterCta = true,
  footerCtaLabel = "Send an inquiry about availability",
  footerCtaUrl = "/contact",
  footerCtaOpenInNewTab = false,
  backgroundColor = "#fafaf9",
  textColor = "#0f172a",
  maxWidth = "xl",
  paddingY = "lg",
  paddingX = "md",
  puck,
}: AccommodationGridProps & { puck?: { isEditing?: boolean } }) => {
  const isEditor = puck?.isEditing;
  const FooterTag: any = isEditor ? "button" : "a";
  const footerProps = isEditor
    ? { type: "button", onClick: (e: React.MouseEvent) => e.preventDefault() }
    : {
        href: footerCtaUrl,
        ...(footerCtaOpenInNewTab
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
          {items.map((item, i) => (
            <AccommodationCard
              key={i}
              {...item}
              variant={cardVariant}
              rounded={cardRounded}
              shadow={cardShadow}
              backgroundColor={cardBackgroundColor}
              textColor={cardTextColor}
              accentColor={cardAccentColor}
              puck={puck}
            />
          ))}
        </div>

        {showFooterCta && footerCtaLabel && (
          <div
            className={cn(
              "mt-10 md:mt-14 flex",
              isCentered ? "justify-center" : "justify-start",
            )}
          >
            <FooterTag
              {...footerProps}
              className="inline-flex items-center gap-2 rounded-full bg-stone-900 text-white px-6 py-3 text-sm font-medium hover:bg-stone-800 transition"
            >
              {footerCtaLabel}
              <span aria-hidden>→</span>
            </FooterTag>
          </div>
        )}
      </div>
    </section>
  );
};

const defaultItem: AccommodationItem = {
  imageUrl: "https://placehold.co/1200x800/efeae2/8b6f4e?text=Room",
  imageAlt: "Room photo",
  eyebrow: "",
  title: "Room",
  description: "Short description of this room or unit.",
  capacity: "Sleeps 2",
  bedType: "1 King bed",
  size: "28 m²",
  priceFromLabel: "From",
  price: "€160",
  priceSuffix: "/ night",
  amenities: [{ text: "Breakfast included" }, { text: "Free Wi-Fi" }],
  ctaLabel: "View room",
  ctaUrl: "/rooms",
  ctaOpenInNewTab: false,
};

export const accommodationGridConfig: ComponentConfig<AccommodationGridProps> =
  {
    label: "Accommodation Grid",
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
      columns: {
        type: "radio",
        label: "Columns",
        options: [
          { label: "1", value: "1" },
          { label: "2", value: "2" },
          { label: "3", value: "3" },
        ],
      },
      items: {
        type: "array",
        label: "Accommodations",
        arrayFields: {
          imageUrl: { ...imageField, label: "Photo" },
          imageAlt: { type: "text", label: "Photo description (alt text)" },
          eyebrow: {
            type: "text",
            label: "Eyebrow / Badge",
            contentEditable: true,
          },
          title: { type: "text", label: "Title", contentEditable: true },
          description: {
            type: "textarea",
            label: "Description",
            contentEditable: true,
          },
          capacity: { type: "text", label: "Capacity" },
          bedType: { type: "text", label: "Bed / Unit Type" },
          size: { type: "text", label: "Size (optional)" },
          priceFromLabel: { type: "text", label: "Price prefix" },
          price: { type: "text", label: "Price" },
          priceSuffix: { type: "text", label: "Price suffix" },
          amenities: {
            type: "array",
            label: "Amenity highlights",
            arrayFields: {
              text: { type: "text", label: "Amenity", contentEditable: true },
            },
            defaultItemProps: { text: "Amenity" },
            getItemSummary: (it) => it.text || "Amenity",
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
        defaultItemProps: defaultItem,
        getItemSummary: (it) => it.title || "Accommodation",
      },
      cardVariant: {
        type: "radio",
        label: "Card variant",
        options: [
          { label: "Editorial", value: "editorial" },
          { label: "Image-first", value: "image-first" },
          { label: "Compact", value: "compact" },
        ],
      },
      cardRounded: {
        type: "select",
        label: "Card corner radius",
        options: [
          { label: "None", value: "none" },
          { label: "Medium", value: "md" },
          { label: "Large", value: "lg" },
          { label: "XL", value: "xl" },
          { label: "2XL", value: "2xl" },
        ],
      },
      cardShadow: {
        type: "select",
        label: "Card shadow",
        options: [
          { label: "None", value: "none" },
          { label: "Soft", value: "sm" },
          { label: "Medium", value: "md" },
          { label: "Strong", value: "lg" },
          { label: "Dramatic", value: "xl" },
        ],
      },
      cardBackgroundColor: {
        ...backgroundColorField,
        label: "Card Background",
      },
      cardTextColor: { ...textColorField, label: "Card Text" },
      cardAccentColor: { ...textColorField, label: "Card Accent" },
      showFooterCta: {
        type: "radio",
        label: "Show footer CTA",
        options: [
          { label: "Show", value: true },
          { label: "Hide", value: false },
        ],
      },
      footerCtaLabel: { type: "text", label: "Footer CTA Label" },
      footerCtaUrl: { type: "text", label: "Footer CTA URL" },
      footerCtaOpenInNewTab: {
        type: "radio",
        label: "Open footer CTA in new tab",
        options: [
          { label: "No", value: false },
          { label: "Yes", value: true },
        ],
      },
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
      eyebrow: "Where you'll stay",
      heading: "Rooms, suites & cabins",
      subheading:
        "Twelve individually designed spaces, from intimate garden rooms to family cabins under the pines.",
      alignment: "left",
      columns: "3",
      cardVariant: "editorial",
      cardRounded: "2xl",
      cardShadow: "md",
      cardBackgroundColor: "#ffffff",
      cardTextColor: "#0f172a",
      cardAccentColor: "#0f172a",
      items: [
        {
          imageUrl:
            "https://placehold.co/1200x800/efeae2/8b6f4e?text=Garden+Suite",
          imageAlt: "Garden Suite",
          eyebrow: "",
          title: "Garden Suite",
          description:
            "A private suite opening onto the walled garden, with a king bed and deep soaking tub.",
          capacity: "Sleeps 2",
          bedType: "1 King bed",
          size: "32 m²",
          priceFromLabel: "From",
          price: "€180",
          priceSuffix: "/ night",
          amenities: [
            { text: "Garden view" },
            { text: "Breakfast included" },
            { text: "Free Wi-Fi" },
          ],
          ctaLabel: "View room",
          ctaUrl: "/rooms/garden-suite",
          ctaOpenInNewTab: false,
        },
        {
          imageUrl:
            "https://placehold.co/1200x800/dde7d6/4b6043?text=Pine+Cabin",
          imageAlt: "Pine Cabin",
          eyebrow: "Family favourite",
          title: "Pine Cabin",
          description:
            "A two-bedroom cabin tucked under the pines, with a wood-burning stove and private deck.",
          capacity: "Sleeps 4",
          bedType: "1 King + 2 Singles",
          size: "58 m²",
          priceFromLabel: "From",
          price: "€260",
          priceSuffix: "/ night",
          amenities: [
            { text: "Wood stove" },
            { text: "Private deck" },
            { text: "Kitchenette" },
          ],
          ctaLabel: "View cabin",
          ctaUrl: "/cabins/pine",
          ctaOpenInNewTab: false,
        },
        {
          imageUrl:
            "https://placehold.co/1200x800/e7dccb/6a4b1f?text=Olive+Loft",
          imageAlt: "Olive Loft",
          eyebrow: "",
          title: "Olive Loft",
          description:
            "An open-plan loft above the courtyard with vaulted ceilings and treetop views.",
          capacity: "Sleeps 2",
          bedType: "1 Queen bed",
          size: "38 m²",
          priceFromLabel: "From",
          price: "€210",
          priceSuffix: "/ night",
          amenities: [
            { text: "Courtyard view" },
            { text: "Espresso machine" },
            { text: "Rain shower" },
          ],
          ctaLabel: "View loft",
          ctaUrl: "/rooms/olive-loft",
          ctaOpenInNewTab: false,
        },
      ],
      showFooterCta: true,
      footerCtaLabel: "Send an inquiry about availability",
      footerCtaUrl: "/contact",
      footerCtaOpenInNewTab: false,
      backgroundColor: "#fafaf9",
      textColor: "#0f172a",
      maxWidth: "xl",
      paddingY: "lg",
      paddingX: "md",
    },
    render: AccommodationGrid,
  };
