import { useQuery } from "@tanstack/react-query";
import { Inbox, AlertCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { formatDate } from "../../lib/formatDate";
import { getAdminFormsSummary } from "../../api/admin";
import type { AdminFormSummary } from "../../api/admin";

function spamRatio(summary: AdminFormSummary): number {
  if (summary.totalSubmissions === 0) return 0;
  return Math.round((summary.spamCount / summary.totalSubmissions) * 100);
}

function SpamBadge({ ratio }: { ratio: number }) {
  if (ratio >= 50)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <AlertTriangle className="h-3 w-3" />
        {ratio}%
      </span>
    );
  if (ratio >= 20)
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        {ratio}%
      </span>
    );
  return <span className="text-sm text-gray-500">{ratio}%</span>;
}

export default function AdminFormsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "forms-summary"],
    queryFn: () => getAdminFormsSummary(),
    retry: false,
  });

  const summaries: AdminFormSummary[] = data?.data ?? [];
  const highSpamCount = summaries.filter((s) => spamRatio(s) >= 50).length;
  const deliveryIncidentCount = summaries.filter(
    (s) => s.openDeliveryAlert || s.failedDeliveryCount > 0,
  ).length;
  const spikeAlertCount = summaries.filter((s) => s.openSpikeAlert).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inquiry Volume</h1>
          <p className="mt-1 text-sm text-gray-500">
            Live submission counts and spam ratios per site.
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
      {deliveryIncidentCount > 0 && !isError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {deliveryIncidentCount} site
              {deliveryIncidentCount !== 1 ? "s" : ""} with inquiry delivery
              incidents
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              Failed delivery attempts or missing routing configuration need
              operator attention.
            </p>
          </div>
        </div>
      )}

      {spikeAlertCount > 0 && !isError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-800">
              {spikeAlertCount} site{spikeAlertCount !== 1 ? "s" : ""} with
              automated spike alerts
            </p>
            <p className="mt-0.5 text-sm text-red-700">
              Recent submission volume is materially above the rolling baseline.
            </p>
          </div>
        </div>
      )}

      {highSpamCount > 0 && !isError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-800">
              {highSpamCount} site{highSpamCount !== 1 ? "s" : ""} with high
              spam ratio (&ge;50%)
            </p>
            <p className="mt-0.5 text-sm text-red-700">
              Review recent traffic and affected pages. Bot or junk inquiry
              volume is elevated.
            </p>
          </div>
        </div>
      )}

      {isError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Could not load inquiry data
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              Could not load form summary data. Try refreshing or check API
              health.
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Loading inquiry data…
          </div>
        ) : summaries.length === 0 && !isError ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Inbox className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">No inquiry data available.</p>
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
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Total
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Non-spam
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Unread
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Spam
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Spam ratio
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Delivery
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Alerts
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Last submission
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {summaries.map((s) => (
                <tr key={s.siteId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {s.siteName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {s.tenantName}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-700">
                    {s.totalSubmissions}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-700">
                    {s.nonSpamSubmissions}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-700">
                    {s.unreadCount > 0 ? (
                      <span className="font-semibold text-blue-700">
                        {s.unreadCount}
                      </span>
                    ) : (
                      s.unreadCount
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-700">
                    {s.spamCount}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <SpamBadge ratio={spamRatio(s)} />
                  </td>
                  <td className="px-6 py-4">
                    {s.failedDeliveryCount > 0 ? (
                      <div>
                        <p className="text-sm font-semibold text-red-600">
                          {s.failedDeliveryCount} failed
                        </p>
                        {s.lastDeliveryError && (
                          <p className="mt-1 max-w-xs text-[11px] text-gray-500 line-clamp-2">
                            {s.lastDeliveryError}
                          </p>
                        )}
                        {s.lastDeliveryFailureAt && (
                          <p className="mt-1 text-[11px] text-gray-400">
                            {formatDate(s.lastDeliveryFailureAt)}
                          </p>
                        )}
                      </div>
                    ) : s.pendingDeliveryCount > 0 ? (
                      <p className="text-sm font-medium text-amber-600">
                        {s.pendingDeliveryCount} pending
                      </p>
                    ) : (
                      <p className="text-sm text-emerald-600">Healthy</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {s.openDeliveryAlert && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Delivery
                        </span>
                      )}
                      {s.openSpikeAlert && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Spike
                        </span>
                      )}
                      {!s.openDeliveryAlert && !s.openSpikeAlert && (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </div>
                    {s.deliveryAlertMessage && (
                      <p className="mt-1 max-w-xs text-[11px] text-gray-500 line-clamp-2">
                        {s.deliveryAlertMessage}
                      </p>
                    )}
                    {s.spikeAlertMessage && (
                      <p className="mt-1 max-w-xs text-[11px] text-gray-500 line-clamp-2">
                        {s.spikeAlertMessage}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {s.lastSubmittedAt ? formatDate(s.lastSubmittedAt) : "—"}
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
