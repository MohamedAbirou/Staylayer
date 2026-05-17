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

export interface GalleryImage {
  imageUrl: string;
  imageAlt: string;
  caption: string;
}

export interface GallerySectionProps {
  eyebrow: string;
  heading: string;
  subheading: string;
  alignment: "left" | "center";
  images: GalleryImage[];
  variant: "masonry" | "feature" | "grid";
  columns: "2" | "3" | "4";
  showCaptions: boolean;
  gap: "sm" | "md" | "lg";
  rounded: "none" | "md" | "lg" | "xl" | "2xl";
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
  "2": "grid-cols-1 sm:grid-cols-2",
  "3": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  "4": "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
};

const gapMap: Record<string, string> = {
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
};

const roundedMap: Record<string, string> = {
  none: "rounded-none",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
};

const Figure = ({
  img,
  className,
  rounded,
  showCaptions,
}: {
  img: GalleryImage;
  className?: string;
  rounded: string;
  showCaptions: boolean;
}) => (
  <figure
    className={cn(
      "relative overflow-hidden bg-stone-100 group",
      roundedMap[rounded],
      className,
    )}
  >
    {img.imageUrl && (
      <img
        src={img.imageUrl}
        alt={img.imageAlt || ""}
        loading="lazy"
        className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
      />
    )}
    {showCaptions && img.caption && (
      <figcaption className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent text-white text-xs md:text-sm p-3 md:p-4">
        {parseMarkup(img.caption)}
      </figcaption>
    )}
  </figure>
);

export const GallerySection = ({
  eyebrow = "A look around",
  heading = "Stillness, gardens, and slow mornings",
  subheading = "A glimpse of the rooms, grounds, and the small everyday moments at Pine Hollow Lodge.",
  alignment = "left",
  images = [],
  variant = "feature",
  columns = "3",
  showCaptions = false,
  gap = "md",
  rounded = "2xl",
  backgroundColor = "#ffffff",
  textColor = "#0f172a",
  maxWidth = "xl",
  paddingY = "lg",
  paddingX = "md",
  ctaLabel = "See the full gallery",
  ctaUrl = "/gallery",
  ctaOpenInNewTab = false,
  puck,
}: GallerySectionProps & { puck?: { isEditing?: boolean } }) => {
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

  let body: React.ReactNode;
  if (variant === "feature" && images.length >= 3) {
    const [hero, ...rest] = images;
    body = (
      <div className={cn("grid lg:grid-cols-2", gapMap[gap])}>
        <Figure
          img={hero}
          rounded={rounded}
          showCaptions={showCaptions}
          className="aspect-[4/5] lg:aspect-auto lg:row-span-2"
        />
        <div className={cn("grid grid-cols-2", gapMap[gap])}>
          {rest.slice(0, 4).map((img, i) => (
            <Figure
              key={i}
              img={img}
              rounded={rounded}
              showCaptions={showCaptions}
              className="aspect-square"
            />
          ))}
        </div>
      </div>
    );
  } else if (variant === "masonry") {
    body = (
      <div className={cn("columns-2 md:columns-3 lg:columns-4", gapMap[gap])}>
        {images.map((img, i) => (
          <div key={i} className={cn("mb-4 break-inside-avoid")}>
            <Figure img={img} rounded={rounded} showCaptions={showCaptions} />
          </div>
        ))}
      </div>
    );
  } else {
    body = (
      <div className={cn("grid", colsMap[columns], gapMap[gap])}>
        {images.map((img, i) => (
          <Figure
            key={i}
            img={img}
            rounded={rounded}
            showCaptions={showCaptions}
            className="aspect-[4/3]"
          />
        ))}
      </div>
    );
  }

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

        {body}

        {ctaLabel && (
          <div
            className={cn(
              "mt-8 md:mt-10 flex",
              isCentered ? "justify-center" : "justify-start",
            )}
          >
            <Tag
              {...linkProps}
              className="inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
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

export const gallerySectionConfig: ComponentConfig<GallerySectionProps> = {
  label: "Gallery Section",
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
    images: {
      type: "array",
      label: "Images",
      arrayFields: {
        imageUrl: { ...imageField, label: "Photo" },
        imageAlt: { type: "text", label: "Photo description (alt text)" },
        caption: {
          type: "text",
          label: "Caption (optional)",
          contentEditable: true,
        },
      },
      defaultItemProps: {
        imageUrl: "https://placehold.co/1200x800/efeae2/8b6f4e?text=Photo",
        imageAlt: "Property photo",
        caption: "",
      },
      getItemSummary: (it) => it.imageAlt || it.caption || "Image",
    },
    variant: {
      type: "radio",
      label: "Layout",
      options: [
        { label: "Feature (1 hero + 4)", value: "feature" },
        { label: "Masonry", value: "masonry" },
        { label: "Even grid", value: "grid" },
      ],
    },
    columns: {
      type: "radio",
      label: "Grid columns",
      options: [
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
      ],
    },
    showCaptions: {
      type: "radio",
      label: "Show captions",
      options: [
        { label: "Show", value: true },
        { label: "Hide", value: false },
      ],
    },
    gap: {
      type: "radio",
      label: "Gap",
      options: [
        { label: "Tight", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Roomy", value: "lg" },
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
    eyebrow: "A look around",
    heading: "Stillness, gardens, and slow mornings",
    subheading:
      "A glimpse of the rooms, grounds, and the small everyday moments at Pine Hollow Lodge.",
    alignment: "left",
    images: [
      {
        imageUrl:
          "https://placehold.co/1600x1200/efeae2/8b6f4e?text=Garden+Suite",
        imageAlt: "Garden Suite interior",
        caption: "The Garden Suite at first light",
      },
      {
        imageUrl: "https://placehold.co/900x900/dde7d6/4b6043?text=Pine+Cabin",
        imageAlt: "Pine Cabin exterior",
        caption: "",
      },
      {
        imageUrl: "https://placehold.co/900x900/e7dccb/6a4b1f?text=Breakfast",
        imageAlt: "Breakfast on the terrace",
        caption: "",
      },
      {
        imageUrl: "https://placehold.co/900x900/d8d2c4/4a4032?text=Sauna",
        imageAlt: "Wood-fired sauna",
        caption: "",
      },
      {
        imageUrl: "https://placehold.co/900x900/c9d6c4/3f5340?text=Garden",
        imageAlt: "The walled garden",
        caption: "",
      },
    ],
    variant: "feature",
    columns: "3",
    showCaptions: false,
    gap: "md",
    rounded: "2xl",
    backgroundColor: "#ffffff",
    textColor: "#0f172a",
    maxWidth: "xl",
    paddingY: "lg",
    paddingX: "md",
    ctaLabel: "See the full gallery",
    ctaUrl: "/gallery",
    ctaOpenInNewTab: false,
  },
  render: GallerySection,
};
