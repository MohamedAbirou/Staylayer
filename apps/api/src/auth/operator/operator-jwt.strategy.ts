import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UsersService } from "../../users/users.service";
import {
  OPERATOR_JWT_AUDIENCE,
  OPERATOR_JWT_ISSUER,
  OperatorAuthenticatedRequestUser,
  OperatorJwtAccessPayload,
} from "./operator-auth.types";

/**
 * Passport strategy registered under the name "operator-jwt". It is
 * intentionally separate from the customer "jwt" strategy so a customer
 * dashboard access token can never be accepted by an operator route, even
 * if both apps run against the same backend in the same browser.
 *
 * Security invariants:
 *  - Verifies `aud=operator-console` and `iss=staylayer-operator`.
 *  - Rejects any token whose `type` is not `operator-access`.
 *  - Rejects any token whose subject no longer has a non-null platformRole
 *    (role revoked while the access token was still valid).
 *  - Rejects any token whose platformRole claim disagrees with the DB
 *    (stale role after a Platform Owner change).
 */
@Injectable()
export class OperatorJwtStrategy extends PassportStrategy(
  Strategy,
  "operator-jwt",
) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const publicKey = configService.get<string>("JWT_PUBLIC_KEY");
    if (!publicKey) {
      throw new Error("JWT_PUBLIC_KEY is not defined in environment variables");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ["RS256"],
      audience: OPERATOR_JWT_AUDIENCE,
      issuer: OPERATOR_JWT_ISSUER,
    });
  }

  async validate(
    payload: OperatorJwtAccessPayload,
  ): Promise<OperatorAuthenticatedRequestUser> {
    if (payload.type !== "operator-access") {
      throw new UnauthorizedException({
        code: "OPERATOR_TOKEN_INVALID_TYPE",
        message: "Invalid operator token type",
      });
    }

    const user = await this.usersService.findAuthUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException({
        code: "OPERATOR_NOT_FOUND",
        message: "Operator no longer exists",
      });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException({
        code: "ACCOUNT_LOCKED",
        message: "Operator account is locked",
      });
    }

    if (!user.platformRole) {
      throw new UnauthorizedException({
        code: "OPERATOR_ROLE_REVOKED",
        message: "Operator role has been revoked",
      });
    }

    if (user.platformRole !== payload.platformRole) {
      throw new UnauthorizedException({
        code: "OPERATOR_ROLE_STALE",
        message: "Operator role has changed. Sign in again.",
      });
    }

    return {
      id: user.id,
      email: user.email,
      platformRole: user.platformRole,
      mfaEnrolled: !!user.operatorMfaSecret && !!user.operatorMfaEnrolledAt,
      mfaEnrolledAt: user.operatorMfaEnrolledAt?.toISOString() ?? null,
      aud: OPERATOR_JWT_AUDIENCE,
    };
  }
}
