import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { TenantMembershipRole } from "@prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../../auth/guards/workspace-scope.guard";
import { MembershipRoles } from "../../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../../auth/auth.types";

import { SearchConsoleService } from "./search-console.service";
import { StartOAuthDto } from "./dto/start-oauth.dto";
import { CompleteOAuthDto } from "./dto/complete-oauth.dto";
import {
  InspectUrlDto,
  SubmitSitemapDto,
  SyncSearchConsoleDto,
} from "./dto/search-console.dto";

@Controller("seo/search-console")
export class SearchConsoleController {
  constructor(
    private readonly service: SearchConsoleService,
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

  @Get("connection")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async getConnection(@Req() req: Request, @Query("siteId") _s?: string) {
    const siteId = await this.siteFromReq(req);
    return this.service.getStatus(siteId);
  }

  @Post("oauth/url")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async startOAuth(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Body() body: StartOAuthDto,
  ) {
    const siteId = await this.siteFromReq(req);
    const user = (req as Request & { user?: AuthenticatedRequestUser }).user;
    return this.service.startOAuth(siteId, user?.sub ?? null, body.returnTo);
  }

  @Post("oauth/exchange")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async completeOAuth(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Body() body: CompleteOAuthDto,
  ) {
    const siteId = await this.siteFromReq(req);
    const user = (req as Request & { user?: AuthenticatedRequestUser }).user;
    return this.service.completeOAuth(siteId, user?.sub ?? null, body);
  }

  @Delete("connection")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async disconnect(@Req() req: Request, @Query("siteId") _s?: string) {
    const siteId = await this.siteFromReq(req);
    return this.service.disconnect(siteId);
  }

  @Post("sync")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async triggerSync(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Body() body: SyncSearchConsoleDto,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.triggerSync(siteId, this.actor(req), {
      startDate: body.startDate,
      endDate: body.endDate,
    });
  }

  @Get("sync-jobs")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listSyncJobs(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.listSyncJobs(siteId, limit);
  }

  @Get("performance/overview")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async overview(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Query("days", new DefaultValuePipe(28), ParseIntPipe) days: number,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.getPerformanceOverview(
      siteId,
      Math.min(Math.max(days, 1), 90),
    );
  }

  @Get("performance/pages")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async pages(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Query("days", new DefaultValuePipe(28), ParseIntPipe) days: number,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.getPagePerformance(
      siteId,
      Math.min(Math.max(days, 1), 90),
    );
  }

  @Get("sitemaps")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listSitemaps(@Req() req: Request, @Query("siteId") _s?: string) {
    const siteId = await this.siteFromReq(req);
    return this.service.listSitemaps(siteId);
  }

  @Post("sitemaps/submit")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async submitSitemap(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Body() body: SubmitSitemapDto,
  ) {
    const siteId = await this.siteFromReq(req);
    await this.service.submitSitemap(siteId, body.sitemapUrl, this.actor(req));
    return { ok: true };
  }

  @Delete("sitemaps")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async deleteSitemap(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Query("sitemapUrl") sitemapUrl: string,
  ) {
    const siteId = await this.siteFromReq(req);
    await this.service.deleteSitemap(siteId, sitemapUrl);
    return { ok: true };
  }

  @Post("url-inspection")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async inspect(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Body() body: InspectUrlDto,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.inspectUrl(
      siteId,
      body.url,
      body.languageCode,
      this.actor(req),
    );
  }

  @Get("url-inspection")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async cachedInspect(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Query("url") url: string,
  ) {
    const siteId = await this.siteFromReq(req);
    const cached = await this.service.getCachedInspection(siteId, url);
    return { url, inspection: cached };
  }
}
