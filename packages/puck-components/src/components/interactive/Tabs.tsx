import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import { useState } from "react";
import { cn } from "../../lib/cn";
import { backgroundColorField, textColorField } from "../../lib/fields";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TabsProps {
  // Tab definitions (up to 5)
  tabs: { label: string }[];
  activeTab: number;

  // Style variant & layout
  variant: "underline" | "pills" | "boxed" | "bordered";
  alignment: "left" | "center" | "right" | "full";

  // Tab bar
  tabBarBgColor: string;
  tabBarPadding: "none" | "xs" | "sm" | "md";

  // Tab button typography + spacing
  tabFontSize: "xs" | "sm" | "base" | "lg";
  tabFontWeight: "normal" | "medium" | "semibold" | "bold";
  tabPadding: "sm" | "md" | "lg";
  tabGap: "none" | "sm" | "md" | "lg";
  tabBorderRadius: "none" | "sm" | "md" | "lg" | "full";

  // Active tab styling
  activeTabBgColor: string;
  activeTabTextColor: string;
  activeIndicatorColor: string;
  activeIndicatorThickness: "1" | "2" | "3" | "4";

  // Inactive tab styling
  inactiveTabTextColor: string;
  inactiveTabBgColor: string;

  // Content panel
  contentBgColor: string;
  contentPadding: "none" | "sm" | "md" | "lg" | "xl";
  contentBorderRadius: "none" | "sm" | "md" | "lg";
  contentBorder: boolean;
  contentShadow: "none" | "sm" | "md" | "lg";

  // Wrapper
  backgroundColor: string;
  wrapperPadding: "none" | "sm" | "md" | "lg";
  wrapperBorderRadius: "none" | "sm" | "md" | "lg";
  wrapperShadow: "none" | "sm" | "md" | "lg";
  wrapperBorder: boolean;

  // Per-tab content slots (one per tab, up to 5)
  slot1: ReactNode;
  slot2: ReactNode;
  slot3: ReactNode;
  slot4: ReactNode;
  slot5: ReactNode;
}

// ─── Style Lookup Maps ────────────────────────────────────────────────────────

const fontSizeMap: Record<string, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
};

const fontWeightMap: Record<string, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

const tabPaddingMap: Record<string, string> = {
  sm: "px-3 py-1.5",
  md: "px-4 py-2.5",
  lg: "px-6 py-3",
};

const tabGapMap: Record<string, string> = {
  none: "gap-0",
  sm: "gap-1",
  md: "gap-2",
  lg: "gap-4",
};

const tabBorderRadiusMap: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
};

const contentPaddingMap: Record<string, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
  xl: "p-10",
};

const contentBorderRadiusMap: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
};

const contentShadowMap: Record<string, string> = {
  none: "",
  sm: "shadow-sm",
  md: "shadow",
  lg: "shadow-lg",
};

const wrapperPaddingMap: Record<string, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-6",
  lg: "p-10",
};

const wrapperBorderRadiusMap: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
};

const wrapperShadowMap: Record<string, string> = {
  none: "",
  sm: "shadow-sm",
  md: "shadow",
  lg: "shadow-lg",
};

const tabBarPaddingMap: Record<string, string> = {
  none: "",
  xs: "px-1 py-0.5",
  sm: "px-2 py-1",
  md: "px-3 py-2",
};

const alignMap: Record<string, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

const indicatorThicknessMap: Record<string, string> = {
  "1": "h-px",
  "2": "h-0.5",
  "3": "h-[3px]",
  "4": "h-1",
};

// ─── Component ────────────────────────────────────────────────────────────────

