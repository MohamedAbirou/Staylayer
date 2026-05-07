import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { formatDate } from "../../lib/formatDate";
import { getAdminSubscriptions } from "../../api/admin";
import type {
  AdminSubscription,
  AdminSubscriptionStatus,
} from "../../api/admin";

const STATUS_LABELS: Record<AdminSubscriptionStatus, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  canceled: "Canceled",
};

const STATUS_COLORS: Record<AdminSubscriptionStatus, string> = {
  active: "bg-green-100 text-green-700",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-red-100 text-red-700",
  canceled: "bg-gray-100 text-gray-600",
};

function StatusIcon({ status }: { status: AdminSubscriptionStatus }) {
  if (status === "active") return <CheckCircle2 className="h-3 w-3" />;
  if (status === "past_due") return <AlertTriangle className="h-3 w-3" />;
  if (status === "canceled") return <XCircle className="h-3 w-3" />;
  return <Clock className="h-3 w-3" />;
}

export default function AdminSubscriptionsPage() {
  const [statusFilter, setStatusFilter] = useState<
    AdminSubscriptionStatus | "ALL"
  >("ALL");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "subscriptions", statusFilter],
    queryFn: () =>
      getAdminSubscriptions(
        statusFilter !== "ALL" ? { status: statusFilter } : undefined,
      ),
    retry: false,
  });

  const subscriptions: AdminSubscription[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Billing state for all tenant plans.
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
              Could not load subscriptions
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              The admin subscriptions API returned an error. Try refreshing or
              check billing sync health.
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(["ALL", "past_due", "active", "trialing", "canceled"] as const).map(
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
            Loading subscriptions…
          </div>
        ) : subscriptions.length === 0 && !isError ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <CreditCard className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">No subscriptions found.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Renews
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Webhook synced
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {subscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">
                      {sub.tenantName}
                    </p>
                    <p className="text-xs text-gray-400">{sub.tenantId}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {sub.planKey}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[sub.status]}`}
                    >
                      <StatusIcon status={sub.status} />
                      {STATUS_LABELS[sub.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {sub.renewsAt ? formatDate(sub.renewsAt) : "—"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {sub.webhookSynced ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="mx-auto h-4 w-4 text-gray-300" />
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
