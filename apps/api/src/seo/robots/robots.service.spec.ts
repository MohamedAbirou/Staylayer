/// <reference types="jest" />

import { ConfigService } from "@nestjs/config";
import { RobotsService } from "./robots.service";

// We test the pure rendering / parsing / validation methods that don't
// require a database. PrismaService and ConfigService are stubbed.
function makeService(): RobotsService {
  const prisma = {} as unknown as ConstructorParameters<
    typeof RobotsService
  >[0];
  const config = new ConfigService({});
  return new RobotsService(prisma, config);
}

describe("RobotsService.renderRobotsTxt", () => {
  const svc = makeService();

  it("emits Disallow:/ for the wildcard when indexing is paused", () => {
    const out = svc.renderRobotsTxt({
      canonicalHost: "example.com",
      indexingEnabled: false,
      robotsCustomRules: "",
      robotsAiCrawlerPolicy: {},
      sitemapEnabled: false,
    });
    expect(out).toMatch(/^User-agent: \*\nDisallow: \/\n/);
    expect(out).toContain("Host: example.com");
    expect(out).not.toContain("Sitemap:");
  });

  it("emits Allow:/ and Sitemap line when indexing is enabled", () => {
    const out = svc.renderRobotsTxt({
      canonicalHost: "example.com",
      indexingEnabled: true,
      robotsCustomRules: "",
      robotsAiCrawlerPolicy: {},
      sitemapEnabled: true,
    });
    expect(out).toMatch(/^User-agent: \*\nAllow: \/\n/);
    expect(out).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("emits an explicit group for crawlers whose policy diverges from the wildcard", () => {
    const out = svc.renderRobotsTxt({
      canonicalHost: "example.com",
      indexingEnabled: true,
      robotsCustomRules: "",
      robotsAiCrawlerPolicy: { GPTBot: "disallow" },
      sitemapEnabled: true,
    });
    expect(out).toMatch(/User-agent: GPTBot\nDisallow: \//);
  });

  it("appends operator custom rules under a comment", () => {
    const out = svc.renderRobotsTxt({
      canonicalHost: "example.com",
      indexingEnabled: true,
      robotsCustomRules: "User-agent: SpecificBot\nDisallow: /staging",
      robotsAiCrawlerPolicy: {},
      sitemapEnabled: true,
    });
    expect(out).toContain("# Custom rules");
    expect(out).toContain("User-agent: SpecificBot");
    expect(out).toContain("Disallow: /staging");
  });
});

describe("RobotsService.validateCustomRules", () => {
  const svc = makeService();

  it("flags directives that appear before any User-agent group", () => {
    const issues = svc.validateCustomRules("Disallow: /foo", true);
    expect(
      issues.find(
        (i) =>
          i.severity === "error" &&
          i.message.includes("before any User-agent group"),
      ),
    ).toBeTruthy();
  });

  it("flags noindex which is unsupported in robots.txt", () => {
    const issues = svc.validateCustomRules(
      "User-agent: *\nnoindex: /foo",
      true,
    );
    expect(
      issues.find(
        (i) => i.severity === "error" && i.message.includes("noindex"),
      ),
    ).toBeTruthy();
  });

  it("flags non-numeric Crawl-delay", () => {
    const issues = svc.validateCustomRules(
      "User-agent: *\nCrawl-delay: oops",
      true,
    );
    expect(
      issues.find((i) => i.message.includes("Crawl-delay must be")),
    ).toBeTruthy();
  });

  it("returns no errors for a well-formed group", () => {
    const issues = svc.validateCustomRules(
      "User-agent: SpecificBot\nDisallow: /staging\nAllow: /staging/public",
      true,
    );
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("warns about Disallow:/ when indexing is enabled (foot-gun)", () => {
    const issues = svc.validateCustomRules("User-agent: *\nDisallow: /", true);
    expect(
      issues.find(
        (i) =>
          i.severity === "warning" &&
          i.message.includes("Disallow: /") &&
          i.message.includes("does not remove existing pages"),
      ),
    ).toBeTruthy();
  });
});

describe("RobotsService.testRule", () => {
  const svc = makeService();

  const rendered = [
    "User-agent: *",
    "Allow: /",
    "",
    "User-agent: GPTBot",
    "Disallow: /",
    "",
    "User-agent: SpecificBot",
    "Disallow: /private",
    "Allow: /private/public",
    "",
  ].join("\n");

  it("uses the wildcard group when no specific match exists", () => {
    const result = svc.testRule({
      url: "/anything",
      userAgent: "Googlebot",
      rendered,
    });
    expect(result.decision).toBe("allow");
    expect(result.groupUserAgent).toBe("*");
  });

  it("matches user-agent case-insensitively", () => {
    const result = svc.testRule({
      url: "/research",
      userAgent: "gptbot",
      rendered,
    });
    expect(result.decision).toBe("disallow");
    expect(result.groupUserAgent).toBe("GPTBot");
  });

  it("applies longest-match precedence (Allow wins over shorter Disallow)", () => {
    const result = svc.testRule({
      url: "/private/public/article",
      userAgent: "SpecificBot",
      rendered,
    });
    expect(result.decision).toBe("allow");
    expect(result.matchedRule).toMatch(/^Allow: \/private\/public/);
  });

  it("returns disallow when the shorter Disallow matches and the Allow does not", () => {
    const result = svc.testRule({
      url: "/private/secret",
      userAgent: "SpecificBot",
      rendered,
    });
    expect(result.decision).toBe("disallow");
    expect(result.matchedRule).toMatch(/^Disallow: \/private/);
  });
});
