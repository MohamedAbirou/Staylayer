import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { backgroundColorField, textColorField } from "../../lib/fields";
import { emojiField } from "../../lib/emoji-picker";
import { useState, useRef, useEffect } from "react";
import { parseMarkup } from "../../lib/parse-markup";
import {
  MatrialIconsApartment,
  MatrialIconsAttachMoney,
  MatrialIconsBarChart,
  MatrialIconsCalenderMonth,
  MatrialIconsContact,
  MatrialIconsEvenetAvailable,
  MatrialIconsGroup,
  MatrialIconsHome,
  MatrialIconsHotel,
  MatrialIconsInfo,
  MatrialIconsLogin,
  MatrialIconsMenuBook,
  MatrialIconsStars,
  MatrialIconsStoreFront,
  MatrialIconsSyncAlt,
  MatrialIconsTrendingUp,
  MatrialIconsWeb,
  MatrialIconsWork,
  MatrialIconsAgriculture,
  MaterialSymbolsLightGlobe,
  MdiCalendarSyncOutline,
  MdiHeart,
  MdiViewDashboardOutline,
  MdiCode,
  MdiEuro,
  MdiStar,
  MdiCoffee,
  FluentTent28Filled,
  MaterialSymbolsVerified,
  MaterialSymbolsPolicy,
} from "../../lib/icons";

interface ListItem {
  text: string;
  icon: string;
}

export interface FeatureCardProps {
  icon: string;
  showIcon: boolean;
  title: string;
  description: string;
  alignment: string;
  backgroundColor: string;
  textColor: string;
  bordered: boolean;
  shadow: string;
  gradient: boolean;
  gradientFrom: string;
  gradientTo: string;
  gradientDirection: string;
  // ── Title typography ──
  titleColor: string;
  titleFontSize: number;
  titleWeight: string;
  // ── Description typography ──
  descriptionColor: string;
  descriptionFontSize: number;
  descriptionWeight: string;
  // ── Icon styling ──
  iconColor: string;
  iconBackground: string;
  iconShape: string;
  // ── List ──
  showList: boolean;
  listItems: ListItem[];
  listVariant: string;
  listAccentColor: string;
  listColor: string;
  listFontSize: number;
  listFontWeight: string;
  listItemSpacing: number;
  listGlobalIcon: string;
  listTopSpacing: number;
}

// ─── Card icon map & picker (used in render + Puck config custom fields) ────

type SvgComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const cardIconMap: Record<string, SvgComponent> = {
  MatrialIconsWeb,
  MatrialIconsSyncAlt,
  MatrialIconsHome,
  MatrialIconsContact,
  MatrialIconsCalenderMonth,
  MatrialIconsEvenetAvailable,
  MatrialIconsTrendingUp,
  MatrialIconsBarChart,
  MatrialIconsGroup,
  MatrialIconsMenuBook,
  MatrialIconsStars,
  MatrialIconsLogin,
  MatrialIconsAttachMoney,
  MatrialIconsInfo,
  MatrialIconsWork,
  MatrialIconsHotel,
  MatrialIconsStoreFront,
  MatrialIconsAgriculture,
  MatrialIconsApartment,
  MaterialSymbolsLightGlobe,
  MdiCalendarSyncOutline,
  MdiHeart,
  MdiViewDashboardOutline,
  MdiCode,
  MdiEuro,
  MdiStar,
  MdiCoffee,
  FluentTent28Filled,
  MaterialSymbolsVerified,
  MaterialSymbolsPolicy,
};

function CardIcon({
  name,
  className = "w-5 h-5",
  color,
}: {
  name: string;
  className?: string;
  color?: string;
}) {
  const Comp = cardIconMap[name];
  if (!Comp) return null;
  const resolved = color || "currentColor";
  return (
    <Comp className={className} fill={resolved} style={{ color: resolved }} />
  );
}

