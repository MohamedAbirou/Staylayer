import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";

import { SeoTokenEncryptionService } from "./search-console-encryption.service";

/**
 * Scopes requested for Google Search Console. We use the read+write scope so
 * we can also submit sitemaps. URL inspection and analytics work with this
 * scope.
 */
export const SEARCH_CONSOLE_OAUTH_SCOPE =
  "https://www.googleapis.com/auth/webmasters";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const STATE_TTL_SECONDS = 10 * 60; // 10 minutes

export interface OAuthStatePayload {
  siteId: string;
  userId: string | null;
  /** Where the dashboard should land after exchange completes. */
  returnTo?: string;
}

export interface OAuthAuthorizeResult {
  authUrl: string;
  state: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

export interface GoogleUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
}

export class SearchConsoleOAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchConsoleOAuthConfigError";
  }
}

export class SearchConsoleOAuthStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchConsoleOAuthStateError";
  }
}

/**
 * Stateless OAuth helper. State is HMAC-signed `{siteId, userId, nonce, exp}`
 * so we don't need a DB table for one-time codes.
 */
@Injectable()
export class SearchConsoleOAuthService {
  private readonly logger = new Logger(SearchConsoleOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly stateSecret: string;

  constructor(private readonly encryption: SeoTokenEncryptionService) {
    this.clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID ?? "").trim();
    this.clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "").trim();
    this.redirectUri = (
      process.env.SEARCH_CONSOLE_OAUTH_REDIRECT_URI ?? ""
    ).trim();
    // Re-use the SEO token encryption key for state HMAC if no dedicated
    // state secret is provided — it's already a 32-byte secret tied to this
    // installation.
    this.stateSecret = (
      process.env.SEARCH_CONSOLE_OAUTH_STATE_SECRET ??
      process.env.SEO_TOKEN_ENCRYPTION_KEY ??
      ""
    ).trim();
  }

  isConfigured(): boolean {
    return (
      this.clientId.length > 0 &&
      this.clientSecret.length > 0 &&
      this.redirectUri.length > 0 &&
      this.stateSecret.length > 0
    );
  }

  /** Public configuration view for diagnostics (no secrets). */
  describeConfig(): {
    configured: boolean;
    clientIdPresent: boolean;
    clientSecretPresent: boolean;
    redirectUri: string;
    encryptionConfigured: boolean;
  } {
    return {
      configured: this.isConfigured() && this.encryption.isConfigured(),
      clientIdPresent: this.clientId.length > 0,
      clientSecretPresent: this.clientSecret.length > 0,
      redirectUri: this.redirectUri,
      encryptionConfigured: this.encryption.isConfigured(),
    };
  }

  buildAuthorizeUrl(payload: OAuthStatePayload): OAuthAuthorizeResult {
    this.assertConfigured();
    const state = this.signState(payload);
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SEARCH_CONSOLE_OAUTH_SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);
    return { authUrl: url.toString(), state };
  }

  /** Verify a state token returned by Google. Throws on tamper/expiry. */
  verifyState(state: string): OAuthStatePayload {
    this.assertConfigured();
    return this.openState(state);
  }

  async exchangeCode(code: string): Promise<GoogleTokenResponse> {
    this.assertConfigured();
    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: "authorization_code",
    });
    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!resp.ok) {
      const text = await resp.text();
      this.logger.error(
        `Google token exchange failed (${resp.status}): ${text}`,
      );
      throw new Error(
        `Google token exchange failed: ${resp.status} ${resp.statusText}`,
      );
    }
    return (await resp.json()) as GoogleTokenResponse;
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    this.assertConfigured();
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "refresh_token",
    });
    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(
        `Google refresh failed: ${resp.status} ${resp.statusText} ${text}`,
      );
    }
    return (await resp.json()) as GoogleTokenResponse;
  }

  async fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const resp = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) {
      throw new Error(
        `Google userinfo failed: ${resp.status} ${resp.statusText}`,
      );
    }
    return (await resp.json()) as GoogleUserInfo;
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      await fetch(GOOGLE_REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken }),
      });
    } catch (err) {
      this.logger.warn(
        `Google token revoke failed (continuing): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /* ── State signing ─────────────────────────────────────── */

  signState(payload: OAuthStatePayload): string {
    const nonce = randomBytes(16).toString("base64url");
    const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS;
    const body = Buffer.from(
      JSON.stringify({ ...payload, nonce, exp }),
      "utf8",
    ).toString("base64url");
    const sig = createHmac("sha256", this.stateSecret)
      .update(body)
      .digest("base64url");
    return `${body}.${sig}`;
  }

  private openState(state: string): OAuthStatePayload {
    if (typeof state !== "string" || !state.includes(".")) {
      throw new SearchConsoleOAuthStateError("State token is malformed");
    }
    const [body, sig] = state.split(".", 2);
    const expectedSig = createHmac("sha256", this.stateSecret)
      .update(body)
      .digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new SearchConsoleOAuthStateError("State signature mismatch");
    }
    let parsed: OAuthStatePayload & { nonce: string; exp: number };
    try {
      parsed = JSON.parse(
        Buffer.from(body, "base64url").toString("utf8"),
      ) as OAuthStatePayload & { nonce: string; exp: number };
    } catch {
      throw new SearchConsoleOAuthStateError("State payload is not JSON");
    }
    if (
      typeof parsed.exp !== "number" ||
      parsed.exp * 1000 < Date.now()
    ) {
      throw new SearchConsoleOAuthStateError("State has expired");
    }
    if (typeof parsed.siteId !== "string" || parsed.siteId.length === 0) {
      throw new SearchConsoleOAuthStateError("State missing siteId");
    }
    return {
      siteId: parsed.siteId,
      userId: parsed.userId ?? null,
      returnTo: parsed.returnTo,
    };
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new SearchConsoleOAuthConfigError(
        "Google Search Console OAuth is not fully configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, SEARCH_CONSOLE_OAUTH_REDIRECT_URI, and SEO_TOKEN_ENCRYPTION_KEY.",
      );
    }
  }
}
