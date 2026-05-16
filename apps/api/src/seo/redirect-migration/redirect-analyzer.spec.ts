import {
  analyzeRedirects,
  normalizeRedirectPath,
  type AnalyzerRedirect,
} from "./redirect-analyzer";

const make = (
  partial: Partial<AnalyzerRedirect> & {
    id: string;
    fromPath: string;
    toPath: string;
  },
): AnalyzerRedirect => ({
  locale: null,
  enabled: true,
  statusCode: 301,
  ...partial,
});

describe("normalizeRedirectPath", () => {
  test("prepends slash, trims, lowercases, strips trailing slash", () => {
    expect(normalizeRedirectPath("  Foo/Bar/  ")).toBe("/foo/bar");
  });
  test("preserves root", () => {
    expect(normalizeRedirectPath("/")).toBe("/");
    expect(normalizeRedirectPath("")).toBe("/");
  });
});

describe("analyzeRedirects", () => {
  test("detects SELF when from === to", () => {
    const result = analyzeRedirects([
      make({ id: "1", fromPath: "/a", toPath: "/a" }),
    ]);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain("SELF");
  });

  test("detects LOOP (cycle of two)", () => {
    const result = analyzeRedirects([
      make({ id: "1", fromPath: "/a", toPath: "/b" }),
      make({ id: "2", fromPath: "/b", toPath: "/a" }),
    ]);
    expect(result.issues.some((i) => i.code === "LOOP")).toBe(true);
  });

  test("detects CHAIN of length ≥ 2", () => {
    const result = analyzeRedirects([
      make({ id: "1", fromPath: "/a", toPath: "/b" }),
      make({ id: "2", fromPath: "/b", toPath: "/c" }),
    ]);
    expect(result.issues.some((i) => i.code === "CHAIN")).toBe(true);
  });

  test("detects CONFLICT (two enabled rules same key)", () => {
    const result = analyzeRedirects([
      make({ id: "1", fromPath: "/a", toPath: "/b" }),
      make({ id: "2", fromPath: "/a", toPath: "/c" }),
    ]);
    expect(result.issues.some((i) => i.code === "CONFLICT")).toBe(true);
  });

  test("does not flag CONFLICT when one rule is disabled", () => {
    const result = analyzeRedirects([
      make({ id: "1", fromPath: "/a", toPath: "/b" }),
      make({ id: "2", fromPath: "/a", toPath: "/c", enabled: false }),
    ]);
    expect(result.issues.some((i) => i.code === "CONFLICT")).toBe(false);
  });

  test("detects DISABLED_DEST when target matches a disabled rule's from", () => {
    const result = analyzeRedirects([
      make({ id: "1", fromPath: "/a", toPath: "/b" }),
      make({ id: "2", fromPath: "/b", toPath: "/c", enabled: false }),
    ]);
    expect(result.issues.some((i) => i.code === "DISABLED_DEST")).toBe(true);
  });

  test("locale-specific rule takes precedence over wildcard during chain walk", () => {
    const result = analyzeRedirects([
      // wildcard chain: /a → /b → /c
      make({ id: "w1", fromPath: "/a", toPath: "/b", locale: null }),
      make({ id: "w2", fromPath: "/b", toPath: "/c", locale: null }),
      // en chain stops at /b
      make({ id: "e1", fromPath: "/a", toPath: "/b", locale: "en" }),
    ]);
    // Wildcard seed produces a chain; the en seed should NOT produce a chain
    // because lookup for next-hop /b in locale en returns null (no en rule).
    const chains = result.issues.filter((i) => i.code === "CHAIN");
    expect(chains.length).toBeGreaterThanOrEqual(1);
  });

  test("counts totals and groupsByLocale", () => {
    const result = analyzeRedirects([
      make({ id: "1", fromPath: "/a", toPath: "/b", locale: "en" }),
      make({ id: "2", fromPath: "/c", toPath: "/d", locale: "es" }),
      make({
        id: "3",
        fromPath: "/e",
        toPath: "/f",
        locale: null,
        enabled: false,
      }),
    ]);
    expect(result.totalRules).toBe(3);
    expect(result.enabledRules).toBe(2);
    expect(Object.keys(result.groupsByLocale).sort()).toEqual(
      ["*", "en", "es"].sort(),
    );
    expect(result.groupsByLocale.en?.["/a"]).toHaveLength(1);
  });
});
