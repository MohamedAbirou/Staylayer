// Content-Security-Policy builder driven by the PUBLIC_IMAGE_HOSTS env var.
//
// PUBLIC_IMAGE_HOSTS is a comma-separated allowlist of hostnames that may
// appear in `<Image>` and direct `<img src="...">` references. We mirror that
// list in the CSP img-src directive so tenants cannot exfiltrate via arbitrary
// hosts. When the allowlist is empty we fall back to `https: data: blob:`
// since hospitality sites legitimately embed many third-party CDNs.

function parseHostList(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(
      (entry) =>
        entry.length > 0 && !entry.includes(" ") && entry.includes("."),
    );
}

function buildImgSrc(allowlist) {
  if (allowlist.length === 0) {
    return "img-src 'self' https: data: blob:";
  }
  const hosts = allowlist.map((host) => `https://${host}`).join(" ");
  return `img-src 'self' ${hosts} data: blob:`;
}

/**
 * Build the CSP header value. Called from middleware on every dynamic
 * response. Static asset paths bypass middleware entirely.
 */
export function buildCsp() {
  const allowlist = parseHostList(process.env.PUBLIC_IMAGE_HOSTS);

  const directives = [
    "default-src 'self'",
    buildImgSrc(allowlist),
    // GTM, Clarity and Google Analytics are loaded by built-in scripts.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://www.clarity.ms https://*.clarity.ms",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.clarity.ms https://*.clarity.ms",
    "frame-src 'self' https://www.googletagmanager.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}
