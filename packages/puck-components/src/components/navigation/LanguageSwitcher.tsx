import type { ComponentConfig } from "@puckeditor/core";
import type { CSSProperties } from "react";
import { useLanguageSwitcherRuntime } from "../../i18n/language-switcher-runtime";
import { cn } from "../../lib/cn";
import { backgroundColorField, textColorField } from "../../lib/fields";

const localeLabels: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "Deutsch",
};

const alignmentMap: Record<LanguageSwitcherProps["alignment"], string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

const sizeMap: Record<LanguageSwitcherProps["size"], string> = {
  sm: "min-h-8 px-2.5 py-1 text-xs",
  md: "min-h-9 px-3 py-1.5 text-sm",
};

function pageSlugToPathname(pageSlug?: string | null) {
  const normalized = String(pageSlug || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");

  if (!normalized || normalized === "home" || normalized === "index") {
    return "/";
  }

  return `/${normalized}`;
}

function buildLocalizedHref(
  pageSlug: string | null | undefined,
  locale: string,
  defaultLocale: string,
) {
  const basePathname = pageSlugToPathname(pageSlug);

  if (!locale || locale === defaultLocale) {
    return basePathname;
  }

  return basePathname === "/" ? `/${locale}` : `/${locale}${basePathname}`;
}

function getLocaleLabel(
  locale: string,
  display: LanguageSwitcherProps["display"],
) {
  if (display === "name") {
    return localeLabels[locale] || locale.toUpperCase();
  }

  return locale.toUpperCase();
}

export interface LanguageSwitcherProps {
  display: "code" | "name";
  variant: "segmented" | "pill" | "text";
  alignment: "left" | "center" | "right";
  size: "sm" | "md";
  backgroundColor: string;
  textColor: string;
  activeBackgroundColor: string;
  activeTextColor: string;
  borderColor: string;
  borderRadius: number;
}

export const LanguageSwitcher = ({
  display = "code",
  variant = "segmented",
  alignment = "right",
  size = "sm",
  backgroundColor = "#ffffff",
  textColor = "#334155",
  activeBackgroundColor = "#0f172a",
  activeTextColor = "#ffffff",
  borderColor = "#cbd5e1",
  borderRadius = 999,
}: LanguageSwitcherProps) => {
  const runtime = useLanguageSwitcherRuntime();
  const currentLocale = runtime?.currentLocale || runtime?.defaultLocale || "en";
  const defaultLocale = runtime?.defaultLocale || "en";
  const fallbackLocales = runtime ? [currentLocale] : ["en", "de"];
  const locales = Array.from(
    new Set([...(runtime?.availableLocales || fallbackLocales), currentLocale]),
  ).filter(Boolean);

  if (locales.length < 2) {
    return <div hidden />;
  }

  return (
    <div className={cn("flex w-full", alignmentMap[alignment])}>
      <nav
        className={cn(
          "inline-flex flex-wrap items-center gap-1 text-sm font-semibold tracking-normal",
          variant === "segmented" && "overflow-hidden border p-0.5",
          variant === "pill" && "gap-2",
          variant === "text" && "gap-3",
        )}
        aria-label="Language selector"
        style={
          {
            backgroundColor:
              variant === "segmented" ? backgroundColor : "transparent",
            borderColor,
            borderRadius,
          } as CSSProperties
        }
      >
        {locales.map((locale) => {
          const active = locale === currentLocale;
          const href = runtime?.buildHref
            ? runtime.buildHref(locale)
            : buildLocalizedHref(runtime?.pageSlug, locale, defaultLocale);

          return (
            <a
              key={locale}
              href={href}
              data-runtime-locale-link="true"
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center justify-center no-underline transition-colors",
                sizeMap[size],
                variant === "text" ? "border-b-2 px-0" : "border",
              )}
              style={
                {
                  color: active ? activeTextColor : textColor,
                  backgroundColor:
                    variant === "text"
                      ? "transparent"
                      : active
                        ? activeBackgroundColor
                        : backgroundColor,
                  borderColor:
                    variant === "text"
                      ? active
                        ? activeBackgroundColor
                        : "transparent"
                      : borderColor,
                  borderRadius: variant === "text" ? 0 : borderRadius,
                } as CSSProperties
              }
              title={localeLabels[locale] || locale.toUpperCase()}
            >
              {getLocaleLabel(locale, display)}
            </a>
          );
        })}
      </nav>
    </div>
  );
};

export const languageSwitcherConfig: ComponentConfig<LanguageSwitcherProps> = {
  label: "Language Switcher",
  fields: {
    display: {
      type: "select",
      label: "Display",
      options: [
        { label: "Locale code", value: "code" },
        { label: "Language name", value: "name" },
      ],
    },
    variant: {
      type: "select",
      label: "Style",
      options: [
        { label: "Segmented", value: "segmented" },
        { label: "Pills", value: "pill" },
        { label: "Text", value: "text" },
      ],
    },
    alignment: {
      type: "select",
      label: "Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    size: {
      type: "select",
      label: "Size",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
      ],
    },
    backgroundColor: { ...backgroundColorField, label: "Background Color" },
    textColor: { ...textColorField, label: "Text Color" },
    activeBackgroundColor: {
      ...backgroundColorField,
      label: "Active Background Color",
    },
    activeTextColor: { ...textColorField, label: "Active Text Color" },
    borderColor: { ...textColorField, label: "Border Color" },
    borderRadius: {
      type: "number",
      label: "Corner Radius (px)",
      min: 0,
      max: 999,
    },
  },
  defaultProps: {
    display: "code",
    variant: "segmented",
    alignment: "right",
    size: "sm",
    backgroundColor: "#ffffff",
    textColor: "#334155",
    activeBackgroundColor: "#0f172a",
    activeTextColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 999,
  },
  render: LanguageSwitcher,
};