import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from "../api/notifications";
import { formatRelativeTime } from "../lib/formatDate";

const CATEGORY_COLORS: Record<string, string> = {
  DEPLOYMENT: "bg-blue-100 text-blue-700",
  DOMAIN: "bg-emerald-100 text-emerald-700",
  BILLING: "bg-amber-100 text-amber-800",
  FORM_SUBMISSION: "bg-sky-100 text-sky-700",
  SYSTEM: "bg-slate-100 text-slate-700",
};

export function NotificationBell() {
  const { session } = useAuth();
  const tenantId = session?.activeTenant?.id ?? null;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unread-count", tenantId],
    queryFn: () => getUnreadCount(tenantId!),
    enabled: Boolean(tenantId),
    refetchInterval: 30_000,
    retry: false,
  });

  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ["notifications", "list", tenantId],
    queryFn: () => getNotifications(tenantId!, { limit: 15 }),
    enabled: Boolean(tenantId && open),
    retry: false,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(tenantId!, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["notifications", "unread-count", tenantId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["notifications", "list", tenantId],
      });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(tenantId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["notifications", "unread-count", tenantId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["notifications", "list", tenantId],
      });
    },
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const unreadCount = unreadData?.count ?? 0;
  const notifications = notificationsData?.data ?? [];

  function handleNotificationClick(n: Notification) {
    if (!n.readAt) {
      markReadMutation.mutate(n.id);
    }
    if (n.actionUrl) {
      setOpen(false);
      navigate(n.actionUrl);
    }
  }

  if (!tenantId) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100/20 hover:text-white cursor-pointer"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllMutation.mutate()}
                  disabled={markAllMutation.isPending}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto h-6 w-6 text-gray-200" />
                <p className="mt-2 text-sm text-gray-500">
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                    !n.readAt ? "bg-blue-50/30" : ""
                  }`}
                >
                  <div className="mt-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                          CATEGORY_COLORS[n.category] ?? CATEGORY_COLORS.SYSTEM
                        }`}
                      >
                        {n.category.replace("_", " ")}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>
                    <p
                      className={`mt-1 truncate text-sm ${
                        !n.readAt
                          ? "font-semibold text-gray-900"
                          : "text-gray-700"
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {n.body}
                    </p>
                  </div>
                  {!n.readAt && (
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                  {n.readAt && (
                    <Check className="mt-2 h-3.5 w-3.5 shrink-0 text-gray-300" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
