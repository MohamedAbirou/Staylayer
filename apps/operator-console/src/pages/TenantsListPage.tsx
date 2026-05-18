import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Building2, Search } from "lucide-react";
import {
  fetchTenants,
  type FetchTenantsParams,
  type TenantStatus,
} from "../api/operator";
import { Pagination } from "../components/Pagination";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { DataFreshness } from "../components/DataFreshness";
import { StatusBadge, tenantStatusTone } from "../components/StatusBadge";

const STATUS_FILTERS: Array<{ label: string; value: TenantStatus | "" }> = [
  { label: "All", value: "" },
  { label: "Active", value: "ACTIVE" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Archived", value: "ARCHIVED" },
];

const PAGE_SIZE = 20;

/**
 * Operator tenants list. Read-only in Phase 4 — selecting a row routes the
 * operator to the Tenant 360 page. The search input maps directly to the
 * backend `q` parameter (case-insensitive contains across name/slug, with
 * cuid-aware exact id fallback handled server-side).
 */
export default function TenantsListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TenantStatus | "">("");
  const [search, setSearch] = useState("");

  const params: FetchTenantsParams = {
    page,
    limit: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(search.trim().length >= 2 ? { q: search.trim() } : {}),
  };

  const query = useQuery({
    queryKey: ["operator-tenants", params],
    queryFn: () => fetchTenants(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const rows = query.data?.data ?? [];

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">Tenants</h1>
            <p className="text-xs text-slate-400">
              All workspaces across the platform.
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={new Date().toISOString()} />
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium",
                status === opt.value
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-200"
                  : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800",
              ].join(" ")}
              onClick={() => {
                setStatus(opt.value);
                setPage(1);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="ml-auto relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name, slug or id…"
            className="w-72 rounded-md border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-left text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Tenant</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Sites</th>
              <th className="px-4 py-3 font-semibold">Members</th>
              <th className="px-4 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {query.isLoading && rows.length === 0
              ? Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/tenants/${row.id}`}
                        className="block font-medium text-slate-100 hover:text-white"
                      >
                        {row.name}
                      </Link>
                      <p className="text-[11px] text-slate-500">{row.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={row.status}
                        tone={tenantStatusTone(row.status)}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {row.planKey ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {row.siteCount}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {row.memberCount}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!query.isLoading && rows.length === 0 ? (
          <EmptyState
            title="No tenants match"
            description="Try clearing filters or relaxing the search term."
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
