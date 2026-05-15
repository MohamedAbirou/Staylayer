import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { textColorField } from "../../lib/fields";
import { parseMarkup } from "../../lib/parse-markup";

interface BreadcrumbItem {
  label: string;
  href: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator: string;
  size: string;
  color: string;
}

const sizeMap: Record<string, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

const separatorIcons: Record<string, React.ReactNode> = {
  slash: <span className="opacity-40">/</span>,
  chevron: <span className="opacity-40">&gt;</span>,
  dot: <span className="opacity-40">·</span>,
  arrow: <span className="opacity-40">&rarr;</span>,
};

export const Breadcrumb = ({
  items = [],
  separator = "chevron",
  size = "md",
  color = "",
  puck,
}: BreadcrumbProps & { puck?: { isEditing?: boolean } }) => {
  return (
    <nav aria-label="Breadcrumb" className={cn(sizeMap[size])}>
      <ol
        className={cn(
          "flex flex-wrap items-center gap-1.5",
          color && "text-(--fg)",
        )}
        style={color ? ({ "--fg": color } as React.CSSProperties) : undefined}
      >
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {isLast ? (
                <span className="font-medium opacity-90">
                  {parseMarkup(item.label)}
                </span>
              ) : puck?.isEditing ? (
                <span className="opacity-60 hover:opacity-100 cursor-pointer transition-opacity">
                  {parseMarkup(item.label)}
                </span>
              ) : (
                <a
                  href={item.href}
                  className="opacity-60 hover:opacity-100 transition-opacity no-underline"
                >
                  {parseMarkup(item.label)}
                </a>
              )}
              {!isLast && (
                <span className="flex items-center">
                  {separatorIcons[separator] || separatorIcons.chevron}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export const breadcrumbConfig: ComponentConfig<BreadcrumbProps> = {
  label: "Breadcrumb",
  fields: {
    items: {
      type: "array",
      label: "Items",
      arrayFields: {
        label: { type: "text", label: "Label" },
        href: { type: "text", label: "URL" },
      },
      defaultItemProps: { label: "Page", href: "/" },
      getItemSummary: (item) => item.label || "Crumb",
    },
    separator: {
      type: "select",
      label: "Separator",
      options: [
        { label: "Chevron ›", value: "chevron" },
        { label: "Slash /", value: "slash" },
        { label: "Dot ·", value: "dot" },
        { label: "Arrow →", value: "arrow" },
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
    color: textColorField,
  },
  defaultProps: {
    items: [
      { label: "Home", href: "/" },
      { label: "Products", href: "/products" },
      { label: "Current Page", href: "" },
    ],
    separator: "chevron",
    size: "md",
    color: "",
  },
  render: Breadcrumb,
};
