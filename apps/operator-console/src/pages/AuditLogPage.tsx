import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import {
  fetchAudit,
  type AuditScope,
  type FetchAuditParams,
} from "../api/operator";
import { OPERATOR_PERMISSIONS, usePermissions } from "../permissions";
import { DataFreshness } from "../components/DataFreshness";
import { EmptyState } from "../components/EmptyState";
import { Pagination } from "../components/Pagination";
import { Skeleton } from "../components/Skeleton";
import { AuditFeed } from "./_AuditFeed";

const PAGE_SIZE = 50;

/**
 * Audit log v1 page. Builds the scope picker dynamically from the held
 * permissions so SUPPORT_ADMIN/FINANCE_ADMIN never see filters they cannot
 * actually request (the backend will reject any unauthorized scope, but
 * UI gating gives clearer feedback).
 */
export default function AuditLogPage() {
  const permissions = usePermissions();
  const [scope, setScope] = useState<AuditScope | undefined>(undefined);
  const [actionFilter, setActionFilter] = useState("");
  const [tenantIdFilter, setTenantIdFilter] = useState("");
  const [siteIdFilter, setSiteIdFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [page, setPage] = useState(1);

  const params: FetchAuditParams = {
    page,
    limit: PAGE_SIZE,
    ...(scope ? { scope } : {}),
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(tenantIdFilter ? { tenantId: tenantIdFilter } : {}),
    ...(siteIdFilter ? { siteId: siteIdFilter } : {}),
    ...(actorFilter ? { actorUserId: actorFilter } : {}),
  };

  const query = useQuery({
    queryKey: ["operator-audit", params],
    queryFn: () => fetchAudit(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const scopes: Array<{ label: string; value: AuditScope | undefined }> = [];
  if (permissions.can(OPERATOR_PERMISSIONS.AUDIT_READ_ALL)) {
    scopes.push({ label: "All", value: "all" });
  }
  if (
    permissions.can(OPERATOR_PERMISSIONS.AUDIT_READ_ALL) ||
    permissions.can(OPERATOR_PERMISSIONS.AUDIT_READ_SUPPORT)
  ) {
    scopes.push({ label: "Support", value: "support" });
  }
  if (
    permissions.can(OPERATOR_PERMISSIONS.AUDIT_READ_ALL) ||
    permissions.can(OPERATOR_PERMISSIONS.AUDIT_READ_BILLING)
  ) {
    scopes.push({ label: "Billing", value: "billing" });
  }

  if (scopes.length === 0) {
    return (
      <div className="px-8 py-8">
        <EmptyState
          title="No audit access"
          description="Your operator role does not include any audit.read.* permission."
        />
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ScrollText className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">Audit log</h1>
            <p className="text-xs text-slate-400">
              Merged operator + customer audit feed, scoped to your role.
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={query.data?.generatedAt} />
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {scopes.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => {
              setScope(s.value);
              setPage(1);
            }}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium",
              scope === s.value
                ? "border-cyan-500 bg-cyan-500/10 text-cyan-200"
                : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800",
            ].join(" ")}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <FilterInput
          label="Action prefix"
          value={actionFilter}
          onChange={(v) => {
            setActionFilter(v);
            setPage(1);
          }}
        />
        <FilterInput
          label="Tenant id"
          value={tenantIdFilter}
          onChange={(v) => {
            setTenantIdFilter(v);
            setPage(1);
          }}
        />
        <FilterInput
          label="Site id"
          value={siteIdFilter}
          onChange={(v) => {
            setSiteIdFilter(v);
            setPage(1);
          }}
        />
        <FilterInput
          label="Actor user id"
          value={actorFilter}
          onChange={(v) => {
            setActorFilter(v);
            setPage(1);
          }}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        {query.isLoading && !query.data ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : query.isError ? (
          <EmptyState
            title="Failed to load audit log"
            description="The API rejected the request or the operator session has expired."
          />
        ) : (
          <AuditFeed entries={query.data?.data ?? []} />
        )}
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

function FilterInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-slate-500">
      {label}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value.trim())}
        className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
        placeholder=""
      />
    </label>
  );
}
