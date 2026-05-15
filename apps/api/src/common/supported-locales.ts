export const SUPPORTED_LOCALES = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "nl",
  "ar",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const SUPPORTED_LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);

export function isSupportedLocale(
  value: string | null | undefined,
): value is SupportedLocale {
  return SUPPORTED_LOCALE_SET.has(String(value ?? "").toLowerCase());
}
