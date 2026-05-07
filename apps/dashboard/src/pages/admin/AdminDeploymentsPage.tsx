import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Rocket,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../auth/useAuth";
import { hasPlatformRole } from "../../auth/access";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { formatDate, formatRelativeTime } from "../../lib/formatDate";
import { getAdminDeployments, retryDeployment } from "../../api/admin";
import type { AdminDeployment, AdminDeployStatus } from "../../api/admin";

const STATUS_LABELS: Record<AdminDeployStatus, string> = {
  PENDING: "Pending",
  BUILDING: "Building",
  DEPLOYED: "Deployed",
  FAILED: "Failed",
};

const STATUS_COLORS: Record<AdminDeployStatus, string> = {
  PENDING: "bg-blue-100 text-blue-700",
  BUILDING: "bg-yellow-100 text-yellow-800",
  DEPLOYED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

function StatusIcon({ status }: { status: AdminDeployStatus }) {
  if (status === "DEPLOYED") return <CheckCircle2 className="h-3 w-3" />;
  if (status === "FAILED") return <XCircle className="h-3 w-3" />;
  if (status === "BUILDING")
    return <Loader2 className="h-3 w-3 animate-spin" />;
  return <Clock className="h-3 w-3" />;
}

export default function AdminDeploymentsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const canRetry = hasPlatformRole(session, [
    "PLATFORM_OWNER",
    "SUPPORT_ADMIN",
  ]);
  const [statusFilter, setStatusFilter] = useState<AdminDeployStatus | "ALL">(
    "ALL",
  );
  const [retryTarget, setRetryTarget] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "deployments", statusFilter],
    queryFn: () =>
      getAdminDeployments(
        statusFilter !== "ALL" ? { status: statusFilter } : undefined,
      ),
    retry: false,
  });

  const { mutate: doRetry, isPending: retryPending } = useMutation({
    mutationFn: (id: string) => retryDeployment(id),
    onSuccess: () => {
      toast.success("Deployment retry queued.");
      setRetryTarget(null);
      void queryClient.invalidateQueries({
        queryKey: ["admin", "deployments"],
      });
    },
    onError: () => {
      toast.error("Retry failed. Check console for details.");
    },
  });

  const deployments: AdminDeployment[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deployments</h1>
          <p className="mt-1 text-sm text-gray-500">
            Latest site deployment status across all tenants.
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
              Could not load deployments
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              The admin deployments API returned an error. Try refreshing or
              check operator permissions.
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(["ALL", "FAILED", "BUILDING", "DEPLOYED", "PENDING"] as const).map(
          (s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-slate-800 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {s === "ALL" ? "All" : STATUS_LABELS[s]}
            </button>
          ),
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Loading deployments…
          </div>
        ) : deployments.length === 0 && !isError ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Rocket className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">No deployments found.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Site
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Provider Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Failure
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Deployed
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deployments.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">
                      {d.siteName}
                    </p>
                    <p className="text-xs text-gray-400">{d.siteId}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {d.tenantName}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[d.status]}`}
                    >
                      <StatusIcon status={d.status} />
                      {STATUS_LABELS[d.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-400">
                    {d.providerProjectId ?? "—"}
                  </td>
                  <td className="px-6 py-4">
                    {d.errorMessage ? (
                      <p
                        title={d.errorMessage}
                        className="max-w-xs truncate text-xs text-red-600"
                      >
                        {d.errorMessage}
                      </p>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {d.deployedAt
                      ? formatRelativeTime(d.deployedAt)
                      : formatDate(d.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {d.status === "FAILED" && canRetry && (
                      <button
                        onClick={() => setRetryTarget(d.id)}
                        className="rounded px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={retryTarget !== null}
        title="Retry deployment?"
        message="This will queue a new deployment for the site. The action will be recorded in the audit log."
        confirmLabel="Retry deployment"
        isPending={retryPending}
        onConfirm={() => retryTarget && doRetry(retryTarget)}
        onCancel={() => setRetryTarget(null)}
      />
    </div>
  );
}
