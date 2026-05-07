export const API_URL = import.meta.env.VITE_API_URL || "/api";

export const LOCALES = ["en", "es", "fr", "de"] as const;
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
