import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface GridProps {
  columns: string;
  gap: string;
  content: ReactNode;
}

const columnsMap: Record<string, string> = {
  "1": "grid-cols-1",
  "2": "grid-cols-1 sm:grid-cols-2",
  "3": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  "4": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

const gapMap: Record<string, string> = {
  none: "gap-0",
  sm: "gap-3 md:gap-4",
  md: "gap-4 md:gap-6",
  lg: "gap-6 md:gap-8",
  xl: "gap-8 md:gap-10",
};

export const Grid = ({
  columns = "3",
  gap = "md",
  content: Content,
}: GridProps) => {
  const Slot = Content as unknown as React.FC<{
    style?: React.CSSProperties;
    className?: string;
  }>;
  return (
    <Slot className={cn("grid w-full", columnsMap[columns], gapMap[gap])} />
  );
};

export const gridConfig: ComponentConfig<GridProps> = {
  label: "Grid",
  fields: {
    content: { type: "slot" },
    columns: {
      type: "radio",
      label: "Columns",
      options: [
        { label: "1", value: "1" },
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
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
  },
  defaultProps: {
    columns: "3",
    gap: "md",
    content: [],
  },
  render: Grid,
};
