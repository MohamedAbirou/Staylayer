import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import {
  resolvePaddingClasses,
  maxWidthMap,
  backgroundColorField,
  imageField,
} from "../../lib/fields";
import { useScrollAnimation } from "../../lib/use-animation";
import {
  animationField,
  animationDurationField,
  animationDelayField,
} from "../../lib/animations";

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

export interface SectionProps {
  backgroundColor: string;
  backgroundImage: string;
  overlayOpacity: number;
  gradient: boolean;
  gradientFrom: string;
  gradientTo: string;
  gradientDirection: string;
  paddingY: string;
  paddingX: string;
  fullWidth: boolean;
  maxWidth: string;
  borderTop: boolean;
  borderBottom: boolean;
  animation: string;
  animationDuration: string;
  animationDelay: string;
  content: ReactNode;
}

export const Section = ({
  backgroundColor = "",
  backgroundImage = "",
  overlayOpacity = 50,
  gradient = false,
  gradientFrom = "#3b82f6",
  gradientTo = "#8b5cf6",
  gradientDirection = "to-br",
  paddingY = "lg",
  paddingX = "lg",
  fullWidth = false,
  maxWidth = "xl",
  borderTop = false,
  borderBottom = false,
  animation = "none",
  animationDuration = "normal",
  animationDelay = "none",
  content: Content,
}: SectionProps) => {
  const Slot = Content as unknown as React.FC<{ className?: string }>;
  const {
    ref: animRef,
    animationClassName,
    style: animStyle,
  } = useScrollAnimation(animation, animationDuration, animationDelay);

  return (
    <section
      ref={animRef}
      className={cn(
        "relative w-full",
        resolvePaddingClasses(paddingY, paddingX),
        animationClassName,
        borderTop && "border-t border-gray-200",
        borderBottom && "border-b border-gray-200",
      )}
      style={
        {
          "--bg": backgroundColor || "transparent",
          "--grad-from": gradientFrom,
          "--grad-to": gradientTo,
          ...animStyle,
        } as React.CSSProperties
      }
    >
      {/* Background layer: gradient or solid colour */}
      {gradient ? (
        <div
          className={cn(
            "absolute inset-0",
            gradientDirMap[gradientDirection] ?? "bg-gradient-to-br",
            "from-(--grad-from) to-(--grad-to)",
          )}
          aria-hidden="true"
        />
      ) : (
        <div className="bg-(--bg) absolute inset-0" aria-hidden="true" />
      )}

      {backgroundImage && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
          <div
            className="absolute inset-0 bg-(--overlay)"
            style={
              {
                "--overlay": `rgba(0,0,0,${overlayOpacity / 100})`,
              } as React.CSSProperties
            }
          />
        </>
      )}
      <div
        className={cn(
          "relative z-10 px-4",
          !fullWidth && cn("mx-auto", maxWidthMap[maxWidth]),
        )}
      >
        <Slot />
      </div>
    </section>
  );
};

export const sectionConfig: ComponentConfig<SectionProps> = {
  label: "Section",
  fields: {
    content: { type: "slot" },
    paddingX: {
      type: "select",
      label: "Horizontal Padding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
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
        { label: "Extra Large", value: "xl" },
        { label: "2XL", value: "2xl" },
        { label: "3XL", value: "3xl" },
        { label: "4XL", value: "4xl" },
        { label: "5XL", value: "5xl" },
        { label: "6XL", value: "6xl" },
      ],
    },
    fullWidth: {
      type: "radio",
      label: "Width",
      options: [
        { label: "Contained", value: false },
        { label: "Full Width", value: true },
      ],
    },
    maxWidth: {
      type: "select",
      label: "Max Width",
      options: [
        { label: "Small (640px)", value: "sm" },
        { label: "Medium (768px)", value: "md" },
        { label: "Large (1024px)", value: "lg" },
        { label: "Extra Large (1280px)", value: "xl" },
        { label: "2XL (1536px)", value: "2xl" },
        { label: "Full", value: "full" },
      ],
    },
    borderTop: {
      type: "radio",
      label: "Top Border",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    borderBottom: {
      type: "radio",
      label: "Bottom Border",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    gradient: {
      type: "radio",
      label: "Background Type",
      options: [
        { label: "Solid Color", value: false },
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
    backgroundImage: {
      ...imageField,
      label: "Background Image",
    },
    overlayOpacity: {
      type: "number",
      label: "Overlay Darkness (%)",
      min: 0,
      max: 100,
    },
    animation: animationField,
    animationDuration: animationDurationField,
    animationDelay: animationDelayField,
  },
  defaultProps: {
    backgroundColor: "",
    backgroundImage: "",
    overlayOpacity: 50,
    gradient: false,
    gradientFrom: "#3b82f6",
    gradientTo: "#8b5cf6",
    gradientDirection: "to-br",
    paddingX: "lg",
    paddingY: "lg",
    fullWidth: false,
    maxWidth: "xl",
    borderTop: false,
    borderBottom: false,
    animation: "none",
    animationDuration: "normal",
    animationDelay: "none",
    content: [],
  },
  render: Section,
};
