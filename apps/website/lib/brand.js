const configuredBrandUrl = process.env.NEXT_PUBLIC_BRAND_URL || "";
const parsedBrandUrl = (() => {
  if (!configuredBrandUrl) {
    return null;
  }

  try {
    return new URL(configuredBrandUrl);
  } catch {
    return null;
  }
})();

export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || "BrandName";
export const DOMAIN_NAME =
  parsedBrandUrl?.hostname || `${BRAND_NAME.toLowerCase()}.com`;
export const BRAND_URL =
  parsedBrandUrl?.toString().replace(/\/$/, "") || `https://${DOMAIN_NAME}`;
export const EMAIL_CONTACT = `contact@${DOMAIN_NAME}`;
