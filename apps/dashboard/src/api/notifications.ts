import client from "./client";

export type NotificationCategory =
  | "DEPLOYMENT"
  | "DOMAIN"
  | "BILLING"
  | "FORM_SUBMISSION"
  | "SYSTEM";

export type NotificationChannel = "IN_APP" | "EMAIL";

export interface Notification {
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

export interface NotificationPreference {
  id: string;
  userId: string;
  tenantId: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
}

export async function getNotifications(
  tenantId: string,
  params?: { unreadOnly?: boolean; limit?: number; cursor?: string },
): Promise<{ data: Notification[]; hasMore: boolean }> {
  const { data } = await client.get<{ data: Notification[]; hasMore: boolean }>(
    `/tenants/${tenantId}/notifications`,
    {
      params: {
        ...(params?.unreadOnly ? { unreadOnly: "true" } : {}),
        ...(params?.limit ? { limit: params.limit } : {}),
        ...(params?.cursor ? { cursor: params.cursor } : {}),
      },
    },
  );
  return data;
}

export async function getUnreadCount(
  tenantId: string,
): Promise<{ count: number }> {
  const { data } = await client.get<{ count: number }>(
    `/tenants/${tenantId}/notifications/unread-count`,
  );
  return data;
}

export async function markNotificationRead(
  tenantId: string,
  notificationId: string,
): Promise<void> {
  await client.patch(
    `/tenants/${tenantId}/notifications/${notificationId}/read`,
  );
}

export async function markAllNotificationsRead(
  tenantId: string,
): Promise<{ count: number }> {
  const { data } = await client.post<{ count: number }>(
    `/tenants/${tenantId}/notifications/mark-all-read`,
  );
  return data;
}

export async function getNotificationPreferences(
  tenantId: string,
): Promise<NotificationPreference[]> {
  const { data } = await client.get<NotificationPreference[]>(
    `/tenants/${tenantId}/notifications/preferences`,
  );
  return data;
}

export async function upsertNotificationPreference(
  tenantId: string,
  preference: {
    category: NotificationCategory;
    channel: NotificationChannel;
    enabled: boolean;
  },
): Promise<NotificationPreference> {
  const { data } = await client.post<NotificationPreference>(
    `/tenants/${tenantId}/notifications/preferences`,
    preference,
  );
  return data;
}
