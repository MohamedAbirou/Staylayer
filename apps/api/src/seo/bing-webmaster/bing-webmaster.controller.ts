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

import { BingWebmasterService } from "./bing-webmaster.service";
import {
  ConnectBingDto,
  SubmitBingSitemapDto,
  VerifyBingApiKeyDto,
} from "./dto/bing-webmaster.dto";

@Controller("seo/bing-webmaster")
export class BingWebmasterController {
  constructor(
    private readonly service: BingWebmasterService,
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

  @Post("verify")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async verify(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Body() body: VerifyBingApiKeyDto,
  ) {
    await this.siteFromReq(req);
    return this.service.verifyApiKey(body.apiKey);
  }

  @Post("connection")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async connect(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Body() body: ConnectBingDto,
  ) {
    const siteId = await this.siteFromReq(req);
    const user = (req as Request & { user?: AuthenticatedRequestUser }).user;
    return this.service.connect(siteId, user?.sub ?? null, body);
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
  async triggerSync(@Req() req: Request, @Query("siteId") _s: string) {
    const siteId = await this.siteFromReq(req);
    return this.service.triggerSync(siteId, this.actor(req));
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
      Math.min(Math.max(days, 1), 180),
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
      Math.min(Math.max(days, 1), 180),
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
    @Body() body: SubmitBingSitemapDto,
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

  @Get("crawl-issues")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async crawlIssues(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Query("limit", new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.listCrawlIssues(siteId, limit);
  }

  @Get("link-summary")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async linkSummary(@Req() req: Request, @Query("siteId") _s?: string) {
    const siteId = await this.siteFromReq(req);
    return this.service.getLinkSummary(siteId);
  }
}
