/**
 * Extract image URLs referenced by a Puck content tree.
 *
 * Recurses through the JSON looking at common Puck image fields. We are
 * intentionally permissive: every value that *looks* like a URL pointing at
 * an image is captured. This is used by both the public-runtime payload
 * (per-page `images`) and the website's image-sitemap renderer.
 */

const IMAGE_FIELD_NAMES = new Set<string>([
  "src",
  "url",
  "image",
  "imageUrl",
  "image_url",
  "backgroundImage",
  "background",
  "poster",
  "thumbnail",
  "asset",
  "logo",
  "icon",
  "photo",
  "media",
  "href", // covers some link/image hybrids
]);

const IMAGE_EXTENSIONS =
  /\.(?:png|jpe?g|webp|gif|avif|svg|bmp|tiff?)(?:\?[^#]*)?(?:#.*)?$/i;

const MAX_IMAGES_PER_PAGE = 100;

export function extractImagesFromPuck(input: unknown): string[] {
  const found = new Set<string>();
  walk(input, found, 0);
  return Array.from(found).slice(0, MAX_IMAGES_PER_PAGE);
}

function walk(node: unknown, out: Set<string>, depth: number): void {
  if (out.size >= MAX_IMAGES_PER_PAGE) return;
  if (depth > 40) return; // safety against pathological nesting
  if (node === null || node === undefined) return;

  if (typeof node === "string") {
    maybeAdd(node, out);
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) walk(item, out, depth + 1);
    return;
  }

  if (typeof node === "object") {
    for (const [key, value] of Object.entries(
      node as Record<string, unknown>,
    )) {
      if (typeof value === "string" && IMAGE_FIELD_NAMES.has(key)) {
        maybeAdd(value, out);
      } else if (
        typeof value === "object" &&
        value !== null &&
        "url" in (value as Record<string, unknown>) &&
        typeof (value as { url?: unknown }).url === "string"
      ) {
        maybeAdd((value as { url: string }).url, out);
      }
      walk(value, out, depth + 1);
    }
  }
}

function maybeAdd(value: string, out: Set<string>): void {
  if (out.size >= MAX_IMAGES_PER_PAGE) return;
  const trimmed = value.trim();
  if (!trimmed) return;
  if (trimmed.length > 2048) return;

  // Absolute http(s) URL.
  if (/^https?:\/\//i.test(trimmed)) {
    if (IMAGE_EXTENSIONS.test(trimmed) || isLikelyImageHost(trimmed)) {
      out.add(trimmed);
    }
    return;
  }

  // Site-relative URL pointing at obvious image extensions.
  if (trimmed.startsWith("/") && IMAGE_EXTENSIONS.test(trimmed)) {
    out.add(trimmed);
  }
}

function isLikelyImageHost(url: string): boolean {
  try {
    const u = new URL(url);
    // Common image CDNs serve URLs without extensions.
    return /cloudinary|imgix|cloudfront|akamaized|imagekit|images\./i.test(
      u.host,
    );
  } catch {
    return false;
  }
}
