import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { textColorField } from "../../lib/fields";
import { useScrollAnimation } from "../../lib/use-animation";
import {
  animationField,
  animationDurationField,
  animationDelayField,
} from "../../lib/animations";
import { parseMarkup } from "../../lib/parse-markup";

export interface HeadingProps {
  text: string;
  level: string;
  size: string;
  weight: string;
  alignment: string;
  color: string;
  letterSpacing: string;
  lineHeight: string;
  textTransform: string;
  maxWidth: string;
  animation: string;
  animationDuration: string;
  animationDelay: string;
  paddingY: string;
}

const sizeMap: Record<string, string> = {
  xs: "text-base md:text-lg",
  sm: "text-lg md:text-xl",
  md: "text-xl md:text-2xl",
  lg: "text-2xl md:text-3xl",
  xl: "text-3xl md:text-4xl",
  "2xl": "text-4xl md:text-5xl",
  "3xl": "text-5xl md:text-6xl",
  "4xl": "text-6xl md:text-7xl",
};

const weightMap: Record<string, string> = {
  light: "font-light",
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
  extrabold: "font-extrabold",
  black: "font-black",
};

const lineHeightMap: Record<string, string> = {
  none: "leading-none",
  tight: "leading-tight",
  snug: "leading-snug",
  normal: "leading-normal",
  relaxed: "leading-relaxed",
  loose: "leading-loose",
};

const alignMap: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const letterSpacingMap: Record<string, string> = {
  tighter: "tracking-tighter",
  tight: "tracking-tight",
  normal: "tracking-normal",
  wide: "tracking-wide",
  wider: "tracking-wider",
};

const transformMap: Record<string, string> = {
  none: "",
  uppercase: "uppercase",
  lowercase: "lowercase",
  capitalize: "capitalize",
};

const headingMaxWidthMap: Record<string, string> = {
  none: "",
  sm: "max-w-lg",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
};

const paddingYMap: Record<string, string> = {
  none: "",
  xs: "py-1",
  sm: "py-2",
  md: "py-4",
  lg: "py-8",
  xl: "py-12",
  "2xl": "py-16",
};

export const Heading = ({
  text = "Your Heading",
  level = "h2",
  size = "xl",
  weight = "bold",
  alignment = "left",
  lineHeight = "tight",
  color = "",
  letterSpacing = "tight",
  textTransform = "none",
  maxWidth = "none",
  animation = "none",
  animationDuration = "normal",
  animationDelay = "none",
  paddingY = "none",
}: HeadingProps) => {
  const Tag = level as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  const {
    ref: animRef,
    animationClassName,
    style: animStyle,
  } = useScrollAnimation(animation, animationDuration, animationDelay);

  const alignClass =
    alignment === "center" ? "mx-auto" : alignment === "right" ? "ml-auto" : "";

  const tagClassName = cn(
    sizeMap[size],
    weightMap[weight],
    alignMap[alignment],
    letterSpacingMap[letterSpacing],
    lineHeightMap[lineHeight],
    transformMap[textTransform],
  );
  const tagStyle = { "--fg": color || "inherit" } as React.CSSProperties;

  return (
    <div
      ref={animRef}
      className={cn(
        animationClassName,
        headingMaxWidthMap[maxWidth],
        paddingYMap[paddingY],
        alignClass,
      )}
      style={animStyle}
    >
      <Tag
        className={cn(tagClassName, "text-(--fg) leading-")}
        style={tagStyle}
      >
        {parseMarkup(text)}
      </Tag>
    </div>
  );
};

export const headingConfig: ComponentConfig<HeadingProps> = {
  label: "Heading",
  fields: {
    text: {
      type: "text",
      label: "Text",
      contentEditable: true,
    },
    level: {
      type: "select",
      label: "HTML Tag",
      options: [
        { label: "H1", value: "h1" },
        { label: "H2", value: "h2" },
        { label: "H3", value: "h3" },
        { label: "H4", value: "h4" },
        { label: "H5", value: "h5" },
        { label: "H6", value: "h6" },
      ],
    },
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
        { label: "4X Large", value: "4xl" },
      ],
    },
    weight: {
      type: "select",
      label: "Weight",
      options: [
        { label: "Light", value: "light" },
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
        { label: "Extra Bold", value: "extrabold" },
        { label: "Black", value: "black" },
      ],
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
    lineHeight: {
      type: "radio",
      label: "Line Height",
      options: [
        { label: "None", value: "none" },
        { label: "Tight", value: "tight" },
        { label: "Snug", value: "snug" },
        { label: "Normal", value: "normal" },
        { label: "Relaxed", value: "relaxed" },
        { label: "Loose", value: "loose" },
      ],
    },
    letterSpacing: {
      type: "select",
      label: "Letter Spacing",
      options: [
        { label: "Tighter", value: "tighter" },
        { label: "Tight", value: "tight" },
        { label: "Normal", value: "normal" },
        { label: "Wide", value: "wide" },
        { label: "Wider", value: "wider" },
      ],
    },
    textTransform: {
      type: "select",
      label: "Text Transform",
      options: [
        { label: "None", value: "none" },
        { label: "UPPERCASE", value: "uppercase" },
        { label: "lowercase", value: "lowercase" },
        { label: "Capitalize", value: "capitalize" },
      ],
    },
    maxWidth: {
      type: "select",
      label: "Max Width",
      options: [
        { label: "None", value: "none" },
        { label: "Narrow", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Wide", value: "lg" },
        { label: "Extra Wide", value: "xl" },
      ],
    },
    color: textColorField,
    paddingY: {
      type: "select",
      label: "Padding Y",
      options: [
        { label: "None", value: "none" },
        { label: "XS (4px)", value: "xs" },
        { label: "SM (8px)", value: "sm" },
        { label: "MD (16px)", value: "md" },
        { label: "LG (32px)", value: "lg" },
        { label: "XL (48px)", value: "xl" },
        { label: "2XL (64px)", value: "2xl" },
      ],
    },
    animation: animationField,
    animationDuration: animationDurationField,
    animationDelay: animationDelayField,
  },
  defaultProps: {
    text: "Your Heading",
    level: "h2",
    size: "xl",
    weight: "bold",
    alignment: "left",
    color: "",
    letterSpacing: "tight",
    lineHeight: "tight",
    textTransform: "none",
    maxWidth: "none",
    animation: "none",
    animationDuration: "normal",
    animationDelay: "none",
    paddingY: "none",
  },
  render: Heading,
};
