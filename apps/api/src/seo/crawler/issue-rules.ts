import { SeoCrawlIssueCategory, SeoCrawlIssueSeverity } from "@prisma/client";

export interface IssueDraft {
  code: string;
  severity: SeoCrawlIssueSeverity;
  category: SeoCrawlIssueCategory;
  message: string;
  recommendation: string | null;
  context?: Record<string, unknown> | null;
}

export interface UrlInspection {
  url: string;
  pathname: string;
  statusCode: number;
  responseTimeMs: number;
  contentType: string | null;
  contentLength: number | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  h1Count: number;
  h1First: string | null;
  h2Count: number;
  h3Count: number;
  wordCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  internalLinks: number;
  externalLinks: number;
  brokenLinks: number;
  redirectChain: { url: string; status: number }[];
  finalUrl: string | null;
  robotsHeader: string | null;
  indexable: boolean;
  noindexReason: string | null;
  fetchError: string | null;
}

const TITLE_MIN = 10;
const TITLE_MAX = 60;
const DESC_MIN = 50;
const DESC_MAX = 160;
const LOW_WORD_COUNT = 100;
const SLOW_RESPONSE_MS = 3000;

/**
 * Evaluate a single fetched URL against the technical-SEO rule set and
 * produce structured issue drafts. Pure function — easy to unit test.
 *
 * The rule set targets hospitality marketing sites (English-or-localized
 * landing pages) and is deliberately conservative: only well-established
 * SEO checks make the cut so the audit avoids false positives that would
 * train operators to ignore findings.
 */
