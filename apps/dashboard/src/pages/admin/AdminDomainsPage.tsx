import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { formatDate } from "../../lib/formatDate";
import { useAuth } from "../../auth/useAuth";
import { hasPlatformRole } from "../../auth/access";
import { getAdminDomains, retryDomainVerification } from "../../api/admin";
import toast from "react-hot-toast";
import type {
  AdminDomain,
  AdminDomainVerificationStatus,
} from "../../api/admin";

const V_STATUS_LABELS: Record<AdminDomainVerificationStatus, string> = {
  UNVERIFIED: "Unverified",
  PENDING: "Pending",
  VERIFIED: "Verified",
  FAILED: "Failed",
};

const V_STATUS_COLORS: Record<AdminDomainVerificationStatus, string> = {
  UNVERIFIED: "bg-gray-100 text-gray-600",
  PENDING: "bg-blue-100 text-blue-700",
  VERIFIED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

function VerificationIcon({
  status,
}: {
  status: AdminDomainVerificationStatus;
}) {
  if (status === "VERIFIED") return <CheckCircle2 className="h-3 w-3" />;
  if (status === "FAILED") return <XCircle className="h-3 w-3" />;
  if (status === "PENDING") return <Clock className="h-3 w-3" />;
  return <AlertTriangle className="h-3 w-3" />;
}

export default function AdminDomainsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const canRetry = hasPlatformRole(session, [
    "PLATFORM_OWNER",
    "SUPPORT_ADMIN",
  ]);
  const [statusFilter, setStatusFilter] = useState<
    AdminDomainVerificationStatus | "ALL"
  >("ALL");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "domains", statusFilter],
    queryFn: () =>
      getAdminDomains(
        statusFilter !== "ALL"
          ? { verificationStatus: statusFilter }
          : undefined,
      ),
    retry: false,
  });

  const retryMutation = useMutation({
    mutationFn: (domainId: string) => retryDomainVerification(domainId),
    onSuccess: () => {
      toast.success("Domain verification retry requested.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "domains"] });
    },
    onError: () => {
      toast.error("Could not retry verification.");
    },
  });

  const domains: AdminDomain[] = data?.data ?? [];
  const failedCount = domains.filter((d) => d.status === "FAILED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Domains</h1>
          <p className="mt-1 text-sm text-gray-500">
            Domain verification and SSL state across all sites.
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

      {/* Hospitality incident summary */}
      {failedCount > 0 && !isError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-800">
              {failedCount} domain{failedCount !== 1 ? "s" : ""} failed
              verification
            </p>
            <p className="mt-0.5 text-sm text-red-700">
              Retry verification or inspect the affected site&apos;s DNS
              records.
            </p>
          </div>
        </div>
      )}

      {isError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Could not load domains
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              The admin domains API returned an error. Try refreshing or check
              API health.
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(["ALL", "FAILED", "UNVERIFIED", "PENDING", "VERIFIED"] as const).map(
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
              {s === "ALL" ? "All" : V_STATUS_LABELS[s]}
            </button>
          ),
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Loading domains…
          </div>
        ) : domains.length === 0 && !isError ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Globe className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">No domains found.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Domain
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Site / Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Verification
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  SSL
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Primary
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Last checked
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {domains.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">
                      {d.domain}
                    </p>
                    {d.expectedTarget && (
                      <p className="text-xs text-gray-400">
                        Target {d.expectedTarget}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-700">{d.siteName}</p>
                    <p className="text-xs text-gray-400">{d.tenantName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${V_STATUS_COLORS[d.verificationStatus]}`}
                    >
                      <VerificationIcon status={d.verificationStatus} />
                      {V_STATUS_LABELS[d.verificationStatus]}
                    </span>
                    <div className="mt-2 space-y-1 text-xs text-gray-400">
                      <p>
                        {d.observedCname
                          ? `CNAME ${d.observedCname}`
                          : d.observedAddresses.length > 0
                            ? d.observedAddresses.join(", ")
                            : "No DNS record observed"}
                      </p>
                      {d.lastError && (
                        <p className="text-red-500">{d.lastError}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {d.sslActive ? (
                      <div className="space-y-1">
                        <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" />
                        {d.verifiedAt && (
                          <p className="text-[11px] text-gray-400">
                            {formatDate(d.verifiedAt)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <XCircle className="mx-auto h-4 w-4 text-red-400" />
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {d.isPrimary ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-blue-400" />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {d.lastCheckedAt ? formatDate(d.lastCheckedAt) : "—"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {d.verificationStatus !== "VERIFIED" && canRetry && (
                      <button
                        onClick={() => retryMutation.mutate(d.id)}
                        disabled={retryMutation.isPending}
                        title="Retry verification"
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <RefreshCw className="h-3 w-3" />
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
    </div>
  );
}
