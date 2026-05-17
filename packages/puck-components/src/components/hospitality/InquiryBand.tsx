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

export interface InquiryBandProps {
  eyebrow: string;
  heading: string;
  subheading: string;
  primaryCtaLabel: string;
  primaryCtaUrl: string;
  primaryCtaOpenInNewTab: boolean;
  showSecondary: boolean;
  phoneLabel: string;
  phoneNumber: string;
  emailLabel: string;
  emailAddress: string;
  whatsappLabel: string;
  whatsappNumber: string;
  trustNote: string;
  variant: "calm" | "photo" | "split" | "compact";
  imageUrl: string;
  imageAlt: string;
  accentColor: string;
  ctaTextColor: string;
  backgroundColor: string;
  textColor: string;
  maxWidth: keyof typeof maxWidthMap | string;
  paddingY: string;
  paddingX: string;
}

const IconPhone = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
    <path
      d="M5 4h3l2 5-2 1a12 12 0 006 6l1-2 5 2v3a2 2 0 01-2 2A17 17 0 013 6a2 2 0 012-2z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);
const IconMail = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
    <rect
      x="3"
      y="5"
      width="18"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M3 7l9 6 9-6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);
const IconChat = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
    <path
      d="M21 12a8 8 0 11-3-6.2L21 5l-1 3.5A8 8 0 0121 12z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

