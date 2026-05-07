import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../auth/useAuth";
import { hasPlatformRole } from "../../auth/access";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { formatDate } from "../../lib/formatDate";
import {
  getAdminTenants,
  suspendTenant,
  reactivateTenant,
} from "../../api/admin";
import type { AdminTenant, AdminTenantStatus } from "../../api/admin";

const STATUS_LABELS: Record<AdminTenantStatus, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  ARCHIVED: "Archived",
};

const STATUS_COLORS: Record<AdminTenantStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  SUSPENDED: "bg-amber-100 text-amber-800",
  ARCHIVED: "bg-gray-100 text-gray-600",
};

interface ActionState {
  tenantId: string;
  type: "suspend" | "reactivate";
}

export default function AdminTenantsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const isOwner = hasPlatformRole(session, ["PLATFORM_OWNER"]);

  const [statusFilter, setStatusFilter] = useState<AdminTenantStatus | "ALL">(
    "ALL",
  );
  const [pendingAction, setPendingAction] = useState<ActionState | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "tenants", statusFilter],
    queryFn: () =>
      getAdminTenants(
        statusFilter !== "ALL" ? { status: statusFilter } : undefined,
      ),
    retry: false,
  });

  const { mutate: doAction, isPending: actionPending } = useMutation({
    mutationFn: (action: ActionState) =>
      action.type === "suspend"
        ? suspendTenant(action.tenantId)
        : reactivateTenant(action.tenantId),
    onSuccess: () => {
      toast.success(
        pendingAction?.type === "suspend"
          ? "Tenant suspended."
          : "Tenant reactivated.",
      );
      setPendingAction(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
    onError: () => {
      toast.error("Action failed. Check console for details.");
    },
  });

  const tenants: AdminTenant[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="mt-1 text-sm text-gray-500">
            All customer workspaces on the platform.
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
              Could not load tenants
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              The admin tenants API returned an error. Try refreshing or check
              operator permissions.
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(["ALL", "ACTIVE", "SUSPENDED", "ARCHIVED"] as const).map((s) => (
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
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Loading tenants…
          </div>
        ) : tenants.length === 0 && !isError ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Building2 className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">No tenants found.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Plan
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Sites
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Members
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Created
                </th>
                {isOwner && (
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">
                      {tenant.name}
                    </p>
                    <p className="text-xs text-gray-400">{tenant.slug}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[tenant.status]}`}
                    >
                      {tenant.status === "ACTIVE" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {STATUS_LABELS[tenant.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {tenant.planKey ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-600">
                    {tenant.siteCount}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-600">
                    {tenant.memberCount}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {formatDate(tenant.createdAt)}
                  </td>
                  {isOwner && (
                    <td className="px-6 py-4 text-right">
                      {tenant.status === "ACTIVE" ? (
                        <button
                          onClick={() =>
                            setPendingAction({
                              tenantId: tenant.id,
                              type: "suspend",
                            })
                          }
                          className="rounded px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                        >
                          Suspend
                        </button>
                      ) : tenant.status === "SUSPENDED" ? (
                        <button
                          onClick={() =>
                            setPendingAction({
                              tenantId: tenant.id,
                              type: "reactivate",
                            })
                          }
                          className="rounded px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                        >
                          Reactivate
                        </button>
                      ) : null}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirm suspend/reactivate */}
      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction?.type === "suspend"
            ? "Suspend tenant?"
            : "Reactivate tenant?"
        }
        message={
          pendingAction?.type === "suspend"
            ? "This will prevent all members from accessing the workspace. Publishing will be disabled immediately."
            : "This will restore full access for all workspace members."
        }
        confirmLabel={
          pendingAction?.type === "suspend" ? "Suspend" : "Reactivate"
        }
        variant={pendingAction?.type === "suspend" ? "danger" : "default"}
        isPending={actionPending}
        onConfirm={() => pendingAction && doAction(pendingAction)}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
