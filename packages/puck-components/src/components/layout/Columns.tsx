import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface ColumnsProps {
  layout: string;
  gap: string;
  alignItems: string;
  stackOnMobile: boolean;
  left: ReactNode;
  right: ReactNode;
}

// CSS custom-property values — consumed by grid-cols-(--col-ratio)
const colMap: Record<string, string> = {
  "50-50": "1fr 1fr",
  "33-67": "1fr 2fr",
  "67-33": "2fr 1fr",
  "25-75": "1fr 3fr",
  "75-25": "3fr 1fr",
  "40-60": "2fr 3fr",
  "60-40": "3fr 2fr",
};

const gapMap: Record<string, string> = {
  none: "gap-0",
  sm: "gap-4",
  md: "gap-6",
  lg: "gap-8",
  xl: "gap-12",
};

const alignMap: Record<string, string> = {
  top: "items-start",
  center: "items-center",
  bottom: "items-end",
  stretch: "items-stretch",
};

export const Columns = ({
  layout = "50-50",
  gap = "md",
  alignItems = "stretch",
  stackOnMobile = true,
  left: Left,
  right: Right,
}: ColumnsProps) => {
  const LeftSlot = Left as unknown as React.FC;
  const RightSlot = Right as unknown as React.FC;

  return (
    <div
      className={cn(
        "grid w-full",
        stackOnMobile
          ? "grid-cols-1 sm:grid-cols-(--col-ratio)"
          : "grid-cols-(--col-ratio)",
        gapMap[gap],
        alignMap[alignItems],
      )}
      style={
        { "--col-ratio": colMap[layout] ?? "1fr 1fr" } as React.CSSProperties
      }
    >
      <div className="min-w-0">
        <LeftSlot />
      </div>
      <div className="min-w-0">
        <RightSlot />
      </div>
    </div>
  );
};

export const columnsConfig: ComponentConfig<ColumnsProps> = {
  label: "Columns",
  fields: {
    left: { type: "slot" },
    right: { type: "slot" },
    layout: {
      type: "select",
      label: "Column Ratio",
      options: [
        { label: "Equal (50/50)", value: "50-50" },
        { label: "Narrow / Wide (33/67)", value: "33-67" },
        { label: "Wide / Narrow (67/33)", value: "67-33" },
        { label: "Sidebar / Content (25/75)", value: "25-75" },
        { label: "Content / Sidebar (75/25)", value: "75-25" },
        { label: "40 / 60", value: "40-60" },
        { label: "60 / 40", value: "60-40" },
      ],
    },
    gap: {
      type: "select",
      label: "Gap",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
    alignItems: {
      type: "radio",
      label: "Vertical Alignment",
      options: [
        { label: "Top", value: "top" },
        { label: "Center", value: "center" },
        { label: "Bottom", value: "bottom" },
        { label: "Stretch", value: "stretch" },
      ],
    },
    stackOnMobile: {
      type: "radio",
      label: "Mobile Layout",
      options: [
        { label: "Stack", value: true },
        { label: "Side by Side", value: false },
      ],
    },
  },
  defaultProps: {
    layout: "50-50",
    gap: "md",
    alignItems: "stretch",
    stackOnMobile: true,
    left: [],
    right: [],
  },
  render: Columns,
};
