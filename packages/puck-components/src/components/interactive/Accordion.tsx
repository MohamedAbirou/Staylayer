import { useState, useEffect } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { textColorField } from "../../lib/fields";

export interface AccordionProps {
  title: string;
  content: string;
  defaultOpen: boolean;
  bordered: boolean;
  accentColor: string;
}

export const Accordion = ({
  title = "Accordion Title",
  content = "This is the accordion content. Click the title to expand or collapse it.",
  defaultOpen = false,
  bordered = true,
  accentColor = "#2563eb",
}: AccordionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg",
        bordered && "border border-gray-200",
      )}
      style={{ "--accent": accentColor } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-semibold">{title}</span>
        <svg
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200 text-(--accent)",
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
          <div className="border-t border-gray-200 px-4 py-3 text-sm leading-relaxed opacity-80">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
};

export const accordionConfig: ComponentConfig<AccordionProps> = {
  label: "Accordion",
  fields: {
    title: { type: "text", label: "Title", contentEditable: true },
    content: { type: "textarea", label: "Content", contentEditable: true },
    defaultOpen: {
      type: "radio",
      label: "Default Open",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    bordered: {
      type: "radio",
      label: "Border",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    accentColor: {
      ...textColorField,
      label: "Accent Color",
    },
  },
  defaultProps: {
    title: "Accordion Title",
    content:
      "This is the accordion content. Click the title to expand or collapse it.",
    defaultOpen: false,
    bordered: true,
    accentColor: "#2563eb",
  },
  render: Accordion,
};
