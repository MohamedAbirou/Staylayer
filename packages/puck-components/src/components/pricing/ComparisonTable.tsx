import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { backgroundColorField, textColorField } from "../../lib/fields";
import { useScrollAnimation } from "../../lib/use-animation";
import {
  animationField,
  animationDurationField,
  animationDelayField,
} from "../../lib/animations";
import { parseMarkup } from "../../lib/parse-markup";

interface ComparisonColumn {
  heading: string;
  highlighted: boolean;
}

interface ComparisonValue {
  value: string;
}

interface ComparisonRow {
  feature: string;
  values: ComparisonValue[];
}

export interface ComparisonTableProps {
  heading: string;
  subheading: string;
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
  striped: boolean;
  accentColor: string;
  backgroundColor: string;
  animation: string;
  animationDuration: string;
  animationDelay: string;
  // ── Heading typography ──
  headingColor: string;
  headingFontSize: number;
  headingWeight: string;
  // ── Subheading typography ──
  subheadingColor: string;
  subheadingFontSize: number;
  subheadingOpacity: number;
}

export const ComparisonTable = ({
  heading = "Compare Plans",
  subheading = "See which plan is right for you.",
  columns = [],
  rows = [],
  striped = true,
  accentColor = "#2563eb",
  backgroundColor = "",
  animation = "none",
  animationDuration = "normal",
  animationDelay = "none",
  headingColor = "",
  headingFontSize = 0,
  headingWeight = "bold",
  subheadingColor = "",
  subheadingFontSize = 0,
  subheadingOpacity = 70,
}: ComparisonTableProps) => {
  const {
    ref: animRef,
    animationClassName,
    style: animStyle,
  } = useScrollAnimation(animation, animationDuration, animationDelay);

  return (
    <div
      ref={animRef}
      className={cn(
        "w-full px-4 py-12 md:px-6 md:py-16 bg-(--bg)",
        animationClassName,
      )}
      style={
        {
          "--bg": backgroundColor || "transparent",
          "--accent": accentColor,
          ...animStyle,
        } as React.CSSProperties
      }
    >
      <div className="mx-auto max-w-screen-xl">
        {(heading || subheading) && (
          <div className="mb-8 text-center md:mb-12">
            {heading && (
              <h2
                style={{
                  color: headingColor || undefined,
                  ...(headingFontSize > 0
                    ? { fontSize: `${headingFontSize}px` }
                    : {}),
                }}
                className={`font-${headingWeight || "bold"} tracking-tight ${headingFontSize === 0 ? " text-2xl md:text-3xl" : ""}`}
              >
                {parseMarkup(heading)}
              </h2>
            )}
            {subheading && (
              <p
                style={{
                  color: subheadingColor || undefined,
                  opacity: subheadingOpacity / 100,
                  ...(subheadingFontSize > 0
                    ? { fontSize: `${subheadingFontSize}px` }
                    : {}),
                }}
                className={`mt-3 text-gray-500 ${subheadingFontSize === 0 ? " text-base" : ""}`}
              >
                {parseMarkup(subheading)}
              </p>
            )}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="py-4 pr-4 font-semibold text-gray-900 text-left min-w-[200px]">
                  Feature
                </th>
                {columns.map((col, i) => (
                  <th
                    key={i}
                    className={cn(
                      "py-4 px-4 text-center font-semibold min-w-[120px]",
                      col.highlighted
                        ? "text-white rounded-t-lg bg-(--accent)"
                        : "text-gray-900",
                    )}
                  >
                    {parseMarkup(col.heading)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                // Extract string values – safe even if structure is slightly off
                const cellValues = row.values.map((item) => item?.value ?? "");

                // Pad if someone added fewer values than columns
                const paddedValues = [
                  ...cellValues,
                  ...Array(
                    Math.max(0, columns.length - cellValues.length),
                  ).fill(""),
                ];

                return (
                  <tr
                    key={ri}
                    className={cn(
                      "border-b border-gray-100",
                      striped && ri % 2 === 1 && "bg-gray-50",
                    )}
                  >
                    <td className="py-3 pr-4 font-medium text-gray-700">
                      {parseMarkup(row.feature)}
                    </td>

                    {columns.map((col, ci) => {
                      const val = paddedValues[ci] ?? "";
                      // Safe lowercase – fallback to "" if not string
                      const valLower =
                        typeof val === "string" ? val.toLowerCase() : "";

                      const isCheck =
                        val === "✓" ||
                        valLower === "yes" ||
                        valLower === "true";
                      const isCross =
                        val === "✗" ||
                        val === "✕" ||
                        valLower === "no" ||
                        valLower === "false";

                      return (
                        <td
                          key={ci}
                          className={cn(
                            "py-3 px-4 text-center",
                            col.highlighted && "bg-blue-50/50",
                          )}
                        >
                          {isCheck ? (
                            <svg
                              className="mx-auto h-5 w-5 text-(--accent)"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2.5}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4.5 12.75l6 6 9-13.5"
                              />
                            </svg>
                          ) : isCross ? (
                            <svg
                              className="mx-auto h-5 w-5 text-gray-300"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          ) : (
                            <span className="text-gray-600">
                              {parseMarkup(val)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const comparisonTableConfig: ComponentConfig<ComparisonTableProps> = {
  label: "Comparison Table",
  fields: {
    heading: { type: "text", label: "Heading", contentEditable: true },
    subheading: { type: "text", label: "Subheading", contentEditable: true },
    columns: {
      type: "array",
      label: "Columns (Plans)",
      arrayFields: {
        heading: { type: "text", label: "Column Name", contentEditable: true },
        highlighted: {
          type: "radio",
          label: "Highlighted",
          options: [
            { label: "No", value: false },
            { label: "Yes", value: true },
          ],
        },
      },
      defaultItemProps: { heading: "Plan", highlighted: false },
      getItemSummary: (item) => item.heading || "Column",
    },
    rows: {
      type: "array",
      label: "Rows (Features)",
      arrayFields: {
        feature: {
          type: "text",
          label: "Feature Name",
          contentEditable: true,
        },
        values: {
          type: "array",
          label: "Values (one per plan)",
          arrayFields: {
            value: {
              type: "text",
              label: "Value",
              contentEditable: true, // ← makes each cell inline editable
            },
          },
          defaultItemProps: { value: "✓" },
          getItemSummary: (item) => item.value || "—",
        },
      },
      defaultItemProps: {
        feature: "New feature",
        values: [{ value: "✓" }, { value: "✓" }, { value: "✗" }],
      },
      getItemSummary: (item) => item.feature || "Feature",
    },
    striped: {
      type: "radio",
      label: "Striped Rows",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    accentColor: { ...textColorField, label: "Accent Color" },
    backgroundColor: backgroundColorField,
    // ── Heading typography ──
    headingColor: { ...textColorField, label: "Heading Color" },
    headingFontSize: {
      type: "number",
      label: "Heading Font Size (px, 0 = auto)",
      min: 0,
      max: 120,
    },
    headingWeight: {
      type: "select",
      label: "Heading Font Weight",
      options: [
        { label: "Normal", value: "normal" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
        { label: "Extra Bold", value: "extrabold" },
      ],
    },
    subheadingColor: { ...textColorField, label: "Subheading Color" },
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
    animation: animationField,
    animationDuration: animationDurationField,
    animationDelay: animationDelayField,
  },
  defaultProps: {
    heading: "Compare Plans",
    subheading: "See which plan is right for you.",
    columns: [
      { heading: "Starter", highlighted: false },
      { heading: "Pro", highlighted: true },
      { heading: "Enterprise", highlighted: false },
    ],
    rows: [
      {
        feature: "Pages",
        values: [
          { value: "5" },
          { value: "Unlimited" },
          { value: "Unlimited" },
        ],
      },
      {
        feature: "Custom Domain",
        values: [{ value: "✓" }, { value: "✓" }, { value: "✓" }],
      },
      {
        feature: "Analytics",
        values: [
          { value: "Basic" },
          { value: "Advanced" },
          { value: "Advanced" },
        ],
      },
      {
        feature: "API Access",
        values: [{ value: "✗" }, { value: "✓" }, { value: "✓" }],
      },
    ],
    striped: true,
    accentColor: "#2563eb",
    backgroundColor: "",
    headingColor: "",
    headingFontSize: 0,
    headingWeight: "bold",
    subheadingColor: "",
    subheadingFontSize: 0,
    subheadingOpacity: 70,
    animation: "none",
    animationDuration: "normal",
    animationDelay: "none",
  },
  render: ComparisonTable,
};
