import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  PlayCircle,
  Search,
  StopCircle,
  XCircle,
} from "lucide-react";

import client from "../../api/client";
import {
  cancelSeoCrawl,
  getSeoCrawlJob,
  getSeoCrawlLinkGraph,
  getSeoCrawlPageLinks,
  listSeoCrawlIssues,
  listSeoCrawlJobs,
  listSeoCrawlResults,
  startSeoCrawl,
  type SeoCrawlIssue,
  type SeoCrawlIssueSeverity,
  type SeoCrawlJob,
  type SeoCrawlLinkGraph,
  type SeoCrawlUrlResult,
  type SeoPageLinks,
} from "../../api/seo";

interface Props {
  siteId: string;
}

const DEFAULT_URL_LIMIT = 250;
const DEFAULT_MAX_DEPTH = 5;
const POLL_INTERVAL_MS = 5_000;

export function SiteCrawlPanel({ siteId }: Props) {
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [urlLimit, setUrlLimit] = useState(DEFAULT_URL_LIMIT);
  const [maxDepth, setMaxDepth] = useState(DEFAULT_MAX_DEPTH);
  const [severityFilter, setSeverityFilter] = useState<
    SeoCrawlIssueSeverity | "ALL"
  >("ALL");
  const [completedTab, setCompletedTab] = useState<"issues" | "link-graph">(
    "issues",
  );

  const jobsQuery = useQuery({
    queryKey: ["seo", "crawler", "jobs", siteId],
    queryFn: () => listSeoCrawlJobs(siteId, 20),
    enabled: Boolean(siteId),
    refetchInterval: (q) => {
      const jobs = q.state.data;
      if (!jobs) return false;
      return jobs.some((j) => j.status === "PENDING" || j.status === "RUNNING")
        ? POLL_INTERVAL_MS
        : false;
    },
  });

  const activeJob = useMemo<SeoCrawlJob | null>(() => {
    if (!selectedJobId) return jobsQuery.data?.[0] ?? null;
    return jobsQuery.data?.find((j) => j.id === selectedJobId) ?? null;
  }, [jobsQuery.data, selectedJobId]);

  const jobDetailQuery = useQuery({
    queryKey: ["seo", "crawler", "job", siteId, activeJob?.id],
    queryFn: () => getSeoCrawlJob(siteId, activeJob!.id),
    enabled: Boolean(activeJob?.id),
    refetchInterval: (q) => {
      const j = q.state.data;
      return j && (j.status === "PENDING" || j.status === "RUNNING")
        ? POLL_INTERVAL_MS
        : false;
    },
    initialData: activeJob ?? undefined,
  });

  const job = jobDetailQuery.data ?? activeJob;
  const isJobActive =
    job && (job.status === "PENDING" || job.status === "RUNNING");

  const resultsQuery = useQuery({
    queryKey: ["seo", "crawler", "results", siteId, job?.id],
    queryFn: () =>
      listSeoCrawlResults(siteId, job!.id, {
        limit: 100,
        hasIssues: true,
      }),
    enabled: Boolean(job?.id) && job?.status === "COMPLETED",
  });

  const issuesQuery = useQuery({
    queryKey: ["seo", "crawler", "issues", siteId, job?.id, severityFilter],
    queryFn: () =>
      listSeoCrawlIssues(siteId, job!.id, {
        limit: 100,
        severity: severityFilter === "ALL" ? undefined : severityFilter,
      }),
    enabled: Boolean(job?.id) && job?.status === "COMPLETED",
  });

  const startMutation = useMutation({
    mutationFn: () => startSeoCrawl(siteId, { urlLimit, maxDepth }),
    onSuccess: (newJob) => {
      setSelectedJobId(newJob.id);
      queryClient.invalidateQueries({
        queryKey: ["seo", "crawler", "jobs", siteId],
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelSeoCrawl(siteId, job!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["seo", "crawler", "jobs", siteId],
      });
      queryClient.invalidateQueries({
        queryKey: ["seo", "crawler", "job", siteId, job?.id],
      });
    },
  });

  const downloadCsv = async () => {
    if (!job) return;
    const res = await client.get(`/seo/crawler/jobs/${job.id}/export.csv`, {
      params: { siteId },
      responseType: "blob",
    });
    const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seo-crawl-${job.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Start panel */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Site crawl &amp; technical audit
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Fetches every internal URL starting from your verified domain and
              inspects each page for SEO issues — broken links,
              missing/duplicate metadata, thin content, slow responses,
              indexability problems, and more.
            </p>
          </div>
          <button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending || Boolean(isJobActive)}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {startMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Start crawl
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">URL budget</span>
            <input
              type="number"
              min={1}
              max={10000}
              value={urlLimit}
              onChange={(e) => setUrlLimit(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <span className="mt-1 block text-xs text-gray-500">
              Maximum URLs to fetch. Your plan caps this value.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Max depth</span>
            <input
              type="number"
              min={1}
              max={10}
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <span className="mt-1 block text-xs text-gray-500">
              How many link-hops away from the home page to follow.
            </span>
          </label>
        </div>

        {startMutation.error && (
          <ErrorBanner message={extractErrorMessage(startMutation.error)} />
        )}
      </div>

      {/* Jobs list + selected job summary */}
      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <JobsList
          jobs={jobsQuery.data ?? []}
          loading={jobsQuery.isLoading}
          selectedId={job?.id ?? null}
          onSelect={(id) => setSelectedJobId(id)}
        />

        {!job ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            Start a crawl to see audit results here.
          </div>
        ) : (
          <div className="space-y-6">
            <JobSummary
              job={job}
              onCancel={() => cancelMutation.mutate()}
              canceling={cancelMutation.isPending}
              onExport={downloadCsv}
            />

            {job.status === "COMPLETED" && (
              <>
                <div className="flex items-center gap-1 border-b border-gray-200">
                  <TabButton
                    active={completedTab === "issues"}
                    onClick={() => setCompletedTab("issues")}
                    label="Issues & URLs"
                  />
                  <TabButton
                    active={completedTab === "link-graph"}
                    onClick={() => setCompletedTab("link-graph")}
                    label="Link graph"
                  />
                </div>
                {completedTab === "issues" ? (
                  <>
                    <IssuesPanel
                      issues={issuesQuery.data?.items ?? []}
                      loading={issuesQuery.isLoading}
                      severityFilter={severityFilter}
                      onSeverityChange={setSeverityFilter}
                    />
                    <ResultsTable
                      results={resultsQuery.data?.items ?? []}
                      loading={resultsQuery.isLoading}
                    />
                  </>
                ) : (
                  <LinkGraphPanel siteId={siteId} jobId={job.id} />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── sub-components ─────────────────────────────────────────────────────

function JobsList({
  jobs,
  loading,
  selectedId,
  onSelect,
}: {
  jobs: SeoCrawlJob[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
        <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
        No crawls yet.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Recent crawls
      </h3>
      <ul className="space-y-1">
        {jobs.map((j) => (
          <li key={j.id}>
            <button
              onClick={() => onSelect(j.id)}
              className={`flex w-full flex-col rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                selectedId === j.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <span className="flex items-center justify-between">
                <span className="font-medium text-gray-900">
                  {formatDate(j.createdAt)}
                </span>
                <StatusBadge status={j.status} />
              </span>
              <span className="text-xs text-gray-500">
                {j.completedUrls}/{j.urlLimit} URLs · {j.errorCount} errors
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JobSummary({
  job,
  onCancel,
  canceling,
  onExport,
}: {
  job: SeoCrawlJob;
  onCancel: () => void;
  canceling: boolean;
  onExport: () => void;
}) {
  const isActive = job.status === "PENDING" || job.status === "RUNNING";
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <StatusBadge status={job.status} />
            <span className="text-sm text-gray-600">
              Started {formatDate(job.startedAt ?? job.createdAt)}
            </span>
          </div>
          <h3 className="mt-1 text-base font-semibold text-gray-900">
            {job.startUrl}
          </h3>
          {job.failureReason && (
            <p className="mt-2 text-sm text-red-600">
              Failure: {job.failureReason}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {isActive && (
            <button
              onClick={onCancel}
              disabled={canceling}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {canceling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <StopCircle className="h-4 w-4" />
              )}
              Cancel
            </button>
          )}
          {job.status === "COMPLETED" && (
            <button
              onClick={onExport}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-5">
        <Stat label="URLs crawled" value={job.completedUrls.toString()} />
        <Stat
          label="Errors"
          value={job.errorCount.toString()}
          tone={job.errorCount > 0 ? "danger" : "neutral"}
        />
        <Stat
          label="Warnings"
          value={job.warningCount.toString()}
          tone={job.warningCount > 0 ? "warn" : "neutral"}
        />
        <Stat label="Info" value={job.infoCount.toString()} />
        <Stat
          label="Broken links"
          value={job.brokenLinkCount.toString()}
          tone={job.brokenLinkCount > 0 ? "danger" : "neutral"}
        />
      </div>

      {isActive && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Progress: {job.completedUrls} / {job.urlLimit} URLs
            </span>
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Running…
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all"
              style={{
                width: `${Math.min(
                  100,
                  Math.round((job.completedUrls / job.urlLimit) * 100),
                )}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function IssuesPanel({
  issues,
  loading,
  severityFilter,
  onSeverityChange,
}: {
  issues: SeoCrawlIssue[];
  loading: boolean;
  severityFilter: SeoCrawlIssueSeverity | "ALL";
  onSeverityChange: (s: SeoCrawlIssueSeverity | "ALL") => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Issues</h3>
        <div className="flex items-center gap-1 rounded-md bg-gray-100 p-0.5 text-xs">
          {(["ALL", "ERROR", "WARNING", "INFO"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onSeverityChange(s)}
              className={`rounded px-2 py-1 font-medium transition-colors ${
                severityFilter === s
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {s === "ALL" ? "All" : capitalize(s)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-gray-500">
          <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : issues.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-gray-600">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          No issues at this severity. Great work.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {issues.map((iss) => (
            <li key={iss.id} className="py-3">
              <div className="flex items-start gap-3">
                <SeverityIcon severity={iss.severity} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {iss.message}
                    </span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono uppercase text-gray-600">
                      {iss.code}
                    </span>
                  </div>
                  {iss.result?.url && (
                    <a
                      href={iss.result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-xs text-blue-600 hover:underline"
                    >
                      {iss.result.url}
                    </a>
                  )}
                  {iss.recommendation && (
                    <p className="mt-1 text-xs text-gray-600">
                      {iss.recommendation}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultsTable({
  results,
  loading,
}: {
  results: SeoCrawlUrlResult[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <Loader2 className="inline h-4 w-4 animate-spin" /> Loading pages…
      </div>
    );
  }
  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
        <Search className="mb-2 h-4 w-4 text-gray-400" />
        No problem pages — every URL passed validation.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-3">
        <h3 className="text-base font-semibold text-gray-900">
          Pages with issues
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">URL</th>
              <th className="px-4 py-2 text-right">Status</th>
              <th className="px-4 py-2 text-right">Errors</th>
              <th className="px-4 py-2 text-right">Warnings</th>
              <th className="px-4 py-2 text-right">Words</th>
              <th className="px-4 py-2 text-right">Resp ms</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {results.map((r) => (
              <tr key={r.id}>
                <td className="max-w-md truncate px-4 py-2">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {r.pathname || "/"}
                  </a>
                </td>
                <td
                  className={`px-4 py-2 text-right font-mono ${
                    r.statusCode >= 400 ? "text-red-600" : "text-gray-700"
                  }`}
                >
                  {r.statusCode}
                </td>
                <td className="px-4 py-2 text-right">{r.errorCount}</td>
                <td className="px-4 py-2 text-right">{r.warningCount}</td>
                <td className="px-4 py-2 text-right">{r.wordCount}</td>
                <td className="px-4 py-2 text-right">
                  {r.responseTimeMs ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── tiny helpers ─────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warn" | "danger";
}) {
  const color =
    tone === "danger"
      ? "text-red-600"
      : tone === "warn"
        ? "text-amber-600"
        : "text-gray-900";
  return (
    <div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: SeoCrawlJob["status"] }) {
  const map: Record<SeoCrawlJob["status"], string> = {
    PENDING: "bg-gray-100 text-gray-700",
    RUNNING: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
    CANCELED: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${map[status]}`}
    >
      {status === "RUNNING" && (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      )}
      {status}
    </span>
  );
}

function SeverityIcon({ severity }: { severity: SeoCrawlIssueSeverity }) {
  if (severity === "ERROR")
    return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />;
  if (severity === "WARNING")
    return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />;
  return <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4" />
      <span>{message}</span>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function extractErrorMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "object" && err !== null) {
    const e = err as { response?: { data?: { message?: string } } };
    if (e.response?.data?.message) return e.response.data.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

// ── Link graph panel (Phase A.3) ─────────────────────────────────────────

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-blue-600 text-blue-700"
          : "border-transparent text-gray-500 hover:text-gray-800"
      }`}
    >
      {label}
    </button>
  );
}

function LinkGraphPanel({ siteId, jobId }: { siteId: string; jobId: string }) {
  const [drawerResultId, setDrawerResultId] = useState<string | null>(null);
  const graphQuery = useQuery({
    queryKey: ["seo", "crawler", "link-graph", siteId, jobId],
    queryFn: () => getSeoCrawlLinkGraph(siteId, jobId, 25),
    enabled: Boolean(jobId),
  });

  if (graphQuery.isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <Loader2 className="inline h-4 w-4 animate-spin" /> Building link graph…
      </div>
    );
  }
  if (graphQuery.error || !graphQuery.data) {
    return <ErrorBanner message={extractErrorMessage(graphQuery.error)} />;
  }

  const graph = graphQuery.data;
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">
          Link graph overview
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Internal linking gives search engines a map of your site. Pages with
          many inbound links are stronger hubs; pages with none are orphans.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Pages" value={graph.totals.totalUrls.toString()} />
          <Stat
            label="Indexable"
            value={graph.totals.indexablePages.toString()}
          />
          <Stat
            label="Internal links"
            value={graph.totals.internalLinks.toString()}
          />
          <Stat
            label="External links"
            value={graph.totals.externalLinks.toString()}
          />
          <Stat
            label="Ext. domains"
            value={graph.totals.uniqueExternalDomains.toString()}
          />
          <Stat
            label="Broken internal"
            value={graph.brokenInternalLinks.length.toString()}
            tone={graph.brokenInternalLinks.length > 0 ? "danger" : "neutral"}
          />
        </div>
      </div>

      <LinkGraphRankingTable
        title="Top hubs (most inbound internal links)"
        rows={graph.topInbound}
        onSelect={(id) => setDrawerResultId(id)}
      />

      <LinkGraphRankingTable
        title="Top authorities (most outbound internal links)"
        rows={graph.topOutbound}
        onSelect={(id) => setDrawerResultId(id)}
      />

      <LinkGraphDepthTable
        title="Deepest pages"
        emptyHint="All crawled pages are within a shallow depth."
        rows={graph.deepestPages}
        onSelect={(id) => setDrawerResultId(id)}
      />

      <LinkGraphDepthTable
        title="Orphan pages (no inbound internal links)"
        emptyHint="No orphans detected — every crawled page is linked from another."
        rows={graph.orphanPages}
        onSelect={(id) => setDrawerResultId(id)}
        tone="warn"
      />

      <BrokenLinksTable rows={graph.brokenInternalLinks} />

      {drawerResultId && (
        <PageLinksDrawer
          siteId={siteId}
          jobId={jobId}
          resultId={drawerResultId}
          onClose={() => setDrawerResultId(null)}
        />
      )}
    </div>
  );
}

function LinkGraphRankingTable({
  title,
  rows,
  onSelect,
}: {
  title: string;
  rows: SeoCrawlLinkGraph["topInbound"];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-3">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-sm text-gray-500">No data yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">URL</th>
                <th className="px-4 py-2 text-right">Depth</th>
                <th className="px-4 py-2 text-right">Status</th>
                <th className="px-4 py-2 text-right">Links</th>
                <th className="px-4 py-2 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {rows.map((r) => (
                <tr key={r.resultId}>
                  <td className="max-w-md truncate px-4 py-2 font-mono text-xs">
                    {r.pathname || "/"}
                  </td>
                  <td className="px-4 py-2 text-right">{r.depth}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {r.statusCode}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {r.count}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => onSelect(r.resultId)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      View links
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LinkGraphDepthTable({
  title,
  emptyHint,
  rows,
  onSelect,
  tone,
}: {
  title: string;
  emptyHint: string;
  rows: SeoCrawlLinkGraph["deepestPages"];
  onSelect: (id: string) => void;
  tone?: "warn";
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-3">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-sm text-gray-500">{emptyHint}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">URL</th>
                <th className="px-4 py-2 text-right">Depth</th>
                <th className="px-4 py-2 text-right">Status</th>
                <th className="px-4 py-2 text-right">Indexable</th>
                <th className="px-4 py-2 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {rows.map((r) => (
                <tr key={r.resultId}>
                  <td className="max-w-md truncate px-4 py-2 font-mono text-xs">
                    {r.pathname || "/"}
                  </td>
                  <td
                    className={`px-4 py-2 text-right ${
                      tone === "warn" ? "font-semibold text-amber-700" : ""
                    }`}
                  >
                    {r.depth}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {r.statusCode}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.indexable ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => onSelect(r.resultId)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      View links
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BrokenLinksTable({
  rows,
}: {
  rows: SeoCrawlLinkGraph["brokenInternalLinks"];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-3">
        <h3 className="text-base font-semibold text-gray-900">
          Broken internal links
        </h3>
      </div>
      {rows.length === 0 ? (
        <div className="flex items-center gap-2 p-6 text-sm text-gray-600">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          No broken internal links detected.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">From</th>
                <th className="px-4 py-2 text-left">Anchor</th>
                <th className="px-4 py-2 text-left">To</th>
                <th className="px-4 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {rows.map((r) => (
                <tr key={r.linkId}>
                  <td className="max-w-xs truncate px-4 py-2 font-mono text-xs">
                    {r.sourcePathname || "/"}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 text-xs">
                    {r.anchorText || (
                      <span className="italic text-gray-400">(no anchor)</span>
                    )}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 font-mono text-xs">
                    {r.targetUrl}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-red-600">
                    {r.targetStatusCode ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PageLinksDrawer({
  siteId,
  jobId,
  resultId,
  onClose,
}: {
  siteId: string;
  jobId: string;
  resultId: string;
  onClose: () => void;
}) {
  const linksQuery = useQuery({
    queryKey: ["seo", "crawler", "page-links", siteId, jobId, resultId],
    queryFn: () => getSeoCrawlPageLinks(siteId, jobId, resultId, 200),
  });

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-gray-900/40"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-gray-900">
              Page links
            </h3>
            {linksQuery.data?.result.url && (
              <p className="truncate text-xs text-gray-500">
                {linksQuery.data.result.url}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-gray-200 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="p-6">
          {linksQuery.isLoading ? (
            <div className="text-sm text-gray-500">
              <Loader2 className="inline h-4 w-4 animate-spin" /> Loading links…
            </div>
          ) : linksQuery.error || !linksQuery.data ? (
            <ErrorBanner message={extractErrorMessage(linksQuery.error)} />
          ) : (
            <PageLinksContent data={linksQuery.data} />
          )}
        </div>
      </div>
    </div>
  );
}

function PageLinksContent({ data }: { data: SeoPageLinks }) {
  return (
    <div className="space-y-6">
      <section>
        <h4 className="text-sm font-semibold text-gray-900">
          Inbound ({data.inboundCount}
          {data.truncated.inbound && ` · showing ${data.inbound.length}`})
        </h4>
        {data.inbound.length === 0 ? (
          <p className="mt-2 text-sm text-amber-700">
            No inbound internal links — this page is an orphan.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
            {data.inbound.map((l) => (
              <li key={l.id} className="px-3 py-2 text-sm">
                <div className="truncate font-mono text-xs text-gray-700">
                  {l.sourcePathname || "/"}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  <span className="italic">
                    {l.anchorText || "(no anchor)"}
                  </span>
                  {l.nofollow && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                      nofollow
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-900">
          Outbound ({data.outboundCount}
          {data.truncated.outbound && ` · showing ${data.outbound.length}`})
        </h4>
        {data.outbound.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No outbound links from this page.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
            {data.outbound.map((l) => (
              <li key={l.id} className="px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs text-gray-700">
                    {l.isInternal ? l.targetPathname || "/" : l.targetUrl}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                      l.isInternal
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {l.isInternal ? "internal" : "external"}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                  <span className="italic">
                    {l.anchorText || "(no anchor)"}
                  </span>
                  {l.nofollow && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                      nofollow
                    </span>
                  )}
                  {l.targetStatusCode != null && (
                    <span
                      className={`font-mono ${
                        l.targetStatusCode >= 400 ? "text-red-600" : ""
                      }`}
                    >
                      {l.targetStatusCode}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
