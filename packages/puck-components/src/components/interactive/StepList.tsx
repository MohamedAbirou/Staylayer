import type { ComponentConfig } from "@puckeditor/core";
import {
  backgroundColorField,
  textColorField,
  maxWidthMap,
} from "../../lib/fields";
import { cn } from "../../lib/cn";
import { parseMarkup } from "../../lib/parse-markup";

interface StepItem {
  title: string;
  description: string;
}

export interface StepListProps {
  items: StepItem[];
  layout: string;
  numberBgColor: string;
  numberTextColor: string;
  titleColor: string;
  descriptionColor: string;
  numberSize: number;
  titleSize: number;
  descriptionSize: number;
  spacing: number;
  maxWidth: string;
  showConnector: boolean;
  connectorColor: string;
}

export const StepList = ({
  items = [],
  layout = "vertical",
  numberBgColor = "#dbeafe",
  numberTextColor = "#1d4ed8",
  titleColor = "",
  descriptionColor = "",
  numberSize = 44,
  titleSize = 18,
  descriptionSize = 15,
  spacing = 32,
  maxWidth = "xl",
  showConnector = false,
  connectorColor = "#e5e7eb",
}: StepListProps) => {
  const isHorizontal = layout === "horizontal";

  if (isHorizontal) {
    return (
      <ol
        className="flex flex-col gap-y-8 sm:flex-row sm:items-start sm:justify-center"
        style={{ gap: `${spacing}px` }}
      >
        {items.map((step, idx) => (
          <li
            key={idx}
            className="relative flex flex-1 flex-col items-center text-center"
          >
            {/* connector line between steps */}
            {showConnector && idx > 0 && (
              <div
                className="absolute top-[22px] right-[calc(50%+22px)] hidden h-0.5 sm:block"
                style={{
                  left: `calc(-50% + ${numberSize / 2}px)`,
                  background: connectorColor,
                  width: "calc(100% - 44px)",
                }}
              />
            )}
            <span
              className="relative z-10 flex shrink-0 items-center justify-center rounded-full text-lg font-bold"
              style={{
                width: numberSize,
                height: numberSize,
                minWidth: numberSize,
                background: numberBgColor,
                color: numberTextColor,
                fontSize: Math.max(numberSize * 0.38, 14),
              }}
            >
              {idx + 1}
            </span>
            <div className="mt-4 px-2">
              <div
                className="font-semibold"
                style={{ fontSize: titleSize, color: titleColor || undefined }}
              >
                {parseMarkup(step.title)}
              </div>
              {step.description && (
                <p
                  className="mt-1 leading-relaxed"
                  style={{
                    fontSize: descriptionSize,
                    color: descriptionColor || "#6b7280",
                  }}
                >
                  {parseMarkup(step.description)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    );
  }

  // Vertical layout
  return (
    <ol
      className={cn("flex flex-col w-full mx-auto", maxWidthMap[maxWidth])}
      style={{ gap: `${spacing}px` }}
    >
      {items.map((step, idx) => (
        <li
          key={idx}
          className={cn(
            "mx-auto flex w-full items-start gap-4",
            maxWidthMap[maxWidth],
          )}
        >
          {/* Number + Connector */}
          <div className="relative flex flex-col items-center flex-shrink-0">
            <span
              className="flex shrink-0 items-center justify-center rounded-full font-bold"
              style={{
                width: numberSize,
                height: numberSize,
                minWidth: numberSize,
                background: numberBgColor,
                color: numberTextColor,
                fontSize: Math.max(numberSize * 0.38, 14),
              }}
            >
              {idx + 1}
            </span>

            {showConnector && idx < items.length - 1 && (
              <div
                className="mt-1 w-0.5 flex-1"
                style={{
                  height: spacing,
                  background: connectorColor,
                  minHeight: 20,
                }}
              />
            )}
          </div>

          {/* Text Content */}
          <div className="pt-1.5 flex-1 min-w-0">
            <div
              className="font-semibold"
              style={{ fontSize: titleSize, color: titleColor || undefined }}
            >
              {parseMarkup(step.title)}
            </div>
            {step.description && (
              <p
                className="mt-1 leading-relaxed"
                style={{
                  fontSize: descriptionSize,
                  color: descriptionColor || "#6b7280",
                }}
              >
                {parseMarkup(step.description)}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
};

export const stepListConfig: ComponentConfig<StepListProps> = {
  label: "Step List",
  fields: {
    items: {
      type: "array",
      label: "Steps",
      arrayFields: {
        title: { type: "text", label: "Step Title", contentEditable: true },
        description: {
          type: "textarea",
          label: "Description (optional)",
          contentEditable: true,
        },
      },
      defaultItemProps: {
        title: "Step Title",
        description: "Brief description of this step.",
      },
      getItemSummary: (item: StepItem) => item.title || "Step",
    },
    layout: {
      type: "radio",
      label: "Layout",
      options: [
        { label: "Vertical", value: "vertical" },
        { label: "Horizontal", value: "horizontal" },
      ],
    },
    spacing: {
      type: "number",
      label: "Between Steps (px)",
      min: 8,
      max: 96,
    },
    maxWidth: {
      type: "select",
      label: "Max Width",
      options: [
        { label: "None", value: "none" },
        { label: "Extra Small (420px)", value: "xs" },
        { label: "Small (640px)", value: "sm" },
        { label: "Medium (768px)", value: "md" },
        { label: "Large (1024px)", value: "lg" },
        { label: "Extra Large (1280px)", value: "xl" },
        { label: "2XL (1536px)", value: "2xl" },
        { label: "Full", value: "full" },
      ],
    },
    numberSize: {
      type: "number",
      label: "Number Circle Size (px)",
      min: 24,
      max: 80,
    },
    titleSize: {
      type: "number",
      label: "Title Font Size (px)",
      min: 12,
      max: 36,
    },
    descriptionSize: {
      type: "number",
      label: "Description Font Size (px)",
      min: 10,
      max: 24,
    },
    showConnector: {
      type: "radio",
      label: "Show Connector Line",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    connectorColor: { ...backgroundColorField, label: "Connector Color" },
    numberBgColor: { ...backgroundColorField, label: "Number Background" },
    numberTextColor: { ...textColorField, label: "Number Text Color" },
    titleColor: { ...textColorField, label: "Title Color" },
    descriptionColor: { ...textColorField, label: "Description Color" },
  },
  defaultProps: {
    items: [
      {
        title: "Sign Up & Import Listings",
        description:
          "Connect Airbnb, Booking.com or upload your property details manually.",
      },
      {
        title: "Customize Your Site",
        description:
          "Choose a modern template, add photos, set policies and pick your domain.",
      },
      {
        title: "Accept Direct Bookings",
        description:
          "Start taking secure, instant reservations while we handle calendars, payments and guest emails.",
      },
    ],
    layout: "vertical",
    spacing: 32,
    maxWidth: "xl",
    numberSize: 44,
    titleSize: 18,
    descriptionSize: 15,
    showConnector: false,
    connectorColor: "#e5e7eb",
    numberBgColor: "#dbeafe",
    numberTextColor: "#1d4ed8",
    titleColor: "",
    descriptionColor: "",
  },
  render: StepList,
};
