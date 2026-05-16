/**
 * Minimal HTML metadata extractor used by the SEO crawler. We deliberately
 * avoid a heavy DOM dependency (cheerio/parse5) to keep the workspace
 * dependency surface small — the SEO crawler only needs head meta, headings,
 * link hrefs, and image alts.
 *
 * The extractor is forgiving: malformed HTML never throws, attributes use
 * single/double/no-quote variants, and entities are decoded for visible
 * text fields.
 *
 * Inputs are capped at MAX_HTML_BYTES; anything beyond that is silently
 * truncated so a single multi-MB page can't DoS the crawler.
 */

export const MAX_HTML_BYTES = 2_000_000; // 2 MB
const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export interface ExtractedLink {
  href: string;
  rel: string | null;
  nofollow: boolean;
  text: string;
}

export interface ExtractedImage {
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  loading: string | null;
  hasSrcset: boolean;
}

export interface ExtractedHtml {
  title: string | null;
  metaDescription: string | null;
  metaRobots: string | null;
  canonical: string | null;
  ogImage: string | null;
  h1: string[];
  h2Count: number;
  h3Count: number;
  links: ExtractedLink[];
  images: ExtractedImage[];
  wordCount: number;
  lang: string | null;
}

export function extractHtmlMetadata(rawHtml: string): ExtractedHtml {
  const html =
    rawHtml.length > MAX_HTML_BYTES
      ? rawHtml.slice(0, MAX_HTML_BYTES)
      : rawHtml;

  return {
    title: extractTitle(html),
    metaDescription: extractMeta(html, "description"),
    metaRobots: extractMeta(html, "robots"),
    canonical: extractCanonical(html),
    ogImage: extractMetaProperty(html, "og:image"),
    h1: extractHeadings(html, "h1"),
    h2Count: countHeadings(html, "h2"),
    h3Count: countHeadings(html, "h3"),
    links: extractLinks(html),
    images: extractImages(html),
    wordCount: countWords(html),
    lang: extractLang(html),
  };
}

// ── primitives ──────────────────────────────────────────────────────────

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, "");
}

function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (body.startsWith("#")) {
      const code = parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITY_MAP[body.toLowerCase()] ?? match;
  });
}

function clean(input: string | null | undefined): string | null {
  if (!input) return null;
  const out = decodeEntities(collapseWhitespace(stripTags(input)));
  return out.length === 0 ? null : out;
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const m = tag.match(re);
  if (!m) return null;
  return decodeEntities(m[1] ?? m[2] ?? m[3] ?? "").trim();
}

// ── extractors ──────────────────────────────────────────────────────────

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? clean(m[1]) : null;
}

function extractMeta(html: string, name: string): string | null {
  const tagRe = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html)) !== null) {
    const tag = match[0];
    const tagName = (attr(tag, "name") ?? "").toLowerCase();
    if (tagName === name.toLowerCase()) {
      const content = attr(tag, "content");
      return content ? collapseWhitespace(content) : null;
    }
  }
  return null;
}

function extractMetaProperty(html: string, property: string): string | null {
  const tagRe = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html)) !== null) {
    const tag = match[0];
    const prop = (attr(tag, "property") ?? "").toLowerCase();
    if (prop === property.toLowerCase()) {
      const content = attr(tag, "content");
      return content ? collapseWhitespace(content) : null;
    }
  }
  return null;
}

function extractCanonical(html: string): string | null {
  const tagRe = /<link\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html)) !== null) {
    const tag = match[0];
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    if (rel === "canonical") {
      return attr(tag, "href");
    }
  }
  return null;
}

function extractHeadings(html: string, tag: "h1"): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = clean(m[1]);
    if (text) out.push(text);
  }
  return out;
}

function countHeadings(html: string, tag: "h2" | "h3"): number {
  const re = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  return (html.match(re) ?? []).length;
}

function extractLinks(html: string): ExtractedLink[] {
  const re = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  const links: ExtractedLink[] = [];
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = re.exec(html)) !== null && count < 2000) {
    const tag = m[0];
    const href = attr(tag, "href");
    if (!href) continue;
    const rel = attr(tag, "rel");
    const nofollow = (rel ?? "")
      .toLowerCase()
      .split(/\s+/)
      .includes("nofollow");
    links.push({
      href: href.trim(),
      rel,
      nofollow,
      text: clean(m[1]) ?? "",
    });
    count += 1;
  }
  return links;
}

function extractImages(html: string): ExtractedImage[] {
  const re = /<img\b[^>]*>/gi;
  const images: ExtractedImage[] = [];
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = re.exec(html)) !== null && count < 2000) {
    const tag = m[0];
    const src = attr(tag, "src") ?? attr(tag, "data-src");
    if (!src) continue;
    images.push({
      src: src.trim(),
      alt: attr(tag, "alt"),
      width: parsePositiveInt(attr(tag, "width")),
      height: parsePositiveInt(attr(tag, "height")),
      loading: normalizeLoadingAttr(attr(tag, "loading")),
      hasSrcset:
        Boolean(attr(tag, "srcset")) || Boolean(attr(tag, "data-srcset")),
    });
    count += 1;
  }
  return images;
}

function parsePositiveInt(value: string | null): number | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d+)/);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function normalizeLoadingAttr(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "lazy" || v === "eager" || v === "auto") return v;
  return null;
}

function countWords(html: string): number {
  // Strip scripts/styles/templates before counting.
  const stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, " ");
  const text = decodeEntities(collapseWhitespace(stripTags(stripped)));
  if (text.length === 0) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function extractLang(html: string): string | null {
  const m = html.match(/<html\b[^>]*>/i);
  if (!m) return null;
  return attr(m[0], "lang");
}
