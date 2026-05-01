import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import React from "react";
import { backgroundColorField } from "../../lib/fields";

export interface SpacerProps {
  size: string;
  backgroundColor: string;
}

const sizeMap: Record<string, string> = {
  xs: "h-2",
  sm: "h-4",
  md: "h-8",
  lg: "h-12",
  xl: "h-16",
  "2xl": "h-24",
  "3xl": "h-32",
};

export const Spacer = ({ size = "md", backgroundColor = "" }: SpacerProps) => {
  return (
    <div
      className={cn("bg-(--bg)", sizeMap[size])}
      style={
        { "--bg": backgroundColor || "transparent" } as React.CSSProperties
      }
      aria-hidden="true"
    />
  );
};

export const spacerConfig: ComponentConfig<SpacerProps> = {
  label: "Spacer",
  fields: {
    size: {
      type: "select",
      label: "Size",
      options: [
        { label: "Extra Small", value: "xs" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
        { label: "2X Large", value: "2xl" },
        { label: "3X Large", value: "3xl" },
      ],
    },
    backgroundColor: backgroundColorField,
  },
  defaultProps: {
    size: "md",
    backgroundColor: "#ffffff",
  },
  render: Spacer,
};
