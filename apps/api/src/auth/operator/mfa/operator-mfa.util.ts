/**
 * Phase 12 — operator MFA primitives.
 *
 * Self-contained TOTP (RFC 6238) implementation + AES-256-GCM helpers for
 * sealing the operator MFA secret at rest. Kept dependency-free so we do
 * not pull a new npm package into the production hot path.
 *
 * The HOTP/TOTP code follows the reference algorithm from RFC 4226 / RFC
 * 6238 exactly (HMAC-SHA1, 30s step, 6 digits, ±1 step skew window).
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = "sha1";
const TOTP_SKEW_STEPS = 1; // accept ±30s drift

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(bytes = 20): string {
  return encodeBase32(randomBytes(bytes));
}

export function buildOtpauthUri(params: {
  secret: string;
  label: string;
  issuer: string;
}): string {
  const issuer = encodeURIComponent(params.issuer);
  const label = encodeURIComponent(`${params.issuer}:${params.label}`);
  const secret = params.secret.replace(/=+$/, "");
  return (
    `otpauth://totp/${label}` +
    `?secret=${secret}&issuer=${issuer}` +
    `&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`
  );
}

export function verifyTotpCode(
  secretBase32: string,
  code: string,
  now: Date = new Date(),
): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const key = decodeBase32(secretBase32);
  const counter = Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  for (let skew = -TOTP_SKEW_STEPS; skew <= TOTP_SKEW_STEPS; skew += 1) {
    const candidate = hotp(key, counter + skew);
    if (constantTimeEqualString(candidate, code)) return true;
  }
  return false;
}

function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // Big-endian 64-bit counter
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac(TOTP_ALGORITHM, key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

// ── base32 (RFC 4648) ──────────────────────────────────────────────
function encodeBase32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

function decodeBase32(input: string): Buffer {
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) {
      throw new Error("Invalid base32 character in TOTP secret");
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function constantTimeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ── AES-256-GCM encryption for operator MFA secret at rest ─────────
//
// Stored as `<ivHex>:<tagHex>:<ciphertextHex>` to keep the column a single
// printable string. Encryption key is derived from
// `OPERATOR_MFA_ENCRYPTION_KEY` (raw or hex/base64). In dev the JWT secret
// is reused if no dedicated key is set.

function deriveEncryptionKey(rawKey: string | undefined): Buffer {
  if (!rawKey) {
    throw new Error(
      "OPERATOR_MFA_ENCRYPTION_KEY (or JWT_SECRET fallback) is required for MFA",
    );
  }
  // SHA-256 hash of any input → 32 byte AES-256 key. Accepts any input
  // length and any encoding without forcing operations teams to manage
  // exact 32-byte keys.
  return createHash("sha256").update(rawKey, "utf8").digest();
}

export function encryptMfaSecret(
  plaintextBase32: string,
  rawKey: string | undefined,
): string {
  const key = deriveEncryptionKey(rawKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintextBase32, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), enc.toString("hex")].join(
    ":",
  );
}

export function decryptMfaSecret(
  sealed: string,
  rawKey: string | undefined,
): string {
  const [ivHex, tagHex, ctHex] = sealed.split(":");
  if (!ivHex || !tagHex || !ctHex) {
    throw new Error("Malformed sealed MFA secret");
  }
  const key = deriveEncryptionKey(rawKey);
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString("utf8");
}

// ── Recovery codes ─────────────────────────────────────────────────
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const bytes = randomBytes(10);
    let raw = "";
    for (const b of bytes) {
      raw += RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length];
    }
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256")
    .update(code.replace(/-/g, "").toUpperCase(), "utf8")
    .digest("hex");
}
