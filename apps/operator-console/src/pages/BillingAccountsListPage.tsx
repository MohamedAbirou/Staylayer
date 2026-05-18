import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { CreditCard, Search } from "lucide-react";
import {
  fetchBillingAccounts,
  fetchBillingPlans,
  type FetchBillingAccountsParams,
} from "../api/operator";
import { Pagination } from "../components/Pagination";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { DataFreshness } from "../components/DataFreshness";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, formatPlanLabel } from "../lib/billing";

const STATUS_FILTERS: Array<{
  label: string;
  value: FetchBillingAccountsParams["status"] | "";
}> = [
  { label: "All", value: "" },
  { label: "Active", value: "active" },
  { label: "Trialing", value: "trialing" },
  { label: "Past due", value: "past_due" },
  { label: "Canceled", value: "canceled" },
  { label: "Inactive", value: "inactive" },
  { label: "Incomplete", value: "incomplete" },
];

const PAGE_SIZE = 25;

function subscriptionTone(
  status: string,
): "ok" | "warn" | "danger" | "muted" | "info" {
  switch (status) {
    case "ACTIVE":
      return "ok";
    case "TRIALING":
      return "info";
    case "PAST_DUE":
      return "warn";
    case "CANCELED":
    case "UNPAID":
      return "danger";
    default:
      return "muted";
  }
}

/**
 * Phase 8 — Billing Accounts list. Provides quick filtering by status,
 * plan key, and the "mismatch" flag (subscription rows whose local copy
 * disagrees with the latest Stripe webhook payload).
 */
export default function BillingAccountsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<
    FetchBillingAccountsParams["status"] | ""
  >("");
  const [planKey, setPlanKey] = useState("");
  const [search, setSearch] = useState("");
  const [mismatch, setMismatch] = useState(
    searchParams.get("mismatch") === "true",
  );

  // Reflect ?mismatch=true in state on first render
  useEffect(() => {
    const next = searchParams.get("mismatch") === "true";
    setMismatch(next);
  }, [searchParams]);

  const plansQuery = useQuery({
    queryKey: ["operator-billing-plans"],
    queryFn: fetchBillingPlans,
    staleTime: 5 * 60_000,
  });

  const params: FetchBillingAccountsParams = {
    page,
    limit: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(planKey ? { planKey } : {}),
    ...(mismatch ? { mismatch: true } : {}),
    ...(search.trim().length >= 2 ? { q: search.trim() } : {}),
  };

  const query = useQuery({
    queryKey: ["operator-billing-accounts", params],
    queryFn: () => fetchBillingAccounts(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const rows = query.data?.data ?? [];

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">
              Billing accounts
            </h1>
            <p className="text-xs text-slate-400">
              Every tenant subscription in the platform, filterable by status
              and plan.
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={new Date().toISOString()} />
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1">
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

        <select
          value={planKey}
          onChange={(e) => {
            setPlanKey(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-100"
        >
          <option value="">All plans</option>
          {(plansQuery.data ?? []).map((plan) => (
            <option key={plan.key} value={plan.key}>
              {plan.name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={mismatch}
            onChange={(e) => {
              const next = e.target.checked;
              setMismatch(next);
              setPage(1);
              const params = new URLSearchParams(searchParams);
              if (next) params.set("mismatch", "true");
              else params.delete("mismatch");
              setSearchParams(params, { replace: true });
            }}
            className="accent-cyan-500"
          />
          Stripe ↔ local mismatch only
        </label>

        <div className="ml-auto relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search tenant, slug, customer id…"
            className="w-80 rounded-md border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-left text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Tenant</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Renews</th>
              <th className="px-4 py-3 font-semibold">Stripe</th>
              <th className="px-4 py-3 font-semibold">Last webhook</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {query.isLoading && rows.length === 0
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => {
                  const sub = row.subscriptions[0];
                  return (
                    <tr
                      key={row.id}
                      className="cursor-pointer hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/billing/accounts/${row.id}`}
                          className="block font-medium text-slate-100 hover:text-white"
                        >
                          {row.name}
                        </Link>
                        <p className="text-[11px] text-slate-500">{row.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {formatPlanLabel(sub?.planKey ?? null)}
                      </td>
                      <td className="px-4 py-3">
                        {sub ? (
                          <StatusBadge
                            status={sub.status}
                            tone={subscriptionTone(sub.status)}
                          />
                        ) : (
                          <span className="text-slate-500">No sub</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-400">
                        {sub?.cancelAtPeriodEnd ? "Cancels at " : ""}
                        {formatDate(sub?.currentPeriodEnd)}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-400">
                        {sub?.providerCustomerId ? (
                          <span className="font-mono">
                            {sub.providerCustomerId.slice(0, 18)}…
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        {formatDate(sub?.lastWebhookAt)}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {!query.isLoading && rows.length === 0 ? (
          <EmptyState
            title="No accounts match"
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
