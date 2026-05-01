import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";

export interface SeparatorProps {
  orientation: string;
  variant: string;
  color: string;
  spacing: string;
  label: string;
  labelPosition: string;
}

const spacingMap: Record<string, string> = {
  none: "",
  sm: "my-2",
  md: "my-4",
  lg: "my-8",
  xl: "my-12",
};

const borderStyleMap: Record<string, string> = {
  solid: "border-t-solid",
  dashed: "border-t-dashed",
  dotted: "border-t-dotted",
};

const borderLeftStyleMap: Record<string, string> = {
  solid: "border-l-solid",
  dashed: "border-l-dashed",
  dotted: "border-l-dotted",
};

export const Separator = ({
  orientation = "horizontal",
  variant = "solid",
  color = "#e5e7eb",
  spacing = "md",
  label = "",
}: SeparatorProps) => {
  const colorVars = { "--sep-color": color } as React.CSSProperties;

  if (orientation === "vertical") {
    return (
      <div
        className={cn(
          "inline-block self-stretch mx-2 border-l border-l-(--sep-color) min-h-6",
          borderLeftStyleMap[variant],
        )}
        style={colorVars}
        role="separator"
        aria-orientation="vertical"
      />
    );
  }

  if (label) {
    return (
      <div
        className={cn("flex items-center gap-3", spacingMap[spacing])}
        role="separator"
        style={colorVars}
      >
        <div className="flex-1 h-px bg-(--sep-color)" />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider shrink-0">
          {label}
        </span>
        <div className="flex-1 h-px bg-(--sep-color)" />
      </div>
    );
  }

  return (
    <hr
      className={cn(
        "border-0 border-t border-t-(--sep-color)",
        borderStyleMap[variant],
        spacingMap[spacing],
      )}
      style={colorVars}
      role="separator"
    />
  );
};

export const separatorConfig: ComponentConfig<SeparatorProps> = {
  label: "Separator",
  fields: {
    orientation: {
      type: "radio",
      label: "Direction",
      options: [
        { label: "Horizontal", value: "horizontal" },
        { label: "Vertical", value: "vertical" },
      ],
    },
    variant: {
      type: "radio",
      label: "Style",
      options: [
        { label: "Solid", value: "solid" },
        { label: "Dashed", value: "dashed" },
        { label: "Dotted", value: "dotted" },
      ],
    },
    color: { type: "text", label: "Color" },
    spacing: {
      type: "select",
      label: "Spacing",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
    label: { type: "text", label: "Label Text (optional)" },
    labelPosition: {
      type: "radio",
      label: "Label Position",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
  },
  defaultProps: {
    orientation: "horizontal",
    variant: "solid",
    color: "#e5e7eb",
    spacing: "md",
    label: "",
    labelPosition: "center",
  },
  render: Separator,
};
