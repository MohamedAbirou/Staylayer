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

export interface HostStoryProps {
  eyebrow: string;
  heading: string;
  body: string;
  signatureName: string;
  signatureRole: string;
  imageUrl: string;
  imageAlt: string;
  variant: "image-left" | "image-right" | "portrait";
  ctaLabel: string;
  ctaUrl: string;
  ctaOpenInNewTab: boolean;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  maxWidth: keyof typeof maxWidthMap | string;
  paddingY: string;
  paddingX: string;
}

export const HostStory = ({
  eyebrow = "Our story",
  heading = "We took over an old farmhouse and slowly turned it into a place we'd want to stay in ourselves.",
  body = "Pine Hollow Lodge is a twelve-room boutique stay in the hills above the coast. We bought the property in 2019, restored it room by room, and opened to guests in 2022. The garden is older than the house. Mornings are slow, breakfast is long, and we keep things small on purpose — so we can actually know who's staying with us.",
  signatureName = "Elena & Marco",
  signatureRole = "Hosts",
  imageUrl = "https://placehold.co/900x1100/efeae2/8b6f4e?text=Hosts",
  imageAlt = "Elena and Marco, hosts at Pine Hollow Lodge",
  variant = "image-left",
  ctaLabel = "Read more about the lodge",
  ctaUrl = "/about",
  ctaOpenInNewTab = false,
  accentColor = "#6b5b3e",
  backgroundColor = "#ffffff",
  textColor = "#0f172a",
  maxWidth = "xl",
  paddingY = "lg",
  paddingX = "md",
  puck,
}: HostStoryProps & { puck?: { isEditing?: boolean } }) => {
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

  const isPortrait = variant === "portrait";
  const isImageRight = variant === "image-right";

  const Image = imageUrl && (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-stone-100",
        isPortrait ? "aspect-[4/5] max-w-xs mx-auto" : "aspect-[4/5] md:aspect-[3/4]",
      )}
    >
      <img
        src={imageUrl}
        alt={imageAlt}
        loading="lazy"
        className="w-full h-full object-cover"
      />
    </div>
  );

  const Copy = (
    <div className="flex flex-col gap-5 max-w-xl">
      {eyebrow && (
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-(--accent)">
          {parseMarkup(eyebrow)}
        </span>
      )}
      {heading && (
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
          {parseMarkup(heading)}
        </h2>
      )}
      {body && (
        <div className="text-base md:text-lg leading-relaxed opacity-85 whitespace-pre-line">
          {parseMarkup(body)}
        </div>
      )}
      {(signatureName || signatureRole) && (
        <div className="pt-1">
          {signatureName && (
            <div className="font-serif text-lg italic">
              — {parseMarkup(signatureName)}
            </div>
          )}
          {signatureRole && (
            <div className="text-sm opacity-60">{parseMarkup(signatureRole)}</div>
          )}
        </div>
      )}
      {ctaLabel && (
        <div>
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
  );

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
        {isPortrait ? (
          <div className="flex flex-col items-center text-center gap-8 max-w-2xl mx-auto">
            {Image}
            <div className="flex flex-col items-center text-center gap-5">
              {eyebrow && (
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-(--accent)">
                  {parseMarkup(eyebrow)}
                </span>
              )}
              {heading && (
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
                  {parseMarkup(heading)}
                </h2>
              )}
              {body && (
                <p className="text-base md:text-lg leading-relaxed opacity-85 whitespace-pre-line">
                  {parseMarkup(body)}
                </p>
              )}
              {(signatureName || signatureRole) && (
                <div>
                  {signatureName && (
                    <div className="font-serif text-lg italic">
                      — {parseMarkup(signatureName)}
                    </div>
                  )}
                  {signatureRole && (
                    <div className="text-sm opacity-60">
                      {parseMarkup(signatureRole)}
                    </div>
                  )}
                </div>
              )}
              {ctaLabel && (
                <Tag
                  {...linkProps}
                  className="inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline text-(--accent)"
                >
                  {ctaLabel}
                  <span aria-hidden>→</span>
                </Tag>
              )}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "grid lg:grid-cols-2 gap-10 md:gap-14 items-center",
              isImageRight && "lg:[&>*:first-child]:order-2",
            )}
          >
            {Image}
            <div className={cn(isImageRight ? "lg:pr-8" : "lg:pl-8")}>
              {Copy}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export const hostStoryConfig: ComponentConfig<HostStoryProps> = {
  label: "Host Story",
  fields: {
    eyebrow: {
      type: "text",
      label: "Eyebrow (optional)",
      contentEditable: true,
    },
    heading: { type: "text", label: "Heading", contentEditable: true },
    body: { type: "textarea", label: "Story body", contentEditable: true },
    signatureName: { type: "text", label: "Signature name (optional)" },
    signatureRole: { type: "text", label: "Signature role (optional)" },
    imageUrl: imageField,
    imageAlt: { type: "text", label: "Image Alt Text" },
    variant: {
      type: "radio",
      label: "Layout",
      options: [
        { label: "Image left", value: "image-left" },
        { label: "Image right", value: "image-right" },
        { label: "Portrait (centered)", value: "portrait" },
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
    eyebrow: "Our story",
    heading:
      "We took over an old farmhouse and slowly turned it into a place we'd want to stay in ourselves.",
    body: "Pine Hollow Lodge is a twelve-room boutique stay in the hills above the coast. We bought the property in 2019, restored it room by room, and opened to guests in 2022. The garden is older than the house. Mornings are slow, breakfast is long, and we keep things small on purpose — so we can actually know who's staying with us.",
    signatureName: "Elena & Marco",
    signatureRole: "Hosts",
    imageUrl: "https://placehold.co/900x1100/efeae2/8b6f4e?text=Hosts",
    imageAlt: "Elena and Marco, hosts at Pine Hollow Lodge",
    variant: "image-left",
    ctaLabel: "Read more about the lodge",
    ctaUrl: "/about",
    ctaOpenInNewTab: false,
    accentColor: "#6b5b3e",
    backgroundColor: "#ffffff",
    textColor: "#0f172a",
    maxWidth: "xl",
    paddingY: "lg",
    paddingX: "md",
  },
  render: HostStory,
};
