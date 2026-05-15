import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { backgroundColorField, textColorField } from "../../lib/fields";
import { parseMarkup } from "../../lib/parse-markup";

interface StatItem {
  value: string;
  label: string;
  description: string;
}

export interface StatsBarProps {
  stats: StatItem[];
  columns: string;
  alignment: string;
  backgroundColor: string;
  valueColor: string;
  textColor: string;
  valueFontSize: number;
  labelFontSize: number;
  descriptionFontSize: number;
}

const columnsMap: Record<string, string> = {
  "2": "grid-cols-1 sm:grid-cols-2",
  "3": "grid-cols-1 sm:grid-cols-3",
  "4": "grid-cols-2 sm:grid-cols-4",
};

export const StatsBar = ({
  stats = [],
  columns = "3",
  alignment = "center",
  backgroundColor = "",
  valueColor = "#2563eb",
  textColor = "",
  valueFontSize = 0,
  labelFontSize = 0,
  descriptionFontSize = 0,
}: StatsBarProps) => {
  const alignClass =
    alignment === "center"
      ? "text-center"
      : alignment === "right"
        ? "text-right"
        : "text-left";

  return (
    <div
      className="w-full rounded-xl px-4 py-8 md:px-6 md:py-12 bg-(--bg)"
      style={
        {
          "--bg": backgroundColor || "transparent",
          "--value-color": valueColor || "#2563eb",
          "--fg": textColor || "inherit",
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          "mx-auto grid max-w-screen-xl gap-6 md:gap-8",
          columnsMap[columns],
        )}
      >
        {stats.map((stat, i) => (
          <div key={i} className={cn("flex flex-col gap-1", alignClass)}>
            <span
              style={{
                color: valueColor || undefined,
                ...(valueFontSize > 0
                  ? { fontSize: `${valueFontSize}px` }
                  : {}),
              }}
              className={`font-extrabold ${valueFontSize === 0 ? " text-3xl md:text-4xl" : ""}`}
            >
              {parseMarkup(stat.value)}
            </span>
            <span
              style={{
                color: textColor || undefined,
                ...(labelFontSize > 0
                  ? { fontSize: `${labelFontSize}px` }
                  : {}),
              }}
              className={`font-semibold uppercase tracking-wide ${labelFontSize === 0 ? " text-sm" : ""}`}
            >
              {parseMarkup(stat.label)}
            </span>
            {stat.description && (
              <span
                style={{
                  color: textColor || undefined,
                  opacity: 0.6,
                  ...(descriptionFontSize > 0
                    ? { fontSize: `${descriptionFontSize}px` }
                    : {}),
                }}
                className={`mt-1 ${descriptionFontSize === 0 ? " text-xs" : ""}`}
              >
                {parseMarkup(stat.description)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const statsBarConfig: ComponentConfig<StatsBarProps> = {
  label: "Stats Bar",
  fields: {
    stats: {
      type: "array",
      label: "Statistics",
      arrayFields: {
        value: { type: "text", label: "Value", contentEditable: true },
        label: { type: "text", label: "Label", contentEditable: true },
        description: {
          type: "text",
          label: "Description (optional)",
          contentEditable: true,
        },
      },
      defaultItemProps: {
        value: "100+",
        label: "Metric",
        description: "",
      },
    },
    columns: {
      type: "radio",
      label: "Columns",
      options: [
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
      ],
    },
    alignment: {
      type: "radio",
      label: "Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    valueColor: {
      ...textColorField,
      label: "Value Color",
    },
    backgroundColor: backgroundColorField,
    textColor: { ...textColorField, label: "Label / Description Color" },
    valueFontSize: {
      type: "number",
      label: "Value Font Size (px, 0 = responsive auto)",
      min: 0,
      max: 120,
    },
    labelFontSize: {
      type: "number",
      label: "Label Font Size (px, 0 = auto)",
      min: 0,
      max: 60,
    },
    descriptionFontSize: {
      type: "number",
      label: "Description Font Size (px, 0 = auto)",
      min: 0,
      max: 40,
    },
  },
  defaultProps: {
    stats: [
      {
        value: "10,000+",
        label: "Properties",
        description: "Managed worldwide",
      },
      { value: "99.9%", label: "Uptime", description: "System reliability" },
      { value: "50+", label: "Countries", description: "Global reach" },
    ],
    columns: "3",
    alignment: "center",
    backgroundColor: "",
    valueColor: "#2563eb",
    textColor: "",
    valueFontSize: 0,
    labelFontSize: 0,
    descriptionFontSize: 0,
  },
  render: StatsBar,
};
