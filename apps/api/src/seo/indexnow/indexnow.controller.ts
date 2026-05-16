import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import {
  SearchEngineSubmissionStatus,
  SearchEngineSubmissionTarget,
  TenantMembershipRole,
} from "@prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../../auth/guards/workspace-scope.guard";
import { MembershipRoles } from "../../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../../auth/auth.types";

import { IndexNowService } from "./indexnow.service";
import { SubmitIndexNowDto, ToggleIndexNowDto } from "./dto/indexnow.dto";

@Controller("seo/indexnow")
export class IndexNowController {
  constructor(
    private readonly indexNowService: IndexNowService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  private async ensureSiteAccess(req: Request): Promise<string> {
    return this.workspaceAccessService.ensureSiteAccess(
      req as Request & { user: AuthenticatedRequestUser },
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async getOverview(@Req() req: Request, @Query("siteId") _siteId: string) {
    const siteId = await this.ensureSiteAccess(req);
    return this.indexNowService.getOverview(siteId);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async toggle(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Body() body: ToggleIndexNowDto,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    return this.indexNowService.setEnabled(siteId, Boolean(body.enabled));
  }

  @Post("rotate-key")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async rotate(@Req() req: Request, @Query("siteId") _siteId: string) {
    const siteId = await this.ensureSiteAccess(req);
    return this.indexNowService.rotateKey(siteId);
  }

  @Post("submit")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async submit(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Body() body: SubmitIndexNowDto,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    const user = (req as Request & { user?: AuthenticatedRequestUser }).user;
    return this.indexNowService.submitManual({
      siteId,
      urls: body.urls,
      actor: user?.sub ?? user?.email ?? null,
    });
  }

  @Get("submissions")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async listSubmissions(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Query("target") target?: string,
    @Query("status") status?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    return this.indexNowService.listSubmissions(siteId, {
      target: parseEnum(target, SearchEngineSubmissionTarget),
      status: parseEnum(status, SearchEngineSubmissionStatus),
      cursor: cursor || undefined,
      limit: limit ? Number.parseInt(limit, 10) || undefined : undefined,
    });
  }

  @Post("submissions/:logId/retry")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async retrySubmission(
    @Req() req: Request,
    @Query("siteId") _siteId: string,
    @Param("logId") logId: string,
  ) {
    const siteId = await this.ensureSiteAccess(req);
    const user = (req as Request & { user?: AuthenticatedRequestUser }).user;
    return this.indexNowService.retrySubmission(
      siteId,
      logId,
      user?.sub ?? user?.email ?? null,
    );
  }
}

function parseEnum<T extends Record<string, string>>(
  value: string | undefined,
  enumObj: T,
): T[keyof T] | undefined {
  if (!value) return undefined;
  return (Object.values(enumObj) as string[]).includes(value)
    ? (value as T[keyof T])
    : undefined;
}
