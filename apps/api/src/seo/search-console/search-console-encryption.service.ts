import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";

/**
 * AES-256-GCM symmetric encryption used to protect Search Console refresh
 * tokens (and any other SEO-integration secrets we add later). The key is
 * read from the `SEO_TOKEN_ENCRYPTION_KEY` env var and must be a 32-byte
 * value encoded as base64 or base64url.
 *
 * Ciphertext format (base64): [12-byte IV][16-byte auth tag][ciphertext]
 *
 * The service intentionally stays narrow — no key rotation, no envelope
 * encryption. Rotation is implemented as "disconnect then reconnect" at the
 * higher level.
 */
@Injectable()
export class SeoTokenEncryptionService {
  private readonly logger = new Logger(SeoTokenEncryptionService.name);
  private readonly key: Buffer | null;

  constructor() {
    this.key = SeoTokenEncryptionService.loadKey(
      process.env.SEO_TOKEN_ENCRYPTION_KEY ?? "",
    );
    if (!this.key) {
      this.logger.warn(
        "SEO_TOKEN_ENCRYPTION_KEY is not configured. Search Console connections will refuse to save.",
      );
    }
  }

  /** Returns true when the env-derived key is a valid 32-byte secret. */
  isConfigured(): boolean {
    return this.key !== null;
  }

  /**
   * Encrypt a plaintext string. Returns base64 payload of
   * `iv || authTag || ciphertext`. Throws if no key is configured.
   */
  encrypt(plaintext: string): string {
    if (!this.key) {
      throw new Error(
        "SEO_TOKEN_ENCRYPTION_KEY is not configured; cannot encrypt secrets",
      );
    }
    if (typeof plaintext !== "string") {
      throw new TypeError("encrypt() expects a string plaintext");
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
  }

  /**
   * Decrypt a ciphertext produced by {@link encrypt}. Throws on tamper or
   * key mismatch.
   */
  decrypt(payload: string): string {
    if (!this.key) {
      throw new Error(
        "SEO_TOKEN_ENCRYPTION_KEY is not configured; cannot decrypt secrets",
      );
    }
    if (typeof payload !== "string" || payload.length === 0) {
      throw new TypeError("decrypt() expects a non-empty base64 payload");
    }
    const buf = Buffer.from(payload, "base64");
    if (buf.length < 12 + 16 + 1) {
      throw new Error("Ciphertext payload is malformed");
    }
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  }

  /**
   * Accept the env value as either standard base64 or base64url. Returns
   * null when the key is missing or not exactly 32 bytes after decode.
   */
  private static loadKey(raw: string): Buffer | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // Try base64 and base64url. Node accepts base64url since v16.
    for (const encoding of ["base64", "base64url"] as const) {
      try {
        const buf = Buffer.from(trimmed, encoding);
        if (buf.length === 32) return buf;
      } catch {
        // ignore and try next
      }
    }
    return null;
  }
}
