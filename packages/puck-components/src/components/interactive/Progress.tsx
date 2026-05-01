import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { textColorField } from "../../lib/fields";
import { useScrollAnimation } from "../../lib/use-animation";
import {
  animationField,
  animationDurationField,
  animationDelayField,
} from "../../lib/animations";

export interface ProgressProps {
  value: number;
  max: number;
  label: string;
  showValue: boolean;
  valueFormat: string;
  size: string;
  color: string;
  trackColor: string;
  rounded: string;
  striped: boolean;
  animated: boolean;
  animation: string;
  animationDuration: string;
  animationDelay: string;
}

const sizeMap: Record<string, string> = {
  xs: "h-1",
  sm: "h-2",
  md: "h-3",
  lg: "h-4",
  xl: "h-6",
};

const roundedMap: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded",
  lg: "rounded-md",
  full: "rounded-full",
};

export const Progress = ({
  value = 60,
  max = 100,
  label = "",
  showValue = true,
  valueFormat = "percent",
  size = "md",
  color = "#2563eb",
  trackColor = "#e5e7eb",
  rounded = "full",
  striped = false,
  animated = false,
  animation = "none",
  animationDuration = "normal",
  animationDelay = "none",
}: ProgressProps) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const {
    ref: animRef,
    animationClassName,
    style: animStyle,
  } = useScrollAnimation(animation, animationDuration, animationDelay);

  const displayValue =
    valueFormat === "percent"
      ? `${Math.round(pct)}%`
      : valueFormat === "fraction"
        ? `${value}/${max}`
        : `${value}`;

  return (
    <div
      ref={animRef}
      className={cn("w-full", animationClassName)}
      style={
        {
          ...animStyle,
          "--bar": color,
          "--track": trackColor,
        } as React.CSSProperties
      }
    >
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="text-sm font-medium text-gray-700">{label}</span>
          )}
          {showValue && (
            <span className="text-sm font-medium text-gray-500">
              {displayValue}
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          "w-full overflow-hidden bg-(--track)",
          sizeMap[size],
          roundedMap[rounded],
        )}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out bg-(--bar) w-(--bar-w)",
            roundedMap[rounded],
            striped &&
              "bg-[length:1rem_1rem] bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)]",
            animated &&
              striped &&
              "animate-[progress-stripes_1s_linear_infinite]",
          )}
          style={{ "--bar-w": `${pct}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
};

export const progressConfig: ComponentConfig<ProgressProps> = {
  label: "Progress",
  fields: {
    value: { type: "number", label: "Value", min: 0 },
    max: { type: "number", label: "Maximum", min: 1 },
    label: { type: "text", label: "Label (optional)" },
    showValue: {
      type: "radio",
      label: "Show Value",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    valueFormat: {
      type: "radio",
      label: "Value Format",
      options: [
        { label: "Percent", value: "percent" },
        { label: "Fraction", value: "fraction" },
        { label: "Number", value: "number" },
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
      ],
    },
    color: { ...textColorField, label: "Bar Color" },
    trackColor: { type: "text", label: "Track Color" },
    rounded: {
      type: "select",
      label: "Corner Rounding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Full", value: "full" },
      ],
    },
    striped: {
      type: "radio",
      label: "Striped",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    animated: {
      type: "radio",
      label: "Animate Stripes",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    animation: animationField,
    animationDuration: animationDurationField,
    animationDelay: animationDelayField,
  },
  defaultProps: {
    value: 60,
    max: 100,
    label: "",
    showValue: true,
    valueFormat: "percent",
    size: "md",
    color: "#2563eb",
    trackColor: "#e5e7eb",
    rounded: "full",
    striped: false,
    animated: false,
    animation: "none",
    animationDuration: "normal",
    animationDelay: "none",
  },
  render: Progress,
};
