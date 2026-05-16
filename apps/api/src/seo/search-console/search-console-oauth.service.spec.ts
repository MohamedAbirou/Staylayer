import { randomBytes } from "node:crypto";

import {
  SearchConsoleOAuthService,
  SearchConsoleOAuthStateError,
  SearchConsoleOAuthConfigError,
  SEARCH_CONSOLE_OAUTH_SCOPE,
} from "./search-console-oauth.service";
import { SeoTokenEncryptionService } from "./search-console-encryption.service";

const KEY = randomBytes(32).toString("base64");

function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => void,
): void {
  const original: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) original[k] = process.env[k];
  Object.assign(process.env, vars);
  try {
    fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  }
}

describe("SearchConsoleOAuthService", () => {
  const baseEnv = {
    SEO_TOKEN_ENCRYPTION_KEY: KEY,
    GOOGLE_OAUTH_CLIENT_ID: "test-client",
    GOOGLE_OAUTH_CLIENT_SECRET: "test-secret",
    SEARCH_CONSOLE_OAUTH_REDIRECT_URI:
      "http://localhost:5173/seo/search-console/callback",
    SEARCH_CONSOLE_OAUTH_STATE_SECRET: "state-hmac-secret",
  };

  it("isConfigured() false when client id missing", () => {
    withEnv({ ...baseEnv, GOOGLE_OAUTH_CLIENT_ID: "" }, () => {
      const svc = new SearchConsoleOAuthService(
        new SeoTokenEncryptionService(),
      );
      expect(svc.isConfigured()).toBe(false);
      expect(() =>
        svc.buildAuthorizeUrl({ siteId: "s1", userId: "u1" }),
      ).toThrow(SearchConsoleOAuthConfigError);
    });
  });

  it("buildAuthorizeUrl returns a properly shaped Google URL with state", () => {
    withEnv(baseEnv, () => {
      const svc = new SearchConsoleOAuthService(
        new SeoTokenEncryptionService(),
      );
      const { authUrl, state } = svc.buildAuthorizeUrl({
        siteId: "site-123",
        userId: "user-7",
        returnTo: "/seo?tab=search-console",
      });
      const url = new URL(authUrl);
      expect(url.origin).toBe("https://accounts.google.com");
      expect(url.searchParams.get("client_id")).toBe("test-client");
      expect(url.searchParams.get("redirect_uri")).toBe(
        baseEnv.SEARCH_CONSOLE_OAUTH_REDIRECT_URI,
      );
      expect(url.searchParams.get("scope")).toBe(SEARCH_CONSOLE_OAUTH_SCOPE);
      expect(url.searchParams.get("access_type")).toBe("offline");
      expect(url.searchParams.get("prompt")).toBe("consent");
      expect(url.searchParams.get("state")).toBe(state);
      const verified = svc.verifyState(state);
      expect(verified.siteId).toBe("site-123");
      expect(verified.userId).toBe("user-7");
      expect(verified.returnTo).toBe("/seo?tab=search-console");
    });
  });

  it("verifyState rejects tampered tokens", () => {
    withEnv(baseEnv, () => {
      const svc = new SearchConsoleOAuthService(
        new SeoTokenEncryptionService(),
      );
      const { state } = svc.buildAuthorizeUrl({ siteId: "s", userId: "u" });
      const [body, sig] = state.split(".");
      const tampered = `${body}A.${sig}`;
      expect(() => svc.verifyState(tampered)).toThrow(
        SearchConsoleOAuthStateError,
      );
    });
  });

  it("verifyState rejects malformed tokens", () => {
    withEnv(baseEnv, () => {
      const svc = new SearchConsoleOAuthService(
        new SeoTokenEncryptionService(),
      );
      expect(() => svc.verifyState("not-a-token")).toThrow(
        SearchConsoleOAuthStateError,
      );
    });
  });

  it("verifyState rejects expired tokens", () => {
    withEnv(baseEnv, () => {
      const svc = new SearchConsoleOAuthService(
        new SeoTokenEncryptionService(),
      );
      // Hand-craft expired payload
      const expired = Math.floor(Date.now() / 1000) - 60;
      const body = Buffer.from(
        JSON.stringify({
          siteId: "s",
          userId: "u",
          nonce: "x",
          exp: expired,
        }),
        "utf8",
      ).toString("base64url");
      const crypto = require("node:crypto");
      const sig = crypto
        .createHmac("sha256", "state-hmac-secret")
        .update(body)
        .digest("base64url");
      const token = `${body}.${sig}`;
      expect(() => svc.verifyState(token)).toThrow(/expired/i);
    });
  });

  it("describeConfig() reports presence without leaking secrets", () => {
    withEnv(baseEnv, () => {
      const svc = new SearchConsoleOAuthService(
        new SeoTokenEncryptionService(),
      );
      const cfg = svc.describeConfig();
      expect(cfg.configured).toBe(true);
      expect(cfg.oauthConfigured).toBe(true);
      expect(cfg.clientIdPresent).toBe(true);
      expect(cfg.clientSecretPresent).toBe(true);
      expect(cfg.redirectUri).toBe(baseEnv.SEARCH_CONSOLE_OAUTH_REDIRECT_URI);
      expect(cfg.encryptionConfigured).toBe(true);
    });
  });
});
