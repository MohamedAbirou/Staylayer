import { useQuery } from "@tanstack/react-query";
import { ClipboardList, AlertCircle, RefreshCw } from "lucide-react";
import { formatDate } from "../../lib/formatDate";
import { getAdminAuditLog } from "../../api/admin";
import type { AdminAuditEntry } from "../../api/admin";

function ActionBadge({ action }: { action: string }) {
  const dangerous = ["suspend", "delete", "reset"].some((k) =>
    action.toLowerCase().includes(k),
  );
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        dangerous ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"
      }`}
    >
      {action}
    </span>
  );
}

export default function AdminAuditPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => getAdminAuditLog({ limit: 100 }),
    retry: false,
  });

  const entries: AdminAuditEntry[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="mt-1 text-sm text-gray-500">
            All manual operator actions recorded on the platform. Read-only.
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {isError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Could not load audit log
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              The audit API returned an error. Try refreshing or check operator
              permissions.
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Loading audit log…
          </div>
        ) : entries.length === 0 && !isError ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <ClipboardList className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">No audit entries yet.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  When
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actor
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Target
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Meta
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-400 whitespace-nowrap">
                    {formatDate(e.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-700">{e.actorEmail}</p>
                    <p className="text-xs text-gray-400">{e.actorId}</p>
                  </td>
                  <td className="px-6 py-4">
                    <ActionBadge action={e.action} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {e.targetType && e.targetId
                      ? `${e.targetType} / ${e.targetId}`
                      : (e.targetType ?? "—")}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-400">
                    {e.meta ? (
                      <pre className="max-w-xs overflow-auto whitespace-pre-wrap font-mono">
                        {JSON.stringify(e.meta, null, 2)}
                      </pre>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
