import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import {
  backgroundColorField,
  textColorField,
  avatarImageField,
} from "../../lib/fields";
import { parseMarkup } from "../../lib/parse-markup";

export interface TestimonialProps {
  quote: string;
  author: string;
  role: string;
  company: string;
  avatarUrl: string;
  variant: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  // ── Quote typography ──
  quoteFontSize: number;
  quoteColor: string;
  // ── Author typography ──
  authorFontSize: number;
  authorColor: string;
}

export const Testimonial = ({
  quote = "This platform has completely transformed how we manage our properties. The tools are intuitive and the support is world-class.",
  author = "Sarah Johnson",
  role = "CEO",
  company = "Hospitality Inc.",
  avatarUrl = "",
  variant = "card",
  backgroundColor = "#ffffff",
  textColor = "",
  accentColor = "#2563eb",
  quoteFontSize = 0,
  quoteColor = "",
  authorFontSize = 0,
  authorColor = "",
}: TestimonialProps) => {
  const isCard = variant === "card";
  return (
    <blockquote
      className={cn(
        "flex flex-col gap-4 bg-(--bg) text-(--fg)",
        isCard && "rounded-xl border border-gray-200 p-6 shadow-sm md:p-8",
      )}
      style={
        {
          "--bg": isCard ? backgroundColor || "#ffffff" : "transparent",
          "--fg": textColor || "inherit",
          "--accent": accentColor,
        } as React.CSSProperties
      }
    >
      <svg
        className="h-8 w-8 shrink-0 text-(--accent)"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C9.591 11.68 11 13.136 11 15a3 3 0 01-3 3 3.74 3.74 0 01-3.417-1.679zM16.583 17.321C15.553 16.227 15 15 15 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C21.591 11.68 23 13.136 23 15a3 3 0 01-3 3 3.74 3.74 0 01-3.417-1.679z" />
      </svg>
      <p
        style={{
          color: quoteColor || textColor || undefined,
          ...(quoteFontSize > 0 ? { fontSize: `${quoteFontSize}px` } : {}),
        }}
        className={`leading-relaxed ${quoteFontSize === 0 ? " text-base md:text-lg" : ""}`}
      >
        {parseMarkup(quote)}
      </p>
      <footer className="flex items-center gap-3 pt-2">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={author}
            className="h-10 w-10 rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white bg-(--accent)">
            <svg
              width="99px"
              height="99px"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
              <g
                id="SVGRepo_tracerCarrier"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></g>
              <g id="SVGRepo_iconCarrier">
                {" "}
                <circle
                  cx="12"
                  cy="6"
                  r="4"
                  stroke="#ffffff"
                  stroke-width="1.5"
                ></circle>{" "}
                <path
                  d="M19.9975 18C20 17.8358 20 17.669 20 17.5C20 15.0147 16.4183 13 12 13C7.58172 13 4 15.0147 4 17.5C4 19.9853 4 22 12 22C14.231 22 15.8398 21.8433 17 21.5634"
                  stroke="#ffffff"
                  stroke-width="1.5"
                  stroke-linecap="round"
                ></path>{" "}
              </g>
            </svg>
          </div>
        )}
        <div>
          <cite
            style={{
              color: authorColor || textColor || undefined,
              ...(authorFontSize > 0
                ? { fontSize: `${authorFontSize}px` }
                : {}),
            }}
            className={`not-italic font-semibold ${authorFontSize === 0 ? " text-sm" : ""}`}
          >
            {parseMarkup(author)}
          </cite>
          {(role || company) && (
            <p className="text-xs opacity-60">
              {role && parseMarkup(role)}
              {role && company && ", "}
              {company && parseMarkup(company)}
            </p>
          )}
        </div>
      </footer>
    </blockquote>
  );
};

export const testimonialConfig: ComponentConfig<TestimonialProps> = {
  label: "Testimonial",
  fields: {
    quote: {
      type: "textarea",
      label: "Quote",
      contentEditable: true,
    },
    author: {
      type: "text",
      label: "Author Name",
      contentEditable: true,
    },
    role: {
      type: "text",
      label: "Role / Title",
      contentEditable: true,
    },
    company: {
      type: "text",
      label: "Company",
      contentEditable: true,
    },
    avatarUrl: {
      ...avatarImageField,
      label: "Avatar Image (optional)",
    },
    variant: {
      type: "radio",
      label: "Style",
      options: [
        { label: "Card", value: "card" },
        { label: "Minimal", value: "minimal" },
      ],
    },
    accentColor: {
      ...textColorField,
      label: "Accent Color",
    },
    // ── Quote typography ──
    quoteColor: { ...textColorField, label: "Quote Color (overrides global)" },
    quoteFontSize: {
      type: "number",
      label: "Quote Font Size (px, 0 = responsive auto)",
      min: 0,
      max: 80,
    },
    // ── Author typography ──
    authorColor: { ...textColorField, label: "Author Name Color" },
    authorFontSize: {
      type: "number",
      label: "Author Font Size (px, 0 = auto)",
      min: 0,
      max: 40,
    },
    backgroundColor: backgroundColorField,
    textColor: textColorField,
  },
  defaultProps: {
    quote:
      "This platform has completely transformed how we manage our properties. The tools are intuitive and the support is world-class.",
    author: "Sarah Johnson",
    role: "CEO",
    company: "Hospitality Inc.",
    avatarUrl: "",
    variant: "card",
    backgroundColor: "#ffffff",
    textColor: "",
    accentColor: "#2563eb",
    quoteFontSize: 0,
    quoteColor: "",
    authorFontSize: 0,
    authorColor: "",
  },
  render: Testimonial,
};
