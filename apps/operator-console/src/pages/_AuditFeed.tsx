import type { AuditFeedEntry } from "../api/operator";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";

/**
 * Renders a list of merged audit entries (operator + legacy). Kept as a
 * non-route component because it is reused by Tenant 360, Site 360, and
 * the dedicated audit log page.
 */
export function AuditFeed({ entries }: { entries: AuditFeedEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState title="No audit entries" />;
  }
  return (
    <ul className="divide-y divide-slate-800">
      {entries.map((entry) => (
        <li key={`${entry.kind}-${entry.id}`} className="py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-200">
              {entry.action}
            </span>
            <StatusBadge
              status={entry.kind === "operator" ? "Operator" : "Customer"}
              tone={entry.kind === "operator" ? "info" : "muted"}
            />
            {entry.kind === "operator" && entry.sensitive ? (
              <StatusBadge status="Sensitive" tone="danger" />
            ) : null}
            {entry.kind === "operator" && entry.statusCode ? (
              <StatusBadge
                status={`HTTP ${entry.statusCode}`}
                tone={
                  entry.statusCode >= 500
                    ? "danger"
                    : entry.statusCode >= 400
                      ? "warn"
                      : "ok"
                }
              />
            ) : null}
            <span className="ml-auto text-[10px] text-slate-500">
              {new Date(entry.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {entry.actorEmail}
            {entry.actorRole ? ` · ${entry.actorRole}` : ""}
            {entry.targetType
              ? ` · ${entry.targetType}${entry.targetId ? `:${entry.targetId}` : ""}`
              : ""}
          </p>
          {entry.kind === "operator" && entry.reason ? (
            <p className="mt-1 rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-300">
              Reason: {entry.reason}
            </p>
          ) : null}
          {entry.kind === "legacy" && entry.metadata ? (
            <details className="mt-1 text-[11px] text-slate-400">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-300">
                Metadata
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded-md border border-slate-800 bg-slate-950/60 p-2 text-[10px] text-slate-300">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
