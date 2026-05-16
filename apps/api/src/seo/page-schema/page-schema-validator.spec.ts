import {
  validateJsonLdNodes,
  type JsonLdNode,
} from "./page-schema-validator";

describe("validateJsonLdNodes", () => {
  it("returns input.not_array when input is not an array", () => {
    const r = validateJsonLdNodes({} as unknown);
    expect(r.issues.some((i) => i.ruleId === "input.not_array")).toBe(true);
  });

  it("flags too many nodes", () => {
    const nodes = Array.from({ length: 51 }, () => ({
      "@context": "https://schema.org",
      "@type": "WebSite",
    }));
    const r = validateJsonLdNodes(nodes);
    expect(r.issues.some((i) => i.ruleId === "input.too_many_nodes")).toBe(
      true,
    );
  });

  it("flags missing @context", () => {
    const r = validateJsonLdNodes([{ "@type": "WebSite" } as JsonLdNode]);
    expect(r.issues.some((i) => i.ruleId === "context.missing")).toBe(true);
  });

  it("flags unexpected @context value", () => {
    const r = validateJsonLdNodes([
      {
        "@context": "https://example.com/",
        "@type": "WebSite",
      } as JsonLdNode,
    ]);
    expect(r.issues.some((i) => i.ruleId === "context.unexpected")).toBe(true);
  });

  it("flags missing @type", () => {
    const r = validateJsonLdNodes([
      { "@context": "https://schema.org" } as JsonLdNode,
    ]);
    expect(r.issues.some((i) => i.ruleId === "type.missing")).toBe(true);
  });

  it("flags unknown @type", () => {
    const r = validateJsonLdNodes([
      {
        "@context": "https://schema.org",
        "@type": "NotARealSchemaType",
      } as JsonLdNode,
    ]);
    expect(r.issues.some((i) => i.ruleId === "type.unknown")).toBe(true);
  });

  it("flags FAQPage missing mainEntity", () => {
    const r = validateJsonLdNodes([
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
      } as JsonLdNode,
    ]);
    expect(
      r.issues.some((i) => i.ruleId === "google.FAQPage.required.mainEntity"),
    ).toBe(true);
  });

  it("flags Event missing required props", () => {
    const r = validateJsonLdNodes([
      {
        "@context": "https://schema.org",
        "@type": "Event",
        name: "x",
      } as JsonLdNode,
    ]);
    expect(
      r.issues.some((i) => i.ruleId === "google.Event.required.startDate"),
    ).toBe(true);
    expect(
      r.issues.some((i) => i.ruleId === "google.Event.required.location"),
    ).toBe(true);
  });

  it("flags JobPosting requiring all four", () => {
    const r = validateJsonLdNodes([
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
      } as JsonLdNode,
    ]);
    expect(
      r.issues.filter((i) => i.ruleId.startsWith("google.JobPosting.required."))
        .length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("flags @id not absolute URL", () => {
    const r = validateJsonLdNodes([
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": "not-a-url",
      } as JsonLdNode,
    ]);
    expect(r.issues.some((i) => i.ruleId === "@id.not_absolute_url")).toBe(
      true,
    );
  });

  it("flags url not absolute", () => {
    const r = validateJsonLdNodes([
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        url: "/relative",
      } as JsonLdNode,
    ]);
    expect(r.issues.some((i) => i.ruleId === "url.not_absolute_url")).toBe(
      true,
    );
  });

  it("passes a valid WebSite node", () => {
    const r = validateJsonLdNodes([
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        url: "https://example.com",
        name: "Example",
      } as JsonLdNode,
    ]);
    expect(r.bySeverity.ERROR).toBe(0);
  });
});
