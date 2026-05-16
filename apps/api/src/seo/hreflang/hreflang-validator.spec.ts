import { HreflangIssueSeverity, HreflangIssueType } from "@prisma/client";

import { validateHreflang } from "./hreflang-validator";

function page(id: string, slug: string, locale: string, published = true) {
  return { id, slug, locale, published };
}

describe("validateHreflang", () => {
  it("returns no issues when every active locale has a published page and default locale is present", () => {
    const result = validateHreflang({
      defaultLocale: "en",
      activeLocales: ["en", "fr"],
      pages: [page("p1", "home", "en"), page("p2", "home", "fr")],
    });
    expect(result.totalSlugs).toBe(1);
    expect(result.totalPages).toBe(2);
    expect(result.issues).toEqual([]);
  });

  it("flags MISSING_LOCALE for each active locale lacking a page", () => {
    const result = validateHreflang({
      defaultLocale: "en",
      activeLocales: ["en", "fr", "es"],
      pages: [page("p1", "about", "en")],
    });
    const missing = result.issues.filter(
      (i) => i.type === HreflangIssueType.MISSING_LOCALE,
    );
    expect(missing.map((m) => m.locale).sort()).toEqual(["es", "fr"]);
    expect(missing[0].severity).toBe(HreflangIssueSeverity.WARNING);
  });

  it("flags MISSING_X_DEFAULT when the default-locale page is absent for an existing slug", () => {
    const result = validateHreflang({
      defaultLocale: "en",
      activeLocales: ["en", "fr"],
      pages: [page("p2", "rooms", "fr")],
    });
    const xDefault = result.issues.find(
      (i) => i.type === HreflangIssueType.MISSING_X_DEFAULT,
    );
    expect(xDefault).toBeDefined();
    expect(xDefault?.severity).toBe(HreflangIssueSeverity.ERROR);
    expect(xDefault?.locale).toBe("en");
  });

  it("flags ORPHAN_ALTERNATE for pages whose locale is not in the active set", () => {
    const result = validateHreflang({
      defaultLocale: "en",
      activeLocales: ["en"],
      pages: [page("p1", "home", "en"), page("p2", "home", "fr")],
    });
    const orphan = result.issues.find(
      (i) => i.type === HreflangIssueType.ORPHAN_ALTERNATE,
    );
    expect(orphan?.locale).toBe("fr");
    expect(orphan?.pageId).toBe("p2");
  });

  it("flags UNPUBLISHED_SIBLING only when at least one sibling is published", () => {
    const result = validateHreflang({
      defaultLocale: "en",
      activeLocales: ["en", "fr"],
      pages: [page("p1", "spa", "en", true), page("p2", "spa", "fr", false)],
    });
    const unpub = result.issues.filter(
      (i) => i.type === HreflangIssueType.UNPUBLISHED_SIBLING,
    );
    expect(unpub).toHaveLength(1);
    expect(unpub[0].locale).toBe("fr");
    expect(unpub[0].severity).toBe(HreflangIssueSeverity.INFO);
  });

  it("does NOT flag UNPUBLISHED_SIBLING when entire slug group is unpublished", () => {
    const result = validateHreflang({
      defaultLocale: "en",
      activeLocales: ["en", "fr"],
      pages: [
        page("p1", "draft", "en", false),
        page("p2", "draft", "fr", false),
      ],
    });
    expect(
      result.issues.find(
        (i) => i.type === HreflangIssueType.UNPUBLISHED_SIBLING,
      ),
    ).toBeUndefined();
  });

  it("flags INVALID_LOCALE_CODE for non-supported locales", () => {
    const result = validateHreflang({
      defaultLocale: "en",
      activeLocales: ["en"],
      pages: [page("p1", "home", "en"), page("p2", "home", "xx-YY")],
    });
    const invalid = result.issues.find(
      (i) => i.type === HreflangIssueType.INVALID_LOCALE_CODE,
    );
    expect(invalid?.severity).toBe(HreflangIssueSeverity.ERROR);
    expect(invalid?.pageId).toBe("p2");
  });

  it("aggregates counts by severity and type", () => {
    const result = validateHreflang({
      defaultLocale: "en",
      activeLocales: ["en", "fr", "de"],
      pages: [page("p1", "home", "en"), page("p2", "home", "fr")],
    });
    // Missing "de" → 1 WARNING.
    expect(result.bySeverity.WARNING).toBe(1);
    expect(result.byType.MISSING_LOCALE).toBe(1);
    expect(result.bySeverity.ERROR).toBe(0);
  });
});
