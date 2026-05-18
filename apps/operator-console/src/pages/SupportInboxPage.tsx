import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Inbox,
  LifeBuoy,
  Plus,
  Search,
  Tag,
  UserCircle2,
} from "lucide-react";
import {
  fetchSupportCases,
  fetchSupportQueueSummary,
  type FetchSupportCasesParams,
  type SupportCaseCategory,
  type SupportCasePriority,
  type SupportCaseStatus,
} from "../api/operator";
import { DataFreshness } from "../components/DataFreshness";
import { EmptyState } from "../components/EmptyState";
import { Pagination } from "../components/Pagination";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import {
  OPERATOR_PERMISSIONS,
  PermissionButton,
  usePermissions,
} from "../permissions";
import { useOperatorAuth } from "../auth/useOperatorAuth";
import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_CATEGORY_VALUES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_PRIORITY_VALUES,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_VALUES,
  formatRelativeTime,
  formatSlaDeadline,
  supportPriorityTone,
  supportStatusTone,
} from "../lib/support";

const PAGE_SIZE = 25;

/**
 * Support inbox queue. Lists every support case the current operator is
 * allowed to see (PLATFORM_OWNER / SUPPORT_ADMIN see all, FINANCE_ADMIN
 * sees only billing-scoped cases per backend scope clamp).
 *
 * Filters mirror `apps/api/src/support-cases/dto/list.dto.ts` exactly:
 * repeated `status`, `priority`, `category`, `unassigned` toggle,
 * `slaBreached` toggle, free-text `q`, and an optional `tenantId` /
 * `siteId` filter (the latter two arrive via URL params so we can link
 * here from Tenant 360 / Site detail pages).
 */
