import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface ButtonGroupProps {
  alignment: string;
  gap: string;
  buttons: ReactNode;
}

const alignMap: Record<string, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

const gapMap: Record<string, string> = {
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
};

export const ButtonGroup = ({
  alignment = "left",
  gap = "md",
  buttons: Buttons,
}: ButtonGroupProps) => {
  const Slot = Buttons as unknown as React.FC<{ className?: string }>;
  return (
    <Slot
      className={cn(
        "flex flex-wrap items-center",
        alignMap[alignment],
        gapMap[gap],
      )}
    />
  );
};

export const buttonGroupConfig: ComponentConfig<ButtonGroupProps> = {
  label: "Button Group",
  fields: {
    buttons: {
      type: "slot",
      allow: ["Button"],
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
    gap: {
      type: "radio",
      label: "Gap",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
  },
  defaultProps: {
    alignment: "left",
    gap: "md",
    buttons: [],
  },
  render: ButtonGroup,
};
