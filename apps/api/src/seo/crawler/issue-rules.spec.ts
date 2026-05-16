import { inspectUrl, UrlInspection } from "./issue-rules";

function base(overrides: Partial<UrlInspection> = {}): UrlInspection {
  return {
    url: "https://example.com/",
    pathname: "/",
    statusCode: 200,
    responseTimeMs: 200,
    contentType: "text/html",
    contentLength: 1000,
    title: "Welcome to our coastal hotel",
    metaDescription:
      "A 50+ char description that nicely fits the recommended range for SEO friendliness.",
    canonical: "https://example.com/",
    h1Count: 1,
    h1First: "Welcome",
    h2Count: 2,
    h3Count: 1,
    wordCount: 500,
    imageCount: 4,
    imagesMissingAlt: 0,
    internalLinks: 5,
    externalLinks: 1,
    brokenLinks: 0,
    redirectChain: [],
    finalUrl: "https://example.com/",
    robotsHeader: null,
    indexable: true,
    noindexReason: null,
    fetchError: null,
    ...overrides,
  };
}

describe("inspectUrl", () => {
  it("returns no issues for a healthy page", () => {
    expect(inspectUrl(base())).toEqual([]);
  });

  it("flags FETCH_ERROR and short-circuits", () => {
    const out = inspectUrl(
      base({ fetchError: "timeout", statusCode: 0, title: null }),
    );
    expect(out.map((i) => i.code)).toEqual(["FETCH_ERROR"]);
  });

  it("flags 404", () => {
    const out = inspectUrl(base({ statusCode: 404, title: null }));
    expect(out.find((i) => i.code === "HTTP_404")).toBeDefined();
  });

  it("flags missing title and description", () => {
    const out = inspectUrl(base({ title: null, metaDescription: null }));
    const codes = out.map((i) => i.code);
    expect(codes).toContain("TITLE_MISSING");
    expect(codes).toContain("META_DESCRIPTION_MISSING");
  });

  it("flags overly long title", () => {
    const out = inspectUrl(base({ title: "x".repeat(80) }));
    expect(out.find((i) => i.code === "TITLE_LONG")).toBeDefined();
  });

  it("flags missing canonical", () => {
    const out = inspectUrl(base({ canonical: null }));
    expect(out.find((i) => i.code === "CANONICAL_MISSING")).toBeDefined();
  });

  it("flags off-site canonical", () => {
    const out = inspectUrl(base({ canonical: "https://different.com/" }));
    expect(out.find((i) => i.code === "CANONICAL_OFFSITE")).toBeDefined();
  });

  it("flags h1 issues", () => {
    expect(
      inspectUrl(base({ h1Count: 0, h1First: null })).map((i) => i.code),
    ).toContain("H1_MISSING");
    expect(inspectUrl(base({ h1Count: 3 })).map((i) => i.code)).toContain(
      "H1_MULTIPLE",
    );
  });

  it("flags thin content", () => {
    expect(inspectUrl(base({ wordCount: 20 })).map((i) => i.code)).toContain(
      "THIN_CONTENT",
    );
  });

  it("flags noindex", () => {
    expect(
      inspectUrl(base({ indexable: false, noindexReason: "meta robots" })).map(
        (i) => i.code,
      ),
    ).toContain("NOINDEX");
  });

  it("flags slow response", () => {
    expect(
      inspectUrl(base({ responseTimeMs: 5000 })).map((i) => i.code),
    ).toContain("SLOW_RESPONSE");
  });

  it("flags redirect chain longer than 1", () => {
    expect(
      inspectUrl(
        base({
          redirectChain: [
            { url: "a", status: 301 },
            { url: "b", status: 302 },
          ],
        }),
      ).map((i) => i.code),
    ).toContain("REDIRECT_CHAIN");
  });

  it("flags missing image alts", () => {
    expect(
      inspectUrl(base({ imagesMissingAlt: 7 })).map((i) => i.code),
    ).toContain("IMAGES_MISSING_ALT");
  });
});
