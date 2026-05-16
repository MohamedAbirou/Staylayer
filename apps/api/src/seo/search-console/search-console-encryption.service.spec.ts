import { randomBytes } from "node:crypto";

import { SeoTokenEncryptionService } from "./search-console-encryption.service";

describe("SeoTokenEncryptionService", () => {
  const VALID_KEY = randomBytes(32).toString("base64");
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.SEO_TOKEN_ENCRYPTION_KEY;
    process.env.SEO_TOKEN_ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.SEO_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.SEO_TOKEN_ENCRYPTION_KEY = originalKey;
    }
  });

  it("encrypts and decrypts round-trip", () => {
    const svc = new SeoTokenEncryptionService();
    expect(svc.isConfigured()).toBe(true);
    const plain = "1//refresh-token-abcdefghijklmnop";
    const ct = svc.encrypt(plain);
    expect(ct).not.toContain(plain);
    expect(svc.decrypt(ct)).toBe(plain);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const svc = new SeoTokenEncryptionService();
    const plain = "same-input";
    const a = svc.encrypt(plain);
    const b = svc.encrypt(plain);
    expect(a).not.toBe(b);
    expect(svc.decrypt(a)).toBe(svc.decrypt(b));
  });

  it("rejects tampered ciphertext via GCM auth tag", () => {
    const svc = new SeoTokenEncryptionService();
    const ct = svc.encrypt("payload");
    // Flip a byte in the ciphertext portion
    const buf = Buffer.from(ct, "base64");
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => svc.decrypt(tampered)).toThrow();
  });

  it("accepts base64url-encoded keys", () => {
    const url = randomBytes(32).toString("base64url");
    process.env.SEO_TOKEN_ENCRYPTION_KEY = url;
    const svc = new SeoTokenEncryptionService();
    expect(svc.isConfigured()).toBe(true);
    expect(svc.decrypt(svc.encrypt("x"))).toBe("x");
  });

  it("isConfigured() is false when key is missing", () => {
    delete process.env.SEO_TOKEN_ENCRYPTION_KEY;
    const svc = new SeoTokenEncryptionService();
    expect(svc.isConfigured()).toBe(false);
    expect(() => svc.encrypt("x")).toThrow(/not configured/);
    expect(() => svc.decrypt("AAAA")).toThrow(/not configured/);
  });

  it("rejects keys that are not 32 bytes", () => {
    process.env.SEO_TOKEN_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString(
      "base64",
    );
    const svc = new SeoTokenEncryptionService();
    expect(svc.isConfigured()).toBe(false);
  });

  it("rejects malformed payloads", () => {
    const svc = new SeoTokenEncryptionService();
    expect(() => svc.decrypt("")).toThrow();
    expect(() => svc.decrypt("AAAA")).toThrow(/malformed/);
  });
});
