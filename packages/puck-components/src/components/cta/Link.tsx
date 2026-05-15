import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { textColorField } from "../../lib/fields";
import { parseMarkup } from "../../lib/parse-markup";

export interface LinkProps {
  label: string;
  href: string;
  alignment: "left" | "center" | "right";
  size: "sm" | "md" | "lg";
  variant: "accent" | "neutral" | "subtle";
  underline: "always" | "hover" | "none";
  weight: "normal" | "medium" | "semibold" | "bold";
  icon: "none" | "arrow" | "external";
  openInNewTab: boolean;
  color: string;
  hoverColor: string;
}

const alignmentMap: Record<LinkProps["alignment"], string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

const sizeMap: Record<LinkProps["size"], string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

const weightMap: Record<LinkProps["weight"], string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

const variantMap: Record<LinkProps["variant"], string> = {
  accent: "text-blue-600",
  neutral: "text-slate-900",
  subtle: "text-slate-600",
};

const underlineMap: Record<LinkProps["underline"], string> = {
  always: "underline underline-offset-4 decoration-current/50",
  hover:
    "no-underline hover:underline hover:underline-offset-4 hover:decoration-current/50",
  none: "no-underline",
};

const iconMap: Record<LinkProps["icon"], React.ReactNode> = {
  none: null,
  arrow: (
    <svg
      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
      />
    </svg>
  ),
  external: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
      />
    </svg>
  ),
};

export const Link = ({
  label = "Read more",
  href = "#",
  alignment = "left",
  size = "md",
  variant = "accent",
  underline = "hover",
  weight = "semibold",
  icon = "arrow",
  openInNewTab = false,
  color = "",
  hoverColor = "",
  puck,
}: LinkProps & { puck?: { isEditing?: boolean } }) => {
  const Tag = puck?.isEditing ? "button" : "a";
  const linkProps = puck?.isEditing
    ? {
        type: "button" as const,
        onClick: (event: React.MouseEvent) => event.preventDefault(),
      }
    : {
        href,
        ...(openInNewTab
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {}),
      };

  return (
    <div className={cn("flex w-full", alignmentMap[alignment])}>
      <Tag
        {...linkProps}
        className={cn(
          "group inline-flex items-center gap-2 transition-colors duration-200",
          sizeMap[size],
          weightMap[weight],
          variantMap[variant],
          underlineMap[underline],
          color && "text-(--link-fg)",
          hoverColor && "[&:hover]:text-(--link-hover-fg)",
        )}
        style={
          {
            "--link-fg": color || undefined,
            "--link-hover-fg": hoverColor || undefined,
          } as React.CSSProperties
        }
      >
        <span>{parseMarkup(label)}</span>
        {iconMap[icon]}
      </Tag>
    </div>
  );
};

export const linkConfig: ComponentConfig<LinkProps> = {
  label: "Link",
  fields: {
    label: {
      type: "text",
      label: "Label",
      contentEditable: true,
    },
    href: {
      type: "text",
      label: "URL",
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
    size: {
      type: "radio",
      label: "Size",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
    variant: {
      type: "select",
      label: "Style",
      options: [
        { label: "Accent", value: "accent" },
        { label: "Neutral", value: "neutral" },
        { label: "Subtle", value: "subtle" },
      ],
    },
    underline: {
      type: "radio",
      label: "Underline",
      options: [
        { label: "Always", value: "always" },
        { label: "On hover", value: "hover" },
        { label: "None", value: "none" },
      ],
    },
    weight: {
      type: "radio",
      label: "Weight",
      options: [
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
      ],
    },
    icon: {
      type: "radio",
      label: "Icon",
      options: [
        { label: "None", value: "none" },
        { label: "Arrow", value: "arrow" },
        { label: "External", value: "external" },
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
    color: {
      ...textColorField,
      label: "Color (optional override)",
    },
    hoverColor: {
      ...textColorField,
      label: "Hover Color (optional override)",
    },
  },
  defaultProps: {
    label: "Read more",
    href: "#",
    alignment: "left",
    size: "md",
    variant: "accent",
    underline: "hover",
    weight: "semibold",
    icon: "arrow",
    openInNewTab: false,
    color: "",
    hoverColor: "",
  },
  render: Link,
};
