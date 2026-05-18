import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, FileCode, Globe, Search, UserRound } from "lucide-react";
import { fetchGlobalSearch } from "../api/operator";
import { DataFreshness } from "../components/DataFreshness";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import {
  StatusBadge,
  domainStatusTone,
  siteStatusTone,
  tenantStatusTone,
} from "../components/StatusBadge";

/**
 * Dedicated search results page. Reads the `q` query parameter so the
 * command palette and other deep-links can land here when the operator
 * wants the full grouped view.
 */
export default function GlobalSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const query = useQuery({
    queryKey: ["operator-global-search", q],
    queryFn: () => fetchGlobalSearch(q, 20),
    enabled: q.trim().length >= 2,
    staleTime: 15_000,
  });

  const sections = useMemo(
    () => [
      {
        title: "Tenants",
        icon: Building2,
        items: query.data?.tenants ?? [],
        render: (t: NonNullable<typeof query.data>["tenants"][number]) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-3 py-2"
          >
            <Link
              to={`/tenants/${t.id}`}
              className="block min-w-0 text-sm font-medium text-slate-100 hover:text-white"
            >
              <span className="block truncate">{t.name}</span>
              <span className="block truncate text-[11px] text-slate-500">
                {t.slug} · {t.siteCount} sites
              </span>
            </Link>
            <StatusBadge status={t.status} tone={tenantStatusTone(t.status)} />
          </li>
        ),
      },
      {
        title: "Sites",
        icon: FileCode,
        items: query.data?.sites ?? [],
        render: (s: NonNullable<typeof query.data>["sites"][number]) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 py-2"
          >
            <Link
              to={`/sites/${s.id}`}
              className="block min-w-0 text-sm font-medium text-slate-100 hover:text-white"
            >
              <span className="block truncate">{s.name}</span>
              <span className="block truncate text-[11px] text-slate-500">
                {s.tenant.name} · {s.publicSubdomain ?? s.slug}
              </span>
            </Link>
            <StatusBadge status={s.status} tone={siteStatusTone(s.status)} />
          </li>
        ),
      },
      {
        title: "Domains",
        icon: Globe,
        items: query.data?.domains ?? [],
        render: (d: NonNullable<typeof query.data>["domains"][number]) => (
          <li
            key={d.id}
            className="flex items-center justify-between gap-3 py-2"
          >
            <Link
              to={`/sites/${d.site.id}`}
              className="block min-w-0 text-sm font-medium text-slate-100 hover:text-white"
            >
              <span className="block truncate">{d.host}</span>
              <span className="block truncate text-[11px] text-slate-500">
                {d.site.tenant.name} · {d.site.name}
              </span>
            </Link>
            <StatusBadge status={d.status} tone={domainStatusTone(d.status)} />
          </li>
        ),
      },
      {
        title: "Users",
        icon: UserRound,
        items: query.data?.users ?? [],
        render: (u: NonNullable<typeof query.data>["users"][number]) => (
          <li
            key={u.id}
            className="flex items-center justify-between gap-3 py-2"
          >
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium text-slate-100">{u.email}</p>
              <p className="truncate text-[11px] text-slate-500">
                {u.platformRole ?? "Customer user"}
              </p>
            </div>
            <StatusBadge
              status={u.platformRole ?? "USER"}
              tone={u.platformRole ? "info" : "muted"}
            />
          </li>
        ),
      },
    ],
    [query.data],
  );

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">Search</h1>
            <p className="text-xs text-slate-400">
              Operator-wide lookup across tenants, sites, domains, and users.
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={query.data?.generatedAt} />
      </header>

      <div className="mt-6">
        <input
          type="search"
          value={q}
          onChange={(event) =>
            setSearchParams(event.target.value ? { q: event.target.value } : {})
          }
          placeholder="Search…"
          className="w-full max-w-xl rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
        />
      </div>

      {q.trim().length < 2 ? (
        <div className="mt-8">
          <EmptyState
            title="Type at least 2 characters"
            description="Searches are bounded server-side and case-insensitive."
          />
        </div>
      ) : query.isLoading ? (
        <div className="mt-8 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <div
                key={section.title}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <header className="mb-3 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white">
                    {section.title}
                  </h2>
                  <span className="ml-auto text-[10px] uppercase tracking-widest text-slate-500">
                    {section.items.length} result
                    {section.items.length === 1 ? "" : "s"}
                  </span>
                </header>
                {section.items.length === 0 ? (
                  <EmptyState title="No matches" />
                ) : (
                  <ul className="divide-y divide-slate-800">
                    {section.items.map((item) =>
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      section.render(item as any),
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
