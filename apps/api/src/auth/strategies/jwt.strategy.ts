import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { SiteStatus, TenantStatus } from "@prisma/client";
import { UsersService } from "../../users/users.service";
import { AuthenticatedRequestUser, JwtAccessPayload } from "../auth.types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
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
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthenticatedRequestUser> {
    const user = await this.usersService.findAuthUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException({
        code: "USER_NOT_FOUND",
        message: "User no longer exists",
      });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException({
        code: "ACCOUNT_LOCKED",
        message: "Account is locked",
      });
    }

    if (payload.platformRole !== (user.platformRole ?? null)) {
      throw new UnauthorizedException({
        code: "STALE_PLATFORM_ROLE",
        message: "Refresh your session before continuing",
      });
    }

    if (!user.platformRole && !user.emailVerifiedAt) {
      throw new UnauthorizedException({
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email before continuing",
      });
    }

    if (payload.activeTenantId || payload.activeMembershipRole) {
      const activeMembership = user.memberships.find(
        (membership) =>
          membership.tenantId === payload.activeTenantId &&
          membership.role === payload.activeMembershipRole,
      );

      if (
        !activeMembership ||
        activeMembership.tenant.status !== TenantStatus.ACTIVE
      ) {
        throw new UnauthorizedException({
          code: "TENANT_ACCESS_DENIED",
          message: "The active tenant is no longer available",
        });
      }

      if (payload.activeSiteId) {
        const activeSite = activeMembership.tenant.sites.find(
          (site) => site.id === payload.activeSiteId,
        );

        if (!activeSite || activeSite.status === SiteStatus.ARCHIVED) {
          throw new UnauthorizedException({
            code: "SITE_ACCESS_DENIED",
            message: "The active site is no longer available",
          });
        }
      }
    }

    return {
      sub: payload.sub,
      email: payload.email,
      platformRole: payload.platformRole ?? null,
      activeTenantId: payload.activeTenantId ?? null,
      activeMembershipRole: payload.activeMembershipRole ?? null,
      activeSiteId: payload.activeSiteId ?? null,
    };
  }
}
