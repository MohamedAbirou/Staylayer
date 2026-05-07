function sanitizeBrandHostname(brandName) {
  const normalized = String(brandName || "BrandName")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "brandname";
}

const configuredBrandUrl = process.env.NEXT_PUBLIC_BRAND_URL || "";
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || "BrandName";

const parsedBrandUrl = (() => {
  const trimmedBrandUrl = configuredBrandUrl.trim();

  if (!trimmedBrandUrl) {
    return null;
  }

  try {
    return new URL(trimmedBrandUrl);
  } catch {
    return null;
  }
})();

const fallbackHostname = `${sanitizeBrandHostname(BRAND_NAME)}.com`;

export const DOMAIN_NAME = parsedBrandUrl?.hostname || fallbackHostname;
export const BRAND_URL =
  parsedBrandUrl?.toString().replace(/\/$/, "") || `https://${DOMAIN_NAME}`;
export const EMAIL_CONTACT = `contact@${DOMAIN_NAME}`;
