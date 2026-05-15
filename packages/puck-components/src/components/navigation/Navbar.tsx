import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import {
  backgroundColorField,
  textColorField,
  logoImageField,
  maxWidthMap,
  resolvePaddingClasses,
} from "../../lib/fields";
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavDropdownSubLink {
  label: string;
  href: string;
  icon: string;
}

interface NavDropdownSubSection {
  title: string;
  links: NavDropdownSubLink[];
}

interface NavDropdownLink {
  label: string;
  href: string;
  description: string;
  icon: string;
  subSections: NavDropdownSubSection[];
}

interface NavDropdownSection {
  title: string;
  links: NavDropdownLink[];
}

interface NavLink {
  label: string;
  href: string;
  openInNewTab: boolean;
  hasDropdown: boolean;
  /** "simple" = stacked sections | "columns" = sections side-by-side | "mega" = left hover + right panel */
  dropdownType: "simple" | "columns" | "mega";
  dropdownSections: NavDropdownSection[];
}

export interface NavbarProps {
  // Logo
  logoType: string;
  logoText: string;
  logoFontSize: number;
  logoFontWeight: string;
  logoImageUrl: string;
  logoImageAlt: string;
  logoHref: string;
  logoImageHeight: number;
  logoImageWidth: number;
  logoImageBgColor: string;
  logoImagePadding: number;
  logoImageBorderRadius: string;
  // Links
  links: NavLink[];
  linkFontSize: number;
  linkFontWeight: string;
  linkGap: number;
  linkOpacity: number;
  linksAlignment: string;
  dividerColor: string;
  // CTA
  ctaLabel: string;
  ctaHref: string;
  ctaVariant: string;
  ctaOpenInNewTab: boolean;
  ctaBorderRadius: string;
  ctaFontSize: number;
  ctaPaddingX: number;
  ctaPaddingY: number;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  ctaHoverBackgroundColor: string;
  ctaHoverTextColor: string;
  ctaBorderColor: string;
  ctaHoverBorderColor: string;
  // Appearance
  style: string;
  backgroundColor: string;
  backdropBlur: number;
  backgroundOpacity: number;
  textColor: string;
  linkTextColor: string;
  borderBottomColor: string;
  borderBottomWidth: number;
  shadow: string;
  borderBottom: boolean;
  // Layout
  positionType: "relative" | "sticky" | "fixed";
  mobileMenuStyle: "dropdown" | "fullscreen-right";
  navbarHeight: number;
  logoLinksGap: number;
  linksCtaGap: number;
  maxWidth: string;
  paddingX: string;
  paddingY: string;
  // Extra slot — not a Puck field, injected at render time by the website
  rightExtra?: React.ReactNode;
}

// ─── Style helpers ───────────────────────────────────────────────────────────

const shadowMap: Record<string, string> = {
  none: "",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
};

const logoBorderRadiusMap: Record<string, string> = {
  none: "0",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
};

const ctaBorderRadiusMap: Record<string, string> = {
  none: "0",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
};

const fontWeightMap: Record<string, string> = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
};

// ─── Nav icon map & picker (used in render + Puck config custom fields) ────

type SvgComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const navIconMap: Record<string, SvgComponent> = {
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

function NavIcon({
  name,
  className = "w-5 h-5",
}: {
  name: string;
  className?: string;
}) {
  const Comp = navIconMap[name];
  if (!Comp) return null;
  return <Comp className={className} />;
}

function NavIconPickerField({
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

  const IconComp = value ? navIconMap[value] : null;

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
          {Object.entries(navIconMap).map(([key, Comp]) => (
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

// ─── Component ───────────────────────────────────────────────────────────────

export const Navbar = ({
  logoType = "text",
  logoText = "Your Brand",
  logoFontSize = 20,
  logoFontWeight = "bold",
  logoImageUrl = "/images/logo.png",
  logoImageAlt = "Logo",
  logoHref = "/",
  logoImageHeight = 18,
  logoImageWidth = 0,
  logoImageBgColor = "",
  logoImagePadding = 0,
  logoImageBorderRadius = "none",
  links = [],
  linkFontSize = 14,
  linkFontWeight = "medium",
  linkGap = 4,
  linkOpacity = 80,
  linksAlignment = "center",
  dividerColor = "",
  ctaLabel = "Get started",
  ctaHref = "/pricing",
  ctaVariant = "primary",
  ctaOpenInNewTab = false,
  ctaBorderRadius = "md",
  ctaFontSize = 16,
  ctaPaddingX = 11,
  ctaPaddingY = 8,
  ctaBackgroundColor = "#FFFFFF",
  ctaTextColor = "#465469",
  ctaHoverBackgroundColor = "#314158",
  ctaHoverTextColor = "#FFFFFF",
  ctaBorderColor = "#314158",
  ctaHoverBorderColor = "#314158",
  style = "solid",
  backgroundColor = "#ffffff",
  backdropBlur = 12,
  backgroundOpacity = 95,
  textColor = "#111827",
  linkTextColor = "#111827",
  borderBottomColor = "",
  borderBottomWidth = 1,
  shadow = "sm",
  borderBottom = false,
  positionType = "relative",
  mobileMenuStyle = "dropdown",
  navbarHeight = 64,
  logoLinksGap = 33,
  linksCtaGap = 8,
  maxWidth = "2xl",
  paddingX = "md",
  paddingY = "none",
  rightExtra,
  puck,
}: NavbarProps & { puck?: { isEditing?: boolean } }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [megaHoverItem, setMegaHoverItem] = useState<{
    idx: number;
    label: string;
  } | null>(null);
  const [openMobileAccordions, setOpenMobileAccordions] = useState<Set<number>>(
    new Set(),
  );
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEditor = puck?.isEditing;
  const [dropdownLeft, setDropdownLeft] = useState(0);
  const navRef = useRef<HTMLElement | null>(null);
  const navItemRefs = useRef<(HTMLLIElement | null)[]>([]);

  const scheduleDropdownClose = () => {
    closeTimerRef.current = setTimeout(() => {
      setOpenDropdown(null);
      setMegaHoverItem(null);
    }, 120);
  };
  const cancelDropdownClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Reset accordions whenever the mobile panel closes
  useEffect(() => {
    if (!mobileOpen) setOpenMobileAccordions(new Set());
  }, [mobileOpen]);

  const safeHref = (href: string) => (isEditor ? undefined : href);
  const preventInEditor = isEditor
    ? (e: React.MouseEvent) => e.preventDefault()
    : undefined;

  // Background style
  // ── Computed values for CSS vars ─────────────────────────────────────────
  const navBgColor =
    style === "transparent"
      ? "transparent"
      : style === "blur"
        ? `${backgroundColor}${Math.round((backgroundOpacity / 100) * 255)
            .toString(16)
            .padStart(2, "0")}`
        : backgroundColor;

  // Colors apply to ALL variants — fields override variant defaults when set
  const ctaAccentColor =
    ctaBackgroundColor ||
    (ctaVariant === "primary" ? "#2563eb" : "transparent");
  const ctaFgColor =
    ctaTextColor ||
    (ctaVariant === "primary"
      ? "#ffffff"
      : ctaVariant === "ghost"
        ? textColor
        : linkTextColor || textColor);
  // ctaBorderColor ONLY controls border — never text color
  const ctaBorderProp = ctaBorderColor
    ? `1px solid ${ctaBorderColor}`
    : ctaVariant === "outline"
      ? `1px solid ${ctaFgColor}`
      : "none";
  const ctaRingVal =
    ctaVariant === "ring"
      ? `0 0 0 1px ${ctaBorderColor || linkTextColor || textColor}`
      : "none";

  const showImage = logoType === "image" || logoType === "both";
  const showText = logoType === "text" || logoType === "both";

  // In editor: always show desktop nav. On live site: JS-based responsive.
  const desktopNavVisible = isEditor || !isMobile;
  const desktopLinksClass = "flex items-center list-none m-0 p-0";

  const animStyles = `
    @keyframes navbar-dropdown-in {
      from { opacity: 0; transform: translateY(-6px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes navbar-mobile-in {
      from { opacity: 0; transform: translateY(-10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .navbar-dropdown-panel {
      animation: navbar-dropdown-in 0.16s cubic-bezier(0.16,1,0.3,1) forwards;
    }
    .navbar-mobile-menu {
      animation: navbar-mobile-in 0.2s cubic-bezier(0.16,1,0.3,1) forwards;
    }
  `;

  // ── Desktop nav item renderer ────────────────────────────────────────────
  // dropdownType: "simple" = stacked | "columns" = side-by-side | "mega" = left hover + right panel
  const renderDesktopNavItem = (link: NavLink, i: number) => {
    const dropType = link.dropdownType || "simple";
    return (
      <li
        key={i}
        ref={(el: HTMLLIElement | null) => {
          navItemRefs.current[i] = el;
        }}
        className="list-none"
        onMouseEnter={() => {
          if (link.hasDropdown && !isEditor) {
            cancelDropdownClose();
            const liEl = navItemRefs.current[i];
            const navEl = navRef.current;
            if (liEl && navEl) {
              const liRect = liEl.getBoundingClientRect();
              const navRect = navEl.getBoundingClientRect();
              setDropdownLeft(liRect.left - navRect.left - 20);
            }
            setOpenDropdown(i);
            // Auto-select first item for mega menu right panel
            if (dropType === "mega") {
              const firstLink = link.dropdownSections?.[0]?.links?.[0];
              if (firstLink)
                setMegaHoverItem({ idx: i, label: firstLink.label });
            }
          }
        }}
        onMouseLeave={() => {
          link.hasDropdown && scheduleDropdownClose();
        }}
      >
        {link.hasDropdown ? (
          <button
            type="button"
            className="flex items-center gap-0.5 bg-transparent border-none rounded-md px-3 py-2 cursor-default transition-opacity duration-150 text-(--link-fg) [font-size:var(--link-fs)] [font-weight:var(--link-weight)] opacity-(--link-opacity) hover:underline hover:underline-offset-[3px]"
          >
            {parseMarkup(link.label)}
            <svg
              className="w-3.5 h-3.5 shrink-0 transition-transform duration-200 [transform:var(--caret-r)]"
              style={
                {
                  "--caret-r":
                    openDropdown === i ? "rotate(180deg)" : "rotate(0deg)",
                } as React.CSSProperties
              }
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        ) : (
          <a
            href={safeHref(link.href)}
            target={link.openInNewTab ? "_blank" : undefined}
            rel={link.openInNewTab ? "noopener noreferrer" : undefined}
            onClick={preventInEditor}
            className="block rounded-md px-3 py-2 no-underline transition-opacity duration-150 text-(--link-fg) [font-size:var(--link-fs)] [font-weight:var(--link-weight)] opacity-(--link-opacity) [border-right:var(--divider-r)] hover:underline hover:underline-offset-[3px]"
            style={
              {
                "--divider-r": dividerColor
                  ? `1px solid ${dividerColor}`
                  : "none",
              } as React.CSSProperties
            }
          >
            {parseMarkup(link.label)}
          </a>
        )}

        {/* ── Dropdown panel — positioned at nav bottom, aligned with trigger ── */}
        {link.hasDropdown && openDropdown === i && !isEditor && (
          <div
            className="navbar-dropdown-panel absolute z-[999] bg-white shadow-lg"
            style={{ top: "100%", left: dropdownLeft }}
            onMouseEnter={() => {
              cancelDropdownClose();
              setOpenDropdown(i);
            }}
            onMouseLeave={() => {
              scheduleDropdownClose();
            }}
          >
            {/* ── Simple: stacked sections ─────────────────────────────── */}
            {dropType === "simple" && (
              <div className="p-5 min-w-[220px]">
                {(link.dropdownSections || []).map((section, si) => (
                  <div
                    key={si}
                    className={cn(
                      si > 0 && "mt-3 pt-3 border-t border-gray-100",
                    )}
                  >
                    {section.title && (
                      <p className="m-0 mb-2 px-2 text-xs font-bold uppercase tracking-[0.07em] text-(--link-fg) opacity-60">
                        {parseMarkup(section.title)}
                      </p>
                    )}
                    {(section.links || []).map((dlink, di) => (
                      <a
                        key={di}
                        href={dlink.href || "#"}
                        className="flex items-start gap-x-2 rounded-lg px-2 py-2 text-sm no-underline transition-colors duration-150 text-(--link-fg) hover:bg-[#EDF4FE]"
                      >
                        {dlink.icon && (
                          <span className="mt-0.5 shrink-0 flex">
                            <NavIcon name={dlink.icon} className="w-5 h-5" />
                          </span>
                        )}
                        <span>
                          <span className="block font-bold">
                            {parseMarkup(dlink.label)}
                          </span>
                          {dlink.description && (
                            <span className="block mt-0.5 text-xs text-gray-500">
                              {parseMarkup(dlink.description)}
                            </span>
                          )}
                        </span>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* ── Columns: sections side-by-side (Resources style) ─────── */}
            {dropType === "columns" && (
              <div className="flex gap-x-6 p-5">
                {(link.dropdownSections || []).map((section, si) => (
                  <div key={si} className="flex flex-col gap-y-2 min-w-[120px]">
                    {section.title && (
                      <p className="m-0 mb-2 px-2 text-sm font-bold text-(--link-fg)">
                        {parseMarkup(section.title)}
                      </p>
                    )}
                    {(section.links || []).map((dlink, di) => (
                      <a
                        key={di}
                        href={dlink.href || "#"}
                        className="flex items-center gap-x-2 rounded-lg px-2 py-2 no-underline transition-colors duration-150 text-(--link-fg) hover:bg-[#EDF4FE]"
                      >
                        {dlink.icon && (
                          <span className="w-5 h-5 shrink-0 flex items-center justify-center">
                            <NavIcon name={dlink.icon} className="w-5 h-5" />
                          </span>
                        )}
                        <span className="text-sm font-bold">
                          {parseMarkup(dlink.label)}
                        </span>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* ── Mega: left hover + right sub-panel (Platform style) ───── */}
            {dropType === "mega" && (
              <div className="flex gap-x-6 p-5">
                {/* Left column — hoverable items */}
                <div className="shrink-0">
                  {(link.dropdownSections || []).map((section, si) => (
                    <div key={si} className={cn(si > 0 && "mt-4")}>
                      {section.title && (
                        <p className="m-0 mb-2 px-2 uppercase text-xs font-bold text-(--link-fg) opacity-60">
                          {parseMarkup(section.title)}
                        </p>
                      )}
                      {(section.links || []).map((dlink, di) => {
                        const isHov =
                          megaHoverItem?.idx === i &&
                          megaHoverItem?.label === dlink.label;
                        return (
                          <div
                            key={di}
                            onMouseEnter={() =>
                              setMegaHoverItem({ idx: i, label: dlink.label })
                            }
                            className={cn(
                              "flex items-center gap-x-2 rounded-lg py-2 px-2 text-sm cursor-default transition-colors duration-150 text-(--link-fg) font-bold",
                              isHov ? "bg-[#EDF4FE]" : "hover:bg-[#EDF4FE]",
                            )}
                          >
                            {dlink.icon && (
                              <span className="w-5 h-5 shrink-0 flex items-center justify-center">
                                <NavIcon
                                  name={dlink.icon}
                                  className="w-5 h-5"
                                />
                              </span>
                            )}
                            {parseMarkup(dlink.label)}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {/* Right panel — sub-sections of the hovered item */}
                <div className="shrink-0 max-w-[530px]">
                  {(() => {
                    if (megaHoverItem?.idx !== i) return null;
                    const activeLink = (link.dropdownSections || [])
                      .flatMap((s) => s.links)
                      .find((l) => l.label === megaHoverItem.label);
                    if (!activeLink?.subSections?.length) return null;
                    return activeLink.subSections.map((sub, idx) => (
                      <div key={idx} className={cn(idx > 0 && "mt-4")}>
                        {sub.title && (
                          <p
                            className={cn(
                              "m-0 mb-2 px-2 text-sm font-bold text-(--link-fg)",
                              idx > 0 && "mt-2",
                            )}
                          >
                            {parseMarkup(sub.title)}
                          </p>
                        )}
                        <div className="flex flex-wrap">
                          {(sub.links || []).map((sl, sli) => (
                            <a
                              key={sli}
                              href={sl.href || "#"}
                              className="flex items-center gap-x-1 px-2 py-2 w-6/12 rounded-lg no-underline transition-colors duration-150 text-(--link-fg) hover:bg-[#EDF4FE]"
                            >
                              {sl.icon && (
                                <span className="shrink-0 flex">
                                  <NavIcon name={sl.icon} className="w-4 h-4" />
                                </span>
                              )}
                              <span className="text-sm font-bold flex items-center gap-1">
                                {parseMarkup(sl.label)}
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="shrink-0 opacity-40"
                                >
                                  <path d="M9 18l6-6-6-6" />
                                </svg>
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  // ── Shared mobile menu links — accordion for dropdown items ──────────────
  const renderMobileLinks = () => (
    <ul className="flex flex-col list-none m-0 pb-6">
      {links.map((link, i) => {
        const isOpen = openMobileAccordions.has(i);
        return (
          <li key={i}>
            {link.hasDropdown ? (
              <>
                {/* Accordion trigger */}
                <button
                  type="button"
                  onClick={() =>
                    setOpenMobileAccordions((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    })
                  }
                  className="w-full flex items-center justify-between px-5 py-3.5 bg-transparent border-none [border-bottom:1px_solid_var(--accordion-border)] text-(--link-fg) [font-size:var(--link-fs)] [font-weight:var(--link-weight)] opacity-(--link-opacity) cursor-pointer text-left"
                >
                  {parseMarkup(link.label)}
                  <svg
                    className="w-4 h-4 shrink-0 transition-transform duration-[250ms] [transform:var(--mob-caret-r)]"
                    style={
                      {
                        "--mob-caret-r": isOpen
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                      } as React.CSSProperties
                    }
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {/* Accordion body */}
                {isOpen && (
                  <div
                    style={
                      {
                        "--mob-body-border": `1px solid ${borderBottomColor || linkTextColor + "18"}`,
                        "--mob-body-bg": linkTextColor + "05",
                      } as React.CSSProperties
                    }
                    className="[border-bottom:var(--mob-body-border)] [background-color:var(--mob-body-bg)]"
                  >
                    {(link.dropdownSections || []).map((section, si) => (
                      <div key={si} className="py-2">
                        {section.title && (
                          <p className="mb-1 pt-1.5 pb-0.5 px-5 text-[11px] font-bold uppercase tracking-[0.08em] text-(--link-fg) opacity-60 m-0">
                            {parseMarkup(section.title)}
                          </p>
                        )}
                        {(section.links || []).map((dlink, di) => (
                          <a
                            key={di}
                            href={dlink.href || "#"}
                            className="flex items-center gap-2.5 px-5 py-2.5 no-underline transition-colors duration-150 text-(--link-fg) [font-size:var(--link-fs)] [opacity:calc(var(--link-opacity)*0.9)] hover:bg-[#EDF4FE]"
                          >
                            {dlink.icon && (
                              <span className="shrink-0 flex">
                                <NavIcon
                                  name={dlink.icon}
                                  className="w-5 h-5"
                                />
                              </span>
                            )}
                            <span>
                              <span className="block font-semibold">
                                {parseMarkup(dlink.label)}
                              </span>
                              {dlink.description && (
                                <span className="block text-xs text-gray-500 mt-px">
                                  {parseMarkup(dlink.description)}
                                </span>
                              )}
                            </span>
                          </a>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <a
                href={link.href}
                target={link.openInNewTab ? "_blank" : undefined}
                rel={link.openInNewTab ? "noopener noreferrer" : undefined}
                className="block px-5 py-3.5 no-underline [border-bottom:1px_solid_var(--accordion-border)] text-(--link-fg) [font-size:var(--link-fs)] [font-weight:var(--link-weight)] opacity-(--link-opacity)"
              >
                {parseMarkup(link.label)}
              </a>
            )}
          </li>
        );
      })}
      {ctaVariant !== "none" && ctaLabel && (
        <li className="px-5 py-4">
          <a
            href={ctaHref}
            target={ctaOpenInNewTab ? "_blank" : undefined}
            rel={ctaOpenInNewTab ? "noopener noreferrer" : undefined}
            className={cn(
              "block text-center no-underline transition-all duration-200 cursor-pointer",
              "[font-size:var(--cta-fs)] [font-weight:var(--cta-weight)] [border-radius:var(--cta-radius)]",
              "px-(--cta-px) py-(--cta-py)",
              "bg-(--cta-bg) text-(--cta-fg)",
              ctaHoverBackgroundColor && "[&:hover]:bg-(--cta-hover-bg)",
              ctaHoverTextColor && "[&:hover]:text-(--cta-hover-fg)",
              ctaHoverBorderColor &&
                "[&:hover]:[border:var(--cta-hover-border)]",
              (ctaVariant === "outline" ||
                !!ctaBorderColor ||
                !!ctaHoverBorderColor) &&
                "[border:var(--cta-border)]",
              ctaVariant === "ring" && "[box-shadow:var(--cta-ring)]",
            )}
          >
            {parseMarkup(ctaLabel)}
          </a>
        </li>
      )}
    </ul>
  );

  return (
    <nav
      ref={(el) => {
        navRef.current = el;
      }}
      className={cn(
        "w-full z-50 bg-(--navbar-bg) [border-bottom:var(--navbar-border-b)]",
        style === "blur" &&
          "[backdrop-filter:var(--navbar-blur)] [-webkit-backdrop-filter:var(--navbar-blur)]",
        positionType === "fixed" || (!positionType && false)
          ? "fixed top-0 left-0 right-0"
          : positionType === "sticky"
            ? "sticky top-0"
            : "relative",
        shadowMap[shadow],
      )}
      style={
        {
          "--navbar-bg": navBgColor,
          "--navbar-blur":
            style === "blur" ? `blur(${backdropBlur}px)` : "none",
          "--navbar-border-b": borderBottom
            ? `${borderBottomWidth}px solid ${borderBottomColor || textColor + "33"}`
            : "none",
          "--navbar-h": `${navbarHeight}px`,
          "--logo-links-gap": `${logoLinksGap}px`,
          "--link-gap": `${linkGap}px`,
          "--links-cta-gap": `${linksCtaGap}px`,
          "--fg": textColor,
          "--link-fg": linkTextColor,
          "--link-fs": `${linkFontSize}px`,
          "--link-weight": fontWeightMap[linkFontWeight] ?? "500",
          "--link-opacity": String(linkOpacity / 100),
          "--cta-bg": ctaAccentColor,
          "--cta-fg": ctaFgColor,
          "--cta-hover-bg": ctaHoverBackgroundColor || undefined,
          "--cta-hover-fg": ctaHoverTextColor || undefined,
          "--cta-hover-border": ctaHoverBorderColor
            ? `1px solid ${ctaHoverBorderColor}`
            : undefined,
          "--cta-border": ctaBorderProp,
          "--cta-ring": ctaRingVal,
          "--cta-fs": `${ctaFontSize}px`,
          "--cta-px": `${ctaPaddingX}px`,
          "--cta-py": `${ctaPaddingY}px`,
          "--cta-radius": ctaBorderRadiusMap[ctaBorderRadius] ?? "8px",
          "--cta-weight": fontWeightMap[linkFontWeight] ?? "500",
          "--logo-h": `${logoImageHeight}px`,
          "--logo-w": logoImageWidth > 0 ? `${logoImageWidth}px` : "auto",
          "--logo-img-radius":
            logoBorderRadiusMap[logoImageBorderRadius] ?? "0",
          "--logo-bg": logoImageBgColor || "transparent",
          "--logo-pad": logoImagePadding > 0 ? `${logoImagePadding}px` : "0",
          "--logo-fs": `${logoFontSize}px`,
          "--logo-weight": fontWeightMap[logoFontWeight] ?? "700",
          "--accordion-border": borderBottomColor || linkTextColor + "18",
        } as React.CSSProperties
      }
    >
      <style dangerouslySetInnerHTML={{ __html: animStyles }} />
      {/* Constrained inner container — maxWidth + padding via Tailwind classes */}
      <div
        className={cn(
          "mx-auto",
          maxWidthMap[maxWidth],
          resolvePaddingClasses(paddingY, paddingX),
        )}
      >
        <div className="flex items-center justify-between gap-4 h-(--navbar-h)">
          <div className="flex items-center shrink-0 gap-(--logo-links-gap)">
            {/* ── Logo ── */}
            <a
              href={safeHref(logoHref)}
              onClick={preventInEditor}
              className="flex items-center gap-2.5 shrink-0 no-underline text-(--fg)"
            >
              {showImage && logoImageUrl && (
                <img
                  src={logoImageUrl}
                  alt={logoImageAlt}
                  className="block shrink-0 h-(--logo-h) w-(--logo-w) bg-(--logo-bg) [padding:var(--logo-pad)] [border-radius:var(--logo-img-radius)]"
                />
              )}
              {showText && logoText && (
                <span className="[font-size:var(--logo-fs)] [font-weight:var(--logo-weight)] leading-[1.1] tracking-tight">
                  {parseMarkup(logoText)}
                </span>
              )}
            </a>

            {/* ── Desktop nav links ── */}
            {desktopNavVisible && linksAlignment === "left" && (
              <ul className={cn(desktopLinksClass, "mx-auto gap-(--link-gap)")}>
                {links.map((link, i) => renderDesktopNavItem(link, i))}
              </ul>
            )}
          </div>

          {desktopNavVisible && linksAlignment === "center" && (
            <ul className={cn(desktopLinksClass, "mx-auto gap-(--link-gap)")}>
              {links.map((link, i) => renderDesktopNavItem(link, i))}
            </ul>
          )}

          <div className="flex items-center shrink-0 gap-(--links-cta-gap)">
            {/* ── Desktop nav links ── */}
            {desktopNavVisible && linksAlignment === "right" && (
              <ul className={cn(desktopLinksClass, "mr-2 gap-(--link-gap)")}>
                {links.map((link, i) => renderDesktopNavItem(link, i))}
              </ul>
            )}

            {/* ── CTA + hamburger ── */}
            {ctaVariant !== "none" && ctaLabel && (isEditor || !isMobile) && (
              <a
                href={safeHref(ctaHref)}
                target={ctaOpenInNewTab ? "_blank" : undefined}
                rel={ctaOpenInNewTab ? "noopener noreferrer" : undefined}
                onClick={preventInEditor}
                className={cn(
                  "inline-flex items-center justify-center no-underline transition-all duration-200 cursor-pointer",
                  "[font-size:var(--cta-fs)] [font-weight:var(--cta-weight)] [border-radius:var(--cta-radius)]",
                  "px-(--cta-px) py-(--cta-py)",
                  "bg-(--cta-bg) text-(--cta-fg)",
                  ctaHoverBackgroundColor && "[&:hover]:bg-(--cta-hover-bg)",
                  ctaHoverTextColor && "[&:hover]:text-(--cta-hover-fg)",
                  ctaHoverBorderColor &&
                    "[&:hover]:[border:var(--cta-hover-border)]",
                  (ctaVariant === "outline" ||
                    !!ctaBorderColor ||
                    !!ctaHoverBorderColor) &&
                    "[border:var(--cta-border)]",
                  ctaVariant === "ring" && "[box-shadow:var(--cta-ring)]",
                )}
              >
                {parseMarkup(ctaLabel)}
              </a>
            )}

            {/* Extra slot injected at render time (e.g. LanguageSelector on the website) */}
            {rightExtra && !isEditor && !isMobile && (
              <div className="shrink-0">{rightExtra}</div>
            )}

            {/* Hamburger — hidden in editor, shows on mobile live. Two spans morph to ✕ */}
            {!isEditor && isMobile && (
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="text-(--fg) bg-transparent border-none p-1.5 rounded-md cursor-pointer inline-flex items-center justify-center w-10 h-10 relative -mr-1.5"
              >
                <div className="w-6 h-6 relative flex flex-col justify-center items-center">
                  <span
                    className="block w-[22px] h-[2px] bg-current rounded-sm [transition:transform_0.3s,opacity_0.3s] [transform:var(--ham-top)]"
                    style={
                      {
                        "--ham-top": mobileOpen
                          ? "rotate(45deg) translateY(1px)"
                          : "translateY(-4px)",
                      } as React.CSSProperties
                    }
                  />
                  <span
                    className="block w-[22px] h-[2px] bg-current rounded-sm [transition:transform_0.3s,opacity_0.3s] [transform:var(--ham-bot)]"
                    style={
                      {
                        "--ham-bot": mobileOpen
                          ? "rotate(-45deg) translateY(-1px)"
                          : "translateY(4px)",
                      } as React.CSSProperties
                    }
                  />
                </div>
              </button>
            )}
          </div>
        </div>

        {/* ── Mobile menu — only on live site ── */}

        {/* Fullscreen slide-from-right (like the website) */}
        {!isEditor &&
          isMobile &&
          mobileMenuStyle === "fullscreen-right" &&
          createPortal(
            <div
              style={
                {
                  "--navbar-h": `${navbarHeight}px`,
                  "--fg": textColor,
                  "--accordion-border":
                    borderBottomColor || linkTextColor + "18",
                  "--link-fg": linkTextColor,
                  "--link-fs": `${linkFontSize}px`,
                  "--link-weight": fontWeightMap[linkFontWeight] ?? "500",
                  "--link-opacity": String(linkOpacity / 100),
                  "--cta-bg": ctaAccentColor,
                  "--cta-fg": ctaFgColor,
                  "--cta-hover-bg": ctaHoverBackgroundColor || undefined,
                  "--cta-hover-fg": ctaHoverTextColor || undefined,
                  "--cta-border": ctaBorderProp,
                  "--cta-ring": ctaRingVal,
                  "--cta-fs": `${ctaFontSize}px`,
                  "--cta-px": `${ctaPaddingX}px`,
                  "--cta-py": `${ctaPaddingY}px`,
                  "--cta-radius": ctaBorderRadiusMap[ctaBorderRadius] ?? "8px",
                  "--cta-weight": fontWeightMap[linkFontWeight] ?? "500",
                } as React.CSSProperties
              }
            >
              {/* Backdrop — tap outside to close */}
              <div
                className={cn(
                  "fixed inset-0 z-[9998] bg-black/35 transition-opacity duration-300 ease-in-out",
                  mobileOpen
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none",
                )}
                onClick={() => setMobileOpen(false)}
              />
              {/* Panel — full width on phones, 400px drawer on tablets */}
              <div
                className="fixed inset-y-0 right-0 z-[9999] bg-white overflow-y-auto w-[min(100vw,400px)] flex flex-col transition-transform duration-300 ease-in-out [transform:var(--panel-tx)] shadow-[-4px_0_24px_rgba(0,0,0,.12)]"
                style={
                  {
                    "--panel-tx": mobileOpen
                      ? "translateX(0)"
                      : "translateX(100%)",
                  } as React.CSSProperties
                }
              >
                {/* Sticky header with close button */}
                <div className="sticky top-0 z-[1] flex items-center justify-between pl-5 pr-3 h-(--navbar-h) [border-bottom:1px_solid_var(--accordion-border)] bg-white shrink-0">
                  <span className="text-xs font-bold uppercase tracking-[0.08em] text-(--fg) opacity-40">
                    Menu
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close menu"
                    className="bg-transparent border-none cursor-pointer p-2 rounded-lg text-(--fg) flex items-center justify-center transition-[background] duration-150 hover:bg-gray-100"
                  >
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                {renderMobileLinks()}
              </div>
            </div>,
            document.body,
          )}

        {/* Inline dropdown with slide-down animation */}
        {!isEditor && mobileMenuStyle !== "fullscreen-right" && mobileOpen && (
          <div
            className="navbar-mobile-menu [border-top:var(--mob-top-border)]"
            style={
              {
                "--mob-top-border": `1px solid ${borderBottomColor || linkTextColor + "33"}`,
              } as React.CSSProperties
            }
          >
            {renderMobileLinks()}
          </div>
        )}
      </div>
    </nav>
  );
};

// ─── Puck Config ─────────────────────────────────────────────────────────────
export const navbarConfig: ComponentConfig<NavbarProps> = {
  label: "Navbar",
  fields: {
    // ── Logo ──
    logoType: {
      type: "select",
      label: "Logo Type",
      options: [
        { label: "Text only", value: "text" },
        { label: "Image only", value: "image" },
        { label: "Image + Text", value: "both" },
      ],
    },
    logoText: {
      type: "text",
      label: "Brand / Site Name",
      contentEditable: true,
    },
    logoFontSize: {
      type: "number",
      label: "Logo Font Size (px)",
      min: 12,
      max: 48,
    },
    logoFontWeight: {
      type: "select",
      label: "Logo Font Weight",
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
    textColor: { ...textColorField, label: "Text / Icon Color" },
    logoImageUrl: { ...logoImageField, label: "Logo Image" },
    logoImageAlt: { type: "text", label: "Logo Image Alt Text" },
    logoImageHeight: {
      type: "number",
      label: "Logo Height (px)",
      min: 16,
      max: 120,
    },
    logoImageWidth: {
      type: "number",
      label: "Logo Width (px, 0 = auto)",
      min: 0,
      max: 400,
    },
    logoImageBgColor: {
      ...backgroundColorField,
      label: "Logo Background Color",
    },
    logoImagePadding: {
      type: "number",
      label: "Logo Padding (px)",
      min: 0,
      max: 24,
    },
    logoImageBorderRadius: {
      type: "select",
      label: "Logo Corner Radius",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
        { label: "Circle / Pill", value: "full" },
      ],
    },
    logoHref: { type: "text", label: "Logo Link URL" },

    // ── Navigation Links ──
    links: {
      type: "array",
      label: "Navigation Links",
      arrayFields: {
        label: { type: "text", label: "Label", contentEditable: true },
        href: { type: "text", label: "URL (leave empty if using dropdown)" },
        openInNewTab: {
          type: "radio",
          label: "Open in New Tab",
          options: [
            { label: "No", value: false },
            { label: "Yes", value: true },
          ],
        },
        hasDropdown: {
          type: "radio",
          label: "Has Dropdown Menu",
          options: [
            { label: "No — plain link", value: false },
            { label: "Yes — dropdown", value: true },
          ],
        },
        dropdownType: {
          type: "select",
          label: "Dropdown Layout",
          options: [
            { label: "Simple (stacked sections)", value: "simple" },
            {
              label: "Columns (sections side-by-side, like Resources menu)",
              value: "columns",
            },
            {
              label: "Mega (left hover + right panel, like Platform menu)",
              value: "mega",
            },
          ],
        },
        dropdownSections: {
          type: "array",
          label: "Dropdown Sections",
          arrayFields: {
            title: {
              type: "text",
              label: "Section Title (optional)",
            },
            links: {
              type: "array",
              label: "Links in this section",
              arrayFields: {
                label: { type: "text", label: "Link Label" },
                href: { type: "text", label: "URL" },
                description: {
                  type: "text",
                  label: "Description (optional, shown below label)",
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
                  }) => (
                    <NavIconPickerField
                      value={value || ""}
                      onChange={onChange}
                    />
                  ),
                },
                subSections: {
                  type: "array",
                  label: "Sub-sections (Mega menu right panel only)",
                  arrayFields: {
                    title: { type: "text", label: "Sub-section Title" },
                    links: {
                      type: "array",
                      label: "Sub-links",
                      arrayFields: {
                        label: { type: "text", label: "Label" },
                        href: { type: "text", label: "URL" },
                        icon: {
                          type: "custom",
                          label: "Icon",
                          render: ({
                            value,
                            onChange,
                          }: {
                            value: string;
                            onChange: (v: string) => void;
                          }) => (
                            <NavIconPickerField
                              value={value || ""}
                              onChange={onChange}
                            />
                          ),
                        },
                      },
                      defaultItemProps: { label: "Link", href: "/", icon: "" },
                      getItemSummary: (item: NavDropdownSubLink) =>
                        item.label || "Link",
                    },
                  },
                  defaultItemProps: {
                    title: "",
                    links: [],
                  },
                  getItemSummary: (item: NavDropdownSubSection) =>
                    item.title || "Sub-section",
                },
              },
              defaultItemProps: {
                label: "Link",
                href: "/",
                description: "",
                icon: "",
                subSections: [],
              },
              getItemSummary: (item: NavDropdownLink) => item.label || "Link",
            },
          },
          defaultItemProps: { title: "", links: [] },
          getItemSummary: (item: NavDropdownSection) => item.title || "Section",
        },
      },
      defaultItemProps: {
        label: "New Link",
        href: "/",
        openInNewTab: false,
        hasDropdown: false,
        dropdownType: "simple",
        dropdownSections: [],
      },
      getItemSummary: (item) => item.label || "Link",
    },
    linkFontSize: {
      type: "number",
      label: "Link Font Size (px)",
      min: 10,
      max: 24,
    },
    linkFontWeight: {
      type: "select",
      label: "Link Font Weight",
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
    linkTextColor: { ...textColorField, label: "Link Text Color" },
    linkOpacity: {
      type: "number",
      label: "Link Opacity (%)",
      min: 30,
      max: 100,
    },
    linkGap: {
      type: "number",
      label: "Gap Between Links (px)",
      min: 0,
      max: 48,
    },
    linksAlignment: {
      type: "radio",
      label: "Links Position",
      options: [
        { label: "Left (after logo)", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right (before CTA)", value: "right" },
      ],
    },
    logoLinksGap: {
      type: "number",
      label: "Logo → Links gap (px)",
      min: 0,
      max: 96,
    },
    linksCtaGap: {
      type: "number",
      label: "Links → CTA gap (px)",
      min: 0,
      max: 96,
    },
    dividerColor: { ...textColorField, label: "Link Divider Color (optional)" },

    // ── CTA Button ──
    ctaLabel: { type: "text", label: "CTA Label", contentEditable: true },
    ctaHref: { type: "text", label: "CTA URL" },
    ctaVariant: {
      type: "select",
      label: "CTA Style",
      options: [
        { label: "None (hidden)", value: "none" },
        { label: "Filled", value: "primary" },
        { label: "Outline (border)", value: "outline" },
        { label: "Ring (thin outline, like website)", value: "ring" },
        { label: "Ghost", value: "ghost" },
      ],
    },
    ctaOpenInNewTab: {
      type: "radio",
      label: "CTA Opens in New Tab",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    ctaBackgroundColor: { ...backgroundColorField, label: "CTA Background" },
    ctaTextColor: { ...textColorField, label: "CTA Text Color" },
    ctaHoverBackgroundColor: {
      ...backgroundColorField,
      label: "CTA Hover Background",
    },
    ctaHoverTextColor: { ...textColorField, label: "CTA Hover Text Color" },
    ctaBorderColor: { ...textColorField, label: "CTA Border Color (outline)" },
    ctaHoverBorderColor: {
      ...textColorField,
      label: "CTA Hover Border Color (outline)",
    },
    ctaBorderRadius: {
      type: "select",
      label: "CTA Corner Radius",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
        { label: "Pill", value: "full" },
      ],
    },
    ctaFontSize: {
      type: "number",
      label: "CTA Font Size (px)",
      min: 10,
      max: 24,
    },
    ctaPaddingX: {
      type: "number",
      label: "CTA Padding X (px)",
      min: 0,
      max: 64,
    },
    ctaPaddingY: {
      type: "number",
      label: "CTA Padding Y (px)",
      min: 0,
      max: 32,
    },

    // ── Appearance ──
    style: {
      type: "radio",
      label: "Background Style",
      options: [
        { label: "Solid", value: "solid" },
        { label: "Transparent", value: "transparent" },
        { label: "Frosted Glass", value: "blur" },
      ],
    },
    backgroundColor: { ...backgroundColorField, label: "Background Color" },
    backdropBlur: {
      type: "number",
      label: "Blur Intensity (px) — Frosted Glass",
      min: 0,
      max: 40,
    },
    backgroundOpacity: {
      type: "number",
      label: "Background Opacity (%) — Frosted Glass",
      min: 0,
      max: 100,
    },
    shadow: {
      type: "select",
      label: "Drop Shadow",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
    borderBottom: {
      type: "radio",
      label: "Bottom Border",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    borderBottomColor: { ...textColorField, label: "Border Color" },
    borderBottomWidth: {
      type: "number",
      label: "Border Width (px)",
      min: 1,
      max: 8,
    },
    // ── Layout ──
    navbarHeight: {
      type: "number",
      label: "Navbar Height (px)",
      min: 40,
      max: 160,
    },
    positionType: {
      type: "select",
      label: "Position",
      options: [
        { label: "Relative (normal flow)", value: "relative" },
        { label: "Sticky (sticks on scroll)", value: "sticky" },
        { label: "Fixed (always on top)", value: "fixed" },
      ],
    },
    mobileMenuStyle: {
      type: "radio",
      label: "Mobile Menu Style",
      options: [
        { label: "Dropdown (slides down)", value: "dropdown" },
        {
          label: "Fullscreen slide-right (like website)",
          value: "fullscreen-right",
        },
      ],
    },
    maxWidth: {
      type: "select",
      label: "Content Max Width",
      options: [
        { label: "Small (640px)", value: "sm" },
        { label: "Medium (768px)", value: "md" },
        { label: "Large (1024px)", value: "lg" },
        { label: "Extra Large (1280px)", value: "xl" },
        { label: "Full Width (1536px)", value: "2xl" },
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
        { label: "Extra Large", value: "xl" },
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
      ],
    },
  },
  defaultProps: {
    logoType: "image",
    logoText: "Your Brand",
    logoFontSize: 20,
    logoFontWeight: "bold",
    textColor: "#111827",
    logoImageUrl: "/images/logo.png",
    logoImageAlt: "Logo",
    logoHref: "/",
    logoImageHeight: 18,
    logoImageWidth: 0,
    logoImageBgColor: "#FFFFFF",
    logoImagePadding: 0,
    logoImageBorderRadius: "none",
    links: [
      {
        label: "Platform",
        href: "/",
        openInNewTab: false,
        hasDropdown: true,
        dropdownType: "columns",
        dropdownSections: [
          {
            title: "Features",
            links: [
              {
                label: "Website Builder",
                href: "/website-builder-vacation-rentals",
                icon: "MatrialIconsWeb",
                description: "",
                subSections: [],
              },
              {
                label: "Channel Manager (Airbnb)",
                href: "/channel-manager-airbnb",
                icon: "MatrialIconsSyncAlt",
                description: "",
                subSections: [],
              },
              {
                label: "Channel Manager (Booking.com)",
                href: "/channel-manager-booking-com",
                icon: "MatrialIconsSyncAlt",
                description: "",
                subSections: [],
              },
              {
                label: "Channel Manager (Vacation Rental)",
                href: "/channel-manager-vacation-rental",
                icon: "MatrialIconsHome",
                description: "",
                subSections: [],
              },
              {
                label: "Guest Communications",
                href: "/automatic-guest-communications-vacation-rentals",
                icon: "MatrialIconsContact",
                description: "",
                subSections: [],
              },
              {
                label: "Booking Engine",
                href: "/booking-system-engine-vacation-rental",
                icon: "MatrialIconsCalenderMonth",
                description: "",
                subSections: [],
              },
              {
                label: "Reservation System",
                href: "/reservation-system-pms-vacation-rental",
                icon: "MatrialIconsEvenetAvailable",
                description: "",
                subSections: [],
              },
              {
                label: "Dynamic Pricing",
                href: "/dynamic-pricing",
                icon: "MatrialIconsTrendingUp",
                description: "",
                subSections: [],
              },
              {
                label: "Statistics & KPIs",
                href: "/statistics-kpis-vacation-rentals",
                icon: "MatrialIconsBarChart",
                description: "",
                subSections: [],
              },
            ],
          },
        ],
      },
      {
        label: "Resources",
        href: "/resources",
        openInNewTab: false,
        hasDropdown: true,
        dropdownType: "columns",
        dropdownSections: [
          {
            title: "Explore",
            links: [
              {
                label: "Ambassador",
                href: "/ambassador",
                icon: "MatrialIconsGroup",
                description: "",
                subSections: [],
              },
              {
                label: "Guest Guide",
                href: "/guest-guide-for-vacation-rentals",
                icon: "MatrialIconsMenuBook",
                description: "",
                subSections: [],
              },
              {
                label: "Account Access",
                href: "/account-access",
                icon: "MatrialIconsLogin",
                description: "",
                subSections: [],
              },
              {
                label: "Pricing",
                href: "/pricing",
                icon: "MatrialIconsAttachMoney",
                description: "",
                subSections: [],
              },
              {
                label: "StayLayer Annual Report",
                href: "/annual-report",
                icon: "MatrialIconsBarChart",
                description: "",
                subSections: [],
              },
              {
                label: "Contact Us",
                href: "/contact-us",
                icon: "MatrialIconsContact",
                description: "",
                subSections: [],
              },
            ],
          },
          {
            title: "Company",
            links: [
              {
                label: "About",
                href: "/about",
                icon: "MatrialIconsInfo",
                description: "",
                subSections: [],
              },
              {
                label: "Careers",
                href: "/careers",
                icon: "MatrialIconsWork",
                description: "",
                subSections: [],
              },
              {
                label: "Bed & Breakfast",
                href: "/bedbreakfast",
                icon: "MatrialIconsHotel",
                description: "",
                subSections: [],
              },
              {
                label: "Boutique",
                href: "/boutique",
                icon: "MatrialIconsStoreFront",
                description: "",
                subSections: [],
              },
              {
                label: "Guest House",
                href: "/guest-house",
                icon: "MatrialIconsHome",
                description: "",
                subSections: [],
              },
              {
                label: "Vacation Apartments",
                href: "/vacation-apartments-and-homes",
                icon: "MatrialIconsApartment",
                description: "",
                subSections: [],
              },
            ],
          },
        ],
      },
    ],
    linkFontSize: 14,
    linkFontWeight: "medium",
    linkTextColor: "#111827",
    linkGap: 8,
    linkOpacity: 80,
    linksAlignment: "left",
    logoLinksGap: 33,
    linksCtaGap: 8,
    dividerColor: "",
    ctaLabel: "Get Started Today",
    ctaHref: "/pricing",
    ctaVariant: "outline",
    ctaOpenInNewTab: false,
    ctaBackgroundColor: "#FFFFFF",
    ctaTextColor: "#465469",
    ctaHoverBackgroundColor: "#314158",
    ctaHoverTextColor: "#FFFFFF",
    ctaBorderColor: "#314158",
    ctaHoverBorderColor: "#314158",
    ctaBorderRadius: "sm",
    ctaFontSize: 16,
    ctaPaddingX: 11,
    ctaPaddingY: 8,
    style: "blur",
    backgroundColor: "#FFFFFF",
    backdropBlur: 10,
    backgroundOpacity: 53,
    shadow: "none",
    borderBottom: false,
    borderBottomColor: "",
    borderBottomWidth: 1,
    navbarHeight: 64,
    positionType: "sticky",
    mobileMenuStyle: "fullscreen-right",
    maxWidth: "2xl",
    paddingX: "md",
    paddingY: "none",
  },
  render: Navbar,
};
