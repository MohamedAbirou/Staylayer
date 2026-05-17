import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import {
  backgroundColorField,
  textColorField,
  imageField,
} from "../../lib/fields";
import { parseMarkup } from "../../lib/parse-markup";

export interface AccommodationCardProps {
  imageUrl: string;
  imageAlt: string;
  eyebrow: string;
  title: string;
  description: string;
  capacity: string;
  bedType: string;
  size: string;
  priceFromLabel: string;
  price: string;
  priceSuffix: string;
  amenities: { text: string }[];
  ctaLabel: string;
  ctaUrl: string;
  ctaOpenInNewTab: boolean;
  variant: "editorial" | "compact" | "image-first";
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  rounded: "none" | "md" | "lg" | "xl" | "2xl";
  shadow: "none" | "sm" | "md" | "lg" | "xl";
}

const roundedMap: Record<string, string> = {
  none: "rounded-none",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
};

const shadowMap: Record<string, string> = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
};

const MetaIcon = ({ kind }: { kind: "guests" | "bed" | "size" }) => {
  if (kind === "guests")
    return (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <path
          d="M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  if (kind === "bed")
    return (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <path
          d="M3 18V7m18 11v-6a3 3 0 00-3-3H3m18 9H3m6-6h.01"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
      <path
        d="M4 4h6v6H4zM14 14h6v6h-6zM4 14l6 6M14 4l6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const AccommodationCard = ({
  imageUrl = "https://placehold.co/1200x800/efeae2/8b6f4e?text=Garden+Suite",
  imageAlt = "Garden Suite at Pine Hollow Lodge",
  eyebrow = "",
  title = "Garden Suite",
  description = "A private suite opening onto the walled garden, with a king bed, deep soaking tub, and morning light through the olive trees.",
  capacity = "Sleeps 2",
  bedType = "1 King bed",
  size = "32 m²",
  priceFromLabel = "From",
  price = "€180",
  priceSuffix = "/ night",
  amenities = [
    { text: "Garden view" },
    { text: "Breakfast included" },
    { text: "Free Wi-Fi" },
    { text: "Air conditioning" },
  ],
  ctaLabel = "View room",
  ctaUrl = "/rooms/garden-suite",
  ctaOpenInNewTab = false,
  variant = "editorial",
  backgroundColor = "#ffffff",
  textColor = "#0f172a",
  accentColor = "#0f172a",
  rounded = "2xl",
  shadow = "md",
  puck,
}: AccommodationCardProps & { puck?: { isEditing?: boolean } }) => {
  const isEditor = puck?.isEditing;
  const Tag: any = isEditor ? "div" : "a";
  const linkProps = isEditor
    ? {}
    : {
        href: ctaUrl,
        ...(ctaOpenInNewTab
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {}),
      };

  const isCompact = variant === "compact";
  const isImageFirst = variant === "image-first";

  const meta = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm opacity-80">
      {capacity && (
        <span className="inline-flex items-center gap-1.5">
          <MetaIcon kind="guests" />
          {capacity}
        </span>
      )}
      {bedType && (
        <span className="inline-flex items-center gap-1.5">
          <MetaIcon kind="bed" />
          {bedType}
        </span>
      )}
      {size && (
        <span className="inline-flex items-center gap-1.5">
          <MetaIcon kind="size" />
          {size}
        </span>
      )}
    </div>
  );

  const amenityList = amenities && amenities.length > 0 && (
    <ul
      className={cn(
        "mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-sm opacity-80",
        isCompact && "hidden",
      )}
    >
      {amenities.map((a, i) => (
        <li key={i} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-(--accent)"
            aria-hidden
          />
          {parseMarkup(a.text)}
        </li>
      ))}
    </ul>
  );

  return (
    <article
      className={cn(
        "group overflow-hidden bg-(--bg) text-(--fg) flex flex-col",
        roundedMap[rounded],
        shadowMap[shadow],
        isImageFirst && "md:flex-row",
      )}
      style={
        {
          "--bg": backgroundColor || "#ffffff",
          "--fg": textColor || "#0f172a",
          "--accent": accentColor || "#0f172a",
        } as React.CSSProperties
      }
    >
      {imageUrl && (
        <div
          className={cn(
            "relative overflow-hidden bg-stone-100",
            isImageFirst ? "md:w-1/2 aspect-[4/3] md:aspect-auto" : "aspect-[4/3]",
          )}
        >
          <img
            src={imageUrl}
            alt={imageAlt}
            className="absolute inset-0 w-full h-full object-cover transition duration-700 group-hover:scale-105"
            loading="lazy"
          />
          {eyebrow && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-xs font-medium tracking-wide text-stone-900">
              {parseMarkup(eyebrow)}
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          "flex flex-col gap-3 p-5 md:p-6",
          isImageFirst && "md:w-1/2 md:justify-center",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
            {parseMarkup(title)}
          </h3>
          {price && (
            <div className="text-right shrink-0">
              {priceFromLabel && (
                <div className="text-[11px] uppercase tracking-wider opacity-60">
                  {priceFromLabel}
                </div>
              )}
              <div className="text-lg font-semibold leading-none">
                {parseMarkup(price)}
                {priceSuffix && (
                  <span className="text-sm font-normal opacity-70 ml-1">
                    {priceSuffix}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        {meta}
        {description && !isCompact && (
          <p className="text-[15px] leading-relaxed opacity-80">
            {parseMarkup(description)}
          </p>
        )}
        {amenityList}
        {ctaLabel && (
          <div className="mt-3">
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
    </article>
  );
};

export const accommodationCardConfig: ComponentConfig<AccommodationCardProps> =
  {
    label: "Accommodation Card",
    fields: {
      imageUrl: imageField,
      imageAlt: { type: "text", label: "Image Alt Text" },
      eyebrow: {
        type: "text",
        label: "Eyebrow / Badge (optional)",
        contentEditable: true,
      },
      title: { type: "text", label: "Title", contentEditable: true },
      description: {
        type: "textarea",
        label: "Short Description",
        contentEditable: true,
      },
      capacity: { type: "text", label: "Capacity (e.g. Sleeps 2)" },
      bedType: { type: "text", label: "Bed / Unit Type" },
      size: { type: "text", label: "Size (e.g. 32 m²) — optional" },
      priceFromLabel: { type: "text", label: "Price prefix (e.g. From)" },
      price: { type: "text", label: "Price (e.g. €180)" },
      priceSuffix: { type: "text", label: "Price suffix (e.g. / night)" },
      amenities: {
        type: "array",
        label: "Amenity highlights",
        arrayFields: {
          text: { type: "text", label: "Amenity", contentEditable: true },
        },
        defaultItemProps: { text: "Amenity" },
        getItemSummary: (item) => item.text || "Amenity",
      },
      ctaLabel: { type: "text", label: "CTA Label" },
      ctaUrl: { type: "text", label: "CTA URL" },
      ctaOpenInNewTab: {
        type: "radio",
        label: "Open CTA in new tab",
        options: [
          { label: "No", value: false },
          { label: "Yes", value: true },
        ],
      },
      variant: {
        type: "radio",
        label: "Variant",
        options: [
          { label: "Editorial (image on top)", value: "editorial" },
          { label: "Image-first (image on side)", value: "image-first" },
          { label: "Compact", value: "compact" },
        ],
      },
      rounded: {
        type: "select",
        label: "Corner radius",
        options: [
          { label: "None", value: "none" },
          { label: "Medium", value: "md" },
          { label: "Large", value: "lg" },
          { label: "XL", value: "xl" },
          { label: "2XL", value: "2xl" },
        ],
      },
      shadow: {
        type: "select",
        label: "Shadow",
        options: [
          { label: "None", value: "none" },
          { label: "Soft", value: "sm" },
          { label: "Medium", value: "md" },
          { label: "Strong", value: "lg" },
          { label: "Dramatic", value: "xl" },
        ],
      },
      backgroundColor: backgroundColorField,
      textColor: textColorField,
      accentColor: { ...textColorField, label: "Accent Color" },
    },
    defaultProps: {
      imageUrl:
        "https://placehold.co/1200x800/efeae2/8b6f4e?text=Garden+Suite",
      imageAlt: "Garden Suite at Pine Hollow Lodge",
      eyebrow: "",
      title: "Garden Suite",
      description:
        "A private suite opening onto the walled garden, with a king bed, deep soaking tub, and morning light through the olive trees.",
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
        { text: "Air conditioning" },
      ],
      ctaLabel: "View room",
      ctaUrl: "/rooms/garden-suite",
      ctaOpenInNewTab: false,
      variant: "editorial",
      rounded: "2xl",
      shadow: "md",
      backgroundColor: "#ffffff",
      textColor: "#0f172a",
      accentColor: "#0f172a",
    },
    render: AccommodationCard,
  };
