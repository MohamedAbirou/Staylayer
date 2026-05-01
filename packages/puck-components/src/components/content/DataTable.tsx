import type { ComponentConfig } from "@puckeditor/core";
import {
  backgroundColorField,
  maxWidthMap,
  textColorField,
} from "../../lib/fields";
import { cn } from "../../lib/cn";
import { parseMarkup } from "../../lib/parse-markup";

interface DataTableColumn {
  header: string;
  width: string;
  align: string;
  bold: boolean;
}

interface DataTableCell {
  value: string;
  featureIncluded?: boolean;
}

interface DataTableRow {
  cells: DataTableCell[];
  isHighlighted: boolean;
}

export interface DataTableProps {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  showFooter: boolean;
  footerText: string;
  headerBgColor: string;
  headerTextColor: string;
  rowOddBgColor: string;
  rowEvenBgColor: string;
  highlightBgColor: string;
  highlightTextColor: string;
  showCheckmarks: boolean;
  bodyTextColor: string;
  footerBgColor: string;
  footerTextColor: string;
  maxWidth: string;
  fontSize: number;
  rounded: boolean;
  shadow: boolean;
  bordered: boolean;
}

export const DataTable = ({
  columns = [],
  rows = [],
  showFooter = false,
  footerText = "",
  headerBgColor = "#f9fafb",
  headerTextColor = "#374151",
  rowOddBgColor = "#ffffff",
  rowEvenBgColor = "#f9fafb",
  highlightBgColor = "#eff6ff",
  highlightTextColor = "#1e40af",
  showCheckmarks = false,
  bodyTextColor = "#1f2937",
  footerBgColor = "#f9fafb",
  footerTextColor = "#374151",
  maxWidth = "xl",
  fontSize = 0,
  rounded = true,
  shadow = true,
  bordered = true,
}: DataTableProps) => {
  return (
    <div className="w-full">
      <div
        className={cn("overflow-hidden w-full mx-auto", maxWidthMap[maxWidth])}
        style={{
          borderRadius: rounded ? 16 : 0,
          border: bordered ? "1px solid #e5e7eb" : "none",
          boxShadow: shadow ? "0 1px 3px rgba(0,0,0,.08)" : "none",
          background: "#fff",
        }}
      >
        <div className="overflow-x-auto">
          <table
            className="min-w-full border-separate"
            style={{ borderSpacing: 0 }}
          >
            {columns.length > 0 && (
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  background: headerBgColor,
                }}
              >
                <tr>
                  {columns.map((col, ci) => (
                    <th
                      key={ci}
                      className="px-5 py-3.5 text-sm font-semibold"
                      style={{
                        color: headerTextColor,
                        textAlign:
                          (col.align as "left" | "center" | "right") || "left",
                        width: col.width || "auto",
                        ...(fontSize > 0 ? { fontSize: `${fontSize}px` } : {}),
                      }}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody style={{ color: bodyTextColor }}>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  style={{
                    background: row.isHighlighted
                      ? highlightBgColor
                      : ri % 2 === 0
                        ? rowOddBgColor
                        : rowEvenBgColor,
                    color: row.isHighlighted
                      ? highlightTextColor
                      : bodyTextColor,
                  }}
                >
                  {row.cells.map((cell, ci) => {
                    const col = columns[ci];
                    const Tag = col?.bold ? "th" : "td";
                    return (
                      <Tag
                        key={ci}
                        className="px-5 py-4 align-top text-sm text-left border-t border-gray-200/50"
                        style={{
                          // textAlign:
                          //   (col?.align as "left" | "center" | "right") ||
                          //   "left",
                          fontWeight: col?.bold ? 600 : undefined,
                          ...(fontSize > 0
                            ? { fontSize: `${fontSize}px` }
                            : {}),
                        }}
                        scope={col?.bold ? "row" : undefined}
                      >
                        {ci === 0 && showCheckmarks && cell.featureIncluded ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                              ✓
                            </span>
                            {parseMarkup(cell.value)}
                          </div>
                        ) : ci === 0 &&
                          showCheckmarks &&
                          !cell.featureIncluded ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-red-700">
                              ✗
                            </span>
                            {parseMarkup(cell.value)}
                          </div>
                        ) : (
                          parseMarkup(cell.value)
                        )}
                      </Tag>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {showFooter && footerText && (
          <div
            className="border-t px-5 py-5"
            style={{
              borderColor: "#e5e7eb",
              background: footerBgColor,
            }}
          >
            <p className="text-sm" style={{ color: footerTextColor }}>
              {footerText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export const dataTableConfig: ComponentConfig<DataTableProps> = {
  label: "Data Table",
  fields: {
    columns: {
      type: "array",
      label: "Columns",
      arrayFields: {
        header: { type: "text", label: "Header Label", contentEditable: true },
        width: { type: "text", label: "Width (e.g. 30%, 200px, auto)" },
        align: {
          type: "radio",
          label: "Alignment",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
        },
        bold: {
          type: "radio",
          label: "Bold Cell",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
      },
      defaultItemProps: {
        header: "Column",
        width: "",
        align: "left",
        bold: false,
      },
      getItemSummary: (item: DataTableColumn) => item.header || "Column",
    },
    rows: {
      type: "array",
      label: "Rows",
      arrayFields: {
        cells: {
          type: "array",
          label: "Cells",
          arrayFields: {
            value: { type: "text", label: "Cell Value", contentEditable: true },
            featureIncluded: {
              type: "radio",
              label: "Feature Included (adds checkmark)",
              options: [
                { label: "Yes", value: true },
                { label: "No", value: false },
              ],
            },
          },
          defaultItemProps: { value: "Cell value", featureIncluded: true },
        },
        isHighlighted: {
          type: "radio",
          label: "Highlight Row",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
      },
      defaultItemProps: {
        cells: [
          { value: "Row value 1", featureIncluded: true },
          { value: "Row value 2" },
        ],
        isHighlighted: false,
      },
      getItemSummary: (_: DataTableRow, i?: number) => `Row ${(i ?? 0) + 1}`,
    },
    fontSize: {
      type: "number",
      label: "Font Size (px)",
      min: 0,
      max: 100,
    },
    showFooter: {
      type: "radio",
      label: "Show Footer",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    footerText: {
      type: "textarea",
      label: "Footer Text",
    },
    showCheckmarks: {
      type: "radio",
      label: "Show Checkmarks",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
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
    headerBgColor: { ...backgroundColorField, label: "Header Background" },
    headerTextColor: { ...textColorField, label: "Header Text Color" },
    rowOddBgColor: { ...backgroundColorField, label: "Odd Row Background" },
    rowEvenBgColor: { ...backgroundColorField, label: "Even Row Background" },
    highlightBgColor: {
      ...backgroundColorField,
      label: "Highlighted Row Background",
    },
    highlightTextColor: { ...textColorField, label: "Highlighted Row Text" },
    bodyTextColor: { ...textColorField, label: "Body Text Color" },
    footerBgColor: { ...backgroundColorField, label: "Footer Background" },
    footerTextColor: { ...textColorField, label: "Footer Text Color" },
    rounded: {
      type: "radio",
      label: "Rounded Corners",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    shadow: {
      type: "radio",
      label: "Shadow",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
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
  },
  defaultProps: {
    columns: [
      { header: "Benefit", width: "30%", align: "left", bold: true },
      {
        header: "What it means for you",
        width: "70%",
        align: "left",
        bold: false,
      },
    ],
    rows: [
      {
        cells: [
          { value: "20% Higher Revenue", featureIncluded: true },
          {
            value:
              "Our users consistently report at least one-fifth more income after switching from OTA-only listings.",
          },
        ],
        isHighlighted: false,
      },
      {
        cells: [
          { value: "Dynamic Pricing Engine", featureIncluded: true },
          {
            value:
              "Optimize nightly rates automatically to stay competitive and maximize occupancy.",
          },
        ],
        isHighlighted: false,
      },
      {
        cells: [
          { value: "Commission-Free Direct Bookings", featureIncluded: true },
          {
            value: "Keep 100% of what you earn, stop paying marketplace fees.",
          },
        ],
        isHighlighted: false,
      },
    ],
    headerBgColor: "#f9fafb",
    headerTextColor: "#374151",
    rowOddBgColor: "#ffffff",
    rowEvenBgColor: "#f9fafb",
    highlightBgColor: "#eff6ff",
    highlightTextColor: "#1e40af",
    bodyTextColor: "#1f2937",
    showFooter: false,
    footerText: "",
    footerBgColor: "#f9fafb",
    footerTextColor: "#374151",
    maxWidth: "xl",
    fontSize: 16,
    rounded: true,
    shadow: true,
    bordered: true,
    showCheckmarks: false,
  },
  render: DataTable,
};
