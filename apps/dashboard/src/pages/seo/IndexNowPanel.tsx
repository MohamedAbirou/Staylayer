import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
} from "lucide-react";

import {
  getIndexNowOverview,
  listIndexNowSubmissions,
  retryIndexNowSubmission,
  rotateIndexNowKey,
  submitIndexNowUrls,
  toggleIndexNow,
  type IndexNowOverview,
  type IndexNowSubmissionEntry,
  type SearchEngineSubmissionStatus,
  type SearchEngineSubmissionTarget,
} from "../../api/seo";

interface Props {
  siteId: string;
}

export function IndexNowPanel({ siteId }: Props) {
  const queryClient = useQueryClient();
  const overviewQuery = useQuery({
    queryKey: ["seo", "indexnow", siteId],
    queryFn: () => getIndexNowOverview(siteId),
    enabled: Boolean(siteId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["seo", "indexnow", siteId] });

  if (overviewQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading IndexNow status…
      </div>
    );
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle className="mt-0.5 h-4 w-4" />
        Failed to load IndexNow status.
        <button
          onClick={() => overviewQuery.refetch()}
          className="font-medium underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <IndexNowEditor
      siteId={siteId}
      overview={overviewQuery.data}
      onChanged={invalidate}
    />
  );
}

function IndexNowEditor({
  siteId,
  overview,
  onChanged,
}: {
  siteId: string;
  overview: IndexNowOverview;
  onChanged: () => void;
}) {
  const [urlsText, setUrlsText] = useState("");

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => toggleIndexNow(siteId, enabled),
    onSuccess: onChanged,
  });

  const rotateMutation = useMutation({
    mutationFn: () => rotateIndexNowKey(siteId),
    onSuccess: onChanged,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitIndexNowUrls(
        siteId,
        urlsText
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    onSuccess: () => {
      setUrlsText("");
      onChanged();
    },
  });

  const handleRotate = () => {
    if (
      !window.confirm(
        "Rotate the IndexNow key? Search engines will need to re-verify, which may pause auto-submissions for a few minutes.",
      )
    ) {
      return;
    }
    rotateMutation.mutate();
  };

  return (
    <div className="space-y-5">
      {!overview.indexingEnabled && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          Indexing is paused for this site, so IndexNow submissions are
          automatically skipped until you re-enable it.
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Auto-submit on publish &amp; redirect changes
            </h3>
            <p className="text-xs text-gray-500">
              When enabled, the platform pings IndexNow on every publish,
              unpublish, delete, and redirect change.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overview.enabled}
              disabled={toggleMutation.isPending}
              onChange={(e) => toggleMutation.mutate(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="font-medium text-gray-900">
              {overview.enabled ? "Enabled" : "Disabled"}
            </span>
          </label>
        </header>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <header className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-base font-semibold text-gray-900">
            <KeyRound className="h-4 w-4" /> Verification key
          </h3>
          <button
            disabled={rotateMutation.isPending}
            onClick={handleRotate}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {rotateMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Rotate key
          </button>
        </header>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs">
          {overview.key}
        </div>
        {overview.keyFileUrl && (
          <a
            href={overview.keyFileUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> {overview.keyFileUrl}
          </a>
        )}
        <p className="mt-2 text-xs text-gray-500">
          The key file is served automatically from your site's root. No upload
          required.
        </p>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <header className="mb-3">
          <h3 className="text-base font-semibold text-gray-900">
            Manual submission
          </h3>
          <p className="text-xs text-gray-500">
            Push specific URLs to IndexNow now. One URL per line, max 500 per
            submission. URLs must belong to{" "}
            <code className="rounded bg-gray-100 px-1">
              {overview.canonicalHost || "this site"}
            </code>
            .
          </p>
        </header>
        <textarea
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          rows={6}
          placeholder={`https://${overview.canonicalHost || "example.com"}/page-1\nhttps://${overview.canonicalHost || "example.com"}/page-2`}
          className="block w-full rounded-md border border-gray-300 bg-gray-50 p-3 font-mono text-xs"
          spellCheck={false}
        />
        <div className="mt-3 flex items-center justify-end gap-3">
          {submitMutation.isError && (
            <span className="text-xs text-red-600">
              {(submitMutation.error as Error)?.message ?? "Submission failed"}
            </span>
          )}
          {submitMutation.isSuccess && submitMutation.data && (
            <span className="flex items-center gap-1 text-xs text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Submitted{" "}
              {submitMutation.data.submitted}
              {submitMutation.data.skipped > 0
                ? ` (${submitMutation.data.skipped} skipped)`
                : ""}
            </span>
          )}
          <button
            disabled={submitMutation.isPending || urlsText.trim().length === 0}
            onClick={() => submitMutation.mutate()}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit URLs
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <SubmissionsActivity siteId={siteId} />
      </section>
    </div>
  );
}

const TARGET_LABEL: Record<string, string> = {
  INDEXNOW_AUTO_PUBLISH: "Auto · Publish",
  INDEXNOW_AUTO_UNPUBLISH: "Auto · Unpublish",
  INDEXNOW_AUTO_DELETE: "Auto · Delete",
  INDEXNOW_AUTO_REDIRECT_CREATE: "Auto · Redirect created",
  INDEXNOW_AUTO_REDIRECT_REMOVE: "Auto · Redirect removed",
  INDEXNOW_MANUAL: "Manual",
};

const STATUS_STYLE: Record<string, string> = {
  SUCCESS: "text-green-700 bg-green-50 border-green-200",
  FAILED: "text-red-700 bg-red-50 border-red-200",
  PENDING: "text-blue-700 bg-blue-50 border-blue-200",
  SKIPPED: "text-gray-600 bg-gray-50 border-gray-200",
};

function SubmissionsTable({
  items,
  retryingId,
  onRetry,
}: {
  items: IndexNowSubmissionEntry[];
  retryingId?: string | null;
  onRetry?: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-500">
        No submissions yet.
      </p>
    );
  }
  return (
    <div className="max-h-96 overflow-auto rounded-md border border-gray-200">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Trigger</th>
            <th className="px-3 py-2 font-medium">URLs</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Attempts</th>
            <th className="px-3 py-2 font-medium">Response</th>
            {onRetry && <th className="px-3 py-2 font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => (
            <tr key={item.id} className="align-top hover:bg-gray-50">
              <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                {new Date(item.createdAt).toLocaleString()}
              </td>
              <td className="px-3 py-2">
                {TARGET_LABEL[item.target] ?? item.target}
              </td>
              <td className="px-3 py-2">
                <div className="font-medium">{item.urlCount}</div>
                {item.urls.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-blue-600">
                      view
                    </summary>
                    <ul className="mt-1 max-h-32 overflow-auto rounded bg-gray-50 p-2 font-mono text-[10px] text-gray-700">
                      {item.urls.map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                    STATUS_STYLE[item.status] ?? STATUS_STYLE.SKIPPED
                  }`}
                >
                  {item.status}
                </span>
                {item.reason && (
                  <div className="mt-1 text-[11px] text-gray-500">
                    {item.reason}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-gray-600">
                <div className="font-medium">{item.attempts}</div>
                {item.nextAttemptAt && (
                  <div
                    className="text-[10px] text-gray-500"
                    title={`Next retry at ${new Date(item.nextAttemptAt).toLocaleString()}`}
                  >
                    next: {new Date(item.nextAttemptAt).toLocaleTimeString()}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-gray-600">
                {item.responseStatus ?? "—"}
                {item.responseBody && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-blue-600">
                      body
                    </summary>
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-gray-50 p-2 font-mono text-[10px] text-gray-700">
                      {item.responseBody}
                    </pre>
                  </details>
                )}
              </td>
              {onRetry && (
                <td className="px-3 py-2">
                  {item.status === "FAILED" ? (
                    <button
                      onClick={() => onRetry(item.id)}
                      disabled={retryingId === item.id}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {retryingId === item.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Retry
                    </button>
                  ) : (
                    <span className="text-[11px] text-gray-400">—</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TARGET_FILTERS: Array<
  | { value: ""; label: string }
  | { value: SearchEngineSubmissionTarget; label: string }
> = [
  { value: "", label: "All triggers" },
  { value: "INDEXNOW_AUTO_PUBLISH", label: "Auto · Publish" },
  { value: "INDEXNOW_AUTO_UNPUBLISH", label: "Auto · Unpublish" },
  { value: "INDEXNOW_AUTO_DELETE", label: "Auto · Delete" },
  { value: "INDEXNOW_AUTO_REDIRECT_CREATE", label: "Auto · Redirect created" },
  { value: "INDEXNOW_AUTO_REDIRECT_REMOVE", label: "Auto · Redirect removed" },
  { value: "INDEXNOW_MANUAL", label: "Manual" },
];

const STATUS_FILTERS: Array<
  | { value: ""; label: string }
  | { value: SearchEngineSubmissionStatus; label: string }
> = [
  { value: "", label: "All statuses" },
  { value: "SUCCESS", label: "Success" },
  { value: "FAILED", label: "Failed" },
  { value: "PENDING", label: "Pending" },
  { value: "SKIPPED", label: "Skipped" },
];

function SubmissionsActivity({ siteId }: { siteId: string }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<SearchEngineSubmissionTarget | "">("");
  const [status, setStatus] = useState<SearchEngineSubmissionStatus | "">("");

  const queryKey = useMemo(
    () => ["seo", "indexnow", "submissions", siteId, target, status] as const,
    [siteId, target, status],
  );

  const submissionsQuery = useQuery({
    queryKey,
    queryFn: () =>
      listIndexNowSubmissions(siteId, {
        target: target || undefined,
        status: status || undefined,
        limit: 100,
      }),
    enabled: Boolean(siteId),
  });

  const retryMutation = useMutation({
    mutationFn: (logId: string) => retryIndexNowSubmission(siteId, logId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({
        queryKey: ["seo", "indexnow", siteId],
      });
    },
  });

  return (
    <>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Submission activity
          </h3>
          <p className="text-xs text-gray-500">
            Failed auto-submissions are retried up to four times with backoff
            (1m → 5m → 15m → 1h). You can also retry manually.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={target}
            onChange={(e) =>
              setTarget(e.target.value as SearchEngineSubmissionTarget | "")
            }
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
          >
            {TARGET_FILTERS.map((opt) => (
              <option key={opt.value || "all-targets"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as SearchEngineSubmissionStatus | "")
            }
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
          >
            {STATUS_FILTERS.map((opt) => (
              <option key={opt.value || "all-statuses"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => submissionsQuery.refetch()}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </header>
      {retryMutation.isError && (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {(retryMutation.error as Error)?.message ?? "Retry failed"}
        </div>
      )}
      {submissionsQuery.isLoading ? (
        <div className="flex items-center gap-2 p-4 text-xs text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading activity…
        </div>
      ) : submissionsQuery.isError ? (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="h-3 w-3" /> Failed to load activity.
        </div>
      ) : (
        <SubmissionsTable
          items={submissionsQuery.data?.items ?? []}
          retryingId={retryMutation.isPending ? retryMutation.variables : null}
          onRetry={(id) => retryMutation.mutate(id)}
        />
      )}
    </>
  );
}
