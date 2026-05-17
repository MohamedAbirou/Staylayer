import type { ComponentConfig } from "@puckeditor/core";
import type { ReactElement } from "react";
import { cn } from "../../lib/cn";
import {
  backgroundColorField,
  textColorField,
  logoImageField,
  maxWidthMap,
  resolvePaddingClasses,
} from "../../lib/fields";
import { parseMarkup } from "../../lib/parse-markup";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FooterLink {
  label: string;
  href: string;
  openInNewTab: boolean;
}

interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

interface SocialLink {
  platform: string;
  href: string;
  label: string;
}

interface FooterBottomLink {
  label: string;
  href: string;
  openInNewTab: boolean;
}

export interface FooterProps {
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
  logoImageBorderRadius: string;
  // Tagline
  tagline: string;
  taglineFontSize: number;
  taglineOpacity: number;
  taglineMaxWidth: number;
  // Link columns
  columns: FooterColumn[];
  columnHeadingFontSize: number;
  columnHeadingLetterSpacing: string;
  columnHeadingTransform: string;
  linkFontSize: number;
  linkOpacity: number;
  linkHoverOpacity: number;
  // Social
  socialLinks: SocialLink[];
  socialIconSize: number;
  socialIconOpacity: number;
  socialIconGap: number;
  // Bottom bar
  showBottomBar: boolean;
  copyrightText: string;
  bottomLinks: FooterBottomLink[];
  bottomBarFontSize: number;
  bottomBarOpacity: number;
  bottomBarBorderColor: string;
  bottomBarBg: string;
  bottomBarTextColor: string;
  // Appearance
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  linkHoverColor: string;
  dividerColor: string;
  borderTop: boolean;
  borderTopColor: string;
  borderTopWidth: number;
  // Layout
  maxWidth: string;
  paddingX: string;
  paddingY: string;
  // Column layout
  logoColumnWidth: string;
  columnsLayout: string;
}

// ─── Social icon SVGs ─────────────────────────────────────────────────────────

const socialIcons: Record<string, ReactElement> = {
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-[1em] h-[1em]">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-[1em] h-[1em]">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-[1em] h-[1em]">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-[1em] h-[1em]">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-[1em] h-[1em]">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-[1em] h-[1em]">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-[1em] h-[1em]">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  ),
};

const defaultSocialIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="w-[1em] h-[1em]">
    <path
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fontWeightMap: Record<string, string> = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
};

const letterSpacingMap: Record<string, string> = {
  tight: "-0.05em",
  normal: "0",
  wide: "0.05em",
  wider: "0.1em",
  widest: "0.2em",
};

const logoRadiusMap: Record<string, string> = {
  none: "0",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
};

// ─── Component ───────────────────────────────────────────────────────────────

