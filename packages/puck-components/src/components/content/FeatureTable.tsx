import type { ComponentConfig } from "@puckeditor/core";
import { backgroundColorField, textColorField } from "../../lib/fields";

interface FeatureRow {
  name: string;
  description: string;
}

export interface FeatureTableProps {
  heading: string;
  subheading: string;
  features: FeatureRow[];
  showCheckIcon: boolean;
  checkIconColor: string;
  checkIconBgColor: string;
  headerBgColor: string;
  headerTextColor: string;
  rowOddBgColor: string;
  rowEvenBgColor: string;
  bodyTextColor: string;
  footerText: string;
  footerBgColor: string;
  rounded: boolean;
  shadow: boolean;
  bordered: boolean;
  col1Label: string;
  col2Label: string;
  // ── Heading typography ──
  headingColor: string;
  headingFontSize: number;
  headingWeight: string;
  // ── Subheading typography ──
  subheadingColor: string;
  subheadingFontSize: number;
  subheadingOpacity: number;
}

export const FeatureTable = ({
  heading = "One plan. Full feature set.",
  subheading = "Everything you need to run smarter and earn more.",
  features = [],
  showCheckIcon = true,
  checkIconColor = "#059669",
  checkIconBgColor = "#ecfdf5",
  headerBgColor = "#f9fafb",
  headerTextColor = "#374151",
  rowOddBgColor = "#ffffff",
  rowEvenBgColor = "#f9fafb",
  bodyTextColor = "#1f2937",
  footerText = "",
  footerBgColor = "#f9fafb",
  rounded = true,
  shadow = true,
  bordered = true,
  col1Label = "Feature",
  col2Label = "What you get",
  headingColor = "",
  headingFontSize = 0,
  headingWeight = "semibold",
  subheadingColor = "",
  subheadingFontSize = 0,
  subheadingOpacity = 80,
}: FeatureTableProps) => {
  return (
    <section className="mx-auto w-full px-4 py-12 sm:px-6 lg:px-8">
      {(heading || subheading) && (
        <div className="mx-auto mb-8 max-w-3xl text-center">
          {heading && (
            <h2
              style={{
                color: headingColor || undefined,
                ...(headingFontSize > 0
                  ? { fontSize: `${headingFontSize}px` }
                  : {}),
              }}
              className={`font-${headingWeight || "semibold"} tracking-tight ${headingFontSize === 0 ? " text-3xl" : ""}`}
            >
              {heading}
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
              className={`mt-3 text-gray-600 ${subheadingFontSize === 0 ? " text-base" : ""}`}
            >
              {subheading}
            </p>
          )}
        </div>
      )}

      <div
        className="overflow-hidden"
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
            <thead
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                background: headerBgColor,
              }}
            >
              <tr>
                <th
                  className="px-5 py-4 text-left text-sm font-medium"
                  style={{ color: headerTextColor }}
                >
                  {col1Label}
                </th>
                <th
                  className="px-5 py-4 text-left text-sm font-medium"
                  style={{ color: headerTextColor }}
                >
                  {col2Label}
                </th>
              </tr>
            </thead>
            <tbody style={{ color: bodyTextColor }}>
              {features.map((f, i) => (
                <tr
                  key={i}
                  style={{
                    background: i % 2 === 0 ? rowOddBgColor : rowEvenBgColor,
                  }}
                >
                  <td className="px-5 py-4 align-top font-medium">
                    <div className="flex items-start gap-2">
                      {showCheckIcon && (
                        <span
                          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                          style={{
                            background: checkIconBgColor,
                            color: checkIconColor,
                          }}
                        >
                          ✓
                        </span>
                      )}
                      <span>{f.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top opacity-80 text-sm">
                    {f.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {footerText && (
          <div
            className="border-t border-gray-200 px-5 py-4 text-sm text-gray-600"
            style={{ background: footerBgColor }}
          >
            {footerText}
          </div>
        )}
      </div>
    </section>
  );
};

export const featureTableConfig: ComponentConfig<FeatureTableProps> = {
  label: "Feature Table",
  fields: {
    heading: { type: "text", label: "Heading", contentEditable: true },
    subheading: {
      type: "textarea",
      label: "Subheading",
      contentEditable: true,
    },
    features: {
      type: "array",
      label: "Features",
      arrayFields: {
        name: { type: "text", label: "Feature Name" },
        description: { type: "textarea", label: "Description" },
      },
      defaultItemProps: {
        name: "Feature Name",
        description: "Brief description of what this feature does.",
      },
      getItemSummary: (item: FeatureRow) => item.name || "Feature",
    },
    col1Label: { type: "text", label: "Column 1 Header" },
    col2Label: { type: "text", label: "Column 2 Header" },
    showCheckIcon: {
      type: "radio",
      label: "Show Check Icon",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    checkIconColor: { ...textColorField, label: "Check Icon Color" },
    checkIconBgColor: {
      ...backgroundColorField,
      label: "Check Icon Background",
    },
    headerBgColor: { ...backgroundColorField, label: "Header Background" },
    headerTextColor: { ...textColorField, label: "Header Text Color" },
    rowOddBgColor: { ...backgroundColorField, label: "Odd Row Background" },
    rowEvenBgColor: { ...backgroundColorField, label: "Even Row Background" },
    bodyTextColor: { ...textColorField, label: "Body Text Color" },
    footerText: { type: "textarea", label: "Footer Note (optional)" },
    footerBgColor: { ...backgroundColorField, label: "Footer Background" },
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
  },
  defaultProps: {
    heading: "One plan. Full feature set.",
    subheading:
      "Everything you need to run smarter and earn more. No tiers, no guesswork.",
    features: [
      {
        name: "Multi-channel calendar sync",
        description:
          "Airbnb, Booking.com, Vrbo, Expedia and your direct site stay aligned. No double bookings.",
      },
      {
        name: "Direct booking website",
        description:
          "Fast, SEO-friendly site with real-time rates and availability. No commissions.",
      },
      {
        name: "Dynamic pricing",
        description:
          "Rates react to demand, season, local events, and lead time.",
      },
      {
        name: "Automated guest messaging",
        description:
          "Welcome notes, check-in guides, and review requests sent automatically.",
      },
      {
        name: "Secure payments",
        description:
          "Card and bank transfer processing with fraud checks and instant receipts.",
      },
      {
        name: "Owner statements",
        description: "Clear monthly statements with splits and notes.",
      },
    ],
    col1Label: "Feature",
    col2Label: "What you get",
    showCheckIcon: true,
    checkIconColor: "#059669",
    checkIconBgColor: "#ecfdf5",
    headerBgColor: "#f9fafb",
    headerTextColor: "#374151",
    rowOddBgColor: "#ffffff",
    rowEvenBgColor: "#f9fafb",
    bodyTextColor: "#1f2937",
    footerText: "",
    footerBgColor: "#f9fafb",
    rounded: true,
    shadow: true,
    bordered: true,
    headingColor: "",
    headingFontSize: 0,
    headingWeight: "semibold",
    subheadingColor: "",
    subheadingFontSize: 0,
    subheadingOpacity: 80,
  },
  render: FeatureTable,
};
