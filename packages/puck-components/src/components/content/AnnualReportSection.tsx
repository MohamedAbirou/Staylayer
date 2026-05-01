import type { ComponentConfig } from "@puckeditor/core";
import { backgroundColorField } from "../../lib/fields";

export interface AnnualReportSectionProps {
  backgroundColor: string;
}

/**
 * AnnualReportSection — puck-components render outputs a realistic visual
 * preview of the download form for the dashboard editor (mock fields, no
 * real submit logic).
 *
 * On the website, puckRenderer.js overrides this render with the real
 * AnnualReportForm component (which has full validation + download logic).
 */
export const AnnualReportSection = ({
  backgroundColor = "#ffffff",
}: AnnualReportSectionProps) => {
  return (
    <section className="py-12" style={{ backgroundColor }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mock form — visual only, not interactive */}
        <div className="max-w-2xl mx-auto p-6 mt-10 bg-white shadow-md rounded-lg">
          {/* First Name + Last Name row */}
          <div className="flex gap-6">
            <div className="flex-1">
              <div className="h-4 w-24 rounded bg-gray-200 mb-2" />
              <div className="h-10 w-full rounded border border-gray-300 bg-gray-50" />
            </div>
            <div className="flex-1">
              <div className="h-4 w-24 rounded bg-gray-200 mb-2" />
              <div className="h-10 w-full rounded border border-gray-300 bg-gray-50" />
            </div>
          </div>

          {/* Email row */}
          <div className="mt-4">
            <div className="h-4 w-32 rounded bg-gray-200 mb-2" />
            <div className="h-10 w-full rounded border border-gray-300 bg-gray-50" />
          </div>

          {/* Privacy note */}
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded bg-gray-100" />
            <div className="h-3 w-4/5 mx-auto rounded bg-gray-100" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-3 w-2/3 mx-auto rounded bg-gray-100" />
          </div>

          {/* Download button */}
          <div className="flex justify-center mt-6">
            <div className="h-11 w-36 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-semibold text-sm">Download</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export const annualReportSectionConfig: ComponentConfig<AnnualReportSectionProps> =
  {
    label: "Annual Report Section",
    fields: {
      backgroundColor: backgroundColorField,
    },
    defaultProps: {
      backgroundColor: "#ffffff",
    },
    render: AnnualReportSection,
  };
