import { useState } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import {
  backgroundColorField,
  textColorField,
  imageField,
} from "../../lib/fields";
import { parseMarkup } from "../../lib/parse-markup";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ShowcaseTab {
  label: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  browserUrl: string;
}

export interface FeatureShowcaseProps {
  heading: string;
  subheading: string;
  tabs: ShowcaseTab[];
  showBrowserChrome: boolean;
  tabPosition: string;
  tabsWidth: string;
  paddingY: string;
  paddingX: string;
  maxWidth: string;
  headingSize: string;
  backgroundColor: string;
  backgroundImage: string;
  backgroundImageOpacity: number;
  textColor: string;
  activeTabBgColor: string;
  activeTabTextColor: string;
  activeTabMobileTextColor: string;
  inactiveTabTextColor: string;
  gradient: boolean;
  gradientFrom: string;
  gradientTo: string;
  gradientDirection: string;
  // ── Heading/subheading customization ──
  headingAlignment: string;
  headingColor: string;
  headingFontSize: number;
  headingWeight: string;
  subheadingColor: string;
  subheadingFontSize: number;
  subheadingOpacity: number;
  // ── Image / browser mockup ──
  browserMockupMaxWidth: number;
  contentVerticalAlignment: string;
}

const gradientDirMap: Record<string, string> = {
  "to-r": "bg-gradient-to-r",
  "to-br": "bg-gradient-to-br",
  "to-b": "bg-gradient-to-b",
  "to-bl": "bg-gradient-to-bl",
  "to-l": "bg-gradient-to-l",
  "to-tl": "bg-gradient-to-tl",
  "to-t": "bg-gradient-to-t",
  "to-tr": "bg-gradient-to-tr",
};

const paddingYMap: Record<string, string> = {
  none: "py-0",
  sm: "py-8 md:py-12",
  md: "py-12 md:py-16",
  lg: "py-16 md:py-24",
  xl: "py-20 md:py-28",
  "2xl": "py-24 md:py-32",
};

const maxWidthMap: Record<string, string> = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

const tabsWidthMap: Record<string, string> = {
  narrow: "220px",
  medium: "280px",
  wide: "360px",
  "x-wide": "440px",
};

const headingSizeMap: Record<string, string> = {
  sm: "text-xl md:text-2xl",
  md: "text-2xl md:text-3xl",
  lg: "text-3xl md:text-4xl",
  xl: "text-4xl md:text-5xl",
};

const paddingXMap: Record<string, string> = {
  none: "px-0",
  sm: "px-4 md:px-6",
  md: "px-4 md:px-6 lg:px-8",
  lg: "px-6 md:px-8 lg:px-12",
};

