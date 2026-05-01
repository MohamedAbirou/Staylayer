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

export interface ParagraphProps {
  text: string;
  size: string;
  weight: string;
  alignment: string;
  color: string;
  maxWidth: string;
  lineHeight: string;
  opacity: string;
  animation: string;
  animationDuration: string;
  animationDelay: string;
  paddingY: string;
}

const sizeMap: Record<string, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
};

const weightMap: Record<string, string> = {
  light: "font-light",
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
};

const alignMap: Record<string, string> = {
  left: "text-left",
  center: "text-center mx-auto",
  right: "text-right ml-auto",
};

const paraMaxWidthMap: Record<string, string> = {
  none: "",
  xs: "max-w-md",
  sm: "max-w-lg",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
};

const lineHeightMap: Record<string, string> = {
  none: "leading-none",
  tight: "leading-tight",
  snug: "leading-snug",
  normal: "leading-normal",
  relaxed: "leading-relaxed",
  loose: "leading-loose",
};

const opacityMap: Record<string, string> = {
  "100": "",
  "90": "opacity-90",
  "80": "opacity-80",
  "70": "opacity-70",
  "60": "opacity-60",
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

export const Paragraph = ({
  text = "Write your paragraph text here. This is a flexible text component you can use anywhere on your page.",
  size = "md",
  weight = "normal",
  alignment = "left",
  color = "",
  maxWidth = "none",
  lineHeight = "tight",
  opacity = "100",
  animation = "none",
  animationDuration = "normal",
  animationDelay = "none",
  paddingY = "none",
}: ParagraphProps) => {
  const {
    ref: animRef,
    animationClassName,
    style: animStyle,
  } = useScrollAnimation(animation, animationDuration, animationDelay);

  const pClassName = cn(
    sizeMap[size],
    weightMap[weight],
    alignMap[alignment],
    paraMaxWidthMap[maxWidth],
    lineHeightMap[lineHeight],
    opacityMap[opacity],
  );
  const pStyle = { "--fg": color || "inherit" } as React.CSSProperties;

  return (
    <div
      ref={animRef}
      className={cn(animationClassName, paddingYMap[paddingY])}
      style={animStyle}
    >
      <p className={cn(pClassName, "text-(--fg)")} style={pStyle}>
        {parseMarkup(text)}
      </p>
    </div>
  );
};

export const paragraphConfig: ComponentConfig<ParagraphProps> = {
  label: "Paragraph",
  fields: {
    text: {
      type: "textarea",
      label: "Text",
      contentEditable: true,
    },
    size: {
      type: "radio",
      label: "Size",
      options: [
        { label: "XS", value: "xs" },
        { label: "SM", value: "sm" },
        { label: "MD", value: "md" },
        { label: "LG", value: "lg" },
        { label: "XL", value: "xl" },
        { label: "2XL", value: "2xl" },
      ],
    },
    weight: {
      type: "radio",
      label: "Weight",
      options: [
        { label: "Light", value: "light" },
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
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
    color: textColorField,
    maxWidth: {
      type: "select",
      label: "Max Width",
      options: [
        { label: "None", value: "none" },
        { label: "Extra Narrow", value: "xs" },
        { label: "Narrow", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Wide", value: "lg" },
        { label: "Extra Wide", value: "xl" },
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
    opacity: {
      type: "select",
      label: "Opacity",
      options: [
        { label: "100%", value: "100" },
        { label: "90%", value: "90" },
        { label: "80%", value: "80" },
        { label: "70%", value: "70" },
        { label: "60%", value: "60" },
      ],
    },
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
    text: "Write your paragraph text here. This is a flexible text component you can use anywhere on your page.",
    size: "md",
    weight: "normal",
    alignment: "left",
    color: "",
    maxWidth: "none",
    lineHeight: "tight",
    opacity: "100",
    animation: "none",
    animationDuration: "normal",
    animationDelay: "none",
    paddingY: "none",
  },
  render: Paragraph,
};
