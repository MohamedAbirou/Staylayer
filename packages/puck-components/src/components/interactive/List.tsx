import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { textColorField } from "../../lib/fields";
import { emojiField } from "../../lib/emoji-picker";
import { parseMarkup } from "../../lib/parse-markup";

interface ListItem {
  text: string;
  icon: string;
}

export interface ListProps {
  items: ListItem[];
  variant: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  accentColor: string;
  globalIcon: string;
  itemSpacing: number;
  paddingX: number;
  paddingY: number;
  marginTop: number;
  marginBottom: number;
}

const weightMap: Record<string, string> = {
  light: "font-light",
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
  extrabold: "font-extrabold",
  black: "font-black",
};

export const List = ({
  items = [],
  variant = "unordered",
  fontSize = 16,
  fontWeight = "normal",
  color = "",
  accentColor = "#2563eb",
  globalIcon = "",
  itemSpacing = 10,
  paddingX = 0,
  paddingY = 0,
  marginTop = 0,
  marginBottom = 0,
}: ListProps) => {
  const rootStyle = {
    "--fg": color || "inherit",
    "--accent": accentColor,
    fontSize: `${fontSize}px`,
    paddingLeft: `${paddingX}px`,
    paddingRight: `${paddingX}px`,
    paddingTop: `${paddingY}px`,
    paddingBottom: `${paddingY}px`,
    marginTop: `${marginTop}px`,
    marginBottom: `${marginBottom}px`,
  } as React.CSSProperties;

  const resolveIcon = (item: ListItem) => globalIcon || item.icon || "";

  if (variant === "check") {
    return (
      <ul
        className="flex flex-col text-(--fg) list-none"
        style={{ ...rootStyle, gap: `${itemSpacing}px` }}
      >
        {items.map((item, i) => {
          const icon = resolveIcon(item);
          return (
            <li
              key={i}
              className={cn("flex items-center gap-2.5", weightMap[fontWeight])}
            >
              {icon ? (
                <span
                  className="mt-0.5 shrink-0 leading-none"
                  style={{ fontSize: `${fontSize * 1.1}px` }}
                >
                  {icon}
                </span>
              ) : (
                <span
                  className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-white bg-(--accent)"
                  style={{
                    width: `${fontSize}px`,
                    height: `${fontSize}px`,
                    minWidth: `${fontSize}px`,
                  }}
                >
                  &#10004;
                </span>
              )}
              <span>{parseMarkup(item.text)}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  if (variant === "numbered") {
    return (
      <ol
        className="flex flex-col text-(--fg) list-none"
        style={{ ...rootStyle, gap: `${itemSpacing}px` }}
      >
        {items.map((item, i) => {
          const icon = resolveIcon(item);
          return (
            <li key={i} className="flex items-start gap-3">
              {icon ? (
                <span
                  className="mt-0.5 shrink-0 leading-none"
                  style={{ fontSize: `${fontSize * 1.1}px` }}
                >
                  {icon}
                </span>
              ) : (
                <span
                  className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-white bg-(--accent)"
                  style={{
                    width: `${fontSize * 1.5}px`,
                    height: `${fontSize * 1.5}px`,
                    minWidth: `${fontSize * 1.5}px`,
                  }}
                >
                  {i + 1}
                </span>
              )}
              <span className="pt-0.5">{parseMarkup(item.text)}</span>
            </li>
          );
        })}
      </ol>
    );
  }

  // Bullet / unordered
  return (
    <ul
      className={cn("flex flex-col text-(--fg) list-none")}
      style={{ ...rootStyle, gap: `${itemSpacing}px` }}
    >
      {items.map((item, i) => {
        const icon = resolveIcon(item);
        return (
          <li key={i} className="flex items-start gap-2">
            {icon ? (
              <span
                className="mt-0.5 shrink-0 leading-none"
                style={{
                  fontSize: `${fontSize * 1.1}px`,
                }}
              >
                {icon}
              </span>
            ) : (
              <span
                className="mt-[0.5em] block shrink-0 rounded-full bg-(--accent)"
                style={{
                  width: "0.45em",
                  height: "0.45em",
                  minWidth: "0.45em",
                }}
              />
            )}
            <span>{parseMarkup(item.text)}</span>
          </li>
        );
      })}
    </ul>
  );
};

export const listConfig: ComponentConfig<ListProps> = {
  label: "List",
  fields: {
    items: {
      type: "array",
      label: "Items",
      arrayFields: {
        text: { type: "text", label: "Text", contentEditable: true },
        icon: { ...emojiField, label: "Item Icon (overrides global)" },
      },
      defaultItemProps: { text: "List item", icon: "" },
    },
    variant: {
      type: "radio",
      label: "Style",
      options: [
        { label: "Bullet", value: "unordered" },
        { label: "Numbered", value: "numbered" },
        { label: "Checkmark", value: "check" },
      ],
    },
    globalIcon: { ...emojiField, label: "Global Icon (all items)" },
    fontSize: {
      type: "number",
      label: "Font Size (px)",
      min: 10,
      max: 48,
    },
    fontWeight: {
      type: "select",
      label: "Font Weight",
      options: [
        { label: "Light", value: "light" },
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
        { label: "Extrabold", value: "extrabold" },
        { label: "Black", value: "black" },
      ],
    },
    itemSpacing: {
      type: "number",
      label: "Item Spacing (px)",
      min: 0,
      max: 60,
    },
    paddingX: {
      type: "number",
      label: "Padding Horizontal (px)",
      min: 0,
      max: 80,
    },
    paddingY: {
      type: "number",
      label: "Padding Vertical (px)",
      min: 0,
      max: 80,
    },
    marginTop: {
      type: "number",
      label: "Margin Top (px)",
      min: 0,
      max: 120,
    },
    marginBottom: {
      type: "number",
      label: "Margin Bottom (px)",
      min: 0,
      max: 120,
    },
    color: textColorField,
    accentColor: {
      ...textColorField,
      label: "Accent / Icon Color",
    },
  },
  defaultProps: {
    items: [
      { text: "First item in the list", icon: "" },
      { text: "Second item in the list", icon: "" },
      { text: "Third item in the list", icon: "" },
    ],
    variant: "unordered",
    fontSize: 16,
    fontWeight: "normal",
    color: "",
    accentColor: "#2563eb",
    globalIcon: "",
    itemSpacing: 10,
    paddingX: 0,
    paddingY: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  render: List,
};
