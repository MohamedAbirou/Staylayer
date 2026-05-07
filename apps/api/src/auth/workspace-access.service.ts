import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedRequestUser } from "./auth.types";

interface SiteScopedRequestLike {
  user?: AuthenticatedRequestUser;
  query: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, string | string[] | undefined>;
}

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureTenantAccess(
    request: SiteScopedRequestLike,
    expectedTenantId?: string,
  ): Promise<string> {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Authentication is required",
      });
    }

    if (!user.activeTenantId || !user.activeMembershipRole) {
      throw new ForbiddenException({
        code: "TENANT_CONTEXT_REQUIRED",
        message: "Select a tenant workspace before continuing",
      });
    }

    const requestedTenantId =
      expectedTenantId ?? this.readTenantId(request) ?? user.activeTenantId;

    if (!requestedTenantId) {
      throw new ForbiddenException({
        code: "TENANT_CONTEXT_REQUIRED",
        message: "Select a tenant workspace before continuing",
      });
    }

    if (requestedTenantId !== user.activeTenantId) {
      throw new ForbiddenException({
        code: "TENANT_CONTEXT_MISMATCH",
        message: "Refresh the workspace context before switching tenants",
      });
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: requestedTenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new ForbiddenException({
        code: "TENANT_ACCESS_DENIED",
        message: "The selected tenant is not available in the active workspace",
      });
    }

    request.query.tenantId = requestedTenantId;
    return requestedTenantId;
  }

  async ensureSiteAccess(request: SiteScopedRequestLike): Promise<string> {
    const tenantId = await this.ensureTenantAccess(request);
    const user = request.user as AuthenticatedRequestUser;

    const requestedSiteId = this.readSiteId(request);

    if (user.activeSiteId) {
      if (!requestedSiteId) {
        request.query.siteId = user.activeSiteId;
      } else if (requestedSiteId !== user.activeSiteId) {
        throw new ForbiddenException({
          code: "SITE_CONTEXT_MISMATCH",
          message: "Refresh the workspace context before switching sites",
        });
      }
    } else if (!requestedSiteId) {
      throw new ForbiddenException({
        code: "SITE_CONTEXT_REQUIRED",
        message: "Select a site before accessing site content",
      });
    }

    const siteId =
      (request.query.siteId as string | undefined) ?? requestedSiteId;

    if (!siteId) {
      throw new ForbiddenException({
        code: "SITE_CONTEXT_REQUIRED",
        message: "Select a site before accessing site content",
      });
    }

    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { tenantId: true },
    });

    if (!site || site.tenantId !== tenantId) {
      throw new ForbiddenException({
        code: "SITE_ACCESS_DENIED",
        message: "The selected site is not available in the active tenant",
      });
    }

    request.query.siteId = siteId;
    return siteId;
  }

  private readSiteId(request: SiteScopedRequestLike): string | undefined {
    const querySiteId = request.query.siteId;
    if (typeof querySiteId === "string" && querySiteId.length > 0) {
      return querySiteId;
    }

    const headerSiteId = request.headers["x-active-site-id"];
    if (typeof headerSiteId === "string" && headerSiteId.length > 0) {
      return headerSiteId;
    }

    if (Array.isArray(headerSiteId)) {
      return headerSiteId.find(
        (value) => typeof value === "string" && value.length > 0,
      );
    }

    return undefined;
  }

  private readTenantId(request: SiteScopedRequestLike): string | undefined {
    const queryTenantId = request.query.tenantId;
    if (typeof queryTenantId === "string" && queryTenantId.length > 0) {
      return queryTenantId;
    }

    const paramsTenantId = request.params?.tenantId;
    if (typeof paramsTenantId === "string" && paramsTenantId.length > 0) {
      return paramsTenantId;
    }

    if (Array.isArray(paramsTenantId)) {
      return paramsTenantId.find(
        (value) => typeof value === "string" && value.length > 0,
      );
    }

    const headerTenantId = request.headers["x-active-tenant-id"];
    if (typeof headerTenantId === "string" && headerTenantId.length > 0) {
      return headerTenantId;
    }

    if (Array.isArray(headerTenantId)) {
      return headerTenantId.find(
        (value) => typeof value === "string" && value.length > 0,
      );
    }

    return undefined;
  }
}