export const Tabs = ({
  tabs = [],
  activeTab = 0,
  variant = "underline",
  alignment = "left",
  tabBarBgColor = "",
  tabBarPadding = "none",
  tabFontSize = "sm",
  tabFontWeight = "medium",
  tabPadding = "md",
  tabGap = "sm",
  tabBorderRadius = "sm",
  activeTabBgColor = "",
  activeTabTextColor = "#2563eb",
  activeIndicatorColor = "#2563eb",
  activeIndicatorThickness = "2",
  inactiveTabTextColor = "#6b7280",
  inactiveTabBgColor = "",
  contentBgColor = "",
  contentPadding = "md",
  contentBorderRadius = "none",
  contentBorder = false,
  contentShadow = "none",
  backgroundColor = "",
  wrapperPadding = "none",
  wrapperBorderRadius = "none",
  wrapperShadow = "none",
  wrapperBorder = false,
  slot1,
  slot2,
  slot3,
  slot4,
  slot5,
  puck,
}: TabsProps & { puck?: { isEditing?: boolean } }) => {
  const [selected, setSelected] = useState(activeTab);
  const isEditing = puck?.isEditing;
  const visibleCount = Math.min(Math.max(tabs.length, 1), 5);
  const slotValues: ReactNode[] = [slot1, slot2, slot3, slot4, slot5];

  // ─── Tab bar wrapper classes ──────────────────────────────────────
  const tabBarClasses = cn(
    "flex flex-wrap items-end",
    alignment !== "full" ? (alignMap[alignment] ?? "justify-start") : "",
    tabGapMap[tabGap],
    tabBarPaddingMap[tabBarPadding],
    variant === "underline" && "border-b border-gray-200",
    variant === "boxed" && "bg-gray-100 p-1 rounded-lg",
    variant === "bordered" && "border-b border-gray-200",
  );

  // ─── Tab button classes ───────────────────────────────────────────
  const getTabButtonClasses = (_i: number) =>
    cn(
      "relative transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
      fontSizeMap[tabFontSize],
      fontWeightMap[tabFontWeight],
      tabPaddingMap[tabPadding],
      alignment === "full" && "flex-1 text-center",
      variant === "underline" && "border-b-2 border-transparent",
      variant === "pills" &&
        (tabBorderRadiusMap[tabBorderRadius] ?? "rounded-full"),
      variant === "boxed" && "rounded-md",
      variant === "bordered" && "border border-gray-200 rounded-t-md -mb-px",
      // CSS-var-driven color/bg classes
      "text-(--tab-fg)",
      (variant === "pills" || variant === "boxed") && "bg-(--tab-bg)",
      variant === "boxed" && "[box-shadow:var(--tab-shadow)]",
      variant === "bordered" && "bg-(--tab-bg) border-b-(--tab-border-b)",
      variant === "underline" && "border-b-(--tab-border)",
    );

  // ─── Tab button inline styles → CSS custom properties ───────────
  const getTabStyle = (i: number): React.CSSProperties => {
    const isActive = selected === i;
    if (variant === "underline") {
      return {
        "--tab-fg": isActive ? activeTabTextColor : inactiveTabTextColor,
        "--tab-border": isActive ? activeIndicatorColor : "transparent",
      } as React.CSSProperties;
    }
    if (variant === "pills") {
      return {
        "--tab-fg": isActive ? activeTabTextColor : inactiveTabTextColor,
        "--tab-bg": isActive
          ? activeTabBgColor || activeTabTextColor
          : inactiveTabBgColor || "transparent",
      } as React.CSSProperties;
    }
    if (variant === "boxed") {
      return {
        "--tab-fg": isActive ? activeTabTextColor : inactiveTabTextColor,
        "--tab-bg": isActive
          ? activeTabBgColor || "#ffffff"
          : inactiveTabBgColor || "transparent",
        "--tab-shadow": isActive ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
      } as React.CSSProperties;
    }
    if (variant === "bordered") {
      return {
        "--tab-fg": isActive ? activeTabTextColor : inactiveTabTextColor,
        "--tab-bg": isActive
          ? activeTabBgColor || contentBgColor || "#ffffff"
          : inactiveTabBgColor || "#f3f4f6",
        "--tab-border-b": isActive
          ? activeTabBgColor || contentBgColor || "#ffffff"
          : "#e5e7eb",
      } as React.CSSProperties;
    }
    return {};
  };

  // ─── Shared: wrapper + content panel classes ──────────────────────
  const wrapperClasses = cn(
    "w-full",
    wrapperPaddingMap[wrapperPadding],
    wrapperBorderRadiusMap[wrapperBorderRadius],
    wrapperShadowMap[wrapperShadow],
    wrapperBorder && "border border-gray-200",
  );

  const contentClasses = cn(
    contentPaddingMap[contentPadding],
    contentBorderRadiusMap[contentBorderRadius],
    contentShadowMap[contentShadow],
    contentBorder && "border border-gray-200",
  );

  // ─── Tab header strip (shared between edit + preview) ────────────
  const tabStrip = (
    <div
      className={cn(tabBarClasses, "bg-(--tab-bar-bg)")}
      style={
        {
          "--tab-bar-bg": tabBarBgColor || "transparent",
        } as React.CSSProperties
      }
      role="tablist"
    >
      {Array.from({ length: visibleCount }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={selected === i}
          onClick={() => setSelected(i)}
          className={getTabButtonClasses(i)}
          style={getTabStyle(i)}
        >
          {tabs[i]?.label ?? `Tab ${i + 1}`}
          {/* Underline indicator rendered as an absolute span so thickness is CSS-controlled */}
          {variant === "underline" && selected === i && (
            <span
              className={cn(
                "absolute bottom-0 left-0 right-0 bg-(--active-indicator)",
                indicatorThicknessMap[activeIndicatorThickness],
              )}
            />
          )}
        </button>
      ))}
    </div>
  );

  // ─── EDITOR MODE: all panels shown stacked ────────────────────────
  // Prevents the Puck drag-handle from hijacking clicks on tab buttons.
  // Users can see every tab's drop zone at once and drop content freely.
  if (isEditing) {
    return (
      <div
        className={cn(wrapperClasses, "bg-(--wrapper-bg)")}
        style={
          {
            "--wrapper-bg": backgroundColor || "transparent",
            "--active-indicator": activeIndicatorColor,
            "--content-bg": contentBgColor || "transparent",
          } as React.CSSProperties
        }
      >
        {tabStrip}
        <div className="mt-2 flex flex-col gap-3">
          {Array.from({ length: visibleCount }, (_, i) => {
            const SlotComp = slotValues[i] as unknown as React.FC;
            return (
              <div key={i}>
                {/* Label badge so the editor knows which tab this panel belongs to */}
                <span className="mb-1 inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-600">
                  {tabs[i]?.label ?? `Tab ${i + 1}`}
                </span>
                <div
                  className={cn(
                    contentClasses,
                    "border-2 border-dashed border-blue-200 bg-(--content-bg)",
                  )}
                >
                  <SlotComp />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── PREVIEW / LIVE MODE: standard tab switching ──────────────────
  const ActiveSlot = slotValues[selected] as unknown as React.FC;

  return (
    <div
      className={cn(wrapperClasses, "bg-(--wrapper-bg)")}
      style={
        {
          "--wrapper-bg": backgroundColor || "transparent",
          "--active-indicator": activeIndicatorColor,
          "--content-bg": contentBgColor || "transparent",
        } as React.CSSProperties
      }
    >
      {tabStrip}
      <div role="tabpanel" className={cn(contentClasses, "bg-(--content-bg)")}>
        <ActiveSlot />
      </div>
    </div>
  );
};

// ─── Puck Config ──────────────────────────────────────────────────────────────

export const tabsConfig: ComponentConfig<TabsProps> = {
  label: "Tabs",
  fields: {
    // ── Tabs ──────────────────────────────────────────────────────────
    tabs: {
      type: "array",
      label: "Tabs (max 5)",
      arrayFields: {
        label: { type: "text", label: "Label" },
      },
      defaultItemProps: { label: "New Tab" },
      getItemSummary: (item) => item.label || "Tab",
    },
    activeTab: {
      type: "number",
      label: "Default Active Tab (0-based)",
      min: 0,
    },
    // ── Per-tab content slots ─────────────────────────────────────────
    slot1: { type: "slot" },
    slot2: { type: "slot" },
    slot3: { type: "slot" },
    slot4: { type: "slot" },
    slot5: { type: "slot" },
    // ── Variant & Alignment ───────────────────────────────────────────
    variant: {
      type: "select",
      label: "Style Variant",
      options: [
        { label: "Underline", value: "underline" },
        { label: "Pills", value: "pills" },
        { label: "Boxed", value: "boxed" },
        { label: "Bordered", value: "bordered" },
      ],
    },
    alignment: {
      type: "radio",
      label: "Tab Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
        { label: "Full Width", value: "full" },
      ],
    },
    // ── Tab Bar ───────────────────────────────────────────────────────
    tabBarBgColor: {
      ...backgroundColorField,
      label: "Tab Bar Background",
    },
    tabBarPadding: {
      type: "select",
      label: "Tab Bar Padding",
      options: [
        { label: "None", value: "none" },
        { label: "XS", value: "xs" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
      ],
    },
    // ── Tab Buttons ───────────────────────────────────────────────────
    tabFontSize: {
      type: "select",
      label: "Font Size",
      options: [
        { label: "XS", value: "xs" },
        { label: "SM", value: "sm" },
        { label: "Base", value: "base" },
        { label: "LG", value: "lg" },
      ],
    },
    tabFontWeight: {
      type: "select",
      label: "Font Weight",
      options: [
        { label: "Thin", value: "thin" },
        { label: "Extra Light", value: "extralight" },
        { label: "Light", value: "light" },
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
        { label: "Extra Bold", value: "extrabold" },
        { label: "Black", value: "black" },
      ],
    },
    tabPadding: {
      type: "radio",
      label: "Tab Padding",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
    tabGap: {
      type: "select",
      label: "Tab Gap",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
    tabBorderRadius: {
      type: "select",
      label: "Tab Border Radius",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Full", value: "full" },
      ],
    },
    // ── Active Tab ────────────────────────────────────────────────────
    activeTabTextColor: {
      ...textColorField,
      label: "Active Text Color",
    },
    activeTabBgColor: {
      ...backgroundColorField,
      label: "Active Tab Background",
    },
    activeIndicatorColor: {
      ...textColorField,
      label: "Indicator Color",
    },
    activeIndicatorThickness: {
      type: "radio",
      label: "Indicator Thickness",
      options: [
        { label: "1px", value: "1" },
        { label: "2px", value: "2" },
        { label: "3px", value: "3" },
        { label: "4px", value: "4" },
      ],
    },
    // ── Inactive Tab ──────────────────────────────────────────────────
    inactiveTabTextColor: {
      ...textColorField,
      label: "Inactive Text Color",
    },
    inactiveTabBgColor: {
      ...backgroundColorField,
      label: "Inactive Tab Background",
    },
    // ── Content Panel ─────────────────────────────────────────────────
    contentBgColor: {
      ...backgroundColorField,
      label: "Content Background",
    },
    contentPadding: {
      type: "select",
      label: "Content Padding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "XL", value: "xl" },
      ],
    },
    contentBorderRadius: {
      type: "select",
      label: "Content Border Radius",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
    contentBorder: {
      type: "radio",
      label: "Content Border",
      options: [
        { label: "None", value: false },
        { label: "Show", value: true },
      ],
    },
    contentShadow: {
      type: "select",
      label: "Content Shadow",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
    // ── Wrapper ───────────────────────────────────────────────────────
    backgroundColor: backgroundColorField,
    wrapperPadding: {
      type: "select",
      label: "Wrapper Padding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
    wrapperBorderRadius: {
      type: "select",
      label: "Wrapper Border Radius",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
    wrapperShadow: {
      type: "select",
      label: "Wrapper Shadow",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
    wrapperBorder: {
      type: "radio",
      label: "Wrapper Border",
      options: [
        { label: "None", value: false },
        { label: "Show", value: true },
      ],
    },
  },
  defaultProps: {
    tabs: [{ label: "Features" }, { label: "Pricing" }, { label: "FAQ" }],
    activeTab: 0,
    variant: "underline",
    alignment: "left",
    tabBarBgColor: "",
    tabBarPadding: "none",
    tabFontSize: "sm",
    tabFontWeight: "medium",
    tabPadding: "md",
    tabGap: "sm",
    tabBorderRadius: "sm",
    activeTabBgColor: "",
    activeTabTextColor: "#2563eb",
    activeIndicatorColor: "#2563eb",
    activeIndicatorThickness: "2",
    inactiveTabTextColor: "#6b7280",
    inactiveTabBgColor: "",
    contentBgColor: "",
    contentPadding: "md",
    contentBorderRadius: "none",
    contentBorder: false,
    contentShadow: "none",
    backgroundColor: "",
    wrapperPadding: "none",
    wrapperBorderRadius: "none",
    wrapperShadow: "none",
    wrapperBorder: false,
    slot1: [],
    slot2: [],
    slot3: [],
    slot4: [],
    slot5: [],
  },
  render: Tabs,
};