// ─── Browser Mockup ──────────────────────────────────────────────────────────
function BrowserMockup({
  url,
  imageSrc,
  alt,
}: {
  url: string;
  imageSrc: string;
  alt: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-gray-400/10">
      {/* Chrome top bar */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        {/* Traffic lights */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="h-2.5 w-2.5 cursor-pointer rounded-full bg-red-400 transition-colors hover:bg-red-500" />
          <div className="h-2.5 w-2.5 cursor-pointer rounded-full bg-yellow-400 transition-colors hover:bg-yellow-500" />
          <div className="h-2.5 w-2.5 cursor-pointer rounded-full bg-green-400 transition-colors hover:bg-green-500" />
        </div>
        {/* Back/forward buttons */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            disabled
            className="rounded-full p-1 opacity-30 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed"
          >
            <svg
              className="h-3 w-3 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            type="button"
            className="rounded-full p-1 transition-colors hover:bg-gray-100"
          >
            <svg
              className="h-3 w-3 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
        {/* URL bar */}
        <div className="mx-2 flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1">
          <svg
            className="h-3 w-3 shrink-0 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="truncate text-xs text-center text-gray-500">
            {url || "app.example.com"}
          </span>
        </div>
        <svg
          className="h-4 w-4 shrink-0 text-gray-400"
          viewBox="0 0 24 24"
          id="three-dots"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g
            id="_20x20_three-dots--grey"
            data-name="20x20/three-dots--grey"
            transform="translate(24) rotate(90)"
          >
            <rect id="Rectangle" width="24" height="24" fill="none" />
            <circle
              id="Oval"
              cx="1"
              cy="1"
              r="1"
              transform="translate(5 11)"
              stroke="#000000"
              stroke-miterlimit="10"
              stroke-width="0.5"
            />
            <circle
              id="Oval-2"
              data-name="Oval"
              cx="1"
              cy="1"
              r="1"
              transform="translate(11 11)"
              stroke="#000000"
              stroke-miterlimit="10"
              stroke-width="0.5"
            />
            <circle
              id="Oval-3"
              data-name="Oval"
              cx="1"
              cy="1"
              r="1"
              transform="translate(17 11)"
              stroke="#000000"
              stroke-miterlimit="10"
              stroke-width="0.5"
            />
          </g>
        </svg>
      </div>
      {/* Screenshot */}
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={alt || "App screenshot"}
          className="w-full"
          loading="lazy"
        />
      ) : (
        <div className="flex h-96 items-center justify-center bg-gray-50 text-sm text-gray-400">
          Add a screenshot URL in the tab settings
        </div>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export const FeatureShowcase = ({
  heading = "Manage Smarter, Not Harder",
  subheading = "Streamline your operations and boost efficiency with our integrated solutions.",
  tabs = [],
  showBrowserChrome = true,
  tabPosition = "left",
  tabsWidth = "medium",
  paddingY = "lg",
  paddingX = "md",
  maxWidth = "7xl",
  headingSize = "lg",
  backgroundColor = "#2563eb",
  backgroundImage = "/background-call-to-action.6a5a5672.jpg",
  backgroundImageOpacity = 80,
  textColor = "#ffffff",
  activeTabBgColor = "rgba(255,255,255,0.15)",
  activeTabTextColor = "#ffffff",
  activeTabMobileTextColor = "#2563eb",
  inactiveTabTextColor = "rgba(255,255,255,0.7)",
  gradient = false,
  gradientFrom = "#1d4ed8",
  gradientTo = "#7c3aed",
  gradientDirection = "to-br",
  headingAlignment = "center",
  headingColor = "",
  headingFontSize = 0,
  headingWeight = "bold",
  subheadingColor = "",
  subheadingFontSize = 0,
  subheadingOpacity = 80,
  browserMockupMaxWidth = 0,
  contentVerticalAlignment = "center",
}: FeatureShowcaseProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex =
    tabs.length > 0 ? Math.min(activeIndex, tabs.length - 1) : 0;
  const activeTab = tabs[safeIndex];
  const isTabsOnLeft = tabPosition !== "right";

  const sectionStyle = gradient
    ? ({
        "--grad-from": gradientFrom,
        "--grad-to": gradientTo,
        "--fg": textColor,
      } as React.CSSProperties)
    : ({
        "--bg": backgroundColor,
        "--fg": textColor,
      } as React.CSSProperties);

  return (
    <section
      className={cn(
        "relative w-full overflow-hidden",
        paddingYMap[paddingY] ?? "py-16 md:py-24",
        gradient
          ? cn(
              gradientDirMap[gradientDirection] ?? "bg-gradient-to-br",
              "from-(--grad-from) to-(--grad-to)",
            )
          : "bg-(--bg)",
      )}
      style={sectionStyle}
    >
      {/* Background image */}
      {backgroundImage && (
        <img
          src={backgroundImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: (backgroundImageOpacity ?? 80) / 100 }}
          loading="lazy"
        />
      )}

      <div
        className={cn(
          "relative z-10 mx-auto",
          maxWidthMap[maxWidth] ?? "max-w-7xl",
          paddingXMap[paddingX] ?? "px-4 md:px-6 lg:px-8",
        )}
      >
        {/* Heading / subheading */}
        {(heading || subheading) && (
          <div
            className={cn(
              "mb-10 md:mb-14",
              headingAlignment === "left"
                ? "text-left"
                : headingAlignment === "right"
                  ? "text-right"
                  : "text-center",
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
                className={`font-${headingWeight || "bold"} ${headingFontSize === 0 ? ` ${headingSizeMap[headingSize] ?? "text-3xl md:text-4xl"}` : ""}`}
              >
                {parseMarkup(heading)}
              </h2>
            )}
            {subheading && (
              <p
                style={{
                  color: subheadingColor || textColor || undefined,
                  opacity: subheadingOpacity / 100,
                  ...(subheadingFontSize > 0
                    ? { fontSize: `${subheadingFontSize}px` }
                    : {}),
                }}
                className={`mt-3 ${subheadingFontSize === 0 ? " text-base md:text-lg" : ""}`}
              >
                {parseMarkup(subheading)}
              </p>
            )}
          </div>
        )}

        {/* Content: tab list + image/browser pane */}
        {tabs.length > 0 ? (
          <div
            className="flex flex-col gap-8 lg:grid lg:gap-0"
            style={{
              gridTemplateColumns: isTabsOnLeft
                ? `${tabsWidthMap[tabsWidth] ?? "280px"} 1fr`
                : `1fr ${tabsWidthMap[tabsWidth] ?? "280px"}`,
              alignItems:
                contentVerticalAlignment === "start"
                  ? "flex-start"
                  : contentVerticalAlignment === "end"
                    ? "flex-end"
                    : "center",
            }}
          >
            {/* ── Tab list ── */}
            <div
              className={cn(
                "-mx-4 flex overflow-x-auto pb-4 sm:mx-0 sm:overflow-visible sm:pb-0 lg:block",
                !isTabsOnLeft && "lg:order-last",
              )}
            >
              <div
                className="flex flex-row gap-2 px-4 sm:gap-3 sm:px-0 lg:block"
                role="tablist"
              >
                {tabs.map((tab, i) => (
                  <div
                    key={i}
                    role="tab"
                    aria-selected={i === safeIndex}
                    tabIndex={i === safeIndex ? 0 : -1}
                    onClick={() => setActiveIndex(i)}
                    className={cn(
                      "group relative shrink-0 cursor-pointer rounded-full px-4 py-1.5 transition-colors",
                      "lg:mb-1 lg:shrink lg:px-6 lg:py-4",
                      tabPosition === "right"
                        ? "lg:rounded-l-none lg:rounded-r-xl"
                        : "lg:rounded-r-none lg:rounded-l-xl",
                      i === safeIndex
                        ? "bg-white lg:bg-(--active-tab-bg) lg:ring-1 lg:ring-inset lg:ring-white/10"
                        : "hover:bg-white/10 lg:hover:bg-white/5",
                    )}
                    style={
                      {
                        "--active-tab-bg": activeTabBgColor,
                      } as React.CSSProperties
                    }
                  >
                    <p
                      className={cn(
                        "m-0 whitespace-nowrap text-sm font-semibold lg:whitespace-normal lg:text-base",
                        i === safeIndex
                          ? "[color:var(--active-tab-mob-fg)] lg:[color:var(--active-tab-fg)]"
                          : "[color:var(--inactive-tab-fg)] hover:[color:var(--active-tab-fg)]",
                      )}
                      style={
                        {
                          "--active-tab-mob-fg": activeTabMobileTextColor,
                          "--active-tab-fg": activeTabTextColor,
                          "--inactive-tab-fg": inactiveTabTextColor,
                        } as React.CSSProperties
                      }
                    >
                      {tab.label}
                    </p>
                    {tab.description && (
                      <p
                        className={cn(
                          "mt-2 hidden text-start text-sm lg:block",
                          i === safeIndex
                            ? "text-white"
                            : "text-white/80 group-hover:text-white",
                        )}
                      >
                        {tab.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Image / browser pane ── */}
            <div className={cn(!isTabsOnLeft && "lg:order-first")}>
              {activeTab &&
                (showBrowserChrome ? (
                  <div
                    style={
                      browserMockupMaxWidth > 0
                        ? {
                            width: `${browserMockupMaxWidth}px`,
                            maxWidth: "none",
                            margin: "0 auto",
                          }
                        : undefined
                    }
                  >
                    <BrowserMockup
                      url={activeTab.browserUrl}
                      imageSrc={activeTab.imageUrl}
                      alt={activeTab.imageAlt}
                    />
                  </div>
                ) : (
                  <img
                    src={activeTab.imageUrl}
                    alt={activeTab.imageAlt}
                    style={
                      browserMockupMaxWidth > 0
                        ? {
                            width: `${browserMockupMaxWidth}px`,
                            maxWidth: "none",
                          }
                        : undefined
                    }
                    className="w-full rounded-xl shadow-2xl"
                    loading="lazy"
                  />
                ))}
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-white/20 text-sm text-white/50">
            Add tabs using the panel on the left
          </div>
        )}
      </div>
    </section>
  );
};

// ─── Puck Config ─────────────────────────────────────────────────────────────

export const featureShowcaseConfig: ComponentConfig<FeatureShowcaseProps> = {
  label: "Feature Showcase",
  fields: {
    heading: {
      type: "text",
      label: "Heading",
      contentEditable: true,
    },
    subheading: {
      type: "textarea",
      label: "Subheading",
      contentEditable: true,
    },
    tabs: {
      type: "array",
      label: "Tabs",
      arrayFields: {
        label: { type: "text", label: "Tab Label" },
        description: {
          type: "textarea",
          label: "Tab Description (desktop only)",
        },
        imageUrl: { ...imageField, label: "Screenshot / Image URL" },
        imageAlt: { type: "text", label: "Image Alt Text" },
        browserUrl: {
          type: "text",
          label: "Browser Bar URL (shown in chrome bar)",
        },
      },
      defaultItemProps: {
        label: "Feature",
        description: "Brief description of this feature",
        imageUrl: "",
        imageAlt: "Feature screenshot",
        browserUrl: "app.staylayer.com",
      },
      getItemSummary: (item: ShowcaseTab) => item.label || "Tab",
    },
    showBrowserChrome: {
      type: "radio",
      label: "Show Browser Chrome",
      options: [
        { label: "Yes — show browser frame", value: true },
        { label: "No — plain image", value: false },
      ],
    },
    tabPosition: {
      type: "radio",
      label: "Tabs Position",
      options: [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ],
    },
    tabsWidth: {
      type: "select",
      label: "Tabs Column Width",
      options: [
        { label: "Narrow (220px)", value: "narrow" },
        { label: "Medium (280px)", value: "medium" },
        { label: "Wide (360px)", value: "wide" },
        { label: "Extra Wide (440px)", value: "x-wide" },
      ],
    },
    headingSize: {
      type: "select",
      label: "Heading Size (base, overridden by custom font size)",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
    // ── Heading / subheading customization ──
    headingAlignment: {
      type: "radio",
      label: "Heading Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    headingColor: {
      ...textColorField,
      label: "Heading Color (overrides global)",
    },
    headingFontSize: {
      type: "number",
      label: "Heading Font Size (px, 0 = use heading size preset)",
      min: 0,
      max: 120,
    },
    headingWeight: {
      type: "select",
      label: "Heading Font Weight",
      options: [
        { label: "Light", value: "light" },
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
        { label: "Extra Bold", value: "extrabold" },
        { label: "Black", value: "black" },
      ],
    },
    subheadingColor: {
      ...textColorField,
      label: "Subheading Color (overrides global)",
    },
    subheadingFontSize: {
      type: "number",
      label: "Subheading Font Size (px, 0 = responsive auto)",
      min: 0,
      max: 80,
    },
    subheadingOpacity: {
      type: "number",
      label: "Subheading Opacity (%)",
      min: 10,
      max: 100,
    },
    // ── Image / browser mockup ──
    browserMockupMaxWidth: {
      type: "number",
      label: "Image Width (px, 0 = fill container)",
      min: 0,
      max: 2000,
    },
    contentVerticalAlignment: {
      type: "radio",
      label: "Content Vertical Alignment (tabs vs image)",
      options: [
        { label: "Top", value: "start" },
        { label: "Center", value: "center" },
        { label: "Bottom", value: "end" },
      ],
    },
    paddingY: {
      type: "select",
      label: "Vertical Padding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
        { label: "2X Large", value: "2xl" },
      ],
    },
    paddingX: {
      type: "select",
      label: "Horizontal Padding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
    maxWidth: {
      type: "select",
      label: "Max Width",
      options: [
        { label: "4XL (56rem)", value: "4xl" },
        { label: "5XL (64rem)", value: "5xl" },
        { label: "6XL (72rem)", value: "6xl" },
        { label: "7XL (80rem)", value: "7xl" },
        { label: "Full Width", value: "full" },
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
    backgroundColor: { ...backgroundColorField, label: "Background Color" },
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
    backgroundImage: { ...imageField, label: "Background Image" },
    backgroundImageOpacity: {
      type: "number",
      label: "Background Image Opacity (%)",
      min: 0,
      max: 100,
    },
    textColor: { ...textColorField, label: "Heading/Subheading Color" },
    activeTabBgColor: {
      ...backgroundColorField,
      label: "Active Tab Background (desktop)",
    },
    activeTabTextColor: {
      ...textColorField,
      label: "Active Tab Text Color (desktop)",
    },
    activeTabMobileTextColor: {
      ...textColorField,
      label: "Active Tab Text Color (mobile)",
    },
    inactiveTabTextColor: {
      ...textColorField,
      label: "Inactive Tab Text Color",
    },
  },
  defaultProps: {
    heading: "Manage Smarter, Not Harder",
    subheading:
      "Streamline your operations and boost efficiency with our integrated solutions.",
    tabs: [
      {
        label: "Channel Manager",
        description:
          "Instant calendar sync across Airbnb, Booking.com, Vrbo, and 100+ other channels",
        imageUrl: "/images/crm/rooms.png",
        imageAlt: "Channel Manager dashboard",
        browserUrl: "app.staylayer.com",
      },
      {
        label: "Property Management System",
        description:
          "Control every listing, rate, and reservation from a single login",
        imageUrl: "/images/crm/overview.png",
        imageAlt: "PMS dashboard",
        browserUrl: "app.staylayer.com",
      },
      {
        label: "Reporting",
        description:
          "Gain insights into your business performance with comprehensive reports",
        imageUrl: "/images/crm/reports-cashflow.png",
        imageAlt: "Reporting dashboard",
        browserUrl: "app.staylayer.com",
      },
    ],
    showBrowserChrome: true,
    tabPosition: "left",
    tabsWidth: "medium",
    paddingY: "lg",
    paddingX: "md",
    maxWidth: "7xl",
    headingSize: "lg",
    backgroundColor: "#2563eb",
    backgroundImage: "/background-call-to-action.6a5a5672.jpg",
    backgroundImageOpacity: 80,
    textColor: "#ffffff",
    gradient: false,
    gradientFrom: "#1d4ed8",
    gradientTo: "#7c3aed",
    gradientDirection: "to-br",
    activeTabBgColor: "rgba(255,255,255,0.15)",
    activeTabTextColor: "#ffffff",
    activeTabMobileTextColor: "#2563eb",
    inactiveTabTextColor: "rgba(255,255,255,0.7)",
    headingAlignment: "center",
    headingColor: "",
    headingFontSize: 0,
    headingWeight: "bold",
    subheadingColor: "",
    subheadingFontSize: 0,
    subheadingOpacity: 80,
    browserMockupMaxWidth: 0,
    contentVerticalAlignment: "center",
  },
  render: FeatureShowcase,
};
