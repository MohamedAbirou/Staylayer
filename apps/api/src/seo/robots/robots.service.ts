import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DomainStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import {
  CRAWLER_CATALOG,
  CRAWLER_USER_AGENTS,
  CrawlerCatalogEntry,
  CrawlerPolicy,
} from "../crawlers/crawler-catalog";

const MAX_EXCLUDED_PATHS = 200;
const PATH_RE = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@/%?#[\]]*$/;

export interface RobotsSettingsDto {
  siteId: string;
  robotsCustomRules: string;
  /**
   * Sparse override map. Bots not present in this map use their catalog
   * default policy. We expose the merged effective policy under
   * `effectiveAiCrawlerPolicy` so the UI can render the right toggles.
   */
  robotsAiCrawlerPolicy: Record<string, CrawlerPolicy>;
  effectiveAiCrawlerPolicy: Record<string, CrawlerPolicy>;
  sitemapExcludedPaths: string[];
  sitemapIncludeImages: boolean;
  indexingEnabled: boolean;
  catalog: ReadonlyArray<CrawlerCatalogEntry>;
}

export interface RobotsValidationIssue {
  severity: "error" | "warning" | "info";
  line: number;
  message: string;
}

export interface RobotsTestResult {
  url: string;
  pathname: string;
  userAgent: string;
  decision: "allow" | "disallow";
  matchedRule: string | null;
  groupUserAgent: string;
}

export interface RenderRobotsInput {
  canonicalHost: string;
  indexingEnabled: boolean;
  robotsCustomRules: string;
  robotsAiCrawlerPolicy: Record<string, CrawlerPolicy>;
  sitemapEnabled: boolean;
}

interface ParsedGroup {
  userAgents: string[];
  allow: string[];
  disallow: string[];
  crawlDelay: number | null;
}

@Injectable()
export class RobotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getSettings(siteId: string): Promise<RobotsSettingsDto> {
    const settings = await this.prisma.siteSettings.findUnique({
      where: { siteId },
      select: {
        robotsCustomRules: true,
        robotsAiCrawlerPolicy: true,
        sitemapExcludedPaths: true,
        sitemapIncludeImages: true,
        seoIndexingEnabled: true,
      },
    });

    if (!settings) {
      throw new NotFoundException({
        code: "SITE_SETTINGS_NOT_FOUND",
        message: "Site settings have not been initialized",
      });
    }

    const policyOverrides = this.parsePolicyOverrides(
      settings.robotsAiCrawlerPolicy,
    );

