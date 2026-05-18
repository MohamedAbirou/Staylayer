import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Check, Minus, Lock } from "lucide-react";

import {
  fetchOperatorRoleBundles,
  type OperatorRoleBundle,
  type PlatformRole,
} from "../api/operator";

const ROLE_ORDER: PlatformRole[] = [
  "PLATFORM_OWNER",
  "SUPPORT_ADMIN",
  "FINANCE_ADMIN",
];

const ROLE_TONE: Record<PlatformRole, string> = {
  PLATFORM_OWNER: "border-amber-700 text-amber-300",
  SUPPORT_ADMIN: "border-cyan-700 text-cyan-300",
  FINANCE_ADMIN: "border-emerald-700 text-emerald-300",
};

/**
 * Phase 11 — read-only permission catalog. Lists every permission key in
 * the backend registry alongside the role bundles that grant it, so the
 * Platform Owner can see exactly what each role can do before assigning
 * roles in the operator-user UI.
 */
export default function PermissionsCatalogPage() {
  const query = useQuery({
    queryKey: ["operator-role-bundles"],
    queryFn: fetchOperatorRoleBundles,
    staleTime: 5 * 60 * 1000,
  });

  const grouped = useMemo(() => {
    if (!query.data) return [] as Array<[string, string[]]>;
    const out = new Map<string, string[]>();
    for (const key of query.data.allPermissions) {
      const prefix = key.split(".")[0] ?? "other";
      const list = out.get(prefix) ?? [];
      list.push(key);
      out.set(prefix, list);
    }
    for (const [k, v] of out) {
      v.sort();
      out.set(k, v);
    }
    return Array.from(out.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [query.data]);

  const bundleMap = useMemo(() => {
    const out = new Map<PlatformRole, Set<string>>();
    if (!query.data) return out;
    for (const bundle of query.data.bundles) {
      out.set(bundle.role, new Set(bundle.permissions));
    }
    return out;
  }, [query.data]);

  return (
    <div className="px-8 py-8">
      <header className="flex items-center gap-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-cyan-400">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">
            Permissions catalog
          </h1>
          <p className="text-xs text-slate-400">
            Source-of-truth view of operator role bundles. Edit a role
            assignment from the operator-users page — this catalog is read-only
            and tracks the backend registry.
          </p>
        </div>
      </header>

      {query.isLoading ? (
        <p className="mt-6 text-sm text-slate-400">Loading bundles…</p>
      ) : null}
      {query.isError ? (
        <p className="mt-6 text-sm text-rose-300">
          Failed to load permission catalog.
        </p>
      ) : null}

      {query.data ? (
        <>
          <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {ROLE_ORDER.map((role) => {
              const bundle = query.data!.bundles.find((b) => b.role === role);
              if (!bundle) return null;
              return <RoleSummary key={role} bundle={bundle} />;
            })}
          </section>

          <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <table className="min-w-full divide-y divide-slate-800 text-xs">
              <thead className="bg-slate-900/60 text-[10px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2 text-left">Permission key</th>
                  {ROLE_ORDER.map((role) => (
                    <th key={role} className="px-3 py-2 text-center">
                      {role.replace("_", " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {grouped.map(([prefix, keys]) => (
                  <PermissionGroup
                    key={prefix}
                    prefix={prefix}
                    keys={keys}
                    bundleMap={bundleMap}
                  />
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </div>
  );
}

function RoleSummary({ bundle }: { bundle: OperatorRoleBundle }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE_TONE[bundle.role]}`}
      >
        <Lock className="h-3 w-3" />
        {bundle.label}
      </div>
      <p className="mt-2 text-xs text-slate-400">{bundle.description}</p>
      <p className="mt-3 text-[11px] text-slate-500">
        {bundle.permissions.length} permission
        {bundle.permissions.length === 1 ? "" : "s"} granted
      </p>
    </div>
  );
}

function PermissionGroup({
  prefix,
  keys,
  bundleMap,
}: {
  prefix: string;
  keys: string[];
  bundleMap: Map<PlatformRole, Set<string>>;
}) {
  return (
    <>
      <tr className="bg-slate-950/60">
        <td
          colSpan={1 + ROLE_ORDER.length}
          className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400"
        >
          {prefix}
        </td>
      </tr>
      {keys.map((key) => (
        <tr key={key} className="hover:bg-slate-900/60">
          <td className="px-4 py-1.5 font-mono text-[11px] text-slate-200">
            {key}
          </td>
          {ROLE_ORDER.map((role) => {
            const has = bundleMap.get(role)?.has(key) ?? false;
            return (
              <td key={role} className="px-3 py-1.5 text-center">
                {has ? (
                  <Check className="mx-auto h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Minus className="mx-auto h-3.5 w-3.5 text-slate-700" />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
