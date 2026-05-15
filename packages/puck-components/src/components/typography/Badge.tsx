import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { parseMarkup } from "../../lib/parse-markup";

export interface BadgeProps {
  text: string;
  variant: string;
  size: string;
}

const variantMap: Record<string, string> = {
  primary: "bg-blue-100 text-blue-800",
  secondary: "bg-gray-100 text-gray-800",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  danger: "bg-red-100 text-red-800",
  purple: "bg-purple-100 text-purple-800",
};

const sizeMap: Record<string, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1 text-sm",
};

export const Badge = ({
  text = "Badge",
  variant = "primary",
  size = "md",
}: BadgeProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        variantMap[variant],
        sizeMap[size],
      )}
    >
      {parseMarkup(text)}
    </span>
  );
};

export const badgeConfig: ComponentConfig<BadgeProps> = {
  label: "Badge",
  fields: {
    text: {
      type: "text",
      label: "Text",
      contentEditable: true,
    },
    variant: {
      type: "select",
      label: "Style",
      options: [
        { label: "Primary (Blue)", value: "primary" },
        { label: "Secondary (Gray)", value: "secondary" },
        { label: "Success (Green)", value: "success" },
        { label: "Warning (Yellow)", value: "warning" },
        { label: "Danger (Red)", value: "danger" },
        { label: "Purple", value: "purple" },
      ],
    },
    size: {
      type: "radio",
      label: "Size",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
  },
  defaultProps: {
    text: "Badge",
    variant: "primary",
    size: "md",
  },
  render: Badge,
};
