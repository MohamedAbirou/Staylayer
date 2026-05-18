import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bell, ExternalLink } from "lucide-react";
import { listOperatorNotifications } from "../api/operator";
import { Pagination } from "../components/Pagination";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { DataFreshness } from "../components/DataFreshness";
import { formatRelative } from "../lib/operations";

const PAGE_SIZE = 25;

/**
 * Phase 9 — Operations / Notifications.
 *
 * Read-only cross-tenant notification log. Supports filtering by
 * tenant, user, category, and unread-only. No mutations are exposed —
 * marking-as-read is owned by the customer dashboard.
 */
export default function OperationsNotificationsPage() {
  const [tenantId, setTenantId] = useState("");
  const [userId, setUserId] = useState("");
  const [category, setCategory] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(tenantId.trim().length > 0 ? { tenantId: tenantId.trim() } : {}),
      ...(userId.trim().length > 0 ? { userId: userId.trim() } : {}),
      ...(category.trim().length > 0 ? { category: category.trim() } : {}),
      ...(unreadOnly ? { unreadOnly: true } : {}),
    }),
    [page, tenantId, userId, category, unreadOnly],
  );

  const query = useQuery({
    queryKey: ["operator-ops-notifications", params],
    queryFn: () => listOperatorNotifications(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const rows = query.data?.data ?? [];

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">Notifications</h1>
            <p className="text-xs text-slate-400">
              Read-only audit of user-facing notifications across all tenants.
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={query.data?.generatedAt ?? null} />
      </header>

      <div className="mt-6 grid grid-cols-1 gap-2 md:grid-cols-4">
        <input
          type="text"
          value={tenantId}
          onChange={(e) => {
            setTenantId(e.target.value);
            setPage(1);
          }}
          placeholder="Tenant ID"
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
        />
        <input
          type="text"
          value={userId}
          onChange={(e) => {
            setUserId(e.target.value);
            setPage(1);
          }}
          placeholder="User ID"
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
        />
        <input
          type="text"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          placeholder="Category (e.g. BILLING)"
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
        />
        <label className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setUnreadOnly(e.target.checked);
              setPage(1);
            }}
            className="accent-cyan-500"
          />
          Unread only
        </label>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-left text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Channel</th>
              <th className="px-4 py-3 font-semibold">Tenant / user</th>
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">State</th>
              <th className="px-4 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-900/60">
                <td className="px-4 py-3">
                  <StatusBadge status={row.category} tone="info" />
                </td>
                <td className="px-4 py-3 text-xs text-slate-300">
                  {row.channel}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    {row.tenantName ? (
                      <Link
                        to={`/tenants/${row.tenantId}`}
                        className="text-sm text-slate-100 hover:text-cyan-300"
                      >
                        {row.tenantName}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-slate-300">
                        {row.tenantId}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {row.userEmail ?? row.userId ?? "—"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 max-w-md">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0">
                      <div
                        className="truncate text-sm text-slate-100"
                        title={row.title}
                      >
                        {row.title}
                      </div>
                      <div
                        className="truncate text-[10px] text-slate-500"
                        title={row.body}
                      >
                        {row.body}
                      </div>
                    </div>
                    {row.actionUrl ? (
                      <a
                        href={row.actionUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="shrink-0 text-cyan-300 hover:text-cyan-200"
                        title="Open action link"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {row.readAt ? (
                    <StatusBadge status="read" tone="muted" />
                  ) : (
                    <StatusBadge status="unread" tone="warn" />
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  <time title={row.createdAt}>
                    {formatRelative(row.createdAt)}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!query.isLoading && rows.length === 0 ? (
          <EmptyState
            title="No notifications match the filters"
            description="Try clearing filters or removing the unread-only checkbox."
          />
        ) : null}
      </div>

      <Pagination
        page={query.data?.page ?? page}
        limit={query.data?.limit ?? PAGE_SIZE}
        total={query.data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
