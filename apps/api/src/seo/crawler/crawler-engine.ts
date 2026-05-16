import { extractHtmlMetadata } from "./html-extractor";

export interface CrawlEngineOptions {
  startUrl: string;
  canonicalHost: string;
  urlLimit: number;
  maxDepth: number;
  concurrency?: number;
  requestTimeoutMs?: number;
  userAgent?: string;
  /** Called once per fully-resolved URL. */
  onPage: (page: CrawlPageOutcome) => void | Promise<void>;
  /** Polled regularly — when true the engine stops the BFS gracefully. */
  isCancelled?: () => boolean;
  /** Replaceable fetch for tests. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

export interface CrawlPageOutcome {
  url: string;
  pathname: string;
  depth: number;
  statusCode: number;
  contentType: string | null;
  contentLength: number | null;
  responseTimeMs: number;
  title: string | null;
  metaDescription: string | null;
  metaRobots: string | null;
  canonical: string | null;
  h1: string[];
  h1Count: number;
  h1First: string | null;
  h2Count: number;
  h3Count: number;
  wordCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  /** Per-image records persisted by the audit pipeline. Capped per page
   * (see `MAX_IMAGES_PER_PAGE`). Order matches DOM order so the first N
   * are treated as above-the-fold candidates downstream. */
  imageRecords: CrawlImageRecord[];
  /** Resolved absolute URL of the <meta property="og:image"> if any. */
  ogImage: string | null;
  internalLinks: number;
  externalLinks: number;
  outboundInternalUrls: string[];
  /** Per-link records persisted for the link-graph analysis. Capped per
   * page by the engine so a single page with thousands of links cannot
   * balloon memory. */
  outboundLinks: CrawlOutboundLink[];
  redirectChain: { url: string; status: number }[];
  finalUrl: string | null;
  robotsHeader: string | null;
  indexable: boolean;
  noindexReason: string | null;
  fetchError: string | null;
}

export interface CrawlEngineResult {
  totalUrls: number;
  durationMs: number;
  reachedLimit: boolean;
}

export interface CrawlOutboundLink {
  /** Fully-resolved target URL (normalized for internal links). */
  targetUrl: string;
  /** Pathname when the link is same-origin, else null. */
  targetPathname: string | null;
  anchorText: string | null;
  rel: string | null;
  nofollow: boolean;
  isInternal: boolean;
}

export interface CrawlImageRecord {
  /** Resolved absolute URL when possible; original src otherwise. */
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  loading: string | null;
  hasSrcset: boolean;
}

/** Hard cap on persisted per-page image records to bound memory & DB rows. */
export const MAX_IMAGES_PER_PAGE = 100;

/** Hard cap on persisted outbound links per page to bound memory. */
export const MAX_LINKS_PER_PAGE = 300;

const DEFAULT_UA =
  "StaylayerSeoCrawler/1.0 (+https://staylayer.com/seo-crawler)";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_CONCURRENCY = 4;
const MAX_REDIRECTS = 5;
const FETCHABLE_PROTOCOLS = new Set(["http:", "https:"]);
const HTML_TYPES = ["text/html", "application/xhtml+xml"];

/**
 * Same-origin breadth-first crawler used by the SEO technical audit.
 *
 * Design constraints:
 *   • Runs in-process inside the NestJS API (no external worker).
 *   • Caps URL count at `urlLimit` (driven by the tenant's plan).
 *   • Honors a cooperative cancel hook so an operator can abort a long job.
 *   • Uses native fetch + a hand-rolled redirect walker so we can record
 *     redirect chains per URL.
 *   • Never blocks on a slow page — each request has an AbortController
 *     timeout.
 *   • Pure data out — persistence is the caller's job.
 */
