import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Users,
  Plus,
  Lock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";

import {
  fetchOperatorUsers,
  type OperatorUserListItem,
  type OperatorUsersListParams,
  type PlatformRole,
} from "../api/operator";
import { OPERATOR_PERMISSIONS, usePermissions } from "../permissions";

const PAGE_SIZE = 25;

const ROLE_LABEL: Record<PlatformRole, string> = {
  PLATFORM_OWNER: "Platform Owner",
  SUPPORT_ADMIN: "Support Admin",
  FINANCE_ADMIN: "Finance Admin",
};

const ROLE_TONE: Record<PlatformRole, string> = {
  PLATFORM_OWNER: "border-amber-700 bg-amber-950 text-amber-300",
  SUPPORT_ADMIN: "border-cyan-800 bg-cyan-950 text-cyan-300",
  FINANCE_ADMIN: "border-emerald-800 bg-emerald-950 text-emerald-300",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function OperatorUsersListPage() {
  const { can } = usePermissions();
  const canManage = can(OPERATOR_PERMISSIONS.OPERATOR_USER_MANAGE_ALL);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [roleFilter, setRoleFilter] = useState<PlatformRole | "">("");
  const [lockedOnly, setLockedOnly] = useState(false);

  const params = useMemo<OperatorUsersListParams>(
    () => ({
      page,
      limit: PAGE_SIZE,
      q: search.trim() ? search.trim() : undefined,
      platformRole: roleFilter || undefined,
      lockedOnly: lockedOnly || undefined,
    }),
    [page, search, roleFilter, lockedOnly],
  );

  const query = useQuery({
    queryKey: ["operator-users", params],
    queryFn: () => fetchOperatorUsers(params),
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-cyan-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Operator users</h1>
            <p className="text-xs text-slate-400">
              Operator accounts with a platform role. Customer dashboard users
              are managed separately and never appear here.
            </p>
          </div>
        </div>
        {canManage ? (
          <Link
            to="/operator-users/new"
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-700 bg-cyan-900/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-900/70"
          >
            <Plus className="h-3.5 w-3.5" /> New operator user
          </Link>
        ) : null}
      </header>

      <form
        className="mt-6 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchDraft);
          setPage(1);
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Email contains
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="ops@example.com"
              className="w-72 rounded-md border border-slate-800 bg-slate-950 py-1.5 pl-7 pr-2 text-sm text-slate-100 focus:border-cyan-700 focus:outline-none"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Role
          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as PlatformRole | "");
              setPage(1);
            }}
            className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus:border-cyan-700 focus:outline-none"
          >
            <option value="">All roles</option>
            <option value="PLATFORM_OWNER">Platform Owner</option>
            <option value="SUPPORT_ADMIN">Support Admin</option>
            <option value="FINANCE_ADMIN">Finance Admin</option>
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={lockedOnly}
            onChange={(event) => {
              setLockedOnly(event.target.checked);
              setPage(1);
            }}
            className="accent-cyan-500"
          />
          Locked only
        </label>
        <button
          type="submit"
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-cyan-700"
        >
          Apply
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Active sessions</th>
              <th className="px-4 py-2 text-left">Locked</th>
              <th className="px-4 py-2 text-left">Last activity</th>
              <th className="px-4 py-2 text-left">Created</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {query.isLoading && !data ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  Loading…
                </td>
              </tr>
            ) : null}
            {query.isError ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-rose-400">
                  Failed to load operator users.
                </td>
              </tr>
            ) : null}
            {data && data.data.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  No operator users match the current filters.
                </td>
              </tr>
            ) : null}
            {data?.data.map((row) => (
              <OperatorUserRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      {data ? (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing {(data.page - 1) * data.limit + 1}–
            {Math.min(data.total, data.page * data.limit)} of {data.total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span>
              Page {data.page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OperatorUserRow({ row }: { row: OperatorUserListItem }) {
  return (
    <tr className="hover:bg-slate-900/60">
      <td className="px-4 py-2 font-mono text-xs text-slate-100">
        <Link
          to={`/operator-users/${row.id}`}
          className="text-cyan-300 hover:text-cyan-200"
        >
          {row.email}
        </Link>
      </td>
      <td className="px-4 py-2">
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE_TONE[row.platformRole]}`}
        >
          <ShieldCheck className="h-3 w-3" />
          {ROLE_LABEL[row.platformRole]}
        </span>
      </td>
      <td className="px-4 py-2 text-xs">{row.activeSessions}</td>
      <td className="px-4 py-2 text-xs">
        {row.locked ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-rose-800 bg-rose-950 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-300">
            <Lock className="h-3 w-3" /> until {formatDate(row.lockedUntil)}
          </span>
        ) : (
          <span className="text-slate-500">No</span>
        )}
      </td>
      <td className="px-4 py-2 text-xs">{formatDate(row.lastLoginAt)}</td>
      <td className="px-4 py-2 text-xs">{formatDate(row.createdAt)}</td>
      <td className="px-4 py-2 text-right text-xs">
        <Link
          to={`/operator-users/${row.id}`}
          className="text-cyan-300 hover:text-cyan-200"
        >
          View
        </Link>
      </td>
    </tr>
  );
}
