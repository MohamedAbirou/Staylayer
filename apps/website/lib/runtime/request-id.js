// Request ID propagation helpers shared between middleware, server
// components and route handlers. The API echoes whatever `x-request-id`
// header it receives, so the Website always sends one — generated here when
// absent — to make end-to-end logs greppable.

const REQUEST_ID_HEADER = "x-request-id";

function generateRequestId() {
  // crypto.randomUUID exists in Node 19+ and Edge runtimes.
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Last-resort fallback.
  return `web-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function ensureRequestId(headersLike) {
  const incoming =
    headersLike?.get?.(REQUEST_ID_HEADER) ??
    headersLike?.[REQUEST_ID_HEADER] ??
    null;
  if (typeof incoming === "string" && incoming.trim().length > 0) {
    return incoming.trim();
  }
  return generateRequestId();
}

export function getRequestIdFromHeaders(headersLike) {
  const value =
    headersLike?.get?.(REQUEST_ID_HEADER) ??
    headersLike?.[REQUEST_ID_HEADER] ??
    null;
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

export { REQUEST_ID_HEADER };
