import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { backgroundColorField, textColorField } from "../../lib/fields";
import { parseMarkup } from "../../lib/parse-markup";

export interface BannerProps {
  text: string;
  linkText: string;
  linkUrl: string;
  variant: string;
  size: string;
  dismissible: boolean;
  backgroundColor: string;
  textColor: string;
  icon: string;
}

const variantStyles: Record<string, string> = {
  subtle: "bg-gray-50 text-gray-700",
  accent: "bg-blue-600 text-white",
  gradient:
    "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white",
  warning: "bg-yellow-400 text-yellow-900",
  success: "bg-green-600 text-white",
  dark: "bg-gray-900 text-gray-100",
};

const sizeMap: Record<string, string> = {
  sm: "py-2 text-xs",
  md: "py-2.5 text-sm",
  lg: "py-3 text-sm",
};

const iconSvgs: Record<string, React.ReactNode> = {
  none: null,
  megaphone: (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46"
      />
    </svg>
  ),
  sparkle: (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
      />
    </svg>
  ),
  rocket: (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
      />
    </svg>
  ),
  gift: (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
      />
    </svg>
  ),
};

export const Banner = ({
  text = "🎉 We just launched our new feature!",
  linkText = "Learn more →",
  linkUrl = "#",
  variant = "accent",
  size = "md",
  backgroundColor = "",
  textColor = "",
  icon = "none",
  puck,
}: BannerProps & { puck?: { isEditing?: boolean } }) => {
  return (
    <div
      className={cn(
        "w-full px-4 md:px-6 z-50",
        backgroundColor ? "bg-(--bg)" : variantStyles[variant],
        textColor && "text-(--fg)",
        sizeMap[size],
      )}
      style={
        {
          ...(backgroundColor ? { "--bg": backgroundColor } : {}),
          ...(textColor ? { "--fg": textColor } : {}),
        } as React.CSSProperties
      }
      role="banner"
    >
      <div className="mx-auto flex max-w-screen-xl items-center justify-center gap-2">
        {icon !== "none" && iconSvgs[icon] && (
          <span className="shrink-0">{iconSvgs[icon]}</span>
        )}
        <p className="text-center font-medium">
          <span>{parseMarkup(text)}</span>
          {linkText && (
            <>
              {" "}
              {puck?.isEditing ? (
                <span className="font-semibold underline underline-offset-2 cursor-pointer">
                  {parseMarkup(linkText)}
                </span>
              ) : (
                <a
                  href={linkUrl}
                  className="font-semibold underline underline-offset-2 hover:no-underline"
                >
                  {parseMarkup(linkText)}
                </a>
              )}
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export const bannerConfig: ComponentConfig<BannerProps> = {
  label: "Banner",
  fields: {
    text: { type: "text", label: "Text", contentEditable: true },
    linkText: { type: "text", label: "Link Text", contentEditable: true },
    linkUrl: { type: "text", label: "Link URL" },
    icon: {
      type: "select",
      label: "Icon",
      options: [
        { label: "None", value: "none" },
        { label: "Megaphone", value: "megaphone" },
        { label: "Sparkle", value: "sparkle" },
        { label: "Rocket", value: "rocket" },
        { label: "Gift", value: "gift" },
      ],
    },
    variant: {
      type: "select",
      label: "Style",
      options: [
        { label: "Subtle (Gray)", value: "subtle" },
        { label: "Accent (Blue)", value: "accent" },
        { label: "Gradient", value: "gradient" },
        { label: "Warning (Yellow)", value: "warning" },
        { label: "Success (Green)", value: "success" },
        { label: "Dark", value: "dark" },
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
    dismissible: {
      type: "radio",
      label: "Dismissible",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    backgroundColor: backgroundColorField,
    textColor: textColorField,
  },
  defaultProps: {
    text: "🎉 We just launched our new feature!",
    linkText: "Learn more →",
    linkUrl: "#",
    variant: "accent",
    size: "md",
    dismissible: false,
    backgroundColor: "",
    textColor: "",
    icon: "none",
  },
  render: Banner,
};