export function inspectUrl(input: UrlInspection): IssueDraft[] {
  const out: IssueDraft[] = [];

  // Fetch-level
  if (input.fetchError) {
    out.push({
      code: "FETCH_ERROR",
      severity: "ERROR",
      category: "INDEXABILITY",
      message: `Could not fetch URL: ${input.fetchError}`,
      recommendation:
        "Verify the URL responds publicly and is not blocked by network rules or auth.",
    });
    return out;
  }

  if (input.statusCode >= 500) {
    out.push({
      code: "HTTP_5XX",
      severity: "ERROR",
      category: "INDEXABILITY",
      message: `Server error (HTTP ${input.statusCode}).`,
      recommendation:
        "Investigate server logs — pages with 5xx are dropped from the index.",
    });
    return out;
  }

  if (input.statusCode === 404 || input.statusCode === 410) {
    out.push({
      code: "HTTP_404",
      severity: "ERROR",
      category: "INDEXABILITY",
      message: `Page returns HTTP ${input.statusCode}.`,
      recommendation:
        "Either restore the page, redirect it to a relevant alternative, or remove inbound internal links.",
    });
    return out;
  }

  if (input.statusCode >= 400 && input.statusCode < 500) {
    out.push({
      code: "HTTP_4XX",
      severity: "ERROR",
      category: "INDEXABILITY",
      message: `Client error (HTTP ${input.statusCode}).`,
      recommendation: "Restore access or remove inbound links to this URL.",
    });
    return out;
  }

  // Redirect chain
  if (input.redirectChain.length > 1) {
    out.push({
      code: "REDIRECT_CHAIN",
      severity: "WARNING",
      category: "LINKS",
      message: `URL goes through ${input.redirectChain.length} redirects before resolving.`,
      recommendation:
        "Update internal links to point at the final destination — chained redirects leak crawl budget and slow first paint.",
      context: { chain: input.redirectChain },
    });
  }

  // Performance
  if (input.responseTimeMs > SLOW_RESPONSE_MS) {
    out.push({
      code: "SLOW_RESPONSE",
      severity: "WARNING",
      category: "PERFORMANCE",
      message: `Server responded in ${input.responseTimeMs} ms (target: < ${SLOW_RESPONSE_MS} ms).`,
      recommendation:
        "Cache the HTML at the edge, reduce origin work, or move to a closer region.",
    });
  }

  // Indexability
  if (!input.indexable) {
    out.push({
      code: "NOINDEX",
      severity: "INFO",
      category: "INDEXABILITY",
      message: `Page is marked noindex (${input.noindexReason ?? "robots meta"}).`,
      recommendation:
        "If this page should appear in search, remove the noindex directive. Otherwise no action required.",
    });
  }

  // Title
  if (!input.title) {
    out.push({
      code: "TITLE_MISSING",
      severity: "ERROR",
      category: "META",
      message: "Page has no <title>.",
      recommendation:
        "Add a unique 30–60 character title. Titles drive both SERP ranking and click-through rate.",
    });
  } else {
    if (input.title.length < TITLE_MIN) {
      out.push({
        code: "TITLE_SHORT",
        severity: "WARNING",
        category: "META",
        message: `Title is ${input.title.length} characters — short titles rarely match user queries.`,
        recommendation: `Aim for ${TITLE_MIN}–${TITLE_MAX} characters with one primary keyword.`,
      });
    } else if (input.title.length > TITLE_MAX) {
      out.push({
        code: "TITLE_LONG",
        severity: "WARNING",
        category: "META",
        message: `Title is ${input.title.length} characters and may be truncated in search results.`,
        recommendation: `Trim to under ${TITLE_MAX} characters.`,
      });
    }
  }

  // Meta description
  if (!input.metaDescription) {
    out.push({
      code: "META_DESCRIPTION_MISSING",
      severity: "WARNING",
      category: "META",
      message: "Page has no meta description.",
      recommendation:
        "Write a 110–155 character description that includes one CTA and one location/brand keyword.",
    });
  } else {
    if (input.metaDescription.length < DESC_MIN) {
      out.push({
        code: "META_DESCRIPTION_SHORT",
        severity: "INFO",
        category: "META",
        message: `Meta description is ${input.metaDescription.length} characters.`,
        recommendation: `Aim for ${DESC_MIN}–${DESC_MAX} characters.`,
      });
    } else if (input.metaDescription.length > DESC_MAX) {
      out.push({
        code: "META_DESCRIPTION_LONG",
        severity: "INFO",
        category: "META",
        message: `Meta description is ${input.metaDescription.length} characters and will be truncated.`,
        recommendation: `Trim to under ${DESC_MAX} characters.`,
      });
    }
  }

  // Canonical
  if (!input.canonical) {
    out.push({
      code: "CANONICAL_MISSING",
      severity: "WARNING",
      category: "META",
      message: 'Page has no <link rel="canonical">.',
      recommendation:
        "Add a self-referencing canonical to prevent duplicate-content issues across query strings and locales.",
    });
  } else if (!sameHostOrPath(input.canonical, input.url)) {
    out.push({
      code: "CANONICAL_OFFSITE",
      severity: "WARNING",
      category: "META",
      message: `Canonical points to a different origin: ${input.canonical}`,
      recommendation:
        "Confirm this is intentional. Off-site canonicals tell search engines to credit another URL.",
    });
  }

  // Headings
  if (input.h1Count === 0) {
    out.push({
      code: "H1_MISSING",
      severity: "WARNING",
      category: "CONTENT",
      message: "Page has no <h1>.",
      recommendation:
        "Add one descriptive <h1> per page — typically the room/location name.",
    });
  } else if (input.h1Count > 1) {
    out.push({
      code: "H1_MULTIPLE",
      severity: "INFO",
      category: "CONTENT",
      message: `Page has ${input.h1Count} <h1> elements.`,
      recommendation:
        "Keep one primary <h1> and demote the rest to <h2>/<h3> for clearer hierarchy.",
    });
  }

  // Content depth
  if (input.wordCount < LOW_WORD_COUNT && input.statusCode === 200) {
    out.push({
      code: "THIN_CONTENT",
      severity: "WARNING",
      category: "CONTENT",
      message: `Page has only ${input.wordCount} words of body copy.`,
      recommendation:
        "Add descriptive copy that helps the page rank for relevant intent (amenities, location, booking process).",
    });
  }

  // Images
  if (input.imagesMissingAlt > 0) {
    out.push({
      code: "IMAGES_MISSING_ALT",
      severity: input.imagesMissingAlt > 5 ? "WARNING" : "INFO",
      category: "ACCESSIBILITY",
      message: `${input.imagesMissingAlt} image${input.imagesMissingAlt === 1 ? "" : "s"} missing alt text.`,
      recommendation:
        "Provide descriptive alt text — required for accessibility and used by image search to surface results.",
    });
  }

  // Broken outbound links discovered on this page
  if (input.brokenLinks > 0) {
    out.push({
      code: "BROKEN_LINKS",
      severity: "ERROR",
      category: "LINKS",
      message: `${input.brokenLinks} broken outbound link${input.brokenLinks === 1 ? "" : "s"} from this page.`,
      recommendation:
        "Update or remove dead links — they degrade UX and waste crawl budget.",
    });
  }

  return out;
}

function sameHostOrPath(canonical: string, currentUrl: string): boolean {
  try {
    const canon = new URL(canonical, currentUrl);
    const here = new URL(currentUrl);
    return canon.host.toLowerCase() === here.host.toLowerCase();
  } catch {
    return true; // can't parse; let other checks catch it
  }
}
