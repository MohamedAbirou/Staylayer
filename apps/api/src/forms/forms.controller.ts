import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { TenantMembershipRole } from "@prisma/client";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../auth/guards/workspace-scope.guard";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { AdminService } from "../admin/admin.service";
import { FormsService } from "./forms.service";
import { SiteSubmissionsQueryDto } from "./dto/submission-query.dto";
import { UpdateSubmissionStatusDto } from "./dto/update-submission-status.dto";

@Controller("submissions")
@UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
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

  @Get()
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
    TenantMembershipRole.BILLING,
  )
  async list(@Query() query: SiteSubmissionsQueryDto, @Req() req: Request) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.formsService.listForSite(siteId, {
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
  }

  @Patch(":id/status")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateSubmissionStatusDto,
    @Query() _query: SiteSubmissionsQueryDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const updated = await this.formsService.updateStatus(
      siteId,
      id,
      dto.status,
    );
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "submission.status_updated",
      targetType: "form_submission",
      targetId: updated.id,
      metadata: {
        status: updated.status,
        formType: updated.formType,
        pageSlug: updated.pageSlug,
      },
    });

    return updated;
  }
}
