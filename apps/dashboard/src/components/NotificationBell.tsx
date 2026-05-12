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

export function NotificationBell({
  align = "start",
}: {
  align?: "start" | "end";
}) {
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
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    retry: false,
  });

  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ["notifications", "list", tenantId],
    queryFn: () => getNotifications(tenantId!, { limit: 15 }),
    enabled: Boolean(tenantId && open),
    refetchInterval: open ? 10_000 : false,
    refetchIntervalInBackground: true,
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
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute top-full z-50 mt-3 w-[24rem] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.18)] ${align === "end" ? "right-0" : "left-0"}`}
        >
          <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(255,255,255,1),rgba(226,232,240,0.45))] px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Live inbox
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Notifications
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                {unreadCount} unread
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllMutation.mutate()}
                  disabled={markAllMutation.isPending}
                  className="mt-3 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="ml-auto rounded-full p-2 text-slate-400 hover:bg-white hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[28rem] overflow-y-auto bg-white">
            {isLoading ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                  <Bell className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700">
                  No notifications yet
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Workspace activity, billing syncs, and access events will land
                  here automatically.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={`flex w-full items-start gap-3 border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50 ${
                    !n.readAt ? "bg-sky-50/40" : ""
                  }`}
                >
                  <div className="mt-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                          CATEGORY_COLORS[n.category] ?? CATEGORY_COLORS.SYSTEM
                        }`}
                      >
                        {n.category.replace("_", " ")}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>
                    <p
                      className={`mt-2 truncate text-sm ${
                        !n.readAt
                          ? "font-semibold text-slate-900"
                          : "text-slate-700"
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {n.body}
                    </p>
                  </div>
                  {!n.readAt && (
                    <div className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" />
                  )}
                  {n.readAt && (
                    <Check className="mt-2 h-3.5 w-3.5 shrink-0 text-slate-300" />
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
