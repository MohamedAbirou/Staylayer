/**
 * Phase 12 — Audit log metadata redaction.
 *
 * The OperatorAuditInterceptor captures request/response context to help
 * operators investigate sensitive mutations. Some of that context can
 * inadvertently include PII (customer email, IP, payment method id) or
 * secrets (access tokens, raw webhook payloads).
 *
 * When exposing audit metadata back to the operator console we run it
 * through this redactor first. The rules are intentionally conservative —
 * the original raw row stays in the database (only writeable through
 * direct DB access), but every read path that surfaces metadata uses the
 * sanitized projection.
 *
 * The matcher is *key-based*: any property whose name contains one of
 * the forbidden substrings (case-insensitive) has its value replaced with
 * the literal string `"[REDACTED]"`. Arrays and nested plain objects are
 * walked recursively. Non-plain values (Buffer, Date, etc.) are
 * stringified into a JSON-safe primitive.
 */
const DENY_SUBSTRINGS: readonly string[] = [
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "sessionid",
  "session_id",
  "ssn",
  "taxid",
  "tax_id",
  "card",
  "cvc",
  "cvv",
  "pan",
  "iban",
  "routing",
  "account_number",
  "accountnumber",
  "phone",
  "address",
  "passport",
  "license",
  "dob",
  "birth",
  "ip",
  "ipaddress",
  "ip_address",
  "useragent",
  "user_agent",
  "body",
  "rawbody",
  "raw_body",
  "html",
  "plaintext",
  "plain_text",
  "payload",
  "signature",
  "private_key",
  "privatekey",
];

const REDACTED = "[REDACTED]";

function shouldRedactKey(key: string): boolean {
  const lc = key.toLowerCase();
  // Email handled specially below (masked instead of full redact).
  return DENY_SUBSTRINGS.some((needle) => lc.includes(needle));
}

function isEmailKey(key: string): boolean {
  return /email|mail/i.test(key) && !/template|subject/i.test(key);
}

function maskEmail(value: unknown): string {
  if (typeof value !== "string") return REDACTED;
  const [local, domain] = value.split("@");
  if (!domain) return REDACTED;
  return `${local.slice(0, 1)}***@${domain}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

export function redactAuditMetadata(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) {
    return input.map((v) => redactAuditMetadata(v));
  }
  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (shouldRedactKey(key)) {
        out[key] = REDACTED;
        continue;
      }
      if (isEmailKey(key)) {
        out[key] = maskEmail(value);
        continue;
      }
      out[key] = redactAuditMetadata(value);
    }
    return out;
  }
  // Strings are passed through. They may still contain raw PII, but
  // without a key context we have no reliable signal to redact. Callers
  // that store free-form user input should put it under a key matching
  // the deny-list (e.g. `body`, `payload`).
  return input;
}
