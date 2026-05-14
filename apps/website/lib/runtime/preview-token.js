import crypto from "crypto";
import { normalizeHostname, normalizePathname } from "./host";

function getPreviewTokenSecret() {
  const secret = process.env.PREVIEW_TOKEN_SECRET || "";

  if (!secret.trim()) {
    throw new Error("PREVIEW_TOKEN_SECRET is not configured");
  }

  return Buffer.from(secret);
}

function sign(encodedClaims) {
  return crypto
    .createHmac("sha256", getPreviewTokenSecret())
    .update(encodedClaims)
    .digest("base64url");
}

export function verifyPreviewToken(token) {
  const [encodedClaims, signature] = String(token || "").split(".");

  if (!encodedClaims || !signature) {
    throw new Error("Preview token is malformed");
  }

  const expectedSignature = sign(encodedClaims);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    throw new Error("Preview token signature is invalid");
  }

  const claims = JSON.parse(
    Buffer.from(encodedClaims, "base64url").toString("utf8"),
  );

  if (!claims?.siteId || !claims?.host || !claims?.pathPrefix) {
    throw new Error("Preview token payload is invalid");
  }

  if (claims.exp * 1000 <= Date.now()) {
    throw new Error("Preview token has expired");
  }

  return claims;
}

export function assertPreviewRequest(claims, pathname) {
  const normalizedPrefix = normalizePathname(claims.pathPrefix);
  const normalizedPathname = normalizePathname(pathname);
  const pathMatches =
    normalizedPrefix === "/" ||
    normalizedPathname === normalizedPrefix ||
    normalizedPathname.startsWith(`${normalizedPrefix}/`);

  if (!pathMatches) {
    throw new Error("Preview token does not allow this path");
  }

  return {
    ...claims,
    host: normalizeHostname(claims.host),
    pathPrefix: normalizedPrefix,
  };
}
