import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { TenantMembershipRole } from "@prisma/client";
import { Request } from "express";
import { AdminService } from "../admin/admin.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { CreateSiteDto } from "./dto/create-site.dto";
import { RestoreSiteDto } from "./dto/restore-site.dto";
import { TenantWorkspaceService } from "./tenant-workspace.service";

@Controller("tenants/:tenantId/sites")
@UseGuards(JwtAuthGuard, RolesGuard)
@MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
export class TenantSitesController {
  constructor(
    private readonly tenantWorkspaceService: TenantWorkspaceService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly adminService: AdminService,
  ) {}

  @Get()
  async list(@Param("tenantId") tenantId: string, @Req() req: Request) {
    const resolvedTenantId =
      await this.workspaceAccessService.ensureTenantAccess(
        req as Request & {
          user?: AuthenticatedRequestUser;
          query: Record<string, unknown>;
          headers: Record<string, string | string[] | undefined>;
          params: Record<string, string>;
        },
        tenantId,
      );

    return this.tenantWorkspaceService.listSites(resolvedTenantId);
  }

  @Get("archived")
  async listArchived(@Param("tenantId") tenantId: string, @Req() req: Request) {
    const resolvedTenantId =
      await this.workspaceAccessService.ensureTenantAccess(
        req as Request & {
          user?: AuthenticatedRequestUser;
          query: Record<string, unknown>;
          headers: Record<string, string | string[] | undefined>;
          params: Record<string, string>;
        },
        tenantId,
      );

    return this.tenantWorkspaceService.listArchivedSites(resolvedTenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateSiteDto,
    @Req() req: Request,
  ) {
    const resolvedTenantId =
      await this.workspaceAccessService.ensureTenantAccess(
        req as Request & {
          user?: AuthenticatedRequestUser;
          query: Record<string, unknown>;
          headers: Record<string, string | string[] | undefined>;
          params: Record<string, string>;
        },
        tenantId,
      );
    const site = await this.tenantWorkspaceService.createSite(
      resolvedTenantId,
      dto,
    );
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForTenant({
      tenantId: resolvedTenantId,
      actorUserId: user?.sub ?? null,
      action: "site.created",
      targetType: "site",
      targetId: site.id,
      metadata: {
        siteName: site.name,
        siteSlug: site.slug,
        siteType: site.siteType,
      },
    });

    return site;
  }

  @Delete(":siteId")
  @MembershipRoles(TenantMembershipRole.OWNER)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param("tenantId") tenantId: string,
    @Param("siteId") siteId: string,
    @Req() req: Request,
  ) {
    const resolvedTenantId =
      await this.workspaceAccessService.ensureTenantAccess(
        req as Request & {
          user?: AuthenticatedRequestUser;
          query: Record<string, unknown>;
          headers: Record<string, string | string[] | undefined>;
          params: Record<string, string>;
        },
        tenantId,
      );
    const site = await this.tenantWorkspaceService.deleteSite(
      resolvedTenantId,
      siteId,
    );
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForTenant({
      tenantId: resolvedTenantId,
      actorUserId: user?.sub ?? null,
      action: "site.deleted",
      targetType: "site",
      targetId: siteId,
      metadata: {
        siteName: site.name,
        archivedSlug: site.slug,
        siteType: site.siteType,
      },
    });

    return site;
  }

  @Post(":siteId/restore")
  @MembershipRoles(TenantMembershipRole.OWNER)
  @HttpCode(HttpStatus.OK)
  async restore(
    @Param("tenantId") tenantId: string,
    @Param("siteId") siteId: string,
    @Body() dto: RestoreSiteDto,
    @Req() req: Request,
  ) {
    const resolvedTenantId =
      await this.workspaceAccessService.ensureTenantAccess(
        req as Request & {
          user?: AuthenticatedRequestUser;
          query: Record<string, unknown>;
          headers: Record<string, string | string[] | undefined>;
          params: Record<string, string>;
        },
        tenantId,
      );
    const site = await this.tenantWorkspaceService.restoreSite(
      resolvedTenantId,
      siteId,
      dto,
    );
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForTenant({
      tenantId: resolvedTenantId,
      actorUserId: user?.sub ?? null,
      action: "site.restored",
      targetType: "site",
      targetId: site.id,
      metadata: {
        siteName: site.name,
        restoredSlug: site.slug,
        restoredPublicSubdomain: site.publicSubdomain,
        siteType: site.siteType,
      },
    });

    return site;
  }
}
