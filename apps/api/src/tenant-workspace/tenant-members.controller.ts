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
import { CreateTenantMemberDto } from "./dto/create-tenant-member.dto";
import { InviteTenantMemberDto } from "./dto/invite-tenant-member.dto";
import { UpdateTenantMemberRoleDto } from "./dto/update-tenant-member-role.dto";
import { TenantWorkspaceService } from "./tenant-workspace.service";

@Controller("tenants/:tenantId/members")
@UseGuards(JwtAuthGuard, RolesGuard)
@MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
export class TenantMembersController {
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

    return this.tenantWorkspaceService.listMembers(resolvedTenantId);
  }

  @Get("invitations")
  async listPendingInvitations(
    @Param("tenantId") tenantId: string,
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

    return this.tenantWorkspaceService.listPendingInvitations(resolvedTenantId);
  }

  @Post("invite")
  @HttpCode(HttpStatus.CREATED)
  async invite(
    @Param("tenantId") tenantId: string,
    @Body() dto: InviteTenantMemberDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedRequestUser | undefined;
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
    const member = await this.tenantWorkspaceService.inviteMember(
      resolvedTenantId,
      dto,
      user?.sub ?? null,
    );

    await this.adminService.createAuditLogForTenant({
      tenantId: resolvedTenantId,
      actorUserId: user?.sub ?? null,
      action: "tenant.member_invited",
      targetType: "workspace_invitation",
      targetId: member.email,
      metadata: {
        email: member.email,
        role: member.role,
        status: member.status,
        expiresAt: member.expiresAt,
      },
    });

    return member;
  }

  @Post("create")
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateTenantMemberDto,
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
    const member = await this.tenantWorkspaceService.createMember(
      resolvedTenantId,
      dto,
    );
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForTenant({
      tenantId: resolvedTenantId,
      actorUserId: user?.sub ?? null,
      action: "tenant.member_created",
      targetType: "tenant_membership",
      targetId: member.id,
      metadata: {
        email: member.email,
        role: member.role,
        userId: member.userId,
      },
    });

    return member;
  }

  @Delete("invitations/:invitationId")
  @HttpCode(HttpStatus.OK)
  async revokeInvitation(
    @Param("tenantId") tenantId: string,
    @Param("invitationId") invitationId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedRequestUser | undefined;
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

    const invitation = await this.tenantWorkspaceService.revokeInvitation(
      resolvedTenantId,
      invitationId,
    );

    await this.adminService.createAuditLogForTenant({
      tenantId: resolvedTenantId,
      actorUserId: user?.sub ?? null,
      action: "tenant.invitation_revoked",
      targetType: "workspace_invitation",
      targetId: invitation.id,
      metadata: {
        email: invitation.email,
        role: invitation.role,
      },
    });

    return invitation;
  }

  @Post("invitations/:invitationId/resend")
  @HttpCode(HttpStatus.OK)
  async resendInvitation(
    @Param("tenantId") tenantId: string,
    @Param("invitationId") invitationId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedRequestUser | undefined;
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

    const invitation = await this.tenantWorkspaceService.resendInvitation(
      resolvedTenantId,
      invitationId,
      user?.sub ?? null,
    );

    await this.adminService.createAuditLogForTenant({
      tenantId: resolvedTenantId,
      actorUserId: user?.sub ?? null,
      action: "tenant.invitation_resent",
      targetType: "workspace_invitation",
      targetId: invitation.id,
      metadata: {
        previousInvitationId: invitationId,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    });

    return invitation;
  }

  @Patch(":membershipId/role")
  @HttpCode(HttpStatus.OK)
  async updateRole(
    @Param("tenantId") tenantId: string,
    @Param("membershipId") membershipId: string,
    @Body() dto: UpdateTenantMemberRoleDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedRequestUser | undefined;
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

    const member = await this.tenantWorkspaceService.updateMemberRole(
      resolvedTenantId,
      membershipId,
      dto.role,
      user?.sub ?? "",
    );

    await this.adminService.createAuditLogForTenant({
      tenantId: resolvedTenantId,
      actorUserId: user?.sub ?? null,
      action: "tenant.member_role_updated",
      targetType: "tenant_membership",
      targetId: member.id,
      metadata: {
        email: member.email,
        role: member.role,
        userId: member.userId,
      },
    });

    return member;
  }

  @Delete(":membershipId")
  @MembershipRoles(TenantMembershipRole.OWNER)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param("tenantId") tenantId: string,
    @Param("membershipId") membershipId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedRequestUser | undefined;
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
    const member = await this.tenantWorkspaceService.removeMember(
      resolvedTenantId,
      membershipId,
      user?.sub ?? "",
    );

    await this.adminService.createAuditLogForTenant({
      tenantId: resolvedTenantId,
      actorUserId: user?.sub ?? null,
      action: "tenant.member_removed",
      targetType: "tenant_membership",
      targetId: member.id,
      metadata: {
        email: member.email,
        role: member.role,
        userId: member.userId,
      },
    });

    return member;
  }
}
