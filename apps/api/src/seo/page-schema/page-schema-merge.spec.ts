import {
  applyJsonLdOverride,
  EMPTY_OVERRIDE,
  isEmptyOverride,
  normalizeOverride,
  type JsonLdOverride,
} from "./page-schema-merge";

const auto = [
  { "@context": "https://schema.org", "@type": "WebSite", name: "S" },
  { "@context": "https://schema.org", "@type": "Organization", name: "O" },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [],
  },
];

describe("normalizeOverride", () => {
  it("returns EMPTY_OVERRIDE for non-object input", () => {
    expect(normalizeOverride(null)).toEqual(EMPTY_OVERRIDE);
    expect(normalizeOverride(42)).toEqual(EMPTY_OVERRIDE);
    expect(normalizeOverride([])).toEqual(EMPTY_OVERRIDE);
  });

  it("defaults mode to merge when invalid", () => {
    expect(normalizeOverride({ mode: "bogus" }).mode).toBe("merge");
  });

  it("accepts replace mode", () => {
    expect(normalizeOverride({ mode: "replace" }).mode).toBe("replace");
  });

  it("filters disabledTypes to strings", () => {
    const r = normalizeOverride({ disabledTypes: ["A", 1, null, "B"] });
    expect(r.disabledTypes).toEqual(["A", "B"]);
  });

  it("filters customNodes to plain objects", () => {
    const r = normalizeOverride({
      customNodes: [{ a: 1 }, "x", null, [1], { b: 2 }],
    });
    expect(r.customNodes).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

describe("isEmptyOverride", () => {
  it("treats merge + empty arrays as empty", () => {
    expect(isEmptyOverride(EMPTY_OVERRIDE)).toBe(true);
  });

  it("non-empty disabledTypes is not empty", () => {
    expect(
      isEmptyOverride({
        mode: "merge",
        disabledTypes: ["WebSite"],
        customNodes: [],
      }),
    ).toBe(false);
  });

  it("replace is never empty", () => {
    expect(
      isEmptyOverride({ mode: "replace", disabledTypes: [], customNodes: [] }),
    ).toBe(false);
  });
});

describe("applyJsonLdOverride", () => {
  it("merge with empty override returns auto nodes", () => {
    expect(applyJsonLdOverride(auto, EMPTY_OVERRIDE)).toEqual(auto);
  });

  it("merge filters disabledTypes", () => {
    const ov: JsonLdOverride = {
      mode: "merge",
      disabledTypes: ["BreadcrumbList"],
      customNodes: [],
    };
    const out = applyJsonLdOverride(auto, ov);
    expect(out.find((n) => n["@type"] === "BreadcrumbList")).toBeUndefined();
    expect(out).toHaveLength(2);
  });

  it("merge appends customNodes", () => {
    const ov: JsonLdOverride = {
      mode: "merge",
      disabledTypes: [],
      customNodes: [{ "@type": "FAQPage" }],
    };
    const out = applyJsonLdOverride(auto, ov);
    expect(out).toHaveLength(4);
    expect(out[3]).toEqual({ "@type": "FAQPage" });
  });

  it("replace returns only customNodes", () => {
    const ov: JsonLdOverride = {
      mode: "replace",
      disabledTypes: ["WebSite"],
      customNodes: [{ "@type": "Article" }],
    };
    const out = applyJsonLdOverride(auto, ov);
    expect(out).toEqual([{ "@type": "Article" }]);
  });

  it("filter handles @type arrays", () => {
    const autoMulti = [
      { "@type": ["Restaurant", "LocalBusiness"], name: "R" },
      { "@type": "WebSite", name: "S" },
    ];
    const out = applyJsonLdOverride(autoMulti, {
      mode: "merge",
      disabledTypes: ["LocalBusiness"],
      customNodes: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0]["@type"]).toBe("WebSite");
  });
});
