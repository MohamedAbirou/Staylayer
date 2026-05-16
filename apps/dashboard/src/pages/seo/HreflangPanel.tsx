import { useMemo, useState, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Info,
  Languages,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

import {
  bulkCreateHreflangStubs,
  dismissHreflangIssue,
  getLatestHreflangScan,
  listHreflangIssues,
  runHreflangScan,
  undismissHreflangIssue,
  type HreflangIssue,
  type HreflangIssueSeverity,
  type HreflangIssueType,
} from "../../api/hreflang";

interface HreflangPanelProps {
  siteId: string;
}

const ISSUE_TYPE_LABELS: Record<HreflangIssueType, string> = {
  MISSING_LOCALE: "Missing locale",
  ORPHAN_ALTERNATE: "Orphan alternate",
  MISSING_X_DEFAULT: "Missing x-default",
  UNPUBLISHED_SIBLING: "Unpublished sibling",
  INVALID_LOCALE_CODE: "Invalid locale code",
};

const ISSUE_TYPE_DESCRIPTIONS: Record<HreflangIssueType, string> = {
  MISSING_LOCALE:
    "An active locale has no page for this slug. Visitors and crawlers see a 404 in that language.",
  ORPHAN_ALTERNATE:
    "A page exists in a locale that is not in the site's active locale list. It will be ignored by hreflang.",
  MISSING_X_DEFAULT:
    "The default locale page for this slug does not exist, so x-default cannot be generated.",
  UNPUBLISHED_SIBLING:
    "A translation exists but is still in draft. It will not be served until published.",
  INVALID_LOCALE_CODE:
    "Page locale is not in the supported locale set (en, es, fr, de, it, pt, nl, ar).",
};

const severityStyles: Record<HreflangIssueSeverity, string> = {
  ERROR: "bg-rose-50 text-rose-700 border border-rose-200",
  WARNING: "bg-amber-50 text-amber-700 border border-amber-200",
  INFO: "bg-sky-50 text-sky-700 border border-sky-200",
};

const severityIcon: Record<HreflangIssueSeverity, ReactElement> = {
  ERROR: <XCircle className="h-3.5 w-3.5" />,
  WARNING: <AlertTriangle className="h-3.5 w-3.5" />,
  INFO: <Info className="h-3.5 w-3.5" />,
};

const ALL_TYPES: HreflangIssueType[] = [
  "MISSING_LOCALE",
  "ORPHAN_ALTERNATE",
  "MISSING_X_DEFAULT",
  "UNPUBLISHED_SIBLING",
  "INVALID_LOCALE_CODE",
];

export function HreflangPanel({ siteId }: HreflangPanelProps) {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<HreflangIssueType | "ALL">(
    "ALL",
  );
  const [severityFilter, setSeverityFilter] = useState<
    HreflangIssueSeverity | "ALL"
  >("ALL");
  const [includeDismissed, setIncludeDismissed] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkResult, setBulkResult] = useState<{
    created: number;
    skipped: Array<{ slug: string; locale: string; reason: string }>;
  } | null>(null);

  const latestQuery = useQuery({
    queryKey: ["hreflang-latest", siteId],
    queryFn: () => getLatestHreflangScan(siteId),
  });

  const issuesQuery = useQuery({
    queryKey: [
      "hreflang-issues",
      siteId,
      typeFilter,
      severityFilter,
      includeDismissed,
    ],
    queryFn: () =>
      listHreflangIssues(siteId, {
        type: typeFilter === "ALL" ? undefined : typeFilter,
        severity: severityFilter === "ALL" ? undefined : severityFilter,
        includeDismissed,
        limit: 500,
      }),
    enabled: Boolean(latestQuery.data),
  });

  const runScan = useMutation({
    mutationFn: () => runHreflangScan(siteId),
    onSuccess: () => {
      setSelectedKeys(new Set());
      setBulkResult(null);
      void queryClient.invalidateQueries({
        queryKey: ["hreflang-latest", siteId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["hreflang-issues", siteId],
      });
    },
  });

  const dismiss = useMutation({
    mutationFn: (issueId: string) => dismissHreflangIssue(siteId, issueId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["hreflang-issues", siteId],
      });
    },
  });

  const undismiss = useMutation({
    mutationFn: (issueId: string) => undismissHreflangIssue(siteId, issueId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["hreflang-issues", siteId],
      });
    },
  });

  const bulkFix = useMutation({
    mutationFn: (pairs: Array<{ slug: string; locale: string }>) =>
      bulkCreateHreflangStubs(siteId, pairs),
    onSuccess: (data) => {
      setBulkResult({ created: data.created.length, skipped: data.skipped });
      setSelectedKeys(new Set());
      void queryClient.invalidateQueries({
        queryKey: ["hreflang-issues", siteId],
      });
    },
  });

  const issues = issuesQuery.data?.data ?? [];

  const selectableIssues = useMemo(
    () =>
      issues.filter(
        (issue) =>
          issue.type === "MISSING_LOCALE" &&
          issue.locale &&
          !issue.dismissedAt,
      ),
    [issues],
  );

  const issueKey = (issue: HreflangIssue) =>
    `${issue.slug}::${issue.locale ?? ""}`;

  const toggleSelect = (issue: HreflangIssue) => {
    const key = issueKey(issue);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === selectableIssues.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(selectableIssues.map(issueKey)));
    }
  };

  const runBulkFix = () => {
    if (selectedKeys.size === 0) return;
    const pairs: Array<{ slug: string; locale: string }> = [];
    for (const issue of selectableIssues) {
      if (selectedKeys.has(issueKey(issue)) && issue.locale) {
        pairs.push({ slug: issue.slug, locale: issue.locale });
      }
    }
    if (pairs.length === 0) return;
    bulkFix.mutate(pairs.slice(0, 50));
  };

  const scan = latestQuery.data;
  const scanning = runScan.isPending;
  const scanRunning = scan?.status === "RUNNING";

  return (
    <div className="space-y-6">
      {/* Header / Summary */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <Languages className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Hreflang Matrix
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-600">
                Validate per-page × per-locale coverage. Hreflang tags and
                x-default are auto-generated from your published pages — this
                scan detects gaps, orphans, and unpublished translations so
                Google indexes the right URLs.
              </p>
            </div>
          </div>
          <button
            onClick={() => runScan.mutate()}
            disabled={scanning}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {scanning ? "Scanning…" : "Run scan"}
          </button>
        </div>

        {latestQuery.isLoading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading latest scan…
          </div>
        ) : !scan ? (
          <div className="mt-6 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            No scan yet. Run your first hreflang scan to surface missing
            translations and orphans.
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard
              label="Status"
              value={
                scan.status === "COMPLETED" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Completed
                  </span>
                ) : scan.status === "FAILED" ? (
                  <span className="inline-flex items-center gap-1 text-rose-700">
                    <XCircle className="h-4 w-4" /> Failed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-indigo-700">
                    <Loader2 className="h-4 w-4 animate-spin" /> {scan.status}
                  </span>
                )
              }
              sub={new Date(scan.createdAt).toLocaleString()}
            />
            <SummaryCard
              label="Slugs scanned"
              value={<span className="text-gray-900">{scan.totalSlugs}</span>}
              sub={`${scan.totalPages} pages`}
            />
            <SummaryCard
              label="Errors"
              value={
                <span className="text-rose-700">{scan.errorCount}</span>
              }
              sub="Block indexing of correct locale"
            />
            <SummaryCard
              label="Warnings"
              value={
                <span className="text-amber-700">{scan.warningCount}</span>
              }
              sub="Coverage gaps"
            />
            <SummaryCard
              label="Info"
              value={<span className="text-sky-700">{scan.infoCount}</span>}
              sub="Drafts or notices"
            />
          </div>
        )}

        {scan?.failureReason ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <strong>Last scan failed:</strong> {scan.failureReason}
          </div>
        ) : null}

        {scan ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <Globe className="h-3.5 w-3.5" />
            <span>
              Default <strong className="text-gray-700">{scan.defaultLocale}</strong>
            </span>
            <span className="text-gray-300">•</span>
            <span>
              Active locales:{" "}
              <strong className="text-gray-700">
                {scan.activeLocales.join(", ")}
              </strong>
            </span>
          </div>
        ) : null}
      </div>

      {/* Bulk fix result */}
      {bulkResult ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="font-semibold">
            Created {bulkResult.created} stub page
            {bulkResult.created === 1 ? "" : "s"}.
          </div>
          {bulkResult.skipped.length > 0 ? (
            <div className="mt-2 text-xs text-emerald-900/80">
              Skipped {bulkResult.skipped.length}:{" "}
              {bulkResult.skipped
                .slice(0, 5)
                .map((s) => `${s.slug}/${s.locale} (${s.reason})`)
                .join(", ")}
              {bulkResult.skipped.length > 5 ? "…" : ""}
            </div>
          ) : null}
          <button
            onClick={() => setBulkResult(null)}
            className="mt-2 text-xs font-medium text-emerald-900 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Filters & bulk action bar */}
      {scan ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Type:
            </span>
            <FilterChip
              active={typeFilter === "ALL"}
              onClick={() => setTypeFilter("ALL")}
              label="All"
            />
            {ALL_TYPES.map((t) => (
              <FilterChip
                key={t}
                active={typeFilter === t}
                onClick={() => setTypeFilter(t)}
                label={ISSUE_TYPE_LABELS[t]}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Severity:
            </span>
            <FilterChip
              active={severityFilter === "ALL"}
              onClick={() => setSeverityFilter("ALL")}
              label="All"
            />
            <FilterChip
              active={severityFilter === "ERROR"}
              onClick={() => setSeverityFilter("ERROR")}
              label="Errors"
            />
            <FilterChip
              active={severityFilter === "WARNING"}
              onClick={() => setSeverityFilter("WARNING")}
              label="Warnings"
            />
            <FilterChip
              active={severityFilter === "INFO"}
              onClick={() => setSeverityFilter("INFO")}
              label="Info"
            />
            <label className="ml-auto inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={includeDismissed}
                onChange={(e) => setIncludeDismissed(e.target.checked)}
                className="rounded border-gray-300"
              />
              Include dismissed
            </label>
          </div>

          {selectableIssues.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
              <div className="text-sm text-indigo-900">
                <strong>{selectedKeys.size}</strong> selected ·{" "}
                {selectableIssues.length} missing-locale issues can be auto-fixed
                by creating draft stub pages (max 50 per run).
              </div>
              <div className="flex gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                >
                  {selectedKeys.size === selectableIssues.length
                    ? "Clear"
                    : "Select all"}
                </button>
                <button
                  onClick={runBulkFix}
                  disabled={selectedKeys.size === 0 || bulkFix.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  {bulkFix.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Create stub pages
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Issues table */}
      {scan ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {issuesQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading issues…
            </div>
          ) : scanRunning ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Scan in progress…
            </div>
          ) : issues.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <div className="rounded-full bg-emerald-50 p-3 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="text-sm font-semibold text-gray-900">
                No issues found
              </div>
              <div className="text-xs text-gray-500">
                Every slug has full coverage across the active locales.
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2">Slug</th>
                  <th className="px-3 py-2">Locale</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Detail</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {issues.map((issue) => {
                  const selectable =
                    issue.type === "MISSING_LOCALE" &&
                    issue.locale &&
                    !issue.dismissedAt;
                  const key = issueKey(issue);
                  return (
                    <tr
                      key={issue.id}
                      className={
                        issue.dismissedAt
                          ? "bg-gray-50/60 text-gray-400"
                          : "hover:bg-gray-50"
                      }
                    >
                      <td className="px-3 py-2">
                        {selectable ? (
                          <input
                            type="checkbox"
                            checked={selectedKeys.has(key)}
                            onChange={() => toggleSelect(issue)}
                            className="rounded border-gray-300"
                          />
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">
                        /{issue.slug || ""}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {issue.locale ? (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700">
                            {issue.locale}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs font-medium text-gray-700">
                        {ISSUE_TYPE_LABELS[issue.type]}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityStyles[issue.severity]}`}
                        >
                          {severityIcon[issue.severity]}
                          {issue.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {ISSUE_TYPE_DESCRIPTIONS[issue.type]}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {issue.dismissedAt ? (
                          <button
                            onClick={() => undismiss.mutate(issue.id)}
                            disabled={undismiss.isPending}
                            className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => dismiss.mutate(issue.id)}
                            disabled={dismiss.isPending}
                            className="text-xs font-medium text-gray-500 hover:text-gray-800 hover:underline disabled:opacity-50"
                          >
                            Dismiss
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-gray-500">{sub}</div> : null}
    </div>
  );
}

function FilterChip({
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
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}
