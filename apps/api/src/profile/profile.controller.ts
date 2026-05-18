import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AdminService } from "../admin/admin.service";
import { AuthService } from "../auth/auth.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { LeaveWorkspaceDto } from "./dto/leave-workspace.dto";
import { ProfileService } from "./profile.service";

@Controller("me")
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async overview(@Req() req: Request) {
    const user = req.user as AuthenticatedRequestUser;
    return this.profileService.getOverview(user.sub);
  }

  @Post("workspaces")
  @HttpCode(HttpStatus.CREATED)
  async createWorkspace(@Body() dto: CreateWorkspaceDto, @Req() req: Request) {
    const user = req.user as AuthenticatedRequestUser;
    const workspace = await this.profileService.createWorkspace(user.sub, dto);

    await this.adminService.createAuditLogForTenant({
      tenantId: workspace.tenantId,
      actorUserId: user.sub,
      action: "tenant.created",
      targetType: "tenant",
      targetId: workspace.tenantId,
      metadata: {
        tenantName: workspace.tenantName,
        tenantSlug: workspace.tenantSlug,
        source: "dashboard_workspace_create",
      },
    });

    return workspace;
  }

  @Post("password")
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request) {
    const user = req.user as AuthenticatedRequestUser;
    return this.profileService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Put("memberships/:tenantId/default")
  @HttpCode(HttpStatus.OK)
  async setDefaultMembership(
    @Param("tenantId") tenantId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedRequestUser;
    return this.profileService.setDefaultMembership(user.sub, tenantId);
  }

  @Post("memberships/:tenantId/leave")
  @HttpCode(HttpStatus.OK)
  async leaveWorkspace(
    @Param("tenantId") tenantId: string,
    @Body() dto: LeaveWorkspaceDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedRequestUser;
    return this.profileService.leaveWorkspace(
      user.sub,
      tenantId,
      dto.confirmTenantSlug,
      async (params) => {
        await this.adminService.createAuditLogForTenant({
          tenantId: params.tenantId,
          actorUserId: params.actorUserId,
          action: params.action,
          targetType: params.targetType,
          targetId: params.targetId,
          metadata: params.metadata,
        });
      },
    );
  }

  @Get("account-deletion-impact")
  async getAccountDeletionImpact(@Req() req: Request) {
    const user = req.user as AuthenticatedRequestUser;
    return this.profileService.getAccountDeletionImpact(user.sub);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @Body() dto: DeleteAccountDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user as AuthenticatedRequestUser;
    const result = await this.profileService.deleteAccount(
      user.sub,
      dto.confirmEmail,
      dto.currentPassword,
      async (params) => {
        await this.adminService.createAuditLogForTenant({
          tenantId: params.tenantId,
          actorUserId: params.actorUserId,
          action: params.action,
          targetType: params.targetType,
          targetId: params.targetId,
          metadata: params.metadata,
        });
      },
    );

    res.cookie("refresh_token", "", this.authService.getClearCookieOptions());

    return result;
  }
}
