function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

export const API_URL = import.meta.env.VITE_API_URL || "/api";
export const ADMIN_LOGIN_PATH = "/admin/login";
export const MARKETING_APP_URL = trimTrailingSlash(
  import.meta.env.VITE_MARKETING_URL || "http://localhost:3002",
);

export function buildMarketingLoginUrl(returnTo?: string | null): string {
  const url = new URL("/login", MARKETING_APP_URL);

  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    url.searchParams.set("returnTo", returnTo);
  }

  return url.toString();
}

export const LOCALES = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "nl",
  "ar",
] as const;
export type Locale = (typeof LOCALES)[number];

export interface Page {
  id: string;
  slug: string;
  locale: Locale;
  title: string;
  puckData: Record<string, unknown>;
  published: boolean;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  seoOgImage: string;
  seoCanonical: string;
  seoNoindex: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PageListItem {
  id: string;
  slug: string;
  locale: string;
  title: string;
  published: boolean;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  seoOgImage: string;
  seoNoindex: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PageVersion {
  id: string;
  savedBy: string;
  note: string;
  savedAt: string;
}
