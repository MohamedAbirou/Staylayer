import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { backgroundColorField, imageField } from "../../lib/fields";

export interface CardProps {
  imageUrl: string;
  imageAlt: string;
  imagePosition: string;
  contentSpacing: number;
  contentAlignment: string;
  padding: string;
  rounded: string;
  shadow: string;
  bordered: boolean;
  backgroundColor: string;
  gradient: boolean;
  gradientFrom: string;
  gradientTo: string;
  gradientDirection: string;
  scaleOnHover: boolean;
  content: ReactNode;
}

const paddingMap: Record<string, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const roundedMap: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded",
  md: "rounded-lg",
  lg: "rounded-xl",
  xl: "rounded-2xl",
};

const shadowMap: Record<string, string> = {
  none: "",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
};

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

export const Card = ({
  imageUrl = "",
  imageAlt = "",
  imagePosition = "top",
  contentSpacing = 16,
  contentAlignment = "left",
  padding = "md",
  rounded = "lg",
  shadow = "sm",
  bordered = true,
  backgroundColor = "#ffffff",
  gradient = false,
  gradientFrom = "#3b82f6",
  gradientTo = "#8b5cf6",
  gradientDirection = "to-br",
  scaleOnHover = true,
  content: Content,
}: CardProps) => {
  const Slot = Content as unknown as React.FC;
  const hasImage = !!imageUrl;

  const bgStyle = gradient
    ? ({
        "--grad-from": gradientFrom,
        "--grad-to": gradientTo,
      } as React.CSSProperties)
    : ({ "--bg": backgroundColor || "#ffffff" } as React.CSSProperties);

  const alignItems =
    contentAlignment === "center"
      ? "center"
      : contentAlignment === "right"
        ? "flex-end"
        : "flex-start";

  return (
    <div
      className={cn(
        "overflow-hidden",
        scaleOnHover &&
          "hover:scale-105 hover:shadow-2xl transition-transform duration-300 ease-in-out",
        gradient
          ? cn(
              gradientDirMap[gradientDirection],
              "from-(--grad-from) to-(--grad-to)",
            )
          : "bg-(--bg)",
        roundedMap[rounded],
        shadowMap[shadow],
        bordered && "border border-gray-200",
        "transition-shadow duration-200",
      )}
      style={bgStyle}
    >
      {hasImage && imagePosition === "top" && (
        <img
          src={imageUrl}
          alt={imageAlt}
          className="h-48 w-full object-cover"
          loading="lazy"
        />
      )}
      <div
        className={cn("flex flex-col", paddingMap[padding])}
        style={{
          gap: `${contentSpacing}px`,
          alignItems,
          textAlign: contentAlignment as "left" | "center" | "right",
        }}
      >
        <Slot />
      </div>
    </div>
  );
};

export const cardConfig: ComponentConfig<CardProps> = {
  label: "Card",
  fields: {
    content: { type: "slot" },
    imageUrl: { ...imageField, label: "Cover Image (optional)" },
    imageAlt: { type: "text", label: "Image Alt Text" },
    imagePosition: {
      type: "radio",
      label: "Image Position",
      options: [
        { label: "Top", value: "top" },
        { label: "None", value: "none" },
      ],
    },
    contentSpacing: {
      type: "number",
      label: "Content Gap (px)",
      min: 0,
      max: 80,
    },
    contentAlignment: {
      type: "radio",
      label: "Content Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    padding: {
      type: "select",
      label: "Padding",
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
    shadow: {
      type: "radio",
      label: "Shadow",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
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
    scaleOnHover: {
      type: "radio",
      label: "Scale on Hover",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
  },
  defaultProps: {
    imageUrl: "",
    imageAlt: "",
    imagePosition: "top",
    contentSpacing: 16,
    contentAlignment: "left",
    padding: "md",
    rounded: "lg",
    shadow: "sm",
    bordered: true,
    backgroundColor: "#ffffff",
    gradient: false,
    gradientFrom: "#3b82f6",
    gradientTo: "#8b5cf6",
    gradientDirection: "to-br",
    scaleOnHover: true,
    content: [],
  },
  render: Card,
};