export async function runCrawlEngine(
  options: CrawlEngineOptions,
): Promise<CrawlEngineResult> {
  const {
    startUrl,
    canonicalHost,
    urlLimit,
    maxDepth,
    concurrency = DEFAULT_CONCURRENCY,
    requestTimeoutMs = DEFAULT_TIMEOUT_MS,
    userAgent = DEFAULT_UA,
    onPage,
    isCancelled = () => false,
    fetchImpl = fetch,
  } = options;

  const startedAt = Date.now();
  const host = canonicalHost.toLowerCase();
  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [];
  const normalizedStart = normalizeUrl(startUrl);
  if (!normalizedStart) {
    return { totalUrls: 0, durationMs: 0, reachedLimit: false };
  }
  queue.push({ url: normalizedStart, depth: 0 });
  visited.add(normalizedStart);

  let totalUrls = 0;
  let reachedLimit = false;

  const inflight = new Set<Promise<void>>();

  const launch = (item: { url: string; depth: number }) => {
    const p = (async () => {
      const outcome = await fetchOne(item.url, item.depth, {
        requestTimeoutMs,
        userAgent,
        fetchImpl,
      });
      totalUrls += 1;

      try {
        await onPage(outcome);
      } catch {
        // Persistence errors are surfaced via the runner's own try/catch;
        // here we just keep the BFS alive.
      }

      if (
        item.depth < maxDepth &&
        outcome.statusCode >= 200 &&
        outcome.statusCode < 400 &&
        outcome.indexable
      ) {
        for (const next of outcome.outboundInternalUrls) {
          if (visited.size >= urlLimit) {
            reachedLimit = true;
            break;
          }
          if (!visited.has(next) && sameHost(next, host)) {
            visited.add(next);
            queue.push({ url: next, depth: item.depth + 1 });
          }
        }
      }
    })();
    inflight.add(p);
    p.finally(() => inflight.delete(p));
  };

  while ((queue.length > 0 || inflight.size > 0) && !isCancelled()) {
    while (queue.length > 0 && inflight.size < concurrency && !isCancelled()) {
      const next = queue.shift()!;
      launch(next);
    }
    if (inflight.size > 0) {
      await Promise.race(inflight);
    }
  }

  // Drain any remaining work even if we triggered cancel mid-flight so we
  // don't leak unresolved promises into the runner.
  if (inflight.size > 0) {
    await Promise.allSettled([...inflight]);
  }

  return {
    totalUrls,
    durationMs: Date.now() - startedAt,
    reachedLimit,
  };
}

// ── per-URL fetcher ─────────────────────────────────────────────────────

async function fetchOne(
  url: string,
  depth: number,
  ctx: {
    requestTimeoutMs: number;
    userAgent: string;
    fetchImpl: typeof fetch;
  },
): Promise<CrawlPageOutcome> {
  const start = Date.now();
  const redirectChain: { url: string; status: number }[] = [];
  let currentUrl = url;
  let response: Response | null = null;
  let fetchError: string | null = null;

  try {
    for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ctx.requestTimeoutMs);
      try {
        const res = await ctx.fetchImpl(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": ctx.userAgent,
            Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          },
        });
        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get("location");
          if (!location) {
            response = res;
            break;
          }
          const nextUrl = safeResolveUrl(location, currentUrl);
          redirectChain.push({ url: currentUrl, status: res.status });
          if (!nextUrl) {
            response = res;
            break;
          }
          currentUrl = nextUrl;
          continue;
        }
        response = res;
        break;
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (err) {
    fetchError =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Request timed out"
          : err.message
        : "Unknown fetch error";
  }

  const finalUrl = response?.url || currentUrl;
  const responseTimeMs = Date.now() - start;

  if (!response || fetchError) {
    return blankOutcome(url, depth, {
      statusCode: 0,
      responseTimeMs,
      redirectChain,
      finalUrl,
      fetchError: fetchError ?? "No response",
    });
  }

  const contentType = response.headers.get("content-type");
  const contentLengthHeader = response.headers.get("content-length");
  const robotsHeader = response.headers.get("x-robots-tag");
  const isHtml = contentType
    ? HTML_TYPES.some((t) => contentType.toLowerCase().includes(t))
    : false;

  let body = "";
  if (isHtml && response.status >= 200 && response.status < 300) {
    try {
      body = await response.text();
    } catch (err) {
      return blankOutcome(url, depth, {
        statusCode: response.status,
        responseTimeMs,
        redirectChain,
        finalUrl,
        contentType,
        contentLength: contentLengthHeader ? Number(contentLengthHeader) : null,
        robotsHeader,
        fetchError: err instanceof Error ? err.message : "Body read failed",
      });
    }
  }

  const extracted = isHtml && body ? extractHtmlMetadata(body) : null;

  const indexability = computeIndexability(
    extracted?.metaRobots ?? null,
    robotsHeader,
  );

  const outboundInternalUrls: string[] = [];
  const outboundLinks: CrawlOutboundLink[] = [];
  let internalLinks = 0;
  let externalLinks = 0;

  if (extracted) {
    const finalHost = hostnameOf(finalUrl);
    for (const link of extracted.links) {
      const resolved = resolveLink(link.href, finalUrl);
      if (!resolved) continue;
      const internal = sameHost(resolved.url, finalHost);
      if (internal) {
        internalLinks += 1;
        if (!link.nofollow) outboundInternalUrls.push(resolved.url);
      } else {
        externalLinks += 1;
      }
      if (outboundLinks.length < MAX_LINKS_PER_PAGE) {
        const anchor = link.text?.trim() ?? "";
        outboundLinks.push({
          targetUrl: resolved.url,
          targetPathname: internal ? safePathname(resolved.url) : null,
          anchorText: anchor.length > 0 ? anchor.slice(0, 500) : null,
          rel: link.rel && link.rel.length > 0 ? link.rel : null,
          nofollow: link.nofollow,
          isInternal: internal,
        });
      }
    }
  }

  const imagesMissingAlt = extracted
    ? extracted.images.filter((img) => !img.alt || img.alt.trim() === "").length
    : 0;

  const ogImageAbs = extracted?.ogImage
    ? (safeResolveUrl(extracted.ogImage, finalUrl) ?? extracted.ogImage)
    : null;

  const imageRecords: CrawlImageRecord[] = extracted
    ? extracted.images.slice(0, MAX_IMAGES_PER_PAGE).map((img) => ({
        src: safeResolveUrl(img.src, finalUrl) ?? img.src,
        alt: img.alt,
        width: img.width,
        height: img.height,
        loading: img.loading,
        hasSrcset: img.hasSrcset,
      }))
    : [];

  return {
    url,
    pathname: safePathname(url),
    depth,
    statusCode: response.status,
    contentType: contentType ?? null,
    contentLength: extracted
      ? body.length
      : contentLengthHeader
        ? Number(contentLengthHeader)
        : null,
    responseTimeMs,
    title: extracted?.title ?? null,
    metaDescription: extracted?.metaDescription ?? null,
    metaRobots: extracted?.metaRobots ?? null,
    canonical: extracted?.canonical
      ? (safeResolveUrl(extracted.canonical, finalUrl) ?? extracted.canonical)
      : null,
    h1: extracted?.h1 ?? [],
    h1Count: extracted?.h1.length ?? 0,
    h1First: extracted?.h1[0] ?? null,
    h2Count: extracted?.h2Count ?? 0,
    h3Count: extracted?.h3Count ?? 0,
    wordCount: extracted?.wordCount ?? 0,
    imageCount: extracted?.images.length ?? 0,
    imagesMissingAlt,
    imageRecords,
    ogImage: ogImageAbs,
    internalLinks,
    externalLinks,
    outboundInternalUrls: dedupe(outboundInternalUrls),
    outboundLinks,
    redirectChain,
    finalUrl,
    robotsHeader,
    indexable: indexability.indexable,
    noindexReason: indexability.reason,
    fetchError: null,
  };
}