    return {
      siteId,
      robotsCustomRules: settings.robotsCustomRules ?? "",
      robotsAiCrawlerPolicy: policyOverrides,
      effectiveAiCrawlerPolicy: this.computeEffectivePolicy(policyOverrides),
      sitemapExcludedPaths: settings.sitemapExcludedPaths ?? [],
      sitemapIncludeImages: settings.sitemapIncludeImages,
      indexingEnabled: settings.seoIndexingEnabled,
      catalog: CRAWLER_CATALOG,
    };
  }

  async updateSettings(
    siteId: string,
    input: {
      robotsCustomRules?: string;
      robotsAiCrawlerPolicy?: Record<string, string>;
      sitemapExcludedPaths?: string[];
      sitemapIncludeImages?: boolean;
      updatedBy?: string;
    },
  ): Promise<RobotsSettingsDto> {
    const existing = await this.prisma.siteSettings.findUnique({
      where: { siteId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: "SITE_SETTINGS_NOT_FOUND",
        message: "Site settings have not been initialized",
      });
    }

    const payload: {
      robotsCustomRules?: string;
      robotsAiCrawlerPolicy?: Record<string, CrawlerPolicy>;
      sitemapExcludedPaths?: string[];
      sitemapIncludeImages?: boolean;
      updatedBy?: string;
    } = {};

    if (input.robotsCustomRules !== undefined) {
      payload.robotsCustomRules = input.robotsCustomRules.replace(
        /\r\n/g,
        "\n",
      );
    }

    if (input.robotsAiCrawlerPolicy !== undefined) {
      payload.robotsAiCrawlerPolicy = this.normalizePolicy(
        input.robotsAiCrawlerPolicy,
      );
    }

    if (input.sitemapExcludedPaths !== undefined) {
      payload.sitemapExcludedPaths = this.normalizeExcludedPaths(
        input.sitemapExcludedPaths,
      );
    }

    if (input.sitemapIncludeImages !== undefined) {
      payload.sitemapIncludeImages = input.sitemapIncludeImages;
    }

    if (input.updatedBy) {
      payload.updatedBy = input.updatedBy;
    }

    await this.prisma.siteSettings.update({
      where: { siteId },
      data: payload,
    });

    return this.getSettings(siteId);
  }

  /**
   * Render the canonical robots.txt for a site. Output is deterministic so
   * downstream caches (Next.js, CDN, Bing) can revalidate predictably.
   *
   * Layout:
   *   1. Wildcard `User-agent: *` group reflecting `indexingEnabled`.
   *   2. One explicit group per crawler whose policy differs from the
   *      wildcard. Order follows the catalog so diffs are reviewable.
   *   3. Operator-authored custom rules appended verbatim.
   *   4. Optional `Sitemap:` and `Host:` directives.
   */
  renderRobotsTxt(input: RenderRobotsInput): string {
    const lines: string[] = [];

    lines.push("User-agent: *");
    if (input.indexingEnabled) {
      lines.push("Allow: /");
    } else {
      lines.push("Disallow: /");
    }
    lines.push("");

    const wildcardDecision: CrawlerPolicy = input.indexingEnabled
      ? "allow"
      : "disallow";

    const effective = this.computeEffectivePolicy(input.robotsAiCrawlerPolicy);
    for (const entry of CRAWLER_CATALOG) {
      const policy = effective[entry.userAgent];
      if (!policy || policy === wildcardDecision) continue;

      lines.push(`User-agent: ${entry.userAgent}`);
      if (policy === "allow") {
        lines.push("Allow: /");
      } else {
        lines.push("Disallow: /");
      }
      lines.push("");
    }

    const trimmedCustom = (input.robotsCustomRules ?? "").trim();
    if (trimmedCustom.length > 0) {
      lines.push("# Custom rules");
      lines.push(trimmedCustom);
      lines.push("");
    }

    if (input.sitemapEnabled && input.canonicalHost) {
      lines.push(`Sitemap: https://${input.canonicalHost}/sitemap.xml`);
    }

    if (input.canonicalHost) {
      lines.push(`Host: ${input.canonicalHost}`);
    }

    return `${lines.join("\n").trimEnd()}\n`;
  }

  /**
   * Syntax + semantic validator for the operator's custom rules. Catches
   * invalid directives, dangling groups, and the common foot-gun of using
   * `Disallow:` instead of `noindex` to remove a page from search.
   */
  validateCustomRules(
    customRules: string,
    indexingEnabled: boolean,
  ): RobotsValidationIssue[] {
    const issues: RobotsValidationIssue[] = [];
    const lines = (customRules ?? "").split(/\r?\n/);

    let currentGroupHasUA = false;
    let pendingGroupHasDirective = false;
    let pendingGroupLine = 0;
    let sawSitemap = false;

    lines.forEach((rawLine, index) => {
      const lineNum = index + 1;
      const stripped = rawLine.replace(/\s*#.*$/, "").trim();
      if (stripped.length === 0) return;

      const colon = stripped.indexOf(":");
      if (colon === -1) {
        issues.push({
          severity: "error",
          line: lineNum,
          message: `Line ${lineNum}: expected "<Directive>: <value>" — got "${stripped}".`,
        });
        return;
      }

      const directive = stripped.slice(0, colon).trim().toLowerCase();
      const value = stripped.slice(colon + 1).trim();

      switch (directive) {
        case "user-agent":
          if (currentGroupHasUA && !pendingGroupHasDirective) {
            issues.push({
              severity: "warning",
              line: pendingGroupLine,
              message: `Line ${pendingGroupLine}: User-agent group has no Allow/Disallow directives — search engines will treat it as an empty rule.`,
            });
          }
          if (value.length === 0) {
            issues.push({
              severity: "error",
              line: lineNum,
              message: `Line ${lineNum}: User-agent value is empty.`,
            });
          }
          currentGroupHasUA = true;
          pendingGroupHasDirective = false;
          pendingGroupLine = lineNum;
          break;
        case "allow":
        case "disallow":
          if (!currentGroupHasUA) {
            issues.push({
              severity: "error",
              line: lineNum,
              message: `Line ${lineNum}: ${directive} appears before any User-agent group.`,
            });
          }
          pendingGroupHasDirective = true;
          if (value.length > 0 && !value.startsWith("/") && value !== "*") {
            issues.push({
              severity: "warning",
              line: lineNum,
              message: `Line ${lineNum}: ${directive} value "${value}" should start with "/". Crawlers may ignore non-absolute paths.`,
            });
          }
          if (directive === "disallow" && (value === "/" || value === "")) {
            if (indexingEnabled && value === "/") {
              issues.push({
                severity: "warning",
                line: lineNum,
                message: `Line ${lineNum}: "Disallow: /" blocks crawling but does not remove existing pages from the index. Use site-wide Indexing toggle or page-level noindex instead.`,
              });
            }
          }
          break;
        case "crawl-delay": {
          const num = Number(value);
          if (!Number.isFinite(num) || num < 0) {
            issues.push({
              severity: "error",
              line: lineNum,
              message: `Line ${lineNum}: Crawl-delay must be a non-negative number — got "${value}".`,
            });
          }
          if (Number.isFinite(num) && num > 30) {
            issues.push({
              severity: "warning",
              line: lineNum,
              message: `Line ${lineNum}: Crawl-delay > 30s causes Bingbot/Yandex to crawl very slowly; Googlebot ignores this directive entirely.`,
            });
          }
          break;
        }
        case "sitemap": {
          sawSitemap = true;
          if (!/^https?:\/\//i.test(value)) {
            issues.push({
              severity: "error",
              line: lineNum,
              message: `Line ${lineNum}: Sitemap directive must be an absolute https:// URL.`,
            });
          }
          break;
        }
        case "host":
          if (!/^[a-z0-9.-]+$/i.test(value)) {
            issues.push({
              severity: "warning",
              line: lineNum,
              message: `Line ${lineNum}: Host value "${value}" is not a valid hostname.`,
            });
          }
          break;
        case "noindex":
          issues.push({
            severity: "error",
            line: lineNum,
            message: `Line ${lineNum}: "noindex" in robots.txt is unsupported by Google since 2019. Use the per-page noindex toggle in the Editor SEO panel.`,
          });
          break;
        default:
          issues.push({
            severity: "warning",
            line: lineNum,
            message: `Line ${lineNum}: Unknown directive "${directive}". Search engines will ignore this line.`,
          });
      }
    });

    if (sawSitemap) {
      issues.push({
        severity: "info",
        line: 0,
        message:
          "A Sitemap directive in custom rules will sit alongside the platform-managed Sitemap line — duplicate entries are valid but redundant.",
      });
    }

    return issues;
  }

  /**
   * Test a URL against the rendered robots.txt for a site to preview whether
   * a specific bot is allowed to crawl it. Implements the longest-match
   * semantics from RFC 9309 (the formal Robots Exclusion Protocol).
   */
  testRule(input: {
    url: string;
    userAgent: string;
    rendered: string;
  }): RobotsTestResult {
    let pathname = "/";
    try {
      const parsed = new URL(input.url, "https://staylayer.test");
      pathname = parsed.pathname + parsed.search;
    } catch {
      throw new BadRequestException({
        code: "INVALID_URL",
        message: "Could not parse URL for robots test",
      });
    }

    const groups = this.parseRobotsGroups(input.rendered);
    const target = input.userAgent || "Googlebot";
    const lowerTarget = target.toLowerCase();

    let chosenGroup: ParsedGroup | null = null;
    let bestSpecificity = -1;
    for (const group of groups) {
      for (const ua of group.userAgents) {
        if (ua === "*") {
          if (bestSpecificity < 0) {
            chosenGroup = group;
            bestSpecificity = 0;
          }
        } else if (lowerTarget === ua.toLowerCase()) {
          chosenGroup = group;
          bestSpecificity = 2;
        } else if (
          bestSpecificity < 1 &&
          lowerTarget.startsWith(ua.toLowerCase())
        ) {
          chosenGroup = group;
          bestSpecificity = 1;
        }
      }
    }

    if (!chosenGroup) {
      return {
        url: input.url,
        pathname,
        userAgent: target,
        decision: "allow",
        matchedRule: null,
        groupUserAgent: "*",
      };
    }

    const allowMatch = this.longestMatch(pathname, chosenGroup.allow);
    const disallowMatch = this.longestMatch(pathname, chosenGroup.disallow);

    // RFC 9309: longest-match wins. If equal length, Allow wins.
    if (allowMatch && disallowMatch) {
      if (allowMatch.length >= disallowMatch.length) {
        return {
          url: input.url,
          pathname,
          userAgent: target,
          decision: "allow",
          matchedRule: `Allow: ${allowMatch.pattern}`,
          groupUserAgent: chosenGroup.userAgents[0] ?? "*",
        };
      }
      return {
        url: input.url,
        pathname,
        userAgent: target,
        decision: "disallow",
        matchedRule: `Disallow: ${disallowMatch.pattern}`,
        groupUserAgent: chosenGroup.userAgents[0] ?? "*",
      };
    }

    if (disallowMatch) {
      return {
        url: input.url,
        pathname,
        userAgent: target,
        decision: "disallow",
        matchedRule: `Disallow: ${disallowMatch.pattern}`,
        groupUserAgent: chosenGroup.userAgents[0] ?? "*",
      };
    }

    if (allowMatch) {
      return {
        url: input.url,
        pathname,
        userAgent: target,
        decision: "allow",
        matchedRule: `Allow: ${allowMatch.pattern}`,
        groupUserAgent: chosenGroup.userAgents[0] ?? "*",
      };
    }

    return {
      url: input.url,
      pathname,
      userAgent: target,
      decision: "allow",
      matchedRule: null,
      groupUserAgent: chosenGroup.userAgents[0] ?? "*",
    };
  }

  // ── site-resolving convenience methods (for dashboard endpoints) ──────────

  async previewRobotsTxt(siteId: string): Promise<{
    canonicalHost: string;
    indexingEnabled: boolean;
    content: string;
  }> {
    const settings = await this.getSettings(siteId);
    const canonicalHost = await this.resolveCanonicalHost(siteId);
    const content = this.renderRobotsTxt({
      canonicalHost,
      indexingEnabled: settings.indexingEnabled,
      robotsCustomRules: settings.robotsCustomRules,
      robotsAiCrawlerPolicy: settings.effectiveAiCrawlerPolicy,
      sitemapEnabled: settings.indexingEnabled,
    });
    return {
      canonicalHost,
      indexingEnabled: settings.indexingEnabled,
      content,
    };
  }

  async validateForSite(siteId: string): Promise<{
    issues: RobotsValidationIssue[];
    indexingEnabled: boolean;
    customRulesLength: number;
  }> {
    const settings = await this.getSettings(siteId);
    const issues = this.validateCustomRules(
      settings.robotsCustomRules,
      settings.indexingEnabled,
    );
    return {
      issues,
      indexingEnabled: settings.indexingEnabled,
      customRulesLength: settings.robotsCustomRules.length,
    };
  }

  async testForSite(
    siteId: string,
    input: { url: string; userAgent?: string },
  ): Promise<RobotsTestResult> {
    const rendered = (await this.previewRobotsTxt(siteId)).content;
    return this.testRule({
      url: input.url,
      userAgent: input.userAgent ?? "Googlebot",
      rendered,
    });
  }

  /**
   * Best-effort canonical host resolution for previews. We use:
   *   1. The site's primary ACTIVE domain, honoring the apex/www preference.
   *   2. The platform subdomain when no domain is attached.
   *   3. An empty string when nothing is available (caller must handle).
   */
  async resolveCanonicalHost(siteId: string): Promise<string> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        publicSubdomain: true,
        preferredHostVariant: true,
        domains: {
          where: { status: DomainStatus.ACTIVE },
          select: { host: true, isPrimary: true },
        },
      },
    });
    if (!site) return "";

    const primary =
      site.domains.find((d) => d.isPrimary) ?? site.domains[0] ?? null;
    if (primary) {
      const base = primary.host.replace(/^www\./i, "");
      const preferWww = site.preferredHostVariant === "WWW";
      const apex = site.domains.find(
        (d) =>
          d.host.toLowerCase() === base.toLowerCase() &&
          !d.host.toLowerCase().startsWith("www."),
      );
      const wwwHost = site.domains.find((d) =>
        d.host.toLowerCase().startsWith("www."),
      );
      if (preferWww && wwwHost) return wwwHost.host;
      if (!preferWww && apex) return apex.host;
      return primary.host;
    }

    const platformRoot = (
      this.configService.get<string>("PLATFORM_ROOT_DOMAIN") ?? ""
    ).trim();
    if (site.publicSubdomain && platformRoot) {
      return `${site.publicSubdomain}.${platformRoot}`;
    }
    return "";
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private computeEffectivePolicy(
    overrides: Record<string, CrawlerPolicy>,
  ): Record<string, CrawlerPolicy> {
    const result: Record<string, CrawlerPolicy> = {};
    for (const entry of CRAWLER_CATALOG) {
      result[entry.userAgent] =
        overrides[entry.userAgent] ?? entry.defaultPolicy;
    }
    return result;
  }

  private parsePolicyOverrides(raw: unknown): Record<string, CrawlerPolicy> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const result: Record<string, CrawlerPolicy> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!CRAWLER_USER_AGENTS.has(key)) continue;
      if (value === "allow" || value === "disallow") {
        result[key] = value;
      }
    }
    return result;
  }

  private normalizePolicy(
    raw: Record<string, string>,
  ): Record<string, CrawlerPolicy> {
    const result: Record<string, CrawlerPolicy> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!CRAWLER_USER_AGENTS.has(key)) {
        throw new BadRequestException({
          code: "UNKNOWN_USER_AGENT",
          message: `Unknown User-agent in policy: "${key}". Use the dashboard toggles only.`,
        });
      }
      if (value !== "allow" && value !== "disallow") {
        throw new BadRequestException({
          code: "INVALID_POLICY_VALUE",
          message: `Policy for "${key}" must be "allow" or "disallow", got "${value}".`,
        });
      }
      result[key] = value;
    }
    return result;
  }

  private normalizeExcludedPaths(paths: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of paths) {
      if (typeof raw !== "string") continue;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (!PATH_RE.test(trimmed)) {
        throw new BadRequestException({
          code: "INVALID_PATH",
          message: `Excluded path "${trimmed}" must start with "/" and contain only URL-safe characters.`,
        });
      }
      if (trimmed.length > 1024) {
        throw new BadRequestException({
          code: "PATH_TOO_LONG",
          message: `Excluded path is longer than 1024 characters.`,
        });
      }
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
      if (out.length >= MAX_EXCLUDED_PATHS) break;
    }
    return out;
  }

  private parseRobotsGroups(text: string): ParsedGroup[] {
    const groups: ParsedGroup[] = [];
    let current: ParsedGroup | null = null;
    let acceptingUserAgents = false;

    for (const rawLine of text.split(/\r?\n/)) {
      const stripped = rawLine.replace(/\s*#.*$/, "").trim();
      if (!stripped) continue;
      const colon = stripped.indexOf(":");
      if (colon === -1) continue;
      const directive = stripped.slice(0, colon).trim().toLowerCase();
      const value = stripped.slice(colon + 1).trim();
      if (!directive) continue;

      if (directive === "user-agent") {
        if (!current || !acceptingUserAgents) {
          current = {
            userAgents: [value],
            allow: [],
            disallow: [],
            crawlDelay: null,
          };
          groups.push(current);
          acceptingUserAgents = true;
        } else {
          current.userAgents.push(value);
        }
        continue;
      }

      if (!current) continue;
      acceptingUserAgents = false;
      if (directive === "allow" && value) current.allow.push(value);
      else if (directive === "disallow" && value !== undefined) {
        if (value) current.disallow.push(value);
      } else if (directive === "crawl-delay") {
        const num = Number(value);
        if (Number.isFinite(num) && num >= 0) current.crawlDelay = num;
      }
    }

    return groups;
  }

  private longestMatch(
    pathname: string,
    patterns: string[],
  ): { pattern: string; length: number } | null {
    let best: { pattern: string; length: number } | null = null;
    for (const pattern of patterns) {
      if (this.matchPattern(pathname, pattern)) {
        if (!best || pattern.length > best.length) {
          best = { pattern, length: pattern.length };
        }
      }
    }
    return best;
  }

  /**
   * Implements RFC 9309 pattern matching:
   *   - `*` matches zero or more characters
   *   - `$` at the end anchors to end of path
   *   - otherwise prefix match
   */
  private matchPattern(pathname: string, pattern: string): boolean {
    if (!pattern) return false;
    const anchor = pattern.endsWith("$");
    const body = anchor ? pattern.slice(0, -1) : pattern;

    if (!body.includes("*")) {
      return anchor ? pathname === body : pathname.startsWith(body);
    }

    const segments = body.split("*");
    let cursor = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (i === 0) {
        if (!pathname.startsWith(seg)) return false;
        cursor = seg.length;
      } else if (i === segments.length - 1) {
        if (anchor) {
          return (
            pathname.endsWith(seg) && pathname.length >= cursor + seg.length
          );
        }
        const idx = pathname.indexOf(seg, cursor);
        return idx >= 0;
      } else {
        const idx = pathname.indexOf(seg, cursor);
        if (idx < 0) return false;
        cursor = idx + seg.length;
      }
    }
    return true;
  }
}
