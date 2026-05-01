import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import {
  resolvePaddingClasses,
  maxWidthMap,
  backgroundColorField,
} from "../../lib/fields";

const gradientDirMap: Record<string, string> = {
  "to-r": "bg-gradient-to-r",
  "to-br": "bg-gradient-to-br",
  "to-b": "bg-gradient-to-b",
  "to-bl": "bg-gradient-to-bl",
  "to-l": "bg-gradient-to-l",
  "to-tl": "bg-gradient-to-tl",
  "to-t": "bg-gradient-to-t",
  "to-tr": "bg-gradient-to-tr",
};

export interface ContainerProps {
  maxWidth: string;
  paddingX: string;
  paddingY: string;
  backgroundColor: string;
  gradient: boolean;
  gradientFrom: string;
  gradientTo: string;
  gradientDirection: string;
  rounded: string;
  content: ReactNode;
}

const roundedMap: Record<string, string> = {
  none: "",
  sm: "rounded",
  md: "rounded-lg",
  lg: "rounded-xl",
  xl: "rounded-2xl",
};

export const Container = ({
  maxWidth = "xl",
  paddingX = "md",
  paddingY = "none",
  backgroundColor = "",
  gradient = false,
  gradientFrom = "#3b82f6",
  gradientTo = "#8b5cf6",
  gradientDirection = "to-br",
  rounded = "none",
  content: Content,
}: ContainerProps) => {
  const Slot = Content as unknown as React.FC<{ className?: string }>;
  return (
    <div
      className={cn(
        "mx-auto w-full",
        maxWidthMap[maxWidth],
        resolvePaddingClasses(paddingY, paddingX),
        roundedMap[rounded],
        gradient
          ? cn(
              gradientDirMap[gradientDirection] ?? "bg-gradient-to-br",
              "from-(--grad-from) to-(--grad-to)",
            )
          : backgroundColor
            ? "bg-(--bg)"
            : "",
      )}
      style={
        gradient
          ? ({
              "--grad-from": gradientFrom,
              "--grad-to": gradientTo,
            } as React.CSSProperties)
          : ({
              "--bg": backgroundColor || "transparent",
            } as React.CSSProperties)
      }
    >
      <Slot />
    </div>
  );
};

export const containerConfig: ComponentConfig<ContainerProps> = {
  label: "Container",
  fields: {
    content: { type: "slot" },
    maxWidth: {
      type: "select",
      label: "Max Width",
      options: [
        { label: "Small (640px)", value: "sm" },
        { label: "Medium (768px)", value: "md" },
        { label: "Large (1024px)", value: "lg" },
        { label: "Extra Large (1280px)", value: "xl" },
        { label: "Full Width (1536px)", value: "2xl" },
        { label: "No Limit", value: "full" },
      ],
    },
    paddingX: {
      type: "select",
      label: "Horizontal Padding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
    paddingY: {
      type: "select",
      label: "Vertical Padding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
    rounded: {
      type: "select",
      label: "Corner Rounding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
    gradient: {
      type: "radio",
      label: "Background Type",
      options: [
        { label: "Solid", value: false },
        { label: "Gradient", value: true },
      ],
    },
    backgroundColor: backgroundColorField,
    gradientFrom: { ...backgroundColorField, label: "Gradient From" },
    gradientTo: { ...backgroundColorField, label: "Gradient To" },
    gradientDirection: {
      type: "select",
      label: "Gradient Direction",
      options: [
        { label: "→ Right", value: "to-r" },
        { label: "↘ Bottom-Right", value: "to-br" },
        { label: "↓ Bottom", value: "to-b" },
        { label: "↙ Bottom-Left", value: "to-bl" },
        { label: "← Left", value: "to-l" },
        { label: "↑ Top", value: "to-t" },
        { label: "↗ Top-Right", value: "to-tr" },
      ],
    },
  },
  defaultProps: {
    maxWidth: "xl",
    paddingX: "md",
    paddingY: "none",
    backgroundColor: "",
    gradient: false,
    gradientFrom: "#3b82f6",
    gradientTo: "#8b5cf6",
    gradientDirection: "to-br",
    rounded: "none",
    content: [],
  },
  render: Container,
};