export const Footer = ({
  logoType = "text",
  logoText = "Your Brand",
  logoFontSize = 20,
  logoFontWeight = "bold",
  logoImageUrl = "/images/logo.png",
  logoImageAlt = "Logo",
  logoHref = "/",
  logoImageHeight = 36,
  logoImageWidth = 0,
  logoImageBorderRadius = "none",
  tagline = "Making the world a better place one component at a time.",
  taglineFontSize = 14,
  taglineOpacity = 70,
  taglineMaxWidth = 280,
  columns = [],
  columnHeadingFontSize = 12,
  columnHeadingLetterSpacing = "widest",
  columnHeadingTransform = "uppercase",
  linkFontSize = 14,
  linkOpacity = 70,
  linkHoverOpacity = 100,
  socialLinks = [],
  socialIconSize = 20,
  socialIconOpacity = 60,
  socialIconGap = 12,
  showBottomBar = true,
  copyrightText = `© ${new Date().getFullYear()} Your Company. All rights reserved.`,
  bottomLinks = [],
  bottomBarFontSize = 14,
  bottomBarOpacity = 50,
  bottomBarBorderColor = "",
  bottomBarBg = "",
  bottomBarTextColor = "#696969",
  backgroundColor = "#111827",
  textColor = "#f9fafb",
  accentColor = "#6366f1",
  linkHoverColor = "",
  dividerColor = "",
  borderTop = false,
  borderTopColor = "",
  borderTopWidth = 1,
  maxWidth = "xl",
  paddingX = "md",
  paddingY = "lg",
  logoColumnWidth = "auto",
  columnsLayout = "auto",
}: FooterProps) => {
  const showLogoSection =
    logoType !== "none" || tagline || socialLinks.length > 0;
  const showImage = logoType === "image" || logoType === "both";
  const showText = logoType === "text" || logoType === "both";

  const colsGridStyle =
    columnsLayout === "auto"
      ? {}
      : ({
          "--cols-grid": `repeat(${columnsLayout}, 1fr)`,
        } as React.CSSProperties);

  const colsGridClass =
    columnsLayout === "auto" ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "";

  // Inject hover CSS via a <style> tag scoped by a unique class so link hover
  // colours work without Tailwind dynamic classes.
  const hoverStyle =
    linkHoverColor || linkHoverOpacity !== linkOpacity
      ? `
    .footer-link:hover {
      opacity: ${linkHoverOpacity / 100} !important;
      ${linkHoverColor ? `color: ${linkHoverColor} !important;` : ""}
    }
    .footer-social:hover {
      opacity: 1 !important;
    }
    .footer-bottom-link:hover {
      opacity: 0.9 !important;
    }
  `
      : "";

  return (
    <footer
      className={cn(
        "w-full bg-(--footer-bg)",
        borderTop && "[border-top:var(--footer-border-top)]",
      )}
      style={
        {
          "--footer-bg": backgroundColor || "#111827",
          "--footer-border-top": borderTop
            ? `${borderTopWidth}px solid ${borderTopColor || textColor + "20"}`
            : "none",
          "--fg": textColor,
          "--accent": accentColor || textColor,
          "--link-fs": `${linkFontSize}px`,
          "--link-opacity": String(linkOpacity / 100),
          "--logo-h": `${logoImageHeight}px`,
          "--logo-w": logoImageWidth > 0 ? `${logoImageWidth}px` : "auto",
          "--logo-radius": logoRadiusMap[logoImageBorderRadius] ?? "0",
          "--logo-fs": `${logoFontSize}px`,
          "--logo-weight": fontWeightMap[logoFontWeight] ?? "700",
          "--tagline-fs": `${taglineFontSize}px`,
          "--tagline-opacity": String(taglineOpacity / 100),
          "--tagline-max-w": `${taglineMaxWidth}px`,
          "--col-heading-fs": `${columnHeadingFontSize}px`,
          "--col-heading-ls":
            letterSpacingMap[columnHeadingLetterSpacing] ?? "0.1em",
          "--col-heading-transform": columnHeadingTransform,
          "--divider-c": dividerColor,
          "--bottom-border-top": `1px solid ${bottomBarBorderColor || textColor + "20"}`,
          "--bottom-bg": bottomBarBg || "transparent",
          "--bottom-fg": bottomBarTextColor || textColor,
          "--bottom-fs": `${bottomBarFontSize}px`,
          "--bottom-opacity": String(bottomBarOpacity / 100),
          "--social-gap": `${socialIconGap}px`,
          "--social-fs": `${socialIconSize}px`,
          "--social-opacity": String(socialIconOpacity / 100),
        } as React.CSSProperties
      }
    >
      {hoverStyle && <style dangerouslySetInnerHTML={{ __html: hoverStyle }} />}

      {/* ── Main body ── */}
      <div
        className={cn(
          "mx-auto",
          maxWidthMap[maxWidth],
          resolvePaddingClasses(paddingY, paddingX),
        )}
      >
        <div
          className={cn(
            "grid gap-10",
            showLogoSection && columns.length > 0
              ? logoColumnWidth === "auto"
                ? "grid-cols-1 lg:grid-cols-[1fr_2fr]"
                : "grid-cols-1 lg:grid-cols-[var(--logo-col-width)_1fr]"
              : "grid-cols-1",
          )}
          style={
            logoColumnWidth !== "auto"
              ? ({ "--logo-col-width": logoColumnWidth } as React.CSSProperties)
              : {}
          }
        >
          {/* ── Logo + tagline + social ── */}
          {showLogoSection && (
            <div className="flex flex-col gap-2 mb-5">
              {logoType !== "none" && (
                <a
                  href={logoHref}
                  className="inline-flex items-center gap-2 no-underline text-(--fg)"
                >
                  {showImage && logoImageUrl && (
                    <img
                      src={logoImageUrl}
                      alt={logoImageAlt}
                      className="block shrink-0 h-(--logo-h) w-(--logo-w) [border-radius:var(--logo-radius)]"
                    />
                  )}
                  {showText && logoText && (
                    <span className="[font-size:var(--logo-fs)] [font-weight:var(--logo-weight)] leading-[1.1] tracking-tight">
                      {parseMarkup(logoText)}
                    </span>
                  )}
                </a>
              )}

              {tagline && (
                <p
                  className={`leading-relaxed text-(--fg) opacity-(--tagline-opacity) max-w-[var(--tagline-max-w)]`}
                  style={{ fontSize: `var(--tagline-fs)` }}
                >
                  {parseMarkup(tagline)}
                </p>
              )}
            </div>
          )}

          {/* ── Link columns ── */}
          {columns.length > 0 && (
            <div
              className={cn(
                "grid gap-8",
                colsGridClass,
                columnsLayout !== "auto" &&
                  "[grid-template-columns:var(--cols-grid)]",
              )}
              style={colsGridStyle}
            >
              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-3">
                  {col.heading && (
                    <h3 className="text-(--accent) [font-size:var(--col-heading-fs)] [font-weight:var(--logo-weight)] [letter-spacing:var(--col-heading-ls)] [text-transform:var(--col-heading-transform)] m-0">
                      {parseMarkup(col.heading)}
                    </h3>
                  )}
                  <ul className="flex flex-col gap-2 list-none m-0 p-0">
                    {col.links.map((link, li) => (
                      <li key={li}>
                        <a
                          href={link.href}
                          target={link.openInNewTab ? "_blank" : undefined}
                          rel={
                            link.openInNewTab
                              ? "noopener noreferrer"
                              : undefined
                          }
                          className="footer-link no-underline transition-opacity text-(--fg) [font-size:var(--link-fs)] opacity-(--link-opacity)"
                        >
                          {parseMarkup(link.label)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Divider between main grid and columns when dividerColor set */}
          {dividerColor && showLogoSection && columns.length > 0 && (
            <div className="hidden lg:block col-span-full [border-top:1px_solid_var(--divider-c)] -mt-6 -mb-6" />
          )}
        </div>
      </div>

      {/* ── Bottom bar ── */}
      {showBottomBar && (
        <div className="bg-(--bottom-bg) [border-top:var(--bottom-border-top)]">
          <div
            className={cn(
              "flex flex-col sm:flex-row items-center justify-between gap-3 mx-auto py-4",
              maxWidthMap[maxWidth],
              resolvePaddingClasses(undefined, paddingX),
            )}
          >
            {copyrightText && (
              <p className="text-(--bottom-fg) [font-size:var(--bottom-fs)] opacity-(--bottom-opacity) m-0">
                {parseMarkup(copyrightText)}
              </p>
            )}
            {socialLinks.length > 0 && (
              <div className="flex flex-wrap gap-(--social-gap)">
                {socialLinks.map((s, i) => (
                  <a
                    key={i}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label || s.platform}
                    className="footer-social transition-opacity text-(--fg) opacity-(--social-opacity) [font-size:var(--social-fs)] leading-none"
                  >
                    {socialIcons[s.platform] ?? defaultSocialIcon}
                  </a>
                ))}
              </div>
            )}
            {bottomLinks.length > 0 && (
              <nav className="flex flex-wrap gap-4">
                {bottomLinks.map((bl, i) => (
                  <a
                    key={i}
                    href={bl.href}
                    target={bl.openInNewTab ? "_blank" : undefined}
                    rel={bl.openInNewTab ? "noopener noreferrer" : undefined}
                    className="footer-bottom-link no-underline transition-opacity text-(--bottom-fg) [font-size:var(--bottom-fs)] opacity-(--bottom-opacity)"
                  >
                    {parseMarkup(bl.label)}
                  </a>
                ))}
              </nav>
            )}
          </div>
        </div>
      )}
    </footer>
  );
};

// ─── Puck Config ─────────────────────────────────────────────────────────────

export const footerConfig: ComponentConfig<FooterProps> = {
  label: "Footer",
  fields: {
    // ── Logo ──
    logoType: {
      type: "select",
      label: "Logo Type",
      options: [
        { label: "None", value: "none" },
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
    logoImageUrl: { ...logoImageField, label: "Logo Image" },
    logoImageAlt: { type: "text", label: "Logo Alt Text" },
    logoHref: { type: "text", label: "Logo Link URL" },
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
    logoImageBorderRadius: {
      type: "select",
      label: "Logo Corner Radius",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
        { label: "Circle", value: "full" },
      ],
    },

    // ── Tagline ──
    tagline: {
      type: "textarea",
      label: "Tagline / Description",
      contentEditable: true,
    },
    taglineFontSize: {
      type: "number",
      label: "Tagline Font Size (px)",
      min: 10,
      max: 24,
    },
    taglineOpacity: {
      type: "number",
      label: "Tagline Opacity (%)",
      min: 10,
      max: 100,
    },
    taglineMaxWidth: {
      type: "number",
      label: "Tagline Max Width (px)",
      min: 100,
      max: 600,
    },

    // ── Link columns ──
    columns: {
      type: "array",
      label: "Link Columns",
      arrayFields: {
        heading: {
          type: "text",
          label: "Column Heading",
          contentEditable: true,
        },
        links: {
          type: "array",
          label: "Links",
          arrayFields: {
            label: { type: "text", label: "Label", contentEditable: true },
            href: { type: "text", label: "URL" },
            openInNewTab: {
              type: "radio",
              label: "Open in New Tab",
              options: [
                { label: "No", value: false },
                { label: "Yes", value: true },
              ],
            },
          },
          defaultItemProps: {
            label: "New Link",
            href: "/",
            openInNewTab: false,
          },
          getItemSummary: (item: FooterLink) => item.label || "Link",
        },
      },
      defaultItemProps: { heading: "New Column", links: [] },
      getItemSummary: (item: FooterColumn) => item.heading || "Column",
    },
    columnHeadingFontSize: {
      type: "number",
      label: "Column Heading Font Size (px)",
      min: 8,
      max: 24,
    },
    columnHeadingLetterSpacing: {
      type: "select",
      label: "Column Heading Letter Spacing",
      options: [
        { label: "Tight", value: "tight" },
        { label: "Normal", value: "normal" },
        { label: "Wide", value: "wide" },
        { label: "Wider", value: "wider" },
        { label: "Widest", value: "widest" },
      ],
    },
    columnHeadingTransform: {
      type: "select",
      label: "Column Heading Case",
      options: [
        { label: "Uppercase", value: "uppercase" },
        { label: "Capitalize", value: "capitalize" },
        { label: "Normal", value: "none" },
        { label: "Lowercase", value: "lowercase" },
      ],
    },
    linkFontSize: {
      type: "number",
      label: "Link Font Size (px)",
      min: 10,
      max: 20,
    },
    linkOpacity: {
      type: "number",
      label: "Link Opacity (%)",
      min: 10,
      max: 100,
    },
    linkHoverOpacity: {
      type: "number",
      label: "Link Hover Opacity (%)",
      min: 10,
      max: 100,
    },
    linkHoverColor: { ...textColorField, label: "Link Hover Color (optional)" },

    // ── Social links ──
    socialLinks: {
      type: "array",
      label: "Social Media Links",
      arrayFields: {
        platform: {
          type: "select",
          label: "Platform",
          options: [
            { label: "X / Twitter", value: "twitter" },
            { label: "Facebook", value: "facebook" },
            { label: "Instagram", value: "instagram" },
            { label: "LinkedIn", value: "linkedin" },
            { label: "YouTube", value: "youtube" },
            { label: "GitHub", value: "github" },
            { label: "TikTok", value: "tiktok" },
            { label: "Other / URL", value: "other" },
          ],
        },
        href: { type: "text", label: "Profile URL" },
        label: { type: "text", label: "Aria Label" },
      },
      defaultItemProps: {
        platform: "twitter",
        href: "https://twitter.com",
        label: "Twitter",
      },
      getItemSummary: (item: SocialLink) =>
        item.label || item.platform || "Social",
    },
    socialIconSize: {
      type: "number",
      label: "Social Icon Size (px)",
      min: 12,
      max: 48,
    },
    socialIconOpacity: {
      type: "number",
      label: "Social Icon Opacity (%)",
      min: 10,
      max: 100,
    },
    socialIconGap: {
      type: "number",
      label: "Social Icon Gap (px)",
      min: 4,
      max: 32,
    },

    // ── Bottom bar ──
    showBottomBar: {
      type: "radio",
      label: "Show Bottom Bar",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    copyrightText: {
      type: "text",
      label: "Copyright Text",
      contentEditable: true,
    },
    bottomLinks: {
      type: "array",
      label: "Bottom Bar Links",
      arrayFields: {
        label: { type: "text", label: "Label", contentEditable: true },
        href: { type: "text", label: "URL" },
        openInNewTab: {
          type: "radio",
          label: "Open in New Tab",
          options: [
            { label: "No", value: false },
            { label: "Yes", value: true },
          ],
        },
      },
      defaultItemProps: {
        label: "Privacy Policy",
        href: "/privacy-policy",
        openInNewTab: false,
      },
      getItemSummary: (item: FooterBottomLink) => item.label || "Link",
    },
    bottomBarFontSize: {
      type: "number",
      label: "Bottom Bar Font Size (px)",
      min: 10,
      max: 18,
    },
    bottomBarOpacity: {
      type: "number",
      label: "Bottom Bar Opacity (%)",
      min: 10,
      max: 100,
    },
    bottomBarBg: {
      ...backgroundColorField,
      label: "Bottom Bar Background (optional)",
    },
    bottomBarBorderColor: {
      ...textColorField,
      label: "Bottom Bar Border Color",
    },
    bottomBarTextColor: {
      ...textColorField,
      label: "Bottom Bar Text Color (overrides global)",
    },

    // ── Appearance ──
    backgroundColor: { ...backgroundColorField, label: "Background Color" },
    textColor: { ...textColorField, label: "Text Color" },
    accentColor: { ...textColorField, label: "Column Heading Color" },
    dividerColor: {
      ...textColorField,
      label: "Column Divider Color (optional)",
    },
    borderTop: {
      type: "radio",
      label: "Top Border",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    borderTopColor: { ...textColorField, label: "Top Border Color" },
    borderTopWidth: {
      type: "number",
      label: "Top Border Width (px)",
      min: 1,
      max: 8,
    },

    // ── Layout ──
    maxWidth: {
      type: "select",
      label: "Content Max Width",
      options: [
        { label: "Medium (768px)", value: "md" },
        { label: "Large (1024px)", value: "lg" },
        { label: "Extra Large (1280px)", value: "xl" },
        { label: "2X Large (1536px)", value: "2xl" },
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
    logoColumnWidth: {
      type: "select",
      label: "Logo Column Width",
      options: [
        { label: "Auto (1/3 of content)", value: "auto" },
        { label: "200px", value: "200px" },
        { label: "240px", value: "240px" },
        { label: "280px", value: "280px" },
        { label: "320px", value: "320px" },
        { label: "360px", value: "360px" },
        { label: "Half (50%)", value: "50%" },
      ],
    },
    columnsLayout: {
      type: "select",
      label: "Link Columns Layout",
      options: [
        { label: "Auto (responsive)", value: "auto" },
        { label: "1 Column", value: "1" },
        { label: "2 Columns", value: "2" },
        { label: "3 Columns", value: "3" },
        { label: "4 Columns", value: "4" },
        { label: "5 Columns", value: "5" },
      ],
    },
  },
  defaultProps: {
    logoType: "text",
    logoText: "Pine Hollow Lodge",
    logoFontSize: 22,
    logoFontWeight: "bold",
    logoImageUrl: "",
    logoImageAlt: "Lodge logo",
    logoHref: "/",
    logoImageHeight: 36,
    logoImageWidth: 0,
    logoImageBorderRadius: "none",
    tagline:
      "A small, independently owned lodge. Hosted in person, written to by hand, and easy to reach for direct stays.",
    taglineFontSize: 16,
    taglineOpacity: 80,
    taglineMaxWidth: 380,
    columns: [
      {
        heading: "Stay",
        links: [
          { label: "Rooms & Suites", href: "/rooms", openInNewTab: false },
          { label: "Cabins & Villas", href: "/cabins", openInNewTab: false },
          { label: "Offers & Packages", href: "/offers", openInNewTab: false },
          {
            label: "Gift Vouchers",
            href: "/gift-vouchers",
            openInNewTab: false,
          },
        ],
      },
      {
        heading: "Explore",
        links: [
          { label: "Amenities", href: "/amenities", openInNewTab: false },
          { label: "Gallery", href: "/gallery", openInNewTab: false },
          { label: "Local Guide", href: "/local-guide", openInNewTab: false },
          { label: "Our Story", href: "/about", openInNewTab: false },
        ],
      },
      {
        heading: "Plan your stay",
        links: [
          { label: "Send an Inquiry", href: "/contact", openInNewTab: false },
          { label: "FAQ", href: "/faq", openInNewTab: false },
          { label: "House Policies", href: "/policies", openInNewTab: false },
          { label: "Directions", href: "/directions", openInNewTab: false },
        ],
      },
    ],
    columnHeadingFontSize: 14,
    columnHeadingLetterSpacing: "normal",
    columnHeadingTransform: "capitalize",
    linkFontSize: 14,
    linkOpacity: 70,
    linkHoverOpacity: 100,
    linkHoverColor: "",
    socialLinks: [],
    socialIconSize: 20,
    socialIconOpacity: 60,
    socialIconGap: 12,
    showBottomBar: true,
    copyrightText: `© ${new Date().getFullYear()} Pine Hollow Lodge. All rights reserved.`,
    bottomLinks: [
      { label: "Privacy", href: "/privacy", openInNewTab: false },
      { label: "Terms", href: "/terms", openInNewTab: false },
      { label: "Cookies", href: "/cookies", openInNewTab: false },
    ],
    bottomBarFontSize: 14,
    bottomBarOpacity: 100,
    bottomBarBg: "#FFFFFF",
    bottomBarBorderColor: "#d4d4d4",
    bottomBarTextColor: "#696969",
    backgroundColor: "#FFFFFF",
    textColor: "#000000",
    accentColor: "#171717",
    dividerColor: "#FFFFFF",
    borderTop: false,
    borderTopColor: "",
    borderTopWidth: 1,
    maxWidth: "xl",
    paddingX: "xl",
    paddingY: "sm",
    logoColumnWidth: "50%",
    columnsLayout: "3",
  },
  render: Footer,
};