export const InquiryBand = ({
  eyebrow = "Plan your stay",
  heading = "Tell us what you're hoping for. We'll write back.",
  subheading = "Share your dates and a little about your trip. We respond within one business day, often the same morning.",
  primaryCtaLabel = "Send an inquiry",
  primaryCtaUrl = "/contact",
  primaryCtaOpenInNewTab = false,
  showSecondary = true,
  phoneLabel = "Call us",
  phoneNumber = "+39 000 000 0000",
  emailLabel = "Email",
  emailAddress = "stay@pinehollow.example",
  whatsappLabel = "WhatsApp",
  whatsappNumber = "+39 000 000 0000",
  trustNote = "We reply within one business day · Real humans, no booking-engine bots",
  variant = "calm",
  imageUrl = "https://placehold.co/1600x900/efeae2/8b6f4e?text=Lodge",
  imageAlt = "Pine Hollow Lodge at dusk",
  accentColor = "#0f172a",
  ctaTextColor = "#ffffff",
  backgroundColor = "#f5f3ee",
  textColor = "#0f172a",
  maxWidth = "xl",
  paddingY = "lg",
  paddingX = "md",
  puck,
}: InquiryBandProps & { puck?: { isEditing?: boolean } }) => {
  const isEditor = puck?.isEditing;

  const PrimaryTag: any = isEditor ? "button" : "a";
  const primaryProps = isEditor
    ? { type: "button", onClick: (e: React.MouseEvent) => e.preventDefault() }
    : {
        href: primaryCtaUrl,
        ...(primaryCtaOpenInNewTab
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {}),
      };

  const isPhoto = variant === "photo";
  const isSplit = variant === "split";
  const isCompact = variant === "compact";

  const Heading = heading && (
    <h2
      className={cn(
        "font-semibold tracking-tight",
        isCompact ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl",
      )}
    >
      {parseMarkup(heading)}
    </h2>
  );

  const Sub = subheading && !isCompact && (
    <p className="text-base md:text-lg opacity-85 max-w-2xl">
      {parseMarkup(subheading)}
    </p>
  );

  const Eyebrow = eyebrow && (
    <span className="text-xs font-medium uppercase tracking-[0.18em] opacity-70">
      {parseMarkup(eyebrow)}
    </span>
  );

  const Primary = primaryCtaLabel && (
    <PrimaryTag
      {...primaryProps}
      className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition bg-(--accent) text-(--cta-fg) hover:opacity-90"
    >
      {primaryCtaLabel}
      <span aria-hidden>→</span>
    </PrimaryTag>
  );

  const Secondary = showSecondary && (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      {phoneNumber && (
        <li>
          <a
            href={isEditor ? undefined : `tel:${phoneNumber.replace(/\s+/g, "")}`}
            onClick={isEditor ? (e) => e.preventDefault() : undefined}
            className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
          >
            <IconPhone />
            <span className="opacity-70">{phoneLabel}:</span>
            <span className="font-medium">{phoneNumber}</span>
          </a>
        </li>
      )}
      {emailAddress && (
        <li>
          <a
            href={isEditor ? undefined : `mailto:${emailAddress}`}
            onClick={isEditor ? (e) => e.preventDefault() : undefined}
            className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
          >
            <IconMail />
            <span className="opacity-70">{emailLabel}:</span>
            <span className="font-medium">{emailAddress}</span>
          </a>
        </li>
      )}
      {whatsappNumber && (
        <li>
          <a
            href={
              isEditor
                ? undefined
                : `https://wa.me/${whatsappNumber.replace(/\D/g, "")}`
            }
            target={isEditor ? undefined : "_blank"}
            rel={isEditor ? undefined : "noopener noreferrer"}
            onClick={isEditor ? (e) => e.preventDefault() : undefined}
            className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
          >
            <IconChat />
            <span className="opacity-70">{whatsappLabel}:</span>
            <span className="font-medium">{whatsappNumber}</span>
          </a>
        </li>
      )}
    </ul>
  );

  const Trust = trustNote && (
    <p className="text-xs opacity-60 mt-1">{parseMarkup(trustNote)}</p>
  );

  return (
    <section
      className={cn(
        "w-full text-(--fg)",
        !isPhoto && "bg-(--bg)",
        resolvePaddingClasses(paddingY, paddingX),
      )}
      style={
        {
          "--bg": backgroundColor || "transparent",
          "--fg": textColor || "inherit",
          "--accent": accentColor || "#0f172a",
          "--cta-fg": ctaTextColor || "#ffffff",
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          "mx-auto w-full",
          maxWidthMap[maxWidth as string] || "max-w-[1280px]",
        )}
      >
        {isPhoto ? (
          <div className="relative overflow-hidden rounded-3xl">
            {imageUrl && (
              <img
                src={imageUrl}
                alt={imageAlt}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/45" />
            <div className="relative flex flex-col gap-5 text-white px-8 py-16 md:px-14 md:py-24 max-w-3xl">
              {Eyebrow}
              {Heading}
              {Sub}
              <div className="flex flex-wrap items-center gap-4 mt-2">
                {Primary}
              </div>
              {showSecondary && (
                <div className="mt-2 text-white">{Secondary}</div>
              )}
              {Trust}
            </div>
          </div>
        ) : isSplit ? (
          <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center rounded-3xl bg-(--bg) p-8 md:p-12">
            <div className="flex flex-col gap-4">
              {Eyebrow}
              {Heading}
              {Sub}
            </div>
            <div className="flex flex-col gap-5 md:items-start">
              {Primary}
              {Secondary}
              {Trust}
            </div>
          </div>
        ) : isCompact ? (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 rounded-2xl bg-(--bg) p-6 md:p-8">
            <div className="flex flex-col gap-2">
              {Heading}
              {Secondary}
            </div>
            <div className="shrink-0">{Primary}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {Eyebrow}
            {Heading}
            {Sub}
            <div className="flex flex-wrap items-center gap-4 mt-2">
              {Primary}
            </div>
            {Secondary}
            {Trust}
          </div>
        )}
      </div>
    </section>
  );
};

export const inquiryBandConfig: ComponentConfig<InquiryBandProps> = {
  label: "Inquiry Band",
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
    primaryCtaLabel: { type: "text", label: "Primary CTA Label" },
    primaryCtaUrl: { type: "text", label: "Primary CTA URL" },
    primaryCtaOpenInNewTab: {
      type: "radio",
      label: "Open primary CTA in new tab",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    showSecondary: {
      type: "radio",
      label: "Show secondary contacts",
      options: [
        { label: "Show", value: true },
        { label: "Hide", value: false },
      ],
    },
    phoneLabel: { type: "text", label: "Phone label" },
    phoneNumber: { type: "text", label: "Phone number" },
    emailLabel: { type: "text", label: "Email label" },
    emailAddress: { type: "text", label: "Email address" },
    whatsappLabel: { type: "text", label: "WhatsApp label" },
    whatsappNumber: { type: "text", label: "WhatsApp number" },
    trustNote: {
      type: "text",
      label: "Trust note (optional)",
      contentEditable: true,
    },
    variant: {
      type: "radio",
      label: "Variant",
      options: [
        { label: "Calm (tinted band)", value: "calm" },
        { label: "Photo-backed", value: "photo" },
        { label: "Split", value: "split" },
        { label: "Compact bar", value: "compact" },
      ],
    },
    imageUrl: imageField,
    imageAlt: { type: "text", label: "Image Alt (photo variant)" },
    accentColor: { ...textColorField, label: "CTA Background" },
    ctaTextColor: { ...textColorField, label: "CTA Text Color" },
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
    eyebrow: "Plan your stay",
    heading: "Tell us what you're hoping for. We'll write back.",
    subheading:
      "Share your dates and a little about your trip. We respond within one business day, often the same morning.",
    primaryCtaLabel: "Send an inquiry",
    primaryCtaUrl: "/contact",
    primaryCtaOpenInNewTab: false,
    showSecondary: true,
    phoneLabel: "Call us",
    phoneNumber: "+39 000 000 0000",
    emailLabel: "Email",
    emailAddress: "stay@pinehollow.example",
    whatsappLabel: "WhatsApp",
    whatsappNumber: "+39 000 000 0000",
    trustNote:
      "We reply within one business day · Real humans, no booking-engine bots",
    variant: "calm",
    imageUrl: "https://placehold.co/1600x900/efeae2/8b6f4e?text=Lodge",
    imageAlt: "Pine Hollow Lodge at dusk",
    accentColor: "#0f172a",
    ctaTextColor: "#ffffff",
    backgroundColor: "#f5f3ee",
    textColor: "#0f172a",
    maxWidth: "xl",
    paddingY: "lg",
    paddingX: "md",
  },
  render: InquiryBand,
};
