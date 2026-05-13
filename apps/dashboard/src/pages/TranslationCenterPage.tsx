import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Languages,
  Play,
  CircleCheck as CheckCircle2,
  TriangleAlert as AlertTriangle,
  Clock,
  Loader as Loader2,
  RefreshCw,
  ThumbsUp,
  ChartBar as BarChart3,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { getBillingPlan } from "../api/billing";
import { getPages } from "../api/pages";
import {
  createTranslationJob,
  getTranslationJobs,
  getLocaleCompleteness,
  approveTranslationJob,
  retryTranslationJob,
  type TranslationJob,
  type TranslationJobStatus,
} from "../api/translation";
import { formatDate } from "../lib/formatDate";
import type { PageListItem } from "../lib/constants";

const STATUS_CONFIG: Record<
  TranslationJobStatus,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  QUEUED: { label: "Queued", color: "text-gray-500 bg-gray-100", icon: Clock },
  PROCESSING: {
    label: "Processing",
    color: "text-blue-700 bg-blue-100",
    icon: Loader2,
  },
  COMPLETED: {
    label: "Completed",
    color: "text-emerald-700 bg-emerald-100",
    icon: CheckCircle2,
  },
  FAILED: {
    label: "Failed",
    color: "text-red-700 bg-red-100",
    icon: AlertTriangle,
  },
  REVIEW_REQUIRED: {
    label: "Review Required",
    color: "text-amber-700 bg-amber-100",
    icon: AlertTriangle,
  },
  APPROVED: {
    label: "Approved",
    color: "text-emerald-700 bg-emerald-100",
    icon: ThumbsUp,
  },
};

const EMPTY_PAGE_LIST: PageListItem[] = [];

