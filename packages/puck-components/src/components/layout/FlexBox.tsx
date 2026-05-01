import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import {
  resolvePaddingClasses,
  backgroundColorField,
  textColorField,
} from "../../lib/fields";
import { useScrollAnimation } from "../../lib/use-animation";
import {
  animationField,
  animationDurationField,
  animationDelayField,
} from "../../lib/animations";
import { cn } from "../../lib/cn";

export interface FlexBoxProps {
  direction: string;
  wrap: string;
  justifyContent: string;
  alignItems: string;
  alignContent: string;
  gap: number;
  rowGap: number;
  paddingY: string;
  paddingX: string;
  backgroundColor: string;
  textColor: string;
  minHeight: number;
  fullWidth: boolean;
  borderRadius: number;
  animation: string;
  animationDuration: string;
  animationDelay: string;
  children: ReactNode;
}

const directionMap: Record<string, string> = {
  row: "flex-row",
  column: "flex-col",
  "row-reverse": "flex-row-reverse",
  "column-reverse": "flex-col-reverse",
};

const wrapMap: Record<string, string> = {
  wrap: "flex-wrap",
  nowrap: "flex-nowrap",
  "wrap-reverse": "flex-wrap-reverse",
};

const justifyMap: Record<string, string> = {
  "flex-start": "justify-start",
  center: "justify-center",
  "flex-end": "justify-end",
  "space-between": "justify-between",
  "space-around": "justify-around",
  "space-evenly": "justify-evenly",
};

const alignItemsMap: Record<string, string> = {
  stretch: "items-stretch",
  "flex-start": "items-start",
  center: "items-center",
  "flex-end": "items-end",
  baseline: "items-baseline",
};

const alignContentMap: Record<string, string> = {
  normal: "",
  "flex-start": "content-start",
  center: "content-center",
  "flex-end": "content-end",
  "space-between": "content-between",
  "space-around": "content-around",
  stretch: "content-stretch",
};

export const FlexBox = ({
  direction = "row",
  wrap = "wrap",
  justifyContent = "flex-start",
  alignItems = "stretch",
  alignContent = "normal",
  gap = 16,
  rowGap = 0,
  paddingY = "none",
  paddingX = "none",
  backgroundColor = "",
  textColor = "",
  minHeight = 0,
  fullWidth = true,
  borderRadius = 0,
  animation = "none",
  animationDuration = "normal",
  animationDelay = "none",
  children: Children,
}: FlexBoxProps) => {
  const Slot = Children as unknown as React.FC;
  const {
    ref: animRef,
    animationClassName,
    style: animStyle,
  } = useScrollAnimation(animation, animationDuration, animationDelay);

  return (
    <div
      ref={animRef}
      className={cn(
        "flex w-full bg-(--bg) text-(--fg)",
        directionMap[direction],
        wrapMap[wrap],
        justifyMap[justifyContent],
        alignItemsMap[alignItems],
        alignContentMap[alignContent],
        "gap-x-(--col-gap) gap-y-(--row-gap)",
        minHeight > 0 && "min-h-(--min-h)",
        borderRadius > 0 && "rounded-(--radius)",
        !fullWidth && "w-auto",
        resolvePaddingClasses(paddingY, paddingX),
        animationClassName,
      )}
      style={
        {
          "--bg": backgroundColor || "transparent",
          "--fg": textColor || "inherit",
          "--col-gap": `${gap}px`,
          "--row-gap": `${rowGap > 0 ? rowGap : gap}px`,
          "--min-h": `${minHeight}px`,
          "--radius": `${borderRadius}px`,
          ...animStyle,
        } as React.CSSProperties
      }
    >
      <Slot />
    </div>
  );
};

export const flexBoxConfig: ComponentConfig<FlexBoxProps> = {
  label: "Flex Box",
  fields: {
    children: { type: "slot" },
    direction: {
      type: "radio",
      label: "Direction",
      options: [
        { label: "Row →", value: "row" },
        { label: "Column ↓", value: "column" },
        { label: "Row ←", value: "row-reverse" },
        { label: "Column ↑", value: "column-reverse" },
      ],
    },
    wrap: {
      type: "radio",
      label: "Wrap",
      options: [
        { label: "Wrap", value: "wrap" },
        { label: "No Wrap", value: "nowrap" },
        { label: "Wrap Reverse", value: "wrap-reverse" },
      ],
    },
    justifyContent: {
      type: "select",
      label: "Justify Content (main axis)",
      options: [
        { label: "Start", value: "flex-start" },
        { label: "Center", value: "center" },
        { label: "End", value: "flex-end" },
        { label: "Space Between", value: "space-between" },
        { label: "Space Around", value: "space-around" },
        { label: "Space Evenly", value: "space-evenly" },
      ],
    },
    alignItems: {
      type: "select",
      label: "Align Items (cross axis)",
      options: [
        { label: "Stretch", value: "stretch" },
        { label: "Start", value: "flex-start" },
        { label: "Center", value: "center" },
        { label: "End", value: "flex-end" },
        { label: "Baseline", value: "baseline" },
      ],
    },
    alignContent: {
      type: "select",
      label: "Align Content (multi-line)",
      options: [
        { label: "Normal", value: "normal" },
        { label: "Start", value: "flex-start" },
        { label: "Center", value: "center" },
        { label: "End", value: "flex-end" },
        { label: "Space Between", value: "space-between" },
        { label: "Space Around", value: "space-around" },
        { label: "Stretch", value: "stretch" },
      ],
    },
    gap: {
      type: "number",
      label: "Gap (px)",
      min: 0,
      max: 128,
    },
    rowGap: {
      type: "number",
      label: "Row Gap (px, 0 = same as Gap)",
      min: 0,
      max: 128,
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
    fullWidth: {
      type: "radio",
      label: "Width",
      options: [
        { label: "Full", value: true },
        { label: "Auto", value: false },
      ],
    },
    minHeight: {
      type: "number",
      label: "Min Height (px, 0 = auto)",
      min: 0,
      max: 1200,
    },
    borderRadius: {
      type: "number",
      label: "Border Radius (px)",
      min: 0,
      max: 100,
    },
    backgroundColor: backgroundColorField,
    textColor: textColorField,
    animation: animationField,
    animationDuration: animationDurationField,
    animationDelay: animationDelayField,
  },
  defaultProps: {
    direction: "row",
    wrap: "wrap",
    justifyContent: "flex-start",
    alignItems: "stretch",
    alignContent: "normal",
    gap: 16,
    rowGap: 0,
    paddingY: "none",
    paddingX: "none",
    backgroundColor: "",
    textColor: "",
    minHeight: 0,
    fullWidth: true,
    borderRadius: 0,
    animation: "none",
    animationDuration: "normal",
    animationDelay: "none",
    children: [],
  },
  render: FlexBox,
};