// ── helpers ─────────────────────────────────────────────────────────────

function blankOutcome(
  url: string,
  depth: number,
  patch: Partial<CrawlPageOutcome> & {
    statusCode: number;
    responseTimeMs: number;
    redirectChain: { url: string; status: number }[];
    finalUrl: string;
  },
): CrawlPageOutcome {
  return {
    url,
    pathname: safePathname(url),
    depth,
    statusCode: patch.statusCode,
    contentType: patch.contentType ?? null,
    contentLength: patch.contentLength ?? null,
    responseTimeMs: patch.responseTimeMs,
    title: null,
    metaDescription: null,
    metaRobots: null,
    canonical: null,
    h1: [],
    h1Count: 0,
    h1First: null,
    h2Count: 0,
    h3Count: 0,
    wordCount: 0,
    imageCount: 0,
    imagesMissingAlt: 0,
    imageRecords: [],
    ogImage: null,
    internalLinks: 0,
    externalLinks: 0,
    outboundInternalUrls: [],
    outboundLinks: [],
    redirectChain: patch.redirectChain,
    finalUrl: patch.finalUrl,
    robotsHeader: patch.robotsHeader ?? null,
    indexable: false,
    noindexReason: patch.fetchError ? "fetch-error" : null,
    fetchError: patch.fetchError ?? null,
  };
}

function computeIndexability(
  metaRobots: string | null,
  xRobotsTag: string | null,
): { indexable: boolean; reason: string | null } {
  const sources: { value: string; source: string }[] = [];
  if (metaRobots) sources.push({ value: metaRobots, source: "meta robots" });
  if (xRobotsTag)
    sources.push({ value: xRobotsTag, source: "X-Robots-Tag header" });
  for (const { value, source } of sources) {
    const tokens = value
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean);
    if (tokens.includes("noindex") || tokens.includes("none")) {
      return { indexable: false, reason: source };
    }
  }
  return { indexable: true, reason: null };
}

function resolveLink(href: string, base: string): { url: string } | null {
  const url = safeResolveUrl(href, base);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!FETCHABLE_PROTOCOLS.has(parsed.protocol)) return null;
    parsed.hash = "";
    return { url: parsed.toString() };
  } catch {
    return null;
  }
}

function safeResolveUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function normalizeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!FETCHABLE_PROTOCOLS.has(u.protocol)) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function safePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "/";
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

function sameHost(url: string, host: string): boolean {
  return hostnameOf(url) === host.toLowerCase();
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
