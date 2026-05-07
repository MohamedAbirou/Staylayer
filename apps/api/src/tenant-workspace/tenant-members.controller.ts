import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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

  @Post("invite")
  @HttpCode(HttpStatus.CREATED)
  async invite(
    @Param("tenantId") tenantId: string,
    @Body() dto: InviteTenantMemberDto,
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
    const member = await this.tenantWorkspaceService.inviteMember(
      resolvedTenantId,
      dto,
    );
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForTenant({
      tenantId: resolvedTenantId,
      actorUserId: user?.sub ?? null,
      action: "tenant.member_invited",
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
}
