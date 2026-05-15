import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { useScrollAnimation } from "../../lib/use-animation";
import {
  animationField,
  animationDurationField,
  animationDelayField,
} from "../../lib/animations";
import { parseMarkup } from "../../lib/parse-markup";

export interface AlertProps {
  variant: string;
  title: string;
  description: string;
  icon: string;
  bordered: boolean;
  rounded: string;
  animation: string;
  animationDuration: string;
  animationDelay: string;
}

const variantStyles: Record<
  string,
  { bg: string; border: string; text: string; icon: string }
> = {
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    icon: "text-blue-500",
  },
  success: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
    icon: "text-green-500",
  },
  warning: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-800",
    icon: "text-yellow-500",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    icon: "text-red-500",
  },
  neutral: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-800",
    icon: "text-gray-500",
  },
};

const iconSvgs: Record<string, React.ReactNode> = {
  info: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
    </svg>
  ),
  success: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  warning: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  ),
  error: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
      />
    </svg>
  ),
  neutral: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
      />
    </svg>
  ),
};

const roundedMap: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
};

export const Alert = ({
  variant = "info",
  title = "Heads up!",
  description = "This is an informational alert to draw attention to important content.",
  icon = "auto",
  bordered = true,
  rounded = "lg",
  animation = "none",
  animationDuration = "normal",
  animationDelay = "none",
}: AlertProps) => {
  const styles = variantStyles[variant] || variantStyles.info;
  const iconKey = icon === "auto" ? variant : icon;
  const {
    ref: animRef,
    animationClassName,
    style: animStyle,
  } = useScrollAnimation(animation, animationDuration, animationDelay);

  return (
    <div
      ref={animRef}
      className={cn(
        "flex gap-3 p-4",
        styles.bg,
        bordered && `border ${styles.border}`,
        roundedMap[rounded],
        animationClassName,
      )}
      style={animStyle}
      role="alert"
    >
      {icon !== "none" && (
        <div className={cn("shrink-0 mt-0.5", styles.icon)}>
          {iconSvgs[iconKey] || iconSvgs.info}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {title && (
          <h5 className={cn("text-sm font-semibold mb-0.5", styles.text)}>
            {parseMarkup(title)}
          </h5>
        )}
        {((description as any)?.props?.value || !description) && (
          <p className={cn("text-sm opacity-90", styles.text)}>
            {parseMarkup(description)}
          </p>
        )}
      </div>
    </div>
  );
};

export const alertConfig: ComponentConfig<AlertProps> = {
  label: "Alert",
  fields: {
    variant: {
      type: "select",
      label: "Variant",
      options: [
        { label: "Info (Blue)", value: "info" },
        { label: "Success (Green)", value: "success" },
        { label: "Warning (Yellow)", value: "warning" },
        { label: "Error (Red)", value: "error" },
        { label: "Neutral (Gray)", value: "neutral" },
      ],
    },
    title: { type: "text", label: "Title", contentEditable: true },
    description: {
      type: "textarea",
      label: "Description",
      contentEditable: true,
    },
    icon: {
      type: "select",
      label: "Icon",
      options: [
        { label: "Auto (match variant)", value: "auto" },
        { label: "Info", value: "info" },
        { label: "Success", value: "success" },
        { label: "Warning", value: "warning" },
        { label: "Error", value: "error" },
        { label: "None", value: "none" },
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
    rounded: {
      type: "select",
      label: "Rounding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
    animation: animationField,
    animationDuration: animationDurationField,
    animationDelay: animationDelayField,
  },
  defaultProps: {
    variant: "info",
    title: "Heads up!",
    description:
      "This is an informational alert to draw attention to important content.",
    icon: "auto",
    bordered: true,
    rounded: "lg",
    animation: "none",
    animationDuration: "normal",
    animationDelay: "none",
  },
  render: Alert,
};
