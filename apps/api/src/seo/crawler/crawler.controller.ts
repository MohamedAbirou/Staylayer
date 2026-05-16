import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { SeoCrawlIssueSeverity, TenantMembershipRole } from "@prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../../auth/guards/workspace-scope.guard";
import { MembershipRoles } from "../../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../../auth/auth.types";

import { CrawlerService } from "./crawler.service";
import { LinkGraphService } from "./link-graph.service";
import { StartCrawlDto } from "./dto/start-crawl.dto";

@Controller("seo/crawler")
export class CrawlerController {
  constructor(
    private readonly crawlerService: CrawlerService,
    private readonly linkGraphService: LinkGraphService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  private async ensureSiteAccess(req: Request): Promise<string> {
    return this.workspaceAccessService.ensureSiteAccess(
      req as Request & { user: AuthenticatedRequestUser },
    );
  }

  @Post("jobs")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async startCrawl(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Body() body: StartCrawlDto,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    const user = (req as Request & { user?: AuthenticatedRequestUser }).user;
    const actor = user?.sub ?? user?.email ?? null;
    return this.crawlerService.startCrawl(
      siteId,
      { urlLimit: body.urlLimit, maxDepth: body.maxDepth },
      actor,
    );
  }

  @Get("jobs")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listJobs(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    return this.crawlerService.listJobs(siteId, { limit });
  }

  @Get("jobs/:jobId")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async getJob(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("jobId") jobId: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    return this.crawlerService.getJob(siteId, jobId);
  }

  @Get("jobs/:jobId/results")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listResults(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("jobId") jobId: string,
    @Query("cursor") cursor?: string,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query("statusCode") statusCode?: string,
    @Query("hasIssues", new DefaultValuePipe(false), ParseBoolPipe)
    hasIssues?: boolean,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    const statusCodeNum =
      statusCode && statusCode.length > 0 ? Number(statusCode) : undefined;
    return this.crawlerService.listResults(siteId, jobId, {
      cursor,
      limit,
      statusCode: statusCodeNum,
      hasIssues,
    });
  }

  @Get("jobs/:jobId/issues")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listIssues(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("jobId") jobId: string,
    @Query("cursor") cursor?: string,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query("severity") severity?: string,
    @Query("code") code?: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    let sev: SeoCrawlIssueSeverity | undefined;
    if (severity === "ERROR" || severity === "WARNING" || severity === "INFO") {
      sev = severity;
    }
    return this.crawlerService.listIssues(siteId, jobId, {
      cursor,
      limit,
      severity: sev,
      code,
    });
  }

  @Post("jobs/:jobId/cancel")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async cancel(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("jobId") jobId: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    return this.crawlerService.cancelCrawl(siteId, jobId);
  }

  @Get("jobs/:jobId/link-graph")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async linkGraph(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("jobId") jobId: string,
    @Query("topN", new DefaultValuePipe(25), ParseIntPipe) topN: number,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    return this.linkGraphService.getJobLinkGraph(siteId, jobId, { topN });
  }

  @Get("jobs/:jobId/results/:resultId/links")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async pageLinks(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("jobId") jobId: string,
    @Param("resultId") resultId: string,
    @Query("limit", new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    return this.linkGraphService.getPageLinks(siteId, jobId, resultId, {
      limit,
    });
  }

  @Get("jobs/:jobId/export.csv")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  @Header("Content-Type", "text/csv; charset=utf-8")
  async exportCsv(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("jobId") jobId: string,
    @Res() res: Response,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    const csv = await this.crawlerService.exportResultsCsv(siteId, jobId);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="seo-crawl-${jobId}.csv"`,
    );
    res.send(csv);
  }
}
