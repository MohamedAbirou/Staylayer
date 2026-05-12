import { Injectable } from "@nestjs/common";
import {
  NotificationCategory,
  NotificationChannel,
  Prisma,
  TenantMembershipRole,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface CreateNotificationInput {
  tenantId: string;
  userId?: string | null;
  siteId?: string | null;
  category: NotificationCategory;
  channel?: NotificationChannel;
  title: string;
  body: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface NotificationDto {
  id: string;
  tenantId: string;
  userId: string | null;
  siteId: string | null;
  category: NotificationCategory;
  channel: NotificationChannel;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface NotificationPreferenceDto {
  id: string;
  userId: string;
  tenantId: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface CreateRoleNotificationInput extends Omit<
  CreateNotificationInput,
  "userId"
> {
  roles: TenantMembershipRole[];
  excludeUserIds?: string[];
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput): Promise<NotificationDto> {
    const notification = await this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        siteId: input.siteId ?? null,
        category: input.category,
        channel: input.channel ?? NotificationChannel.IN_APP,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl ?? null,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });

    return this.toDto(notification);
  }

  async createForUsers(
    input: Omit<CreateNotificationInput, "userId"> & { userIds: string[] },
  ): Promise<NotificationDto[]> {
    const channel = input.channel ?? NotificationChannel.IN_APP;
    const uniqueUserIds = Array.from(
      new Set(input.userIds.map((userId) => userId.trim()).filter(Boolean)),
    );

    if (uniqueUserIds.length === 0) {
      return [];
    }

    const enabledUserIds = await this.resolveEnabledUserIds(
      input.tenantId,
      uniqueUserIds,
      input.category,
      channel,
    );

    if (enabledUserIds.length === 0) {
      return [];
    }

    return Promise.all(
      enabledUserIds.map((userId) =>
        this.create({
          ...input,
          userId,
          channel,
        }),
      ),
    );
  }

  async createForTenantRoles(
    input: CreateRoleNotificationInput,
  ): Promise<NotificationDto[]> {
    const excludedUserIds = new Set(
      input.excludeUserIds?.filter(Boolean) ?? [],
    );
    const memberships = await this.prisma.tenantMembership.findMany({
      where: {
        tenantId: input.tenantId,
        role: { in: input.roles },
      },
      select: {
        userId: true,
      },
    });

    const userIds = memberships
      .map((membership) => membership.userId)
      .filter((userId) => !excludedUserIds.has(userId));

    return this.createForUsers({
      ...input,
      userIds,
    });
  }

  async listForUser(
    tenantId: string,
    userId: string,
    params: { unreadOnly?: boolean; limit?: number; cursor?: string },
  ): Promise<{ data: NotificationDto[]; hasMore: boolean }> {
    const limit = Math.min(params.limit ?? 20, 50);
    const rows = await this.prisma.notification.findMany({
      where: {
        tenantId,
        OR: [{ userId }, { userId: null }],
        ...(params.unreadOnly ? { readAt: null } : {}),
        ...(params.cursor
          ? { createdAt: { lt: new Date(params.cursor) } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map((r) => this.toDto(r));

    return { data, hasMore };
  }

  async getUnreadCount(tenantId: string, userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        tenantId,
        OR: [{ userId }, { userId: null }],
        readAt: null,
      },
    });
  }

  async markRead(
    tenantId: string,
    userId: string,
    notificationId: string,
  ): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        tenantId,
        OR: [{ userId }, { userId: null }],
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(tenantId: string, userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        tenantId,
        OR: [{ userId }, { userId: null }],
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return result.count;
  }

  async getPreferences(
    tenantId: string,
    userId: string,
  ): Promise<NotificationPreferenceDto[]> {
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { tenantId, userId },
    });

    return prefs.map((p) => ({
      id: p.id,
      userId: p.userId,
      tenantId: p.tenantId,
      category: p.category,
      channel: p.channel,
      enabled: p.enabled,
    }));
  }

  async upsertPreference(
    tenantId: string,
    userId: string,
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean,
  ): Promise<NotificationPreferenceDto> {
    const pref = await this.prisma.notificationPreference.upsert({
      where: {
        userId_tenantId_category_channel: {
          userId,
          tenantId,
          category,
          channel,
        },
      },
      create: { userId, tenantId, category, channel, enabled },
      update: { enabled },
    });

    return {
      id: pref.id,
      userId: pref.userId,
      tenantId: pref.tenantId,
      category: pref.category,
      channel: pref.channel,
      enabled: pref.enabled,
    };
  }

  async isEnabled(
    tenantId: string,
    userId: string,
    category: NotificationCategory,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_tenantId_category_channel: {
          userId,
          tenantId,
          category,
          channel,
        },
      },
      select: { enabled: true },
    });

    return pref?.enabled ?? true;
  }

  private async resolveEnabledUserIds(
    tenantId: string,
    userIds: string[],
    category: NotificationCategory,
    channel: NotificationChannel,
  ): Promise<string[]> {
    const preferences = await this.prisma.notificationPreference.findMany({
      where: {
        tenantId,
        userId: { in: userIds },
        category,
        channel,
      },
      select: {
        userId: true,
        enabled: true,
      },
    });

    const disabledUserIds = new Set(
      preferences
        .filter((preference) => !preference.enabled)
        .map((preference) => preference.userId),
    );

    return userIds.filter((userId) => !disabledUserIds.has(userId));
  }

  private toDto(notification: {
    id: string;
    tenantId: string;
    userId: string | null;
    siteId: string | null;
    category: NotificationCategory;
    channel: NotificationChannel;
    title: string;
    body: string;
    actionUrl: string | null;
    readAt: Date | null;
    metadata: unknown;
    createdAt: Date;
  }): NotificationDto {
    return {
      id: notification.id,
      tenantId: notification.tenantId,
      userId: notification.userId,
      siteId: notification.siteId,
      category: notification.category,
      channel: notification.channel,
      title: notification.title,
      body: notification.body,
      actionUrl: notification.actionUrl,
      readAt: notification.readAt?.toISOString() ?? null,
      metadata: notification.metadata,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
