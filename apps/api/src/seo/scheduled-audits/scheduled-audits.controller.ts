import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { SeoAuditScheduleCadence, TenantMembershipRole } from "@prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../../auth/guards/workspace-scope.guard";
import { MembershipRoles } from "../../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../../auth/auth.types";

import { SeoAuditRunnerService } from "./scheduled-audits-runner.service";
import { SeoAuditScheduleService } from "./scheduled-audits-schedule.service";
import { SeoAuditQueryService } from "./scheduled-audits-query.service";

interface UpdateScheduleBody {
  cadence?: SeoAuditScheduleCadence;
  enabled?: boolean;
  hourUtc?: number;
  dayOfWeek?: number | null;
}

@Controller("seo/audit")
export class ScheduledAuditsController {
  constructor(
    private readonly scheduleService: SeoAuditScheduleService,
    private readonly runner: SeoAuditRunnerService,
    private readonly query: SeoAuditQueryService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  private async ensureSiteAccess(req: Request): Promise<string> {
    return this.workspaceAccessService.ensureSiteAccess(
      req as Request & { user: AuthenticatedRequestUser },
    );
  }

  // ── Schedule ─────────────────────────────────────────────────────────

  @Get("schedule")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async getSchedule(@Req() req: Request, @Query("siteId") _siteId: string) {
    const siteId = await this.ensureSiteAccess(req);
    return this.scheduleService.getOrCreate(siteId);
  }

  @Put("schedule")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async updateSchedule(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Body() body: UpdateScheduleBody,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    if (
      body.cadence !== undefined &&
      !["OFF", "DAILY", "WEEKLY"].includes(body.cadence)
    ) {
      throw new BadRequestException("cadence must be OFF, DAILY, or WEEKLY");
    }
    return this.scheduleService.update(siteId, body);
  }

  // ── Runs ─────────────────────────────────────────────────────────────

  @Get("runs")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listRuns(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Query("limit") limit?: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 20;
    return this.query.listRuns(siteId, parsedLimit);
  }

  @Post("runs")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerRun(@Req() req: Request, @Query("siteId") _siteId: string) {
    const siteId = await this.ensureSiteAccess(req);
    const user = (req as Request & { user: AuthenticatedRequestUser }).user;
    return this.runner.runAudit(siteId, {
      kind: "MANUAL",
      triggeredBy: user?.sub ? `user:${user.sub}` : "manual",
    });
  }

  @Get("runs/:runId")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async getRun(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("runId") runId: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    return this.query.getRun(siteId, runId);
  }

  // ── History (per-page score series) ──────────────────────────────────

  @Get("history")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async history(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Query("slug") slug: string,
    @Query("locale") locale: string,
    @Query("limit") limit?: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    if (!slug) throw new BadRequestException("slug is required");
    if (!locale) throw new BadRequestException("locale is required");
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 30;
    return this.query.getHistory(siteId, slug, locale, parsedLimit);
  }

  // ── Alerts ───────────────────────────────────────────────────────────

  @Get("alerts")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listAlerts(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Query("status") status?: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    const normalised = (status ?? "OPEN").toUpperCase();
    if (!["OPEN", "RESOLVED", "ALL"].includes(normalised)) {
      throw new BadRequestException("status must be OPEN, RESOLVED, or ALL");
    }
    return this.query.listAlerts(
      siteId,
      normalised as "OPEN" | "RESOLVED" | "ALL",
    );
  }

  @Patch("alerts/:alertId/dismiss")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async dismissAlert(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("alertId") alertId: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    return this.query.dismissAlert(siteId, alertId);
  }
}