export default function SupportInboxPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { session } = useOperatorAuth();
  const permissions = usePermissions();

  const status = params.getAll("status") as SupportCaseStatus[];
  const priority = params.getAll("priority") as SupportCasePriority[];
  const category = params.getAll("category") as SupportCaseCategory[];
  const unassigned = params.get("unassigned") === "1";
  const slaBreached = params.get("slaBreached") === "1";
  const mineOnly = params.get("mine") === "1";
  const q = params.get("q") ?? "";
  const tenantId = params.get("tenantId") ?? undefined;
  const siteId = params.get("siteId") ?? undefined;
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);

  const apiParams: FetchSupportCasesParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(status.length ? { status } : {}),
      ...(priority.length ? { priority } : {}),
      ...(category.length ? { category } : {}),
      ...(unassigned ? { unassigned: true } : {}),
      ...(slaBreached ? { slaBreached: true } : {}),
      ...(tenantId ? { tenantId } : {}),
      ...(siteId ? { siteId } : {}),
      ...(q.trim().length >= 2 ? { q: q.trim() } : {}),
      ...(mineOnly && session?.user.id
        ? { assignedOperatorId: session.user.id }
        : {}),
    }),
    [
      page,
      status,
      priority,
      category,
      unassigned,
      slaBreached,
      tenantId,
      siteId,
      q,
      mineOnly,
      session?.user.id,
    ],
  );

  const listQuery = useQuery({
    queryKey: ["operator-support-cases", apiParams],
    queryFn: () => fetchSupportCases(apiParams),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const summaryQuery = useQuery({
    queryKey: ["operator-support-summary"],
    queryFn: () => fetchSupportQueueSummary(),
    staleTime: 30_000,
  });

  const rows = listQuery.data?.data ?? [];

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    next.delete("page");
    setParams(next, { replace: true });
  };

  const toggleArrayParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    const existing = next.getAll(key);
    next.delete(key);
    if (existing.includes(value)) {
      existing.filter((v) => v !== value).forEach((v) => next.append(key, v));
    } else {
      [...existing, value].forEach((v) => next.append(key, v));
    }
    next.delete("page");
    setParams(next, { replace: true });
  };

  const handlePageChange = (next: number) => {
    const sp = new URLSearchParams(params);
    if (next <= 1) sp.delete("page");
    else sp.set("page", String(next));
    setParams(sp, { replace: true });
  };

  const canCreate = permissions.can(
    OPERATOR_PERMISSIONS.SUPPORT_CASE_CREATE_ALL,
  );

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LifeBuoy className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">Support inbox</h1>
            <p className="text-xs text-slate-400">
              Operator-facing queue across every tenant you can access.
              {summaryQuery.data?.scope === "billing"
                ? " Showing billing-scoped cases only."
                : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DataFreshness generatedAt={new Date().toISOString()} />
          <PermissionButton
            permission={OPERATOR_PERMISSIONS.SUPPORT_CASE_CREATE_ALL}
            onClick={() => navigate("/support/new")}
            className="inline-flex items-center gap-2 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500"
          >
            <Plus className="h-3.5 w-3.5" />
            {canCreate ? "New case" : "New case"}
          </PermissionButton>
        </div>
      </header>

      <SummaryStrip
        loading={summaryQuery.isLoading}
        data={summaryQuery.data}
        mineActive={mineOnly}
        unassignedActive={unassigned}
        slaActive={slaBreached}
        onToggleMine={() => updateParam("mine", mineOnly ? null : "1")}
        onToggleUnassigned={() =>
          updateParam("unassigned", unassigned ? null : "1")
        }
        onToggleSla={() => updateParam("slaBreached", slaBreached ? null : "1")}
      />

      <section className="mt-6 space-y-3">
        <FilterRow label="Status">
          {SUPPORT_STATUS_VALUES.map((value) => (
            <FilterChip
              key={value}
              active={status.includes(value)}
              onClick={() => toggleArrayParam("status", value)}
            >
              {SUPPORT_STATUS_LABELS[value]}
            </FilterChip>
          ))}
        </FilterRow>
        <FilterRow label="Priority">
          {SUPPORT_PRIORITY_VALUES.map((value) => (
            <FilterChip
              key={value}
              active={priority.includes(value)}
              onClick={() => toggleArrayParam("priority", value)}
            >
              {SUPPORT_PRIORITY_LABELS[value]}
            </FilterChip>
          ))}
        </FilterRow>
        <FilterRow label="Category">
          {SUPPORT_CATEGORY_VALUES.map((value) => (
            <FilterChip
              key={value}
              active={category.includes(value)}
              onClick={() => toggleArrayParam("category", value)}
            >
              {SUPPORT_CATEGORY_LABELS[value]}
            </FilterChip>
          ))}
        </FilterRow>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              defaultValue={q}
              onBlur={(event) => updateParam("q", event.target.value.trim())}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  updateParam(
                    "q",
                    (event.target as HTMLInputElement).value.trim(),
                  );
                }
              }}
              placeholder="Search subject, requester, tags…"
              className="w-80 rounded-md border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          {tenantId ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
              <Building2 className="h-3 w-3" /> Tenant filter
              <button
                type="button"
                className="ml-1 text-slate-500 hover:text-slate-200"
                onClick={() => updateParam("tenantId", null)}
              >
                ×
              </button>
            </span>
          ) : null}
          {siteId ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
              <Tag className="h-3 w-3" /> Site filter
              <button
                type="button"
                className="ml-1 text-slate-500 hover:text-slate-200"
                onClick={() => updateParam("siteId", null)}
              >
                ×
              </button>
            </span>
          ) : null}
          {status.length ||
          priority.length ||
          category.length ||
          unassigned ||
          slaBreached ||
          mineOnly ||
          q ||
          tenantId ||
          siteId ? (
            <button
              type="button"
              className="ml-auto text-xs text-slate-400 hover:text-slate-200"
              onClick={() =>
                setParams(new URLSearchParams(), { replace: true })
              }
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      </section>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-left text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Case</th>
              <th className="px-4 py-3 font-semibold">Tenant / site</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Priority</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Assignee</th>
              <th className="px-4 py-3 font-semibold">SLA</th>
              <th className="px-4 py-3 font-semibold">Last activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {listQuery.isLoading && rows.length === 0
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3" colSpan={8}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => {
                  const sla = formatSlaDeadline(
                    row.resolutionDueAt ?? row.firstResponseDueAt,
                  );
                  const slaBreachedRow =
                    row.slaBreachedResolution || row.slaBreachedFirstResponse;
                  return (
                    <tr
                      key={row.id}
                      className="cursor-pointer hover:bg-slate-800/40"
                      onClick={() => navigate(`/support/${row.id}`)}
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/support/${row.id}`}
                          className="block font-medium text-slate-100 hover:text-white"
                          onClick={(event) => event.stopPropagation()}
                        >
                          #{row.number} · {row.subject}
                        </Link>
                        {row.tags.length > 0 ? (
                          <p className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
                            {row.tags.slice(0, 4).map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-slate-800 px-1.5 py-0.5"
                              >
                                #{tag}
                              </span>
                            ))}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <Link
                          to={`/tenants/${row.tenantId}`}
                          onClick={(event) => event.stopPropagation()}
                          className="block hover:text-cyan-300"
                        >
                          {row.tenant.name}
                        </Link>
                        <p className="text-[11px] text-slate-500">
                          {row.site ? (
                            row.site.name
                          ) : (
                            <span className="italic">workspace-wide</span>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={SUPPORT_STATUS_LABELS[row.status]}
                          tone={supportStatusTone(row.status)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={SUPPORT_PRIORITY_LABELS[row.priority]}
                          tone={supportPriorityTone(row.priority)}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {SUPPORT_CATEGORY_LABELS[row.category]}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {row.assignedOperator ? (
                          <span className="inline-flex items-center gap-1.5">
                            <UserCircle2 className="h-3.5 w-3.5 text-slate-500" />
                            <span className="truncate">
                              {row.assignedOperator.email}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-500">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {slaBreachedRow ? (
                          <StatusBadge
                            status={
                              <span className="inline-flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Breached
                              </span>
                            }
                            tone="danger"
                          />
                        ) : (
                          <StatusBadge status={sla.label} tone={sla.tone} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        {formatRelativeTime(row.lastActivityAt)}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {!listQuery.isLoading && rows.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="No cases match"
            description="Try clearing filters or broadening the search."
          />
        ) : null}
      </div>

      <Pagination
        page={listQuery.data?.page ?? page}
        limit={listQuery.data?.limit ?? PAGE_SIZE}
        total={listQuery.data?.total ?? 0}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

function SummaryStrip({
  loading,
  data,
  mineActive,
  unassignedActive,
  slaActive,
  onToggleMine,
  onToggleUnassigned,
  onToggleSla,
}: {
  loading: boolean;
  data: import("../api/operator").SupportCaseQueueSummary | undefined;
  mineActive: boolean;
  unassignedActive: boolean;
  slaActive: boolean;
  onToggleMine: () => void;
  onToggleUnassigned: () => void;
  onToggleSla: () => void;
}) {
  if (loading && !data) {
    return (
      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-20 w-full" />
        ))}
      </section>
    );
  }
  if (!data) return null;
  const totalBreached =
    data.slaBreachedFirstResponse + data.slaBreachedResolution;
  return (
    <section className="mt-6 grid gap-3 sm:grid-cols-4">
      <StatTile label="Total cases" value={data.total} />
      <StatTile
        label="Assigned to me"
        value={data.assignedToMe}
        active={mineActive}
        onClick={onToggleMine}
      />
      <StatTile
        label="Unassigned"
        value={data.unassigned}
        active={unassignedActive}
        onClick={onToggleUnassigned}
      />
      <StatTile
        label="SLA breached"
        value={totalBreached}
        tone={totalBreached > 0 ? "danger" : "muted"}
        active={slaActive}
        onClick={onToggleSla}
      />
    </section>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
  active,
  onClick,
}: {
  label: string;
  value: number | string;
  tone?: "default" | "danger" | "muted";
  active?: boolean;
  onClick?: () => void;
}) {
  const base =
    "rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500";
  const palette = active
    ? "border-cyan-500/60 bg-cyan-500/10"
    : tone === "danger"
      ? "border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10"
      : "border-slate-800 bg-slate-900 hover:bg-slate-800/60";
  const Inner = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p
        className={[
          "mt-2 text-2xl font-semibold",
          tone === "danger" ? "text-rose-300" : "text-white",
        ].join(" ")}
      >
        {value}
      </p>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={[base, palette].join(" ")}
    >
      {Inner}
    </button>
  ) : (
    <div className={[base, palette].join(" ")}>{Inner}</div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-cyan-500 bg-cyan-500/10 text-cyan-200"
          : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
