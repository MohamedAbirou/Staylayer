import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import {
  NotificationCategory,
  NotificationChannel,
  TenantMembershipRole,
} from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import { NotificationsService } from "./notifications.service";

type ScopedRequest = Request & {
  user?: AuthenticatedRequestUser;
  query: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
};

@Controller("tenants/:tenantId/notifications")
@UseGuards(JwtAuthGuard, RolesGuard)
@MembershipRoles(
  TenantMembershipRole.OWNER,
  TenantMembershipRole.ADMIN,
  TenantMembershipRole.EDITOR,
  TenantMembershipRole.BILLING,
)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  @Get()
  async list(
    @Param("tenantId") tenantId: string,
    @Query("unreadOnly") unreadOnly: string | undefined,
    @Query("limit") limit: string | undefined,
    @Query("cursor") cursor: string | undefined,
    @Req() req: Request,
  ) {
    const resolved = await this.workspaceAccess.ensureTenantAccess(
      req as ScopedRequest,
      tenantId,
    );
    const userId = (req as ScopedRequest).user?.sub;
    if (!userId) return { data: [], hasMore: false };

    return this.notificationsService.listForUser(resolved, userId, {
      unreadOnly: unreadOnly === "true",
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor: cursor || undefined,
    });
  }

  @Get("unread-count")
  async unreadCount(
    @Param("tenantId") tenantId: string,
    @Req() req: Request,
  ) {
    const resolved = await this.workspaceAccess.ensureTenantAccess(
      req as ScopedRequest,
      tenantId,
    );
    const userId = (req as ScopedRequest).user?.sub;
    if (!userId) return { count: 0 };

    const count = await this.notificationsService.getUnreadCount(
      resolved,
      userId,
    );
    return { count };
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    const resolved = await this.workspaceAccess.ensureTenantAccess(
      req as ScopedRequest,
      tenantId,
    );
    const userId = (req as ScopedRequest).user?.sub;
    if (!userId) return;

    await this.notificationsService.markRead(resolved, userId, id);
  }

  @Post("mark-all-read")
  @HttpCode(HttpStatus.OK)
  async markAllRead(
    @Param("tenantId") tenantId: string,
    @Req() req: Request,
  ) {
    const resolved = await this.workspaceAccess.ensureTenantAccess(
      req as ScopedRequest,
      tenantId,
    );
    const userId = (req as ScopedRequest).user?.sub;
    if (!userId) return { count: 0 };

    const count = await this.notificationsService.markAllRead(resolved, userId);
    return { count };
  }

  @Get("preferences")
  async getPreferences(
    @Param("tenantId") tenantId: string,
    @Req() req: Request,
  ) {
    const resolved = await this.workspaceAccess.ensureTenantAccess(
      req as ScopedRequest,
      tenantId,
    );
    const userId = (req as ScopedRequest).user?.sub;
    if (!userId) return [];

    return this.notificationsService.getPreferences(resolved, userId);
  }

  @Post("preferences")
  @HttpCode(HttpStatus.OK)
  async upsertPreference(
    @Param("tenantId") tenantId: string,
    @Body()
    body: {
      category: NotificationCategory;
      channel: NotificationChannel;
      enabled: boolean;
    },
    @Req() req: Request,
  ) {
    const resolved = await this.workspaceAccess.ensureTenantAccess(
      req as ScopedRequest,
      tenantId,
    );
    const userId = (req as ScopedRequest).user?.sub;
    if (!userId) return null;

    return this.notificationsService.upsertPreference(
      resolved,
      userId,
      body.category,
      body.channel,
      body.enabled,
    );
  }
}
