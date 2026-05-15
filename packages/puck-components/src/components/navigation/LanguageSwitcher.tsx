import type { ComponentConfig } from "@puckeditor/core";
import type { CSSProperties } from "react";
import { useLanguageSwitcherRuntime } from "../../i18n/language-switcher-runtime";
import { cn } from "../../lib/cn";
import { backgroundColorField, textColorField } from "../../lib/fields";

const localeNames: Record<string, string> = {
  ar: "Arabic",
  de: "Deutsch",
  en: "English",
  es: "Espanol",
  fr: "Francais",
  it: "Italiano",
  nl: "Nederlands",
  pt: "Portugues",
};

const alignmentMap: Record<LanguageSwitcherProps["alignment"], string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

const panelPositionMap: Record<LanguageSwitcherProps["alignment"], string> = {
  left: "left-0",
  center: "left-1/2 -translate-x-1/2",
  right: "right-0",
};

const sizeMap = {
  sm: {
    trigger: "min-h-12 px-3 py-2",
    item: "min-h-11 px-3 py-2",
    primary: "text-sm",
    secondary: "text-[11px]",
    badge: "text-[10px] px-2 py-1",
    icon: "h-4 w-4",
    panel: "w-[18rem]",
  },
  md: {
    trigger: "min-h-14 px-4 py-3",
    item: "min-h-12 px-3.5 py-2.5",
    primary: "text-base",
    secondary: "text-xs",
    badge: "text-[11px] px-2.5 py-1",
    icon: "h-4.5 w-4.5",
    panel: "w-[20rem]",
  },
} as const;

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

function getLocaleCode(locale: string) {
  return locale.toUpperCase();
}

function getLocaleName(locale: string) {
  return localeNames[locale] || getLocaleCode(locale);
}

function getLocaleLabel(
  locale: string,
  display: LanguageSwitcherProps["display"],
) {
  if (display === "name") {
    return getLocaleName(locale);
  }

  return getLocaleCode(locale);
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9 4.03-9 9-9Zm0 0c2.6 2.37 4.2 5.37 4.2 9S14.6 18.63 12 21m0-18c-2.6 2.37-4.2 5.37-4.2 9s1.6 6.63 4.2 9m-8.1-9h16.2"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 7.5 5 5 5-5" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 10 3 3 7-7" />
    </svg>
  );
}

