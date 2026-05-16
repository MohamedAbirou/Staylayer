import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { CruxFormFactor, PsiStrategy, TenantMembershipRole } from "@prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../../auth/guards/workspace-scope.guard";
import { MembershipRoles } from "../../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../../auth/auth.types";

import { PsiAuditService } from "./psi.service";
import {
  FetchCruxRecordDto,
  LatestPsiAuditsQueryDto,
  ListPsiAuditsQueryDto,
  RunPsiAuditDto,
} from "./dto/psi.dto";

@Controller("seo/psi")
export class PsiController {
  constructor(
    private readonly service: PsiAuditService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  private async siteFromReq(req: Request): Promise<string> {
    return this.workspaceAccessService.ensureSiteAccess(
      req as Request & { user: AuthenticatedRequestUser },
    );
  }

  private actor(req: Request): string | null {
    const user = (req as Request & { user?: AuthenticatedRequestUser }).user;
    return user?.sub ?? user?.email ?? null;
  }

  @Get("config")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async config(@Req() req: Request, @Query("siteId") _s?: string) {
    await this.siteFromReq(req);
    return this.service.describeConfig();
  }

  @Get("quota")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async quota(@Req() req: Request, @Query("siteId") _s?: string) {
    const siteId = await this.siteFromReq(req);
    return this.service.getMonthlyQuota(siteId);
  }

  @Post("audits")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async runAudit(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Body() body: RunPsiAuditDto,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.runAudit(siteId, {
      url: body.url,
      strategy: body.strategy ?? PsiStrategy.MOBILE,
      forceRefresh: body.forceRefresh,
      triggeredBy: this.actor(req) ?? undefined,
    });
  }

  @Get("audits")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listAudits(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Query() query: ListPsiAuditsQueryDto,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.listAudits(siteId, {
      url: query.url,
      strategy: query.strategy,
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get("audits/latest")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async latestAudits(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Query() query: LatestPsiAuditsQueryDto,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.getLatestPerUrl(siteId, query.limit ?? 25);
  }

  @Get("audits/:id")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async getAudit(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Param("id") id: string,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.getAuditById(siteId, id);
  }

  @Post("crux")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async fetchCrux(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Body() body: FetchCruxRecordDto,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.fetchCruxRecord(siteId, {
      url: body.url,
      origin: body.origin,
      formFactor: body.formFactor ?? CruxFormFactor.ALL,
      forceRefresh: body.forceRefresh,
    });
  }
}
