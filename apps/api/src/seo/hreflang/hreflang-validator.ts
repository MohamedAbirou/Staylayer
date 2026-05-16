import { HreflangIssueSeverity, HreflangIssueType } from "@prisma/client";

import { SUPPORTED_LOCALE_SET } from "../../common/supported-locales";

export interface HreflangValidatorPage {
  id: string;
  slug: string;
  locale: string;
  published: boolean;
}

export interface HreflangValidatorInput {
  defaultLocale: string;
  activeLocales: string[];
  pages: HreflangValidatorPage[];
}

export interface HreflangIssueDraft {
  type: HreflangIssueType;
  severity: HreflangIssueSeverity;
  slug: string;
  locale: string | null;
  pageId: string | null;
  details: Record<string, unknown>;
}

export interface HreflangValidationResult {
  totalSlugs: number;
  totalPages: number;
  issues: HreflangIssueDraft[];
  bySeverity: Record<HreflangIssueSeverity, number>;
  byType: Record<HreflangIssueType, number>;
}

/**
 * Pure hreflang validator.
 *
 * Issue rules:
 *  - MISSING_LOCALE: an active locale has no page for a slug that exists in
 *    other locales.
 *  - ORPHAN_ALTERNATE: a page exists for a locale that is not in the site's
 *    active locales (would be rendered but unadvertised, or vice versa).
 *  - MISSING_X_DEFAULT: the default-locale page is missing for a slug that
 *    exists in other locales, leaving x-default with nothing valid to point
 *    at.
 *  - UNPUBLISHED_SIBLING: a sibling locale page exists but is unpublished
 *    (the auto-generated hreflang link would 404 to crawlers).
 *  - INVALID_LOCALE_CODE: page locale is not in SUPPORTED_LOCALES.
 */
export function validateHreflang(
  input: HreflangValidatorInput,
): HreflangValidationResult {
  const activeLocales = Array.from(
    new Set(input.activeLocales.filter((l): l is string => Boolean(l))),
  );
  const activeSet = new Set(activeLocales);
  const defaultLocale = input.defaultLocale;

  const pagesBySlug = new Map<string, HreflangValidatorPage[]>();
  for (const page of input.pages) {
    if (!page.slug) continue;
    const bucket = pagesBySlug.get(page.slug) ?? [];
    bucket.push(page);
    pagesBySlug.set(page.slug, bucket);
  }

  const issues: HreflangIssueDraft[] = [];

  // Invalid locale codes (per-page, regardless of slug grouping).
  for (const page of input.pages) {
    if (!SUPPORTED_LOCALE_SET.has(page.locale)) {
      issues.push({
        type: HreflangIssueType.INVALID_LOCALE_CODE,
        severity: HreflangIssueSeverity.ERROR,
        slug: page.slug,
        locale: page.locale,
        pageId: page.id,
        details: { actualLocale: page.locale },
      });
    }
  }

  for (const [slug, pages] of pagesBySlug) {
    const localeToPage = new Map<string, HreflangValidatorPage>();
    for (const page of pages) {
      localeToPage.set(page.locale, page);
    }
    const existingLocales = new Set(localeToPage.keys());

    // MISSING_LOCALE — active locale lacks a page for this slug.
    for (const active of activeLocales) {
      if (!existingLocales.has(active)) {
        issues.push({
          type: HreflangIssueType.MISSING_LOCALE,
          severity: HreflangIssueSeverity.WARNING,
          slug,
          locale: active,
          pageId: null,
          details: {
            missingLocale: active,
            availableLocales: Array.from(existingLocales).sort(),
          },
        });
      }
    }

    // ORPHAN_ALTERNATE — page exists in locale not on the active list.
    for (const locale of existingLocales) {
      if (!activeSet.has(locale) && SUPPORTED_LOCALE_SET.has(locale)) {
        const page = localeToPage.get(locale)!;
        issues.push({
          type: HreflangIssueType.ORPHAN_ALTERNATE,
          severity: HreflangIssueSeverity.WARNING,
          slug,
          locale,
          pageId: page.id,
          details: { activeLocales },
        });
      }
    }

    // MISSING_X_DEFAULT — slug has pages but not the default-locale one.
    if (!existingLocales.has(defaultLocale)) {
      issues.push({
        type: HreflangIssueType.MISSING_X_DEFAULT,
        severity: HreflangIssueSeverity.ERROR,
        slug,
        locale: defaultLocale,
        pageId: null,
        details: { defaultLocale },
      });
    }

    // UNPUBLISHED_SIBLING — sibling exists but unpublished. Only meaningful
    // when at least one sibling IS published (otherwise the slug is entirely
    // a draft and there's no live hreflang to worry about).
    const hasAnyPublished = pages.some((p) => p.published);
    if (hasAnyPublished) {
      for (const page of pages) {
        if (!page.published && activeSet.has(page.locale)) {
          issues.push({
            type: HreflangIssueType.UNPUBLISHED_SIBLING,
            severity: HreflangIssueSeverity.INFO,
            slug,
            locale: page.locale,
            pageId: page.id,
            details: {},
          });
        }
      }
    }
  }

  const bySeverity: Record<HreflangIssueSeverity, number> = {
    [HreflangIssueSeverity.ERROR]: 0,
    [HreflangIssueSeverity.WARNING]: 0,
    [HreflangIssueSeverity.INFO]: 0,
  };
  const byType: Record<HreflangIssueType, number> = {
    [HreflangIssueType.MISSING_LOCALE]: 0,
    [HreflangIssueType.ORPHAN_ALTERNATE]: 0,
    [HreflangIssueType.MISSING_X_DEFAULT]: 0,
    [HreflangIssueType.UNPUBLISHED_SIBLING]: 0,
    [HreflangIssueType.INVALID_LOCALE_CODE]: 0,
  };
  for (const issue of issues) {
    bySeverity[issue.severity] += 1;
    byType[issue.type] += 1;
  }

  return {
    totalSlugs: pagesBySlug.size,
    totalPages: input.pages.length,
    issues,
    bySeverity,
    byType,
  };
}
