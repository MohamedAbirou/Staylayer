import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { backgroundColorField, textColorField } from "../../lib/fields";

export interface ButtonProps {
  label: string;
  url: string;
  variant: string;
  size: string;
  rounded: string;
  fullWidth: boolean;
  openInNewTab: boolean;
  icon: string;
  iconPosition: string;
  backgroundColor: string;
  textColor: string;
  hoverBackgroundColor: string;
  hoverTextColor: string;
  shadow: string;
  // Custom spacing
  customPaddingX: number;
  customPaddingY: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}

const variantBase: Record<string, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500",
  outline:
    "border border-gray-100 text-white hover:text-gray-800 hover:bg-gray-50 hover:border-gray-400 focus:ring-gray-300 bg-transparent",
  ghost: "text-gray-700 hover:bg-gray-100 focus:ring-gray-500 bg-transparent",
  white:
    "bg-white text-gray-900 hover:bg-gray-50 focus:ring-gray-200 shadow-sm",
  dark: "bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-700",
  gradient:
    "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 focus:ring-blue-500",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
  link: "text-blue-600 hover:text-blue-800 underline-offset-4 hover:underline bg-transparent p-0",
};

const sizeMap: Record<string, string> = {
  xs: "px-2.5 py-1 text-xs",
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
  xl: "px-8 py-4 text-lg",
};

const roundedMap: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
};

const shadowMap: Record<string, string> = {
  none: "",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
};

const iconSvgs: Record<string, React.ReactNode> = {
  none: null,
  arrow_right: (
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
        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
      />
    </svg>
  ),
  arrow_left: (
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
        d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
      />
    </svg>
  ),
  external: (
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
        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
      />
    </svg>
  ),
  download: (
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
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  ),
  play: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
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
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  ),
  check: (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  ),
  mail: (
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
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  ),
  phone: (
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
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
      />
    </svg>
  ),
};

export const Button = ({
  label = "Get Started",
  url = "#",
  variant = "primary",
  size = "md",
  rounded = "lg",
  fullWidth = false,
  openInNewTab = false,
  icon = "none",
  iconPosition = "right",
  backgroundColor = "",
  textColor = "",
  hoverBackgroundColor = "",
  hoverTextColor = "",
  shadow = "none",
  customPaddingX = 0,
  customPaddingY = 0,
  marginTop = 0,
  marginRight = 0,
  marginBottom = 0,
  marginLeft = 0,
  puck,
}: ButtonProps & { id?: string; puck?: { isEditing?: boolean } }) => {
  const Tag = puck?.isEditing ? "button" : "a";
  const linkProps = puck?.isEditing
    ? {
        type: "button" as const,
        onClick: (e: React.MouseEvent) => e.preventDefault(),
      }
    : {
        href: url,
        ...(openInNewTab
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {}),
      };

  const iconEl = iconSvgs[icon] || null;

  const customStyle = {
    "--custom-bg": backgroundColor || undefined,
    "--custom-fg": textColor || undefined,
    "--btn-hover-bg": hoverBackgroundColor || undefined,
    "--btn-hover-fg": hoverTextColor || undefined,
    ...(customPaddingX > 0
      ? {
          paddingLeft: `${customPaddingX}px`,
          paddingRight: `${customPaddingX}px`,
        }
      : {}),
    ...(customPaddingY > 0
      ? {
          paddingTop: `${customPaddingY}px`,
          paddingBottom: `${customPaddingY}px`,
        }
      : {}),
    ...(marginTop > 0 ? { marginTop: `${marginTop}px` } : {}),
    ...(marginRight > 0 ? { marginRight: `${marginRight}px` } : {}),
    ...(marginBottom > 0 ? { marginBottom: `${marginBottom}px` } : {}),
    ...(marginLeft > 0 ? { marginLeft: `${marginLeft}px` } : {}),
  };

  return (
    <Tag
      {...linkProps}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        variant !== "link" && roundedMap[rounded],
        variantBase[variant],
        variant !== "link" && sizeMap[size],
        shadowMap[shadow],
        fullWidth && "w-full",
        backgroundColor && "bg-(--custom-bg)",
        textColor && "text-(--custom-fg)",
        hoverBackgroundColor && "[&:hover]:bg-(--btn-hover-bg)",
        hoverTextColor && "[&:hover]:text-(--btn-hover-fg)",
      )}
      style={customStyle as React.CSSProperties}
    >
      {iconEl && iconPosition === "left" && iconEl}
      <span>{label}</span>
      {iconEl && iconPosition === "right" && iconEl}
    </Tag>
  );
};

