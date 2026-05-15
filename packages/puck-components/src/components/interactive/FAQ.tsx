import { useState } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import {
  backgroundColorField,
  maxWidthMap,
  textColorField,
} from "../../lib/fields";
import { parseMarkup } from "../../lib/parse-markup";

interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQProps {
  heading: string;
  headingPosition: string;
  subheading: string;
  items: FAQItem[];
  columns: string;
  backgroundColor: string;
  textColor: string;
  maxWidth: string;
  accentColor: string;
  // ── Heading typography ──
  headingColor: string;
  headingFontSize: number;
  headingWeight: string;
  // ── Subheading typography ──
  subheadingColor: string;
  subheadingFontSize: number;
  subheadingOpacity: number;
}

function AccordionItem({
  question,
  answer,
  isOpen,
  onToggle,
  accentColor,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  accentColor: string;
}) {
  return (
    <div
      className="border-b border-gray-200 last:border-b-0"
      style={{ "--accent": accentColor } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-4 text-left transition-colors hover:opacity-80"
        aria-expanded={isOpen}
      >
        <span className="pr-4 text-base font-medium">
          {parseMarkup(question)}
        </span>
        <svg
          className={cn(
            "h-5 w-5 shrink-0 transition-transform duration-200 text-(--accent)",
            isOpen && "rotate-180",
          )}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 [grid-template-rows:var(--rows)]"
        style={{ "--rows": isOpen ? "1fr" : "0fr" } as React.CSSProperties}
      >
        <div className="overflow-hidden">
          <div className=" px-4 mb-4 text-sm leading-relaxed opacity-80">
            {parseMarkup(answer)}
          </div>
        </div>
      </div>
    </div>
  );
}

export const FAQ = ({
  heading = "Frequently asked questions",
  headingPosition = "center",
  subheading = "Helpful details for planning a direct stay.",
  items = [],
  columns = "1",
  backgroundColor = "",
  textColor = "",
  maxWidth = "xl",
  accentColor = "#2563eb",
  headingColor = "",
  headingFontSize = 0,
  headingWeight = "bold",
  subheadingColor = "",
  subheadingFontSize = 0,
  subheadingOpacity = 70,
}: FAQProps) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const isTwoColumns = columns === "2" && items.length > 2;
  const midPoint = Math.ceil(items.length / 2);
  const leftItems = isTwoColumns ? items.slice(0, midPoint) : items;
  const rightItems = isTwoColumns ? items.slice(midPoint) : [];

  return (
    <div
      className="w-full px-4 py-10 md:px-6 md:py-16 bg-(--bg) text-(--fg)"
      style={
        {
          "--bg": backgroundColor || "transparent",
          "--fg": textColor || "inherit",
        } as React.CSSProperties
      }
    >
      <div className={cn("mx-auto", maxWidthMap[maxWidth])}>
        {(heading || subheading) && (
          <div className={`mb-8 md:mb-12 text-${headingPosition}`}>
            {heading && (
              <h2
                style={{
                  color: headingColor || textColor || undefined,
                  ...(headingFontSize > 0
                    ? { fontSize: `${headingFontSize}px` }
                    : {}),
                }}
                className={`font-${headingWeight || "bold"} ${headingFontSize === 0 ? " text-2xl md:text-3xl" : ""}`}
              >
                {parseMarkup(heading)}
              </h2>
            )}
            {subheading && (
              <p
                style={{
                  color: subheadingColor || textColor || undefined,
                  opacity: subheadingOpacity / 100,
                  ...(subheadingFontSize > 0
                    ? { fontSize: `${subheadingFontSize}px` }
                    : {}),
                }}
                className={`mt-3 ${subheadingFontSize === 0 ? " text-base" : ""}`}
              >
                {parseMarkup(subheading)}
              </p>
            )}
          </div>
        )}
        <div
          className={cn(
            "mx-auto",
            isTwoColumns
              ? "grid max-w-5xl grid-cols-1 gap-x-12 md:grid-cols-2"
              : maxWidthMap[maxWidth],
          )}
        >
          <div>
            {leftItems.map((item, i) => (
              <AccordionItem
                key={i}
                question={item.question}
                answer={item.answer}
                isOpen={openIndex === i}
                onToggle={() => toggle(i)}
                accentColor={accentColor}
              />
            ))}
          </div>
          {isTwoColumns && (
            <div>
              {rightItems.map((item, i) => {
                const idx = midPoint + i;
                return (
                  <AccordionItem
                    key={idx}
                    question={item.question}
                    answer={item.answer}
                    isOpen={openIndex === idx}
                    onToggle={() => toggle(idx)}
                    accentColor={accentColor}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const faqConfig: ComponentConfig<FAQProps> = {
  label: "FAQ",
  fields: {
    heading: { type: "text", label: "Heading", contentEditable: true },
    headingPosition: {
      type: "radio",
      label: "Heading Position",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    subheading: { type: "text", label: "Subheading", contentEditable: true },
    items: {
      type: "array",
      label: "Questions",
      arrayFields: {
        question: { type: "text", label: "Question", contentEditable: true },
        answer: { type: "textarea", label: "Answer", contentEditable: true },
      },
      defaultItemProps: {
        question: "Can I book directly?",
        answer:
          "Yes. Send an inquiry with your dates and the reservations team will confirm availability and next steps.",
      },
    },
    columns: {
      type: "radio",
      label: "Layout",
      options: [
        { label: "Single Column", value: "1" },
        { label: "Two Columns", value: "2" },
      ],
    },
    accentColor: {
      ...textColorField,
      label: "Accent Color",
    },
    backgroundColor: backgroundColorField,
    textColor: { ...textColorField, label: "Text Color (global fallback)" },
    maxWidth: {
      type: "select",
      label: "Max Width",
      options: [
        { label: "Small (640px)", value: "sm" },
        { label: "Medium (768px)", value: "md" },
        { label: "Large (1024px)", value: "lg" },
        { label: "Extra Large (1280px)", value: "xl" },
        { label: "2XL (1536px)", value: "2xl" },
        { label: "Full", value: "full" },
      ],
    },
    // ── Heading typography ──
    headingColor: {
      ...textColorField,
      label: "Heading Color (overrides global)",
    },
    headingFontSize: {
      type: "number",
      label: "Heading Font Size (px, 0 = responsive auto)",
      min: 0,
      max: 120,
    },
    headingWeight: {
      type: "select",
      label: "Heading Font Weight",
      options: [
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
        { label: "Extra Bold", value: "extrabold" },
      ],
    },
    // ── Subheading typography ──
    subheadingColor: {
      ...textColorField,
      label: "Subheading Color (overrides global)",
    },
    subheadingFontSize: {
      type: "number",
      label: "Subheading Font Size (px, 0 = auto)",
      min: 0,
      max: 60,
    },
    subheadingOpacity: {
      type: "number",
      label: "Subheading Opacity (%)",
      min: 10,
      max: 100,
    },
  },
  defaultProps: {
    heading: "Frequently asked questions",
    headingPosition: "center",
    subheading: "Helpful details for planning a direct stay.",
    items: [
      {
        question: "Can I book directly?",
        answer:
          "Yes. Send an inquiry with your preferred dates and the reservations team will confirm availability, rates, and next steps.",
      },
      {
        question: "What information should I include?",
        answer:
          "Include your arrival and departure dates, number of guests, room preferences, and any special requests for your stay.",
      },
      {
        question: "Do you support longer stays or groups?",
        answer:
          "Share your group size and ideal dates so the team can recommend the best rooms, villas, or packages.",
      },
      {
        question: "When will I hear back?",
        answer:
          "Most direct inquiries receive a personal reply within one business day.",
      },
    ],
    columns: "1",
    backgroundColor: "",
    textColor: "",
    maxWidth: "xl",
    accentColor: "#2563eb",
    headingColor: "",
    headingFontSize: 0,
    headingWeight: "bold",
    subheadingColor: "",
    subheadingFontSize: 0,
    subheadingOpacity: 70,
  },
  render: FAQ,
};
