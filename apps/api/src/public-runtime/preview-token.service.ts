import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeHostname, normalizePathname } from "./public-runtime.util";

export interface PreviewTokenClaims {
  siteId: string;
  actorId: string;
  host: string;
  pathPrefix: string;
  tokenVersion: number;
  exp: number;
}

@Injectable()
export class PreviewTokenService {
  constructor(private readonly configService: ConfigService) {}

  createToken(input: {
    siteId: string;
    actorId: string;
    host: string;
    pathPrefix: string;
    tokenVersion: number;
    expiresInSeconds: number;
  }): { token: string; expiresAt: string } {
    const now = Math.floor(Date.now() / 1000);
    const claims: PreviewTokenClaims = {
      siteId: input.siteId,
      actorId: input.actorId,
      host: normalizeHostname(input.host),
      pathPrefix: normalizePathname(input.pathPrefix),
      tokenVersion: input.tokenVersion,
      exp: now + input.expiresInSeconds,
    };

    const encodedClaims = this.toBase64Url(JSON.stringify(claims));
    const signature = this.sign(encodedClaims);

    return {
      token: `${encodedClaims}.${signature}`,
      expiresAt: new Date(claims.exp * 1000).toISOString(),
    };
  }

  verifyToken(token: string): PreviewTokenClaims {
    const [encodedClaims, signature] = String(token ?? "").split(".");

    if (!encodedClaims || !signature) {
      throw new UnauthorizedException({
        code: "INVALID_PREVIEW_TOKEN",
        message: "Preview token is malformed",
      });
    }

    const expectedSignature = this.sign(encodedClaims);
    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);

    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new UnauthorizedException({
        code: "INVALID_PREVIEW_TOKEN",
        message: "Preview token signature is invalid",
      });
    }

    let claims: PreviewTokenClaims;

    try {
      claims = JSON.parse(
        this.fromBase64Url(encodedClaims),
      ) as PreviewTokenClaims;
    } catch {
      throw new UnauthorizedException({
        code: "INVALID_PREVIEW_TOKEN",
        message: "Preview token payload is invalid",
      });
    }

    if (!claims.siteId || !claims.host || !claims.pathPrefix) {
      throw new UnauthorizedException({
        code: "INVALID_PREVIEW_TOKEN",
        message: "Preview token is missing required claims",
      });
    }

    if (claims.exp * 1000 <= Date.now()) {
      throw new UnauthorizedException({
        code: "PREVIEW_TOKEN_EXPIRED",
        message: "Preview token has expired",
      });
    }

    return claims;
  }

  assertAuthorizedPreview(input: {
    token: string;
    siteId: string;
    hostname: string;
    pathname: string;
    tokenVersion: number;
  }): PreviewTokenClaims {
    const claims = this.verifyToken(input.token);

    if (claims.siteId !== input.siteId) {
      throw new UnauthorizedException({
        code: "INVALID_PREVIEW_TOKEN",
        message: "Preview token site does not match the resolved host",
      });
    }

    if (claims.tokenVersion !== input.tokenVersion) {
      throw new UnauthorizedException({
        code: "INVALID_PREVIEW_TOKEN",
        message: "Preview token has been revoked",
      });
    }

    if (normalizeHostname(claims.host) !== normalizeHostname(input.hostname)) {
      throw new UnauthorizedException({
        code: "INVALID_PREVIEW_TOKEN",
        message: "Preview token host does not match this request",
      });
    }

    const normalizedPrefix = normalizePathname(claims.pathPrefix);
    const normalizedPathname = normalizePathname(input.pathname);
    const pathMatches =
      normalizedPrefix === "/" ||
      normalizedPathname === normalizedPrefix ||
      normalizedPathname.startsWith(`${normalizedPrefix}/`);

    if (!pathMatches) {
      throw new UnauthorizedException({
        code: "INVALID_PREVIEW_TOKEN",
        message: "Preview token path does not allow this request",
      });
    }

    return claims;
  }

  private sign(value: string): string {
    return createHmac("sha256", this.getSecret())
      .update(value)
      .digest("base64url");
  }

  private getSecret(): Buffer {
    const secret = this.configService
      .get<string>("PREVIEW_TOKEN_SECRET")
      ?.trim();

    if (!secret) {
      throw new InternalServerErrorException(
        "PREVIEW_TOKEN_SECRET is not configured",
      );
    }

    return Buffer.from(secret);
  }

  private toBase64Url(value: string): string {
    return Buffer.from(value, "utf8").toString("base64url");
  }

  private fromBase64Url(value: string): string {
    return Buffer.from(value, "base64url").toString("utf8");
  }
}