export const buttonConfig: ComponentConfig<ButtonProps> = {
  label: "Button",
  fields: {
    label: {
      type: "text",
      label: "Label",
      contentEditable: true,
    },
    url: {
      type: "text",
      label: "Link URL",
    },
    variant: {
      type: "select",
      label: "Style",
      options: [
        { label: "Primary (Blue)", value: "primary" },
        { label: "Secondary (Gray)", value: "secondary" },
        { label: "Outline", value: "outline" },
        { label: "Ghost (Subtle)", value: "ghost" },
        { label: "White", value: "white" },
        { label: "Dark", value: "dark" },
        { label: "Gradient", value: "gradient" },
        { label: "Danger (Red)", value: "danger" },
        { label: "Success (Green)", value: "success" },
        { label: "Link (Text only)", value: "link" },
      ],
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
        { label: "Pill", value: "full" },
      ],
    },
    icon: {
      type: "select",
      label: "Icon",
      options: [
        { label: "None", value: "none" },
        { label: "Arrow Right →", value: "arrow_right" },
        { label: "Arrow Left ←", value: "arrow_left" },
        { label: "External Link", value: "external" },
        { label: "Download", value: "download" },
        { label: "Play ▶", value: "play" },
        { label: "Sparkle ✨", value: "sparkle" },
        { label: "Checkmark ✓", value: "check" },
        { label: "Email ✉", value: "mail" },
        { label: "Phone", value: "phone" },
      ],
    },
    iconPosition: {
      type: "radio",
      label: "Icon Position",
      options: [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ],
    },
    fullWidth: {
      type: "radio",
      label: "Width",
      options: [
        { label: "Auto", value: false },
        { label: "Full Width", value: true },
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
    openInNewTab: {
      type: "radio",
      label: "Open in New Tab",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    backgroundColor: {
      ...backgroundColorField,
      label: "Custom Background",
    },
    textColor: {
      ...textColorField,
      label: "Custom Text Color",
    },
    hoverBackgroundColor: {
      ...backgroundColorField,
      label: "Hover Background Color",
    },
    hoverTextColor: {
      ...textColorField,
      label: "Hover Text Color",
    },
    // ── Custom padding ──
    customPaddingX: {
      type: "number",
      label: "Custom Padding X (px, 0 = use size preset)",
      min: 0,
      max: 120,
    },
    customPaddingY: {
      type: "number",
      label: "Custom Padding Y (px, 0 = use size preset)",
      min: 0,
      max: 80,
    },
    // ── Margin ──
    marginTop: { type: "number", label: "Margin Top (px)", min: 0, max: 120 },
    marginRight: {
      type: "number",
      label: "Margin Right (px)",
      min: 0,
      max: 120,
    },
    marginBottom: {
      type: "number",
      label: "Margin Bottom (px)",
      min: 0,
      max: 120,
    },
    marginLeft: { type: "number", label: "Margin Left (px)", min: 0, max: 120 },
  },
  defaultProps: {
    label: "Get Started",
    url: "/pricing",
    variant: "outline",
    size: "lg",
    rounded: "full",
    icon: "none",
    iconPosition: "right",
    fullWidth: false,
    shadow: "none",
    openInNewTab: false,
    backgroundColor: "#0930f6",
    textColor: "",
    hoverBackgroundColor: "",
    hoverTextColor: "",
    customPaddingX: 22,
    customPaddingY: 9,
    marginTop: 27,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
  },
  render: Button,
};