export interface LanguageSwitcherProps {
  display: "code" | "name";
  variant: "menu" | "segmented" | "pill" | "text";
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
  display = "name",
  variant = "menu",
  alignment = "right",
  size = "sm",
  backgroundColor = "#ffffff",
  textColor = "#0f172a",
  activeBackgroundColor = "#0f172a",
  activeTextColor = "#ffffff",
  borderColor = "#cbd5e1",
  borderRadius = 20,
  puck,
}: LanguageSwitcherProps & { puck?: { isEditing?: boolean } }) => {
  const runtime = useLanguageSwitcherRuntime();
  const currentLocale =
    runtime?.currentLocale || runtime?.defaultLocale || "en";
  const defaultLocale = runtime?.defaultLocale || "en";
  const fallbackLocales = runtime ? [currentLocale] : ["en", "de"];
  const locales = Array.from(
    new Set([...(runtime?.availableLocales || fallbackLocales), currentLocale]),
  ).filter(Boolean);

  if (locales.length < 2) {
    return <div hidden />;
  }

  const isEditing = puck?.isEditing;
  const sizeStyles = sizeMap[size];
  const paletteStyle = {
    "--lang-bg": backgroundColor,
    "--lang-fg": textColor,
    "--lang-active-bg": activeBackgroundColor,
    "--lang-active-fg": activeTextColor,
    "--lang-border": borderColor,
  } as CSSProperties;

  if (variant === "menu") {
    const triggerPrimary = getLocaleLabel(currentLocale, display);
    const triggerSecondary =
      display === "name"
        ? getLocaleCode(currentLocale)
        : getLocaleName(currentLocale);

    return (
      <div
        className={cn("flex w-full", alignmentMap[alignment])}
        style={paletteStyle}
      >
        <details className={cn("group relative", sizeStyles.panel)}>
          <summary
            className={cn(
              "list-none cursor-pointer rounded-[calc(var(--radius)+6px)] border shadow-[0_18px_48px_-32px_rgba(15,23,42,0.45)] transition-all duration-200",
              "[&::-webkit-details-marker]:hidden",
              sizeStyles.trigger,
            )}
            aria-label="Language selector"
            style={
              {
                "--radius": `${borderRadius}px`,
                backgroundColor: "var(--lang-bg)",
                borderColor: "var(--lang-border)",
                color: "var(--lang-fg)",
              } as CSSProperties
            }
          >
            <span className="flex items-center gap-3">
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border"
                style={{ borderColor: "var(--lang-border)" }}
              >
                <GlobeIcon className={sizeStyles.icon} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={cn(
                    "truncate font-semibold leading-none",
                    sizeStyles.primary,
                  )}
                >
                  {triggerPrimary}
                </span>
                <span
                  className={cn(
                    "mt-1 truncate uppercase tracking-[0.18em] opacity-65",
                    sizeStyles.secondary,
                  )}
                >
                  {triggerSecondary}
                </span>
              </span>
              <span
                className={cn(
                  "rounded-full border font-semibold uppercase tracking-[0.18em]",
                  sizeStyles.badge,
                )}
                style={{ borderColor: "var(--lang-border)" }}
              >
                {getLocaleCode(currentLocale)}
              </span>
              <ChevronIcon
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180",
                )}
              />
            </span>
          </summary>

          <div
            className={cn(
              "absolute z-20 mt-3 overflow-hidden rounded-[calc(var(--radius)+10px)] border shadow-[0_28px_70px_-28px_rgba(15,23,42,0.45)]",
              panelPositionMap[alignment],
              sizeStyles.panel,
            )}
            style={
              {
                "--radius": `${borderRadius}px`,
                backgroundColor: "var(--lang-bg)",
                borderColor: "var(--lang-border)",
              } as CSSProperties
            }
          >
            <div
              className="border-b px-4 py-3"
              style={{ borderColor: "var(--lang-border)" }}
            >
              <p
                className={cn(
                  "m-0 font-semibold uppercase tracking-[0.2em] opacity-65",
                  sizeStyles.secondary,
                )}
                style={{ color: "var(--lang-fg)" }}
              >
                Select language
              </p>
            </div>
            <div className="grid gap-1.5 p-2">
              {locales.map((locale) => {
                const active = locale === currentLocale;
                const href = runtime?.buildHref
                  ? runtime.buildHref(locale)
                  : buildLocalizedHref(
                      runtime?.pageSlug,
                      locale,
                      defaultLocale,
                    );
                const Tag = isEditing ? "button" : "a";
                const localeProps = isEditing
                  ? {
                      type: "button" as const,
                      onClick: (event: React.MouseEvent) =>
                        event.preventDefault(),
                    }
                  : { href };

                return (
                  <Tag
                    key={locale}
                    {...localeProps}
                    data-runtime-locale-link={isEditing ? undefined : "true"}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[calc(var(--radius)-4px)] border text-left no-underline transition-all duration-150",
                      sizeStyles.item,
                    )}
                    style={
                      {
                        "--radius": `${borderRadius}px`,
                        backgroundColor: active
                          ? "var(--lang-active-bg)"
                          : "var(--lang-bg)",
                        color: active
                          ? "var(--lang-active-fg)"
                          : "var(--lang-fg)",
                        borderColor: active
                          ? "var(--lang-active-bg)"
                          : "var(--lang-border)",
                      } as CSSProperties
                    }
                  >
                    <span
                      className={cn(
                        "inline-flex min-w-[3rem] items-center justify-center rounded-full border font-semibold uppercase tracking-[0.18em]",
                        sizeStyles.badge,
                      )}
                      style={{
                        borderColor: active
                          ? "rgba(255,255,255,0.22)"
                          : "var(--lang-border)",
                      }}
                    >
                      {getLocaleCode(locale)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={cn(
                          "truncate font-semibold leading-none",
                          sizeStyles.primary,
                        )}
                      >
                        {getLocaleName(locale)}
                      </span>
                      <span
                        className={cn(
                          "mt-1 uppercase tracking-[0.18em] opacity-65",
                          sizeStyles.secondary,
                        )}
                      >
                        {getLocaleCode(locale)}
                      </span>
                    </span>
                    {active ? (
                      <span
                        className={cn(
                          "rounded-full border px-2 py-1 font-semibold uppercase tracking-[0.18em]",
                          sizeStyles.secondary,
                        )}
                        style={{ borderColor: "rgba(255,255,255,0.22)" }}
                      >
                        Current
                      </span>
                    ) : (
                      <CheckIcon className="h-4 w-4 opacity-25" />
                    )}
                  </Tag>
                );
              })}
            </div>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div
      className={cn("flex w-full", alignmentMap[alignment])}
      style={paletteStyle}
    >
      <nav
        className={cn(
          "inline-flex flex-wrap items-center",
          variant === "segmented" &&
            "gap-1 rounded-[calc(var(--radius)+6px)] border p-1 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.4)]",
          variant === "pill" && "gap-2 rounded-full border p-1.5",
          variant === "text" && "gap-4",
        )}
        aria-label="Language selector"
        style={
          {
            "--radius": `${borderRadius}px`,
            backgroundColor:
              variant === "text" ? "transparent" : "var(--lang-bg)",
            borderColor:
              variant === "text" ? "transparent" : "var(--lang-border)",
          } as CSSProperties
        }
      >
        {locales.map((locale) => {
          const active = locale === currentLocale;
          const href = runtime?.buildHref
            ? runtime.buildHref(locale)
            : buildLocalizedHref(runtime?.pageSlug, locale, defaultLocale);
          const Tag = isEditing ? "button" : "a";
          const localeProps = isEditing
            ? {
                type: "button" as const,
                onClick: (event: React.MouseEvent) => event.preventDefault(),
              }
            : { href };

          return (
            <Tag
              key={locale}
              {...localeProps}
              data-runtime-locale-link={isEditing ? undefined : "true"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 no-underline transition-all duration-150",
                variant === "text"
                  ? "border-b-2 px-0 pb-1"
                  : cn(
                      "rounded-[var(--radius)] border",
                      variant === "segmented" && sizeStyles.item,
                      variant === "pill" && sizeStyles.item,
                    ),
              )}
              style={
                {
                  color:
                    variant === "text"
                      ? active
                        ? "var(--lang-active-bg)"
                        : "var(--lang-fg)"
                      : active
                        ? "var(--lang-active-fg)"
                        : "var(--lang-fg)",
                  backgroundColor:
                    variant === "text"
                      ? "transparent"
                      : active
                        ? "var(--lang-active-bg)"
                        : variant === "pill"
                          ? "rgba(255,255,255,0.72)"
                          : "transparent",
                  borderColor:
                    variant === "text"
                      ? active
                        ? "var(--lang-active-bg)"
                        : "transparent"
                      : active
                        ? "var(--lang-active-bg)"
                        : "var(--lang-border)",
                } as CSSProperties
              }
              title={getLocaleName(locale)}
            >
              {variant !== "text" && (
                <span
                  className={cn(
                    "rounded-full border font-semibold uppercase tracking-[0.18em]",
                    sizeStyles.badge,
                  )}
                  style={{
                    borderColor: active
                      ? "rgba(255,255,255,0.22)"
                      : "var(--lang-border)",
                  }}
                >
                  {getLocaleCode(locale)}
                </span>
              )}
              <span
                className={cn("font-semibold leading-none", sizeStyles.primary)}
              >
                {getLocaleLabel(locale, display)}
              </span>
            </Tag>
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
        { label: "Menu / Popover", value: "menu" },
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
    backgroundColor: { ...backgroundColorField, label: "Surface Color" },
    textColor: { ...textColorField, label: "Text Color" },
    activeBackgroundColor: {
      ...backgroundColorField,
      label: "Active Surface Color",
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
    display: "name",
    variant: "menu",
    alignment: "right",
    size: "sm",
    backgroundColor: "#ffffff",
    textColor: "#0f172a",
    activeBackgroundColor: "#0f172a",
    activeTextColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 20,
  },
  render: LanguageSwitcher,
};