function CardIconPickerField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const IconComp = value ? cardIconMap[value] : null;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-block" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Choose icon"
          style={{
            cursor: "pointer",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "5px 10px",
            background: open ? "#f9fafb" : "#fff",
            minWidth: 48,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {IconComp ? (
            <IconComp style={{ width: 20, height: 20 }} />
          ) : (
            <span style={{ fontSize: 18, lineHeight: 1, color: "#9ca3af" }}>
              ＋
            </span>
          )}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            title="Remove icon"
            style={{
              fontSize: 11,
              cursor: "pointer",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              padding: "5px 9px",
              background: "#fff",
              color: "#6b7280",
              lineHeight: 1,
            }}
          >
            ✕ Clear
          </button>
        )}
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 9999,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 8,
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            width: 284,
            boxShadow: "0 8px 24px rgba(0,0,0,.14)",
          }}
        >
          {Object.entries(cardIconMap).map(([key, Comp]) => (
            <button
              key={key}
              type="button"
              title={key}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              style={{
                cursor: "pointer",
                border: "none",
                borderRadius: 6,
                padding: 4,
                background: value === key ? "#eff6ff" : "transparent",
                width: 34,
                height: 34,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Comp style={{ width: 20, height: 20 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const shadowMap: Record<string, string> = {
  none: "",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
};

const gradientDirMap: Record<string, string> = {
  "to-r": "bg-gradient-to-r",
  "to-br": "bg-gradient-to-br",
  "to-b": "bg-gradient-to-b",
  "to-bl": "bg-gradient-to-bl",
  "to-l": "bg-gradient-to-l",
  "to-t": "bg-gradient-to-t",
  "to-tr": "bg-gradient-to-tr",
};

const iconShapeMap: Record<string, string> = {
  circle: "rounded-full",
  rounded: "rounded-xl",
  square: "rounded-none",
};

const listWeightMap: Record<string, string> = {
  light: "font-light",
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
  extrabold: "font-extrabold",
  black: "font-black",
};

export const FeatureCard = ({
  icon = "star",
  showIcon = true,
  title = "Feature Title",
  description = "Describe this feature and how it helps your customers achieve their goals.",
  alignment = "left",
  backgroundColor = "#ffffff",
  textColor = "",
  bordered = true,
  shadow = "sm",
  gradient = false,
  gradientFrom = "#3b82f6",
  gradientTo = "#8b5cf6",
  gradientDirection = "to-br",
  titleColor = "",
  titleFontSize = 0,
  titleWeight = "semibold",
  descriptionColor = "",
  descriptionFontSize = 0,
  descriptionWeight = "medium",
  showList = false,
  listItems = [],
  listVariant = "check",
  listAccentColor = "#2563eb",
  listColor = "",
  listFontSize = 14,
  listFontWeight = "normal",
  listItemSpacing = 8,
  listGlobalIcon = "",
  listTopSpacing = 0,
  iconColor = "",
  iconBackground = "",
  iconShape = "rounded",
}: FeatureCardProps) => {
  const alignClass =
    alignment === "center"
      ? "items-center text-center"
      : alignment === "right"
        ? "items-end text-right"
        : "items-start text-left";

  const bgStyle = gradient
    ? ({
        "--grad-from": gradientFrom,
        "--grad-to": gradientTo,
      } as React.CSSProperties)
    : ({
        "--bg": backgroundColor || "#ffffff",
        "--fg": textColor || "inherit",
      } as React.CSSProperties);

  const resolveItemIcon = (item: ListItem) => listGlobalIcon || item.icon || "";

  const renderList = () => {
    if (!showList || listItems.length === 0) return null;

    const listStyle = {
      "--list-fg": listColor || "inherit",
      "--list-accent": listAccentColor,
      fontSize: `${listFontSize}px`,
      gap: `${listItemSpacing}px`,
    } as React.CSSProperties;

    if (listVariant === "numbered") {
      return (
        <ol
          className="flex flex-col list-none w-full text-(--list-fg)"
          style={listStyle}
        >
          {listItems.map((item, i) => {
            const icon = resolveItemIcon(item);
            return (
              <li
                key={i}
                className={cn(
                  "flex items-start gap-2.5",
                  listWeightMap[listFontWeight],
                )}
              >
                {icon ? (
                  <span
                    className="mt-0.5 shrink-0 leading-none"
                    style={{ fontSize: `${listFontSize * 1.1}px` }}
                  >
                    {icon}
                  </span>
                ) : (
                  <span
                    className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-white bg-(--list-accent)"
                    style={{
                      width: `${listFontSize * 1.4}px`,
                      height: `${listFontSize * 1.4}px`,
                      minWidth: `${listFontSize * 1.4}px`,
                      fontSize: `${listFontSize * 0.7}px`,
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

    if (listVariant === "check") {
      return (
        <ul
          className="flex flex-col list-none w-full text-(--list-fg)"
          style={listStyle}
        >
          {listItems.map((item, i) => {
            const icon = resolveItemIcon(item);
            return (
              <li
                key={i}
                className={cn(
                  "flex items-center gap-2.5",
                  listWeightMap[listFontWeight],
                )}
              >
                {icon ? (
                  <span
                    className="mt-0.5 shrink-0 leading-none"
                    style={{ fontSize: `${listFontSize * 1.1}px` }}
                  >
                    {icon}
                  </span>
                ) : (
                  <span
                    className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-white bg-(--list-accent)"
                    style={{
                      width: `${listFontSize}px`,
                      height: `${listFontSize}px`,
                      minWidth: `${listFontSize}px`,
                      fontSize: `${listFontSize * 0.7}px`,
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

    // Bullet / unordered
    return (
      <ul
        className="flex flex-col list-none w-full text-(--list-fg)"
        style={listStyle}
      >
        {listItems.map((item, i) => {
          const icon = resolveItemIcon(item);
          return (
            <li
              key={i}
              className={cn(
                "flex items-start gap-2",
                listWeightMap[listFontWeight],
              )}
            >
              {icon ? (
                <span
                  className="mt-0.5 shrink-0 leading-none"
                  style={{ fontSize: `${listFontSize * 1.1}px` }}
                >
                  {icon}
                </span>
              ) : (
                <span
                  className="mt-[0.5em] block shrink-0 rounded-full bg-(--list-accent)"
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

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl p-6 hover:shadow-2xl hover:scale-105 transition-transform duration-300 ease-in-out",
        gradient
          ? cn(
              gradientDirMap[gradientDirection],
              "from-(--grad-from) to-(--grad-to)",
            )
          : "bg-(--bg)",
        "text-(--fg)",
        bordered && "border border-gray-200",
        shadowMap[shadow],
        alignClass,
      )}
      style={bgStyle}
    >
      {showIcon && (
        <div
          className={cn(
            "shrink-0 flex items-center justify-center text-purple-100",
            iconBackground ? iconShapeMap[iconShape] : "",
          )}
          style={{
            backgroundColor: iconBackground || undefined,
            padding: iconBackground ? "10px" : undefined,
          }}
        >
          <CardIcon
            name={icon}
            className="w-10 h-10"
            color={iconColor || undefined}
          />
        </div>
      )}
      {((title as any)?.props?.value || title) && (
        <h3
          style={{
            color: titleColor || textColor || undefined,
            ...(titleFontSize > 0 ? { fontSize: `${titleFontSize}px` } : {}),
          }}
          className={`font-${titleWeight || "semibold"} ${titleFontSize === 0 ? " text-lg" : ""}`}
        >
          {parseMarkup(title)}
        </h3>
      )}
      {((description as any)?.props?.value || description) && (
        <p
          style={{
            color: descriptionColor || textColor || undefined,
            opacity: 0.7,
            ...(descriptionFontSize > 0
              ? { fontSize: `${descriptionFontSize}px` }
              : {}),
          }}
          className={`leading-relaxed font-${descriptionWeight || "medium"} ${descriptionFontSize === 0 ? " text-sm" : ""}`}
        >
          {parseMarkup(description)}
        </p>
      )}
      <div
        style={
          listTopSpacing > 0 ? { marginTop: `${listTopSpacing}px` } : undefined
        }
      >
        {renderList()}
      </div>
    </div>
  );
};

export const featureCardConfig: ComponentConfig<FeatureCardProps> = {
  label: "Feature Card",
  fields: {
    title: { type: "text", label: "Title", contentEditable: true },
    description: {
      type: "textarea",
      label: "Description",
      contentEditable: true,
    },
    // ── Title typography ──
    titleColor: { ...textColorField, label: "Title Color (overrides global)" },
    titleFontSize: {
      type: "number",
      label: "Title Font Size (px, 0 = auto)",
      min: 0,
      max: 80,
    },
    titleWeight: {
      type: "select",
      label: "Title Font Weight",
      options: [
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
        { label: "Extra Bold", value: "extrabold" },
      ],
    },
    // ── Description typography ──
    descriptionColor: {
      ...textColorField,
      label: "Description Color (overrides global)",
    },
    descriptionFontSize: {
      type: "number",
      label: "Description Font Size (px, 0 = auto)",
      min: 0,
      max: 60,
    },
    descriptionWeight: {
      type: "select",
      label: "Description Font Weight",
      options: [
        { label: "Light", value: "light" },
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
        { label: "Extrabold", value: "extrabold" },
      ],
    },
    showIcon: {
      type: "radio",
      label: "Show Icon",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    icon: {
      type: "custom",
      label: "Icon",
      render: ({
        value,
        onChange,
      }: {
        value: string;
        onChange: (v: string) => void;
      }) => <CardIconPickerField value={value || ""} onChange={onChange} />,
    },
    // ── Icon styling ──
    iconColor: { ...textColorField, label: "Icon Color" },
    iconBackground: { ...backgroundColorField, label: "Icon Background Color" },
    iconShape: {
      type: "radio",
      label: "Icon Background Shape",
      options: [
        { label: "Circle", value: "circle" },
        { label: "Rounded", value: "rounded" },
        { label: "Square", value: "square" },
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
    bordered: {
      type: "radio",
      label: "Border",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
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
    gradient: {
      type: "radio",
      label: "Background Type",
      options: [
        { label: "Solid", value: false },
        { label: "Gradient", value: true },
      ],
    },
    textColor: textColorField,
    backgroundColor: backgroundColorField,
    gradientFrom: { ...backgroundColorField, label: "Gradient From" },
    gradientTo: { ...backgroundColorField, label: "Gradient To" },
    gradientDirection: {
      type: "select",
      label: "Gradient Direction",
      options: [
        { label: "→ Right", value: "to-r" },
        { label: "↘ Bottom-Right", value: "to-br" },
        { label: "↓ Bottom", value: "to-b" },
        { label: "↙ Bottom-Left", value: "to-bl" },
        { label: "← Left", value: "to-l" },
        { label: "↑ Top", value: "to-t" },
        { label: "↗ Top-Right", value: "to-tr" },
      ],
    },
    // ── List ──
    showList: {
      type: "radio",
      label: "Show List",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    listItems: {
      type: "array",
      label: "List Items",
      arrayFields: {
        text: { type: "text", label: "Text", contentEditable: true },
        icon: { ...emojiField, label: "Item Icon (overrides global)" },
      },
      defaultItemProps: { text: "List item", icon: "" },
    },
    listVariant: {
      type: "radio",
      label: "List Style",
      options: [
        { label: "Checkmark", value: "check" },
        { label: "Bullet", value: "unordered" },
        { label: "Numbered", value: "numbered" },
      ],
    },
    listGlobalIcon: {
      ...emojiField,
      label: "Global Icon (overrides checkmark/bullet)",
    },
    listAccentColor: {
      ...textColorField,
      label: "List Accent Color",
    },
    listColor: {
      ...textColorField,
      label: "List Text Color",
    },
    listFontSize: {
      type: "number",
      label: "List Font Size (px)",
      min: 10,
      max: 32,
    },
    listFontWeight: {
      type: "select",
      label: "List Font Weight",
      options: [
        { label: "Light", value: "light" },
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
      ],
    },
    listItemSpacing: {
      type: "number",
      label: "List Item Spacing (px)",
      min: 0,
      max: 40,
    },
    listTopSpacing: {
      type: "number",
      label: "List Top Spacing (px)",
      min: 0,
      max: 80,
    },
  },
  defaultProps: {
    icon: "star",
    showIcon: true,
    title: "Feature Title",
    description:
      "Describe this feature and how it helps your customers achieve their goals.",
    alignment: "left",
    backgroundColor: "#ffffff",
    textColor: "",
    bordered: true,
    shadow: "sm",
    gradient: false,
    gradientFrom: "#3b82f6",
    gradientTo: "#8b5cf6",
    gradientDirection: "to-br",
    titleColor: "",
    titleFontSize: 0,
    titleWeight: "semibold",
    descriptionColor: "",
    descriptionFontSize: 0,
    descriptionWeight: "medium",
    iconColor: "",
    iconBackground: "",
    iconShape: "rounded",
    showList: false,
    listItems: [
      { text: "First list item", icon: "" },
      { text: "Second list item", icon: "" },
      { text: "Third list item", icon: "" },
    ],
    listVariant: "check",
    listAccentColor: "#2563eb",
    listColor: "",
    listFontSize: 14,
    listFontWeight: "normal",
    listItemSpacing: 8,
    listGlobalIcon: "",
    listTopSpacing: 0,
  },
  render: FeatureCard,
};
