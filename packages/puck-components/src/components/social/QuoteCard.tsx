import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { backgroundColorField, textColorField } from "../../lib/fields";
import { parseMarkup } from "../../lib/parse-markup";

export interface QuoteCardProps {
  quote: string;
  author: string;
  withBorder: boolean;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  shadow: string;
  rounded: string;
  quoteFontSize: number;
  quoteColor: string;
  authorFontSize: number;
  authorColor: string;
}

const shadowMap: Record<string, string> = {
  none: "",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl shadow-slate-900/10",
};

const roundedMap: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded",
  md: "rounded-lg",
  lg: "rounded-xl",
  xl: "rounded-2xl",
};

export const QuoteCard = ({
  quote = "This product has completely transformed how we work. Highly recommended.",
  author = "Jane Smith",
  withBorder = true,
  backgroundColor = "#ffffff",
  textColor = "",
  accentColor = "#e2e8f0",
  shadow = "xl",
  rounded = "xl",
  quoteFontSize = 0,
  quoteColor = "",
  authorFontSize = 0,
  authorColor = "",
}: QuoteCardProps) => {
  return (
    <figure
      className={cn(
        "relative flex h-full flex-col justify-between justify-items-end p-4",
        shadowMap[shadow],
        roundedMap[rounded],
      )}
      style={{
        background: backgroundColor || "#ffffff",
        color: textColor || "inherit",
      }}
    >
      {/* Large decorative quote mark */}
      <svg
        aria-hidden="true"
        width={112}
        height={94}
        viewBox="0 0 105 78"
        className="absolute left-3 top-5 opacity-50"
        style={{ fill: accentColor || "#e2e8f0" }}
      >
        <path d="M25.086 77.292c-4.821 0-9.115-1.205-12.882-3.616-3.767-2.561-6.78-6.102-9.04-10.622C1.054 58.534 0 53.411 0 47.686c0-5.273.904-10.396 2.712-15.368 1.959-4.972 4.746-9.567 8.362-13.786a59.042 59.042 0 0 1 12.43-11.3C28.325 3.917 33.599 1.507 39.324 0l11.074 13.786c-6.479 2.561-11.677 5.951-15.594 10.17-3.767 4.219-5.65 7.835-5.65 10.848 0 1.356.377 2.863 1.13 4.52.904 1.507 2.637 3.089 5.198 4.746 3.767 2.41 6.328 4.972 7.684 7.684 1.507 2.561 2.26 5.5 2.26 8.814 0 5.123-1.959 9.19-5.876 12.204-3.767 3.013-8.588 4.52-14.464 4.52Zm54.24 0c-4.821 0-9.115-1.205-12.882-3.616-3.767-2.561-6.78-6.102-9.04-10.622-2.11-4.52-3.164-9.643-3.164-15.368 0-5.273.904-10.396 2.712-15.368 1.959-4.972 4.746-9.567 8.362-13.786a59.042 59.042 0 0 1 12.43-11.3C82.565 3.917 87.839 1.507 93.564 0l11.074 13.786c-6.479 2.561-11.677 5.951-15.594 10.17-3.767 4.219-5.65 7.835-5.65 10.848 0 1.356.377 2.863 1.13 4.52.904 1.507 2.637 3.089 5.198 4.746 3.767 2.41 6.328 4.972 7.684 7.684 1.507 2.561 2.26 5.5 2.26 8.814 0 5.123-1.959 9.19-5.876 12.204-3.767 3.013-8.588 4.52-14.464 4.52Z" />
      </svg>

      <blockquote className="relative z-10 pt-2">
        <p
          style={{
            color: quoteColor || textColor || undefined,
            ...(quoteFontSize > 0 ? { fontSize: `${quoteFontSize}px` } : {}),
          }}
          className={`leading-relaxed tracking-tight ${quoteFontSize === 0 ? " text-base md:text-lg" : ""}`}
        >
          {parseMarkup(quote)}
        </p>
      </blockquote>

      <figcaption
        className={cn(
          "relative z-10 mt-6 flex items-center justify-end ms-auto gap-3 pt-6 max-w-3/4",
          withBorder && "border-t",
        )}
        style={{ borderColor: accentColor || "#e5e7eb" }}
      >
        <div>
          {author && (
            <div
              style={{
                color: authorColor || textColor || undefined,
                ...(authorFontSize > 0
                  ? { fontSize: `${authorFontSize}px` }
                  : {}),
              }}
              className={
                authorFontSize === 0 ? "text-lg leading-tight" : "leading-tight"
              }
            >
              {parseMarkup(author)}
            </div>
          )}
        </div>
      </figcaption>
    </figure>
  );
};

export const quoteCardConfig: ComponentConfig<QuoteCardProps> = {
  label: "Quote Card",
  fields: {
    quote: {
      type: "textarea",
      label: "Quote Text",
      contentEditable: true,
    },
    author: {
      type: "text",
      label: "Author Name",
      contentEditable: true,
    },
    withBorder: {
      type: "radio",
      label: "Footer Divider",
      options: [
        { label: "Show", value: true },
        { label: "Hide", value: false },
      ],
    },
    shadow: {
      type: "select",
      label: "Shadow",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
    rounded: {
      type: "select",
      label: "Corner Rounding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
    backgroundColor: backgroundColorField,
    textColor: textColorField,
    accentColor: {
      ...backgroundColorField,
      label: "Quote Mark & Divider Color",
    },
    quoteColor: { ...textColorField, label: "Quote Text Color" },
    quoteFontSize: {
      type: "number",
      label: "Quote Font Size (px, 0 = auto)",
      min: 0,
      max: 80,
    },
    authorColor: { ...textColorField, label: "Author Color" },
    authorFontSize: {
      type: "number",
      label: "Author Font Size (px, 0 = auto)",
      min: 0,
      max: 60,
    },
  },
  defaultProps: {
    quote:
      "A small, beautifully kept place that feels personal from the moment you arrive. We'll be back for a longer stay.",
    author: "Maya & Tom, returning guests",
    withBorder: true,
    backgroundColor: "#ffffff",
    textColor: "",
    accentColor: "#e2e8f0",
    shadow: "xl",
    rounded: "xl",
    quoteFontSize: 0,
    quoteColor: "",
    authorFontSize: 0,
    authorColor: "",
  },
  render: QuoteCard,
};
