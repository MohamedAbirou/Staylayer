import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { SiteStatus, TenantStatus } from "@prisma/client";
import { UsersService, type AuthUserRecord } from "../users/users.service";
import {
  ActiveSiteContext,
  AuthContextRequest,
  AuthMembershipSummary,
  AuthResponse,
  AuthenticatedUserProfile,
  JwtAccessPayload,
  RefreshTokenPayload,
} from "./auth.types";

const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000;
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<{
    id: string;
    email: string;
    platformRole: AuthenticatedUserProfile["platformRole"];
  } | null> {
    const user = await this.usersService.findAuthUserByEmail(email);
    if (!user) {
      return null;
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException({
        code: "ACCOUNT_LOCKED",
        message: `Account locked. Try again after ${user.lockedUntil.toISOString()}`,
      });
    }

    const isPasswordValid = await this.usersService.verifyPassword(
      user.passwordHash,
      password,
    );

    if (!isPasswordValid) {
      await this.usersService.incrementFailedAttempts(user.id);
      this.logger.warn(`Failed login attempt for user ${user.email}`);
      return null;
    }

    if (!user.platformRole && !user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: "EMAIL_NOT_VERIFIED",
        message:
          "Verify your email before signing in. Request a new verification email if needed.",
      });
    }

    // Reset failed attempts on successful login
    await this.usersService.resetFailedAttempts(user.id);

    return {
      id: user.id,
      email: user.email,
      platformRole: user.platformRole ?? null,
    };
  }

  async login(
    user: {
      id: string;
      email: string;
      platformRole: AuthenticatedUserProfile["platformRole"];
    },
    context: AuthContextRequest = {},
  ): Promise<AuthResponse> {
    const authUser = await this.usersService.findAuthUserById(user.id);

    if (!authUser) {
      throw new UnauthorizedException({
        code: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    return this.buildAuthResponse(authUser, context);
  }

  async switchContext(
    userId: string,
    context: AuthContextRequest = {},
  ): Promise<AuthResponse> {
    const authUser = await this.usersService.findAuthUserById(userId);

    if (!authUser) {
      throw new UnauthorizedException({
        code: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    return this.buildAuthResponse(authUser, context);
  }

  async generateRefreshToken(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, type: "refresh" },
      { expiresIn: REFRESH_TOKEN_EXPIRY },
    );
  }

  async refreshAccessToken(
    refreshToken: string,
    context: AuthContextRequest = {},
  ): Promise<AuthResponse & { newRefreshToken: string }> {
    let payload: RefreshTokenPayload;
    try {
      payload =
        await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException({
        code: "TOKEN_EXPIRED",
        message: "Refresh token expired or invalid",
      });
    }

    if (payload.type !== "refresh") {
      throw new UnauthorizedException({
        code: "INVALID_TOKEN",
        message: "Invalid token type",
      });
    }

    const user = await this.usersService.findAuthUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        code: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    const session = await this.buildAuthResponse(user, context);
    const newRefreshToken = await this.generateRefreshToken(user.id);

    return {
      ...session,
      newRefreshToken,
    };
  }

  getRefreshTokenCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict";
    path: string;
    maxAge: number;
  } {
    return {
      httpOnly: true,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "strict",
      path: "/",
      maxAge: REFRESH_TOKEN_EXPIRY,
    };
  }

  getClearCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict";
    path: string;
    maxAge: number;
  } {
    return {
      httpOnly: true,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    };
  }

  private async buildAuthResponse(
    user: AuthUserRecord,
    context: AuthContextRequest,
  ): Promise<AuthResponse> {
    if (!user.platformRole && !user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: "EMAIL_NOT_VERIFIED",
        message:
          "Verify your email before signing in. Request a new verification email if needed.",
      });
    }

    const memberships = this.buildMembershipSummaries(user);

    // NOTE: We intentionally allow customer users with zero memberships to
    // sign in. They land in a "no-workspace" limbo state on the dashboard
    // where they can create a new workspace, accept a pending invite, or
    // permanently delete their account. Locking them out here would orphan
    // any user who deletes their last workspace.

    const activeMembership = this.resolveActiveMembership(memberships, context);
    const activeTenant = activeMembership
      ? {
          id: activeMembership.tenantId,
          slug: activeMembership.tenantSlug,
          name: activeMembership.tenantName,
          status: activeMembership.tenantStatus,
        }
      : null;
    const activeSite = this.resolveActiveSite(activeMembership, context);
    const accessToken = await this.generateAccessToken({
      sub: user.id,
      email: user.email,
      platformRole: user.platformRole ?? null,
      activeTenantId: activeTenant?.id ?? null,
      activeMembershipRole: activeMembership?.role ?? null,
      activeSiteId: activeSite?.id ?? null,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        platformRole: user.platformRole ?? null,
      },
      memberships,
      activeTenant,
      activeSite,
      activeMembershipRole: activeMembership?.role ?? null,
    };
  }

  private buildMembershipSummaries(
    user: AuthUserRecord,
  ): AuthMembershipSummary[] {
    return user.memberships
      .filter((membership) => membership.tenant.status === TenantStatus.ACTIVE)
      .map((membership) => ({
        tenantId: membership.tenant.id,
        tenantSlug: membership.tenant.slug,
        tenantName: membership.tenant.name,
        tenantStatus: membership.tenant.status,
        role: membership.role,
        isDefault: membership.isDefault,
        sites: membership.tenant.sites.filter(
          (site) => site.status !== SiteStatus.ARCHIVED,
        ),
      }));
  }

  private resolveActiveMembership(
    memberships: AuthMembershipSummary[],
    context: AuthContextRequest,
  ): AuthMembershipSummary | null {
    if (memberships.length === 0) {
      if (context.tenantId) {
        throw new ForbiddenException({
          code: "TENANT_ACCESS_DENIED",
          message: "The requested tenant is not available for this user",
        });
      }
      return null;
    }

    if (context.tenantId) {
      const requestedMembership = memberships.find(
        (membership) => membership.tenantId === context.tenantId,
      );

      if (!requestedMembership) {
        throw new ForbiddenException({
          code: "TENANT_ACCESS_DENIED",
          message: "The requested tenant is not available for this user",
        });
      }

      return requestedMembership;
    }

    if (memberships.length === 1) {
      return memberships[0];
    }

    const defaultMemberships = memberships.filter(
      (membership) => membership.isDefault,
    );

    if (defaultMemberships.length === 1) {
      return defaultMemberships[0];
    }

    throw new ForbiddenException({
      code: "TENANT_CONTEXT_REQUIRED",
      message: "Select a tenant workspace to continue",
    });
  }

  private resolveActiveSite(
    membership: AuthMembershipSummary | null,
    context: AuthContextRequest,
  ): ActiveSiteContext | null {
    if (!membership) {
      if (context.siteId) {
        throw new ForbiddenException({
          code: "SITE_ACCESS_DENIED",
          message: "The requested site is not available in the active tenant",
        });
      }
      return null;
    }

    if (context.siteId) {
      const requestedSite = membership.sites.find(
        (site) => site.id === context.siteId,
      );

      if (!requestedSite) {
        throw new ForbiddenException({
          code: "SITE_ACCESS_DENIED",
          message: "The requested site is not available in the active tenant",
        });
      }

      return requestedSite;
    }

    if (membership.sites.length >= 1) {
      return membership.sites[0];
    }

    return null;
  }

  private async generateAccessToken(
    payload: JwtAccessPayload,
  ): Promise<string> {
    return this.jwtService.signAsync(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });
  }
}
