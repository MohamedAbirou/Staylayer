import { ImageAltQuality } from "@prisma/client";

/**
 * Image SEO audit rules (Phase D.1).
 *
 * Pure functions that classify a single image's alt-text quality and emit
 * structured flags about technical issues (missing dimensions, lazy-load
 * misconfiguration, OpenGraph size compliance, sitemap coverage).
 *
 * Designed to be cheap so we can run them per crawled image in-process
 * without inflating the crawl budget.
 */

export const OG_RECOMMENDED_MIN_WIDTH = 1200;
export const OG_RECOMMENDED_MIN_HEIGHT = 630;
export const OG_RECOMMENDED_ASPECT = 1.91;
export const OG_ASPECT_TOLERANCE = 0.25;

export const ALT_MIN_GOOD = 5;
export const ALT_MAX_GOOD = 125;

/** Flags emitted per image. Persisted as JSON on the finding row so the
 * dashboard can render them without re-deriving from the alt text. */
export type ImageFlag =
  | "missing_alt"
  | "empty_alt"
  | "filename_alt"
  | "alt_too_short"
  | "alt_too_long"
  | "missing_dimensions"
  | "missing_width"
  | "missing_height"
  | "above_fold_lazy"
  | "below_fold_eager"
  | "og_too_small"
  | "og_aspect_off"
  | "og_missing"
  | "not_in_sitemap";

export interface ImageInput {
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  loading: string | null;
  hasSrcset: boolean;
  /** Index in DOM order on the page (0-based). */
  domIndex: number;
  isOgImage: boolean;
  inSitemap: boolean;
}

export interface ImageAnalysis {
  filename: string | null;
  hasAlt: boolean;
  altQuality: ImageAltQuality;
  aboveFold: boolean;
  flags: ImageFlag[];
}

const ABOVE_FOLD_INDEX_THRESHOLD = 3;

/**
 * Reasonable image-content-type detection from URL. Used as a soft signal
 * for OG image validation (we cannot reliably probe binary dimensions
 * here without fetching).
 */
const IMG_EXT_RE = /\.(?:png|jpe?g|gif|webp|avif|svg)(?:$|[?#])/i;

export function analyzeImage(input: ImageInput): ImageAnalysis {
  const flags: ImageFlag[] = [];
  const filename = parseFilename(input.src);
  const aboveFold = input.domIndex < ABOVE_FOLD_INDEX_THRESHOLD;

  // Alt classification
  const altQuality = classifyAlt(input.alt, filename);
  const hasAlt = altQuality !== ImageAltQuality.MISSING;

  switch (altQuality) {
    case ImageAltQuality.MISSING:
      flags.push("missing_alt");
      break;
    case ImageAltQuality.EMPTY:
      flags.push("empty_alt");
      break;
    case ImageAltQuality.FILENAME_LIKE:
      flags.push("filename_alt");
      break;
    case ImageAltQuality.TOO_SHORT:
      flags.push("alt_too_short");
      break;
    case ImageAltQuality.TOO_LONG:
      flags.push("alt_too_long");
      break;
    default:
      break;
  }

  // Dimensions — emit dim flags only when the image isn't an SVG (which
  // has intrinsic vector dimensions) and looks like a real raster image.
  const isSvg = /\.svg(?:$|[?#])/i.test(input.src);
  if (!isSvg) {
    if (input.width === null && input.height === null) {
      flags.push("missing_dimensions");
    } else {
      if (input.width === null) flags.push("missing_width");
      if (input.height === null) flags.push("missing_height");
    }
  }

  // Lazy-load hygiene. Browsers default to eager when omitted, so:
  //   • Above-the-fold images explicitly marked loading="lazy" delay LCP.
  //   • Below-the-fold images that are NOT lazy waste bandwidth.
  if (aboveFold && input.loading === "lazy") {
    flags.push("above_fold_lazy");
  }
  if (!aboveFold && input.loading !== "lazy") {
    flags.push("below_fold_eager");
  }

  // OpenGraph image checks — only the canonical og:image is graded.
  if (input.isOgImage) {
    const w = input.width;
    const h = input.height;
    if (w !== null && h !== null) {
      if (w < OG_RECOMMENDED_MIN_WIDTH || h < OG_RECOMMENDED_MIN_HEIGHT) {
        flags.push("og_too_small");
      }
      const aspect = w / h;
      if (Math.abs(aspect - OG_RECOMMENDED_ASPECT) > OG_ASPECT_TOLERANCE) {
        flags.push("og_aspect_off");
      }
    }
  }

  // Sitemap coverage — only meaningful for raster/SVG images served by the
  // tenant. We don't flag remote third-party hosts (e.g. tracking pixels)
  // because the tenant's sitemap can't include them.
  if (!input.inSitemap && IMG_EXT_RE.test(input.src)) {
    flags.push("not_in_sitemap");
  }

  return {
    filename,
    hasAlt,
    altQuality,
    aboveFold,
    flags,
  };
}

export function parseFilename(src: string): string | null {
  if (!src) return null;
  try {
    const u = new URL(src);
    const segments = u.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? null;
    return last && last.length > 0 ? last : null;
  } catch {
    // Relative URL — strip query/hash and take last path segment.
    const stripped = src.split("?")[0].split("#")[0];
    const segments = stripped.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? null;
    return last && last.length > 0 ? last : null;
  }
}

/**
 * Classify alt text. Returns:
 *   • MISSING        — the attribute was absent on the tag (null input)
 *   • EMPTY          — present but whitespace only (decorative role)
 *   • FILENAME_LIKE  — looks like the source filename
 *   • TOO_SHORT      — under `ALT_MIN_GOOD` chars
 *   • TOO_LONG       — over `ALT_MAX_GOOD` chars
 *   • GOOD           — descriptive and within bounds
 *
 * Note: EMPTY alt is legal HTML for decorative imagery, but we still
 * surface it as a low-severity finding so operators can confirm intent.
 */
export function classifyAlt(
  alt: string | null,
  filename: string | null,
): ImageAltQuality {
  if (alt === null || alt === undefined) return ImageAltQuality.MISSING;
  const trimmed = alt.trim();
  if (trimmed.length === 0) return ImageAltQuality.EMPTY;

  if (filename && looksLikeFilename(trimmed, filename)) {
    return ImageAltQuality.FILENAME_LIKE;
  }

  if (trimmed.length < ALT_MIN_GOOD) return ImageAltQuality.TOO_SHORT;
  if (trimmed.length > ALT_MAX_GOOD) return ImageAltQuality.TOO_LONG;
  return ImageAltQuality.GOOD;
}

function looksLikeFilename(alt: string, filename: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\s_\-.]+/g, "")
      .trim();
  const a = normalize(alt);
  const f = normalize(filename.replace(/\.[a-z0-9]+$/i, ""));
  if (!a || !f) return false;
  // Exact match after normalization, OR alt contains the filename token
  // verbatim (e.g. "img-1234").
  if (a === f) return true;
  if (a.includes(f) && f.length >= 4) return true;
  // Common filename signals
  if (
    /^(?:img|image|photo|picture|dsc|untitled|screenshot)[\d_\-]+$/i.test(
      alt.trim(),
    )
  ) {
    return true;
  }
  return false;
}