export default function TranslationCenterPage() {
  const { session } = useAuth();
  const siteId = session?.activeSite?.id ?? null;
  const tenantId = session?.activeTenant?.id ?? null;
  const queryClient = useQueryClient();

  const [showNewJob, setShowNewJob] = useState(false);
  const [sourceLocale, setSourceLocale] = useState("");
  const [targetLocale, setTargetLocale] = useState("");
  const [pageScope, setPageScope] = useState<"all" | "published" | "selected">(
    "all",
  );
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [autoPublish, setAutoPublish] = useState(true);

  const { data: completeness = [] } = useQuery({
    queryKey: ["translation", "completeness", siteId],
    queryFn: () => getLocaleCompleteness(siteId!),
    enabled: Boolean(siteId),
    refetchInterval: 30_000,
  });

  const { data: billingPlan, isLoading: billingPlanLoading } = useQuery({
    queryKey: ["translation", "plan", tenantId],
    queryFn: () => getBillingPlan(tenantId!),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["translation", "jobs", siteId],
    queryFn: () => getTranslationJobs(siteId!, { limit: 20 }),
    enabled: Boolean(siteId),
    refetchInterval: 10_000,
  });

  const { data: sourcePagesData, isLoading: sourcePagesLoading } = useQuery({
    queryKey: ["translation", "source-pages", siteId, sourceLocale],
    queryFn: () => getPages({ locale: sourceLocale, limit: 500 }),
    enabled: Boolean(siteId && showNewJob && sourceLocale),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createTranslationJob(siteId!, {
        sourceLocale,
        targetLocale,
        pageIds: pageScope === "selected" ? selectedPageIds : undefined,
        publishedOnly: pageScope === "published",
        overwrite,
        autoPublish,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["translation", "jobs", siteId],
      });
      setShowNewJob(false);
      setSourceLocale("");
      setTargetLocale("");
      setPageScope("all");
      setSelectedPageIds([]);
      setOverwrite(false);
      setAutoPublish(true);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (jobId: string) => approveTranslationJob(siteId!, jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["translation", "jobs", siteId],
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => retryTranslationJob(siteId!, jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["translation", "jobs", siteId],
      });
    },
  });

  const jobs = jobsData?.data ?? [];
  const sourceLocaleOptions = completeness
    .filter((locale) => locale.translated > 0)
    .map((locale) => locale.locale);
  const targetLocaleOptions = sourceLocale
    ? completeness
        .filter((locale) => locale.locale !== sourceLocale)
        .map((locale) => locale.locale)
    : [];
  const translationQuota =
    billingPlan?.limits.translationCharactersPerMonth ?? 0;
  const translationUsage =
    billingPlan?.usage.translationCharactersThisMonth ?? 0;
  const machineTranslationIncluded = !billingPlan || translationQuota > 0;
  const needsMoreLocales = completeness.length < 2;
  const hasSourceLocale = sourceLocaleOptions.length > 0;
  const localeCapReached = billingPlan
    ? completeness.length >= billingPlan.limits.locales
    : false;
  const translationBlocked =
    !machineTranslationIncluded || needsMoreLocales || !hasSourceLocale;
  const sourcePages = sourcePagesData?.data ?? EMPTY_PAGE_LIST;
  const selectedPageCount = selectedPageIds.length;
  const requiresPageSelection = pageScope === "selected";
  const allSourcePageIds = sourcePages.map((page) => page.id);
  const publishedSourcePages = sourcePages.filter((page) => page.published);
  const publishedSourcePageCount = publishedSourcePages.length;

  useEffect(() => {
    if (sourceLocale && !sourceLocaleOptions.includes(sourceLocale)) {
      setSourceLocale("");
    }
  }, [sourceLocale, sourceLocaleOptions]);

  useEffect(() => {
    if (targetLocale && !targetLocaleOptions.includes(targetLocale)) {
      setTargetLocale("");
    }
  }, [sourceLocale, targetLocale, targetLocaleOptions]);

  useEffect(() => {
    setPageScope("all");
    setSelectedPageIds([]);
  }, [sourceLocale]);

  useEffect(() => {
    if (!sourcePages.length) {
      setSelectedPageIds((current) => (current.length === 0 ? current : []));
      return;
    }

    const validIds = new Set(sourcePages.map((page) => page.id));
    setSelectedPageIds((current) => {
      const next = current.filter((pageId) => validIds.has(pageId));

      if (next.length === current.length) {
        return current;
      }

      return next;
    });
  }, [sourcePages]);

  function togglePageSelection(pageId: string) {
    setSelectedPageIds((current) =>
      current.includes(pageId)
        ? current.filter((id) => id !== pageId)
        : [...current, pageId],
    );
  }

  if (!siteId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Translation Center</h1>
        <p className="mt-2 text-sm text-gray-600">
          Select a site to manage translations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Translation Center
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Translate your site content into multiple languages with one click.
          </p>
        </div>
        <button
          onClick={() => {
            if (!translationBlocked) {
              setShowNewJob(true);
            }
          }}
          disabled={billingPlanLoading || translationBlocked}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-blue-700"
        >
          <Play className="h-4 w-4" />
          New translation
        </button>
      </div>

      {!billingPlanLoading && translationBlocked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="space-y-2">
              <div>
                <h2 className="text-sm font-semibold text-amber-900">
                  Translation is not available for this site yet
                </h2>
                <p className="mt-1 text-sm text-amber-800">
                  Resolve the blockers below before starting a machine
                  translation job.
                </p>
              </div>

              {!machineTranslationIncluded && billingPlan && (
                <p className="text-sm text-amber-800">
                  {billingPlan.planName} does not include machine translation.
                  This workspace has used {translationUsage.toLocaleString()} of{" "}
                  {translationQuota.toLocaleString()} translation characters
                  this month.
                </p>
              )}

              {needsMoreLocales && (
                <p className="text-sm text-amber-800">
                  Only {completeness.length} active locale
                  {completeness.length === 1 ? " is" : "s are"} configured for
                  this site. Add another locale in Settings to create a valid
                  translation target.
                  {localeCapReached && billingPlan
                    ? ` ${billingPlan.planName} currently caps this site at ${billingPlan.limits.locales} locale${billingPlan.limits.locales === 1 ? "" : "s"}, so a plan upgrade is required first.`
                    : ""}
                </p>
              )}

              {!hasSourceLocale && (
                <p className="text-sm text-amber-800">
                  Publish at least one page in a source locale before requesting
                  machine translation.
                </p>
              )}

              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  to="/settings"
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Open localization settings
                </Link>
                {!machineTranslationIncluded && (
                  <Link
                    to="/billing"
                    className="rounded-lg bg-amber-900 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-950"
                  >
                    Review plan options
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Locale Completeness */}
      {completeness.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">
              Locale Coverage
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {completeness.map((lc) => {
              const pct =
                lc.total > 0 ? Math.round((lc.translated / lc.total) * 100) : 0;
              return (
                <div
                  key={lc.locale}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 uppercase">
                      {lc.locale}
                    </span>
                    <span className="text-xs font-semibold text-gray-600">
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                    <span>
                      {lc.translated}/{lc.total} pages
                    </span>
                    {lc.stale > 0 && (
                      <span className="text-amber-600 font-medium">
                        {lc.stale} stale
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New job form */}
      {showNewJob && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Start a new translation job
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Source locale
              </label>
              <select
                value={sourceLocale}
                onChange={(e) => setSourceLocale(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select source...</option>
                {sourceLocaleOptions.map((locale) => (
                  <option key={locale} value={locale}>
                    {locale.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Target locale
              </label>
              <select
                value={targetLocale}
                onChange={(e) => setTargetLocale(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                disabled={!sourceLocale}
              >
                <option value="">
                  {sourceLocale
                    ? "Select target..."
                    : "Select a source first..."}
                </option>
                {targetLocaleOptions.map((locale) => (
                  <option key={locale} value={locale}>
                    {locale.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-600">
            Source locales require existing pages. Target locales must already
            be active in site settings.
          </div>
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="page-scope"
                  checked={pageScope === "all"}
                  onChange={() => setPageScope("all")}
                  className="border-gray-300"
                />
                Translate all pages in{" "}
                {sourceLocale
                  ? sourceLocale.toUpperCase()
                  : "the source locale"}
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="page-scope"
                  checked={pageScope === "published"}
                  onChange={() => setPageScope("published")}
                  disabled={
                    !sourceLocale ||
                    sourcePagesLoading ||
                    publishedSourcePageCount === 0
                  }
                  className="border-gray-300"
                />
                Translate published pages only
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="page-scope"
                  checked={pageScope === "selected"}
                  onChange={() => setPageScope("selected")}
                  disabled={
                    !sourceLocale ||
                    sourcePagesLoading ||
                    sourcePages.length === 0
                  }
                  className="border-gray-300"
                />
                Translate selected pages only
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-600">
              Choose whether the job should include all source pages, only
              published pages, or a hand-picked page set.
            </p>

            {pageScope === "published" && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                This job will translate {publishedSourcePageCount} published
                page{publishedSourcePageCount === 1 ? "" : "s"} from the{" "}
                {sourceLocale.toUpperCase()} locale and exclude drafts.
              </div>
            )}

            {pageScope === "selected" && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900">
                    Choose pages to translate
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedPageIds(allSourcePageIds)}
                      disabled={sourcePagesLoading || sourcePages.length === 0}
                      className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPageIds([])}
                      disabled={selectedPageCount === 0}
                      className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {selectedPageCount} of {sourcePages.length} page
                  {sourcePages.length === 1 ? "" : "s"} selected.
                </p>

                {sourcePagesLoading ? (
                  <div className="mt-3 flex items-center text-sm text-gray-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading source pages...
                  </div>
                ) : sourcePages.length === 0 ? (
                  <div className="mt-3 rounded-md border border-dashed border-gray-200 bg-white px-3 py-4 text-sm text-gray-500">
                    No pages were found in this source locale.
                  </div>
                ) : (
                  <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {sourcePages.map((page) => (
                      <PageSelectionRow
                        key={page.id}
                        page={page}
                        checked={selectedPageIds.includes(page.id)}
                        onToggle={() => togglePageSelection(page.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="rounded border-gray-300"
              />
              Overwrite existing translations
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="rounded border-gray-300"
              />
              Publish translated pages when the job completes
            </label>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Leave this on to make translated pages available on the live site as
            soon as the job finishes.
          </div>
          {createMutation.isError && (
            <p className="mt-3 text-xs text-red-600">
              {(
                createMutation.error as {
                  response?: { data?: { message?: string } };
                }
              )?.response?.data?.message ?? "Translation job failed to start."}
            </p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => createMutation.mutate()}
              disabled={
                !sourceLocale ||
                !targetLocale ||
                createMutation.isPending ||
                (requiresPageSelection && selectedPageCount === 0) ||
                (pageScope === "published" && publishedSourcePageCount === 0)
              }
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-blue-700"
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Start translation
            </button>
            <button
              onClick={() => setShowNewJob(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Jobs list */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Translation History
          </h2>
        </div>
        {jobsLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading jobs...
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Languages className="h-8 w-8 text-gray-200" />
            <p className="mt-3 text-sm text-gray-500">
              No translation jobs yet
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Start your first translation to reach guests in their language.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onApprove={() => approveMutation.mutate(job.id)}
                onRetry={() => retryMutation.mutate(job.id)}
                isApprovePending={approveMutation.isPending}
                isRetryPending={retryMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PageSelectionRow({
  page,
  checked,
  onToggle,
}: {
  page: PageListItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 hover:border-blue-200 hover:bg-blue-50/40">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 rounded border-gray-300"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {page.title}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase text-gray-600">
            /{page.slug}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              page.published
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {page.published ? "Published" : "Draft"}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Last updated {formatDate(page.updatedAt)}
        </p>
      </div>
    </label>
  );
}

function JobRow({
  job,
  onApprove,
  onRetry,
  isApprovePending,
  isRetryPending,
}: {
  job: TranslationJob;
  onApprove: () => void;
  onRetry: () => void;
  isApprovePending: boolean;
  isRetryPending: boolean;
}) {
  const cfg = STATUS_CONFIG[job.status];
  const Icon = cfg.icon;
  const progress =
    job.totalPages > 0
      ? Math.round((job.completedPages / job.totalPages) * 100)
      : 0;

  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.color}`}
        >
          <Icon
            className={`h-3.5 w-3.5 ${job.status === "PROCESSING" ? "animate-spin" : ""}`}
          />
          {cfg.label}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">
            {job.sourceLocale.toUpperCase()} → {job.targetLocale.toUpperCase()}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {job.completedPages}/{job.totalPages} pages
            {job.charactersUsed > 0 &&
              ` · ${job.charactersUsed.toLocaleString()} chars`}
            {job.autoPublish ? " · published live" : " · saved as drafts"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {(job.status === "PROCESSING" || job.status === "QUEUED") && (
          <div className="w-24">
            <div className="h-1.5 w-full rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {job.status === "REVIEW_REQUIRED" && (
          <button
            onClick={onApprove}
            disabled={isApprovePending}
            className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            <ThumbsUp className="h-3 w-3" />
            Approve
          </button>
        )}

        {job.status === "FAILED" && (
          <button
            onClick={onRetry}
            disabled={isRetryPending}
            className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        )}

        <span className="text-xs text-gray-400">
          {formatDate(job.createdAt)}
        </span>
      </div>
    </div>
  );
}
