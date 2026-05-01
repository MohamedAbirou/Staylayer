import { useState, useEffect, useRef } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { backgroundColorField, textColorField } from "../../lib/fields";

export interface CountdownProps {
  targetDate: string;
  heading: string;
  description: string;
  showLabels: boolean;
  labelStyle: string;
  separator: string;
  size: string;
  alignment: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  completedText: string;
  headingColor: string;
  headingFontSize: number;
  headingWeight: string;
  descriptionColor: string;
  descriptionFontSize: number;
  descriptionOpacity: number;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(target: string): TimeLeft {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

const sizeStyles: Record<
  string,
  { number: string; label: string; gap: string }
> = {
  sm: {
    number: "text-2xl md:text-3xl",
    label: "text-xs",
    gap: "gap-3 md:gap-4",
  },
  md: {
    number: "text-3xl md:text-5xl",
    label: "text-xs md:text-sm",
    gap: "gap-4 md:gap-6",
  },
  lg: {
    number: "text-5xl md:text-7xl",
    label: "text-sm md:text-base",
    gap: "gap-6 md:gap-8",
  },
};

const alignMap: Record<string, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};

export const Countdown = ({
  targetDate = "",
  heading = "Launching Soon",
  description = "Get ready for something amazing.",
  showLabels = true,
  labelStyle = "full",
  separator = "colon",
  size = "md",
  alignment = "center",
  backgroundColor = "",
  textColor = "",
  accentColor = "#2563eb",
  completedText = "🎉 We're live!",
  headingColor = "",
  headingFontSize = 0,
  headingWeight = "bold",
  descriptionColor = "",
  descriptionFontSize = 0,
  descriptionOpacity = 70,
  puck,
}: CountdownProps & { puck?: { isEditing?: boolean } }) => {
  const defaultTarget = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const target = targetDate || defaultTarget;
  const [time, setTime] = useState<TimeLeft>(calcTimeLeft(target));
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    setTime(calcTimeLeft(target));
    intervalRef.current = setInterval(() => {
      setTime(calcTimeLeft(target));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [target]);

  const isComplete =
    time.days === 0 &&
    time.hours === 0 &&
    time.minutes === 0 &&
    time.seconds === 0;

  const styles = sizeStyles[size] || sizeStyles.md;

  const labels =
    labelStyle === "short"
      ? ["d", "h", "m", "s"]
      : ["Days", "Hours", "Minutes", "Seconds"];

  const units: { value: number; label: string }[] = [
    { value: time.days, label: labels[0] },
    { value: time.hours, label: labels[1] },
    { value: time.minutes, label: labels[2] },
    { value: time.seconds, label: labels[3] },
  ];

  const sepChar = separator === "colon" ? ":" : separator === "dot" ? "·" : "";

  return (
    <div
      className="w-full px-4 py-10 md:px-6 md:py-16 bg-(--bg)"
      style={
        {
          "--bg": backgroundColor || "transparent",
          "--fg": textColor || "inherit",
          "--accent": accentColor,
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          "mx-auto flex max-w-3xl flex-col gap-6",
          alignMap[alignment],
        )}
      >
        {heading && (
          <h2
            style={{
              color: headingColor || textColor || undefined,
              ...(headingFontSize > 0
                ? { fontSize: `${headingFontSize}px` }
                : {}),
            }}
            className={`font-${headingWeight || "bold"} ${headingFontSize === 0 ? " text-2xl md:text-3xl" : ""}`}
          >
            {heading}
          </h2>
        )}
        {description && (
          <p
            style={{
              color: descriptionColor || textColor || undefined,
              opacity: descriptionOpacity / 100,
              ...(descriptionFontSize > 0
                ? { fontSize: `${descriptionFontSize}px` }
                : {}),
            }}
            className={descriptionFontSize === 0 ? "text-base md:text-lg" : ""}
          >
            {description}
          </p>
        )}

        {isComplete && !puck?.isEditing ? (
          <p className="text-2xl font-bold md:text-4xl text-(--accent)">
            {completedText}
          </p>
        ) : (
          <div className={cn("flex items-center", styles.gap)}>
            {units.map((unit, i) => (
              <div key={i} className="flex items-center gap-inherit">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "font-extrabold tabular-nums text-(--accent)",
                      styles.number,
                    )}
                  >
                    {String(unit.value).padStart(2, "0")}
                  </span>
                  {showLabels && (
                    <span
                      className={cn(
                        "mt-1 font-medium uppercase tracking-wider opacity-60 text-(--fg)",
                        styles.label,
                      )}
                    >
                      {unit.label}
                    </span>
                  )}
                </div>
                {sepChar && i < units.length - 1 && (
                  <span
                    className={cn(
                      "font-bold opacity-30 mx-1 text-(--fg)",
                      styles.number,
                    )}
                  >
                    {sepChar}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const countdownConfig: ComponentConfig<CountdownProps> = {
  label: "Countdown",
  fields: {
    targetDate: { type: "text", label: "Target Date (YYYY-MM-DD)" },
    heading: { type: "text", label: "Heading", contentEditable: true },
    description: { type: "text", label: "Description", contentEditable: true },
    completedText: {
      type: "text",
      label: "Completed Text",
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
    alignment: {
      type: "radio",
      label: "Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    showLabels: {
      type: "radio",
      label: "Show Labels",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    labelStyle: {
      type: "radio",
      label: "Label Style",
      options: [
        { label: "Full", value: "full" },
        { label: "Short", value: "short" },
      ],
    },
    separator: {
      type: "radio",
      label: "Separator",
      options: [
        { label: "Colon :", value: "colon" },
        { label: "Dot ·", value: "dot" },
        { label: "None", value: "none" },
      ],
    },
    accentColor: { ...textColorField, label: "Number Color" },
    backgroundColor: backgroundColorField,
    textColor: textColorField,
    headingColor: { ...textColorField, label: "Heading Color" },
    headingFontSize: {
      type: "number",
      label: "Heading Font Size (px, 0 = auto)",
      min: 0,
      max: 120,
    },
    headingWeight: {
      type: "select",
      label: "Heading Font Weight",
      options: [
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
        { label: "Extrabold", value: "extrabold" },
      ],
    },
    descriptionColor: { ...textColorField, label: "Description Color" },
    descriptionFontSize: {
      type: "number",
      label: "Description Font Size (px, 0 = auto)",
      min: 0,
      max: 80,
    },
    descriptionOpacity: {
      type: "number",
      label: "Description Opacity (0–100)",
      min: 0,
      max: 100,
    },
  },
  defaultProps: {
    targetDate: "",
    heading: "Launching Soon",
    description: "Get ready for something amazing.",
    showLabels: true,
    labelStyle: "full",
    separator: "colon",
    size: "md",
    alignment: "center",
    backgroundColor: "",
    textColor: "",
    accentColor: "#2563eb",
    completedText: "🎉 We're live!",
    headingColor: "",
    headingFontSize: 0,
    headingWeight: "bold",
    descriptionColor: "",
    descriptionFontSize: 0,
    descriptionOpacity: 70,
  },
  render: Countdown,
};
