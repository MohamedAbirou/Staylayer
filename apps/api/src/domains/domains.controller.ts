import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { TenantMembershipRole } from "@prisma/client";
import { AdminService } from "../admin/admin.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../auth/guards/workspace-scope.guard";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { DomainsService } from "./domains.service";
import { AddDomainDto } from "./dto/add-domain.dto";
import { SiteDomainQueryDto } from "./dto/domain-query.dto";
import { PreferredHostVariantDto } from "./dto/preferred-host-variant.dto";

@Controller("domains")
@UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
export class DomainsController {
  constructor(
    private readonly domainsService: DomainsService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly adminService: AdminService,
  ) {}

  private async ensureAuthenticatedSiteAccess(req: Request): Promise<string> {
    return this.workspaceAccessService.ensureSiteAccess(
      req as Request & {
        user?: AuthenticatedRequestUser;
        query: Record<string, unknown>;
        headers: Record<string, string | string[] | undefined>;
      },
    );
  }

  @Get("runtime-profile")
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
    TenantMembershipRole.BILLING,
  )
  async runtimeProfile(
    @Query() _query: SiteDomainQueryDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.domainsService.getRuntimeProfile(siteId);
  }

  @Get()
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
    TenantMembershipRole.BILLING,
  )
  async list(@Query() _query: SiteDomainQueryDto, @Req() req: Request) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.domainsService.listForSite(siteId);
  }

  @Post()
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async add(
    @Query() _query: SiteDomainQueryDto,
    @Body() dto: AddDomainDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.domainsService.add(siteId, dto.hostname);
  }

  @Patch(":id/primary")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async setPrimary(
    @Param("id") id: string,
    @Query() _query: SiteDomainQueryDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.domainsService.setPrimary(siteId, id);
  }

  @Post(":id/retry")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async retry(
    @Param("id") id: string,
    @Query() _query: SiteDomainQueryDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const domain = await this.domainsService.retryForSite(siteId, id);
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "domain.retry_requested",
      targetType: "domain",
      targetId: id,
      metadata: {
        hostname: domain.hostname,
        status: domain.status,
      },
    });

    return domain;
  }

  @Delete(":id")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("id") id: string,
    @Query() _query: SiteDomainQueryDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    await this.domainsService.remove(siteId, id);
  }

  @Patch("preferred-host-variant")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async setPreferredHostVariant(
    @Query() _query: SiteDomainQueryDto,
    @Body() dto: PreferredHostVariantDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const profile = await this.domainsService.setPreferredHostVariant(
      siteId,
      dto.variant,
    );
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "domain.canonical_preference_updated",
      targetType: "site",
      targetId: siteId,
      metadata: { variant: dto.variant },
    });

    return profile;
  }

  @Post(":id/companion")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async addCompanion(
    @Param("id") id: string,
    @Query() _query: SiteDomainQueryDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const created = await this.domainsService.addCompanionForDomain(siteId, id);
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "domain.companion_added",
      targetType: "domain",
      targetId: created.id,
      metadata: {
        hostname: created.hostname,
        kind: created.kind,
        apexHost: created.apexHost,
      },
    });

    return created;
  }
}
