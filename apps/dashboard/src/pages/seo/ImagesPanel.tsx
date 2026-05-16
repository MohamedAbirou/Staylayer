import { useMemo, useState } from "react";
import type React from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getSeoImageJobSummary,
  getSeoImagePageFindings,
  listSeoCrawlJobs,
  listSeoImagePages,
  type SeoImageFinding,
} from "../../api/seo";

interface Props {
  siteId: string;
}

const FLAG_LABEL: Record<string, string> = {
  missing_alt: "Missing alt",
  empty_alt: "Empty alt",
  filename_alt: "Alt looks like filename",
  alt_too_short: "Alt too short",
  alt_too_long: "Alt too long",
  missing_dimensions: "Missing width & height",
  missing_width: "Missing width",
  missing_height: "Missing height",
  above_fold_lazy: "Above-fold image lazy-loaded",
  below_fold_eager: "Below-fold image not lazy",
  og_too_small: "OG image too small",
  og_aspect_off: "OG aspect ratio off (1.91:1)",
  og_missing: "No og:image declared",
  not_in_sitemap: "Image not in sitemap",
};

function formatFlag(flag: string): string {
  return FLAG_LABEL[flag] ?? flag;
}

export function ImagesPanel({ siteId }: Props): React.ReactElement {
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["seo-crawl-jobs", siteId, "for-images"],
    queryFn: () => listSeoCrawlJobs(siteId, 10),
    enabled: !!siteId,
  });

  const latestJob = useMemo(
    () =>
      (jobsQuery.data ?? []).find((j) => j.status === "COMPLETED") ??
      jobsQuery.data?.[0] ??
      null,
    [jobsQuery.data],
  );

  const jobId = latestJob?.id ?? null;

  const summaryQuery = useQuery({
    queryKey: ["seo-image-summary", siteId, jobId],
    queryFn: () => getSeoImageJobSummary(siteId, jobId!),
    enabled: !!jobId,
  });

  const pagesQuery = useQuery({
    queryKey: ["seo-image-pages", siteId, jobId],
    queryFn: () => listSeoImagePages(siteId, jobId!, { limit: 100 }),
    enabled: !!jobId,
  });

  const findingsQuery = useQuery({
    queryKey: ["seo-image-findings", siteId, jobId, selectedResultId],
    queryFn: () =>
      getSeoImagePageFindings(siteId, jobId!, selectedResultId!, 100),
    enabled: !!jobId && !!selectedResultId,
  });

  if (jobsQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
        Loading crawl jobs…
      </div>
    );
  }

  if (!latestJob) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8">
        <h2 className="text-lg font-semibold text-gray-900">Images</h2>
        <p className="mt-2 text-sm text-gray-600">
          Run a site crawl to populate the image audit. The audit inspects alt
          text, filenames, dimensions, lazy-loading hints, og:image quality, and
          sitemap coverage for every page.
        </p>
      </div>
    );
  }

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Images</h2>
          <span className="text-xs text-gray-500">
            Crawl {latestJob.id.slice(0, 8)} ·{" "}
            <span className="font-medium">{latestJob.status}</span>
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Image SEO findings from the most recent site crawl. Click a page to
          drill into individual image issues.
        </p>

        {summaryQuery.isLoading && (
          <p className="mt-4 text-sm text-gray-500">Loading summary…</p>
        )}
        {summary && (
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryCard label="Total images" value={summary.imageTotal} />
            <SummaryCard
              label="Missing alt"
              value={summary.imageMissingAlt}
              tone={summary.imageMissingAlt > 0 ? "danger" : "ok"}
            />
            <SummaryCard
              label="Filename-like alt"
              value={summary.imageFilenameAlt}
              tone={summary.imageFilenameAlt > 0 ? "warn" : "ok"}
            />
            <SummaryCard
              label="Missing dims"
              value={summary.imageMissingDims}
              tone={summary.imageMissingDims > 0 ? "warn" : "ok"}
            />
            <SummaryCard
              label="Not lazy (below fold)"
              value={summary.imageNotLazy}
              tone={summary.imageNotLazy > 0 ? "warn" : "ok"}
            />
            <SummaryCard
              label="OG too small"
              value={summary.imageUndersizedOg}
              tone={summary.imageUndersizedOg > 0 ? "warn" : "ok"}
            />
            <SummaryCard
              label="OG missing"
              value={summary.imageOversizedOg}
              tone={summary.imageOversizedOg > 0 ? "warn" : "ok"}
            />
            <SummaryCard
              label="Not in sitemap"
              value={summary.imageMissingSitemap}
              tone={summary.imageMissingSitemap > 0 ? "warn" : "ok"}
            />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Pages with image issues
            </h3>
            <p className="text-xs text-gray-500">
              Sorted by issue severity, worst first.
            </p>
          </div>
          {pagesQuery.isLoading && (
            <p className="px-5 py-4 text-sm text-gray-500">Loading…</p>
          )}
          {pagesQuery.data && pagesQuery.data.items.length === 0 && (
            <p className="px-5 py-4 text-sm text-gray-500">
              No image issues found.
            </p>
          )}
          {pagesQuery.data && pagesQuery.data.items.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {pagesQuery.data.items.map((row) => {
                const isSelected = row.resultId === selectedResultId;
                return (
                  <li key={row.resultId}>
                    <button
                      type="button"
                      onClick={() => setSelectedResultId(row.resultId)}
                      className={`flex w-full items-start justify-between gap-3 px-5 py-3 text-left transition-colors ${
                        isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {row.pathname || row.url}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {row.url}
                        </p>
                      </div>
                      <div className="flex flex-col items-end text-xs">
                        <span className="font-semibold text-red-600">
                          {row.imageFindingsIssues} issues
                        </span>
                        <span className="text-gray-500">
                          {row.imageFindingsTotal} imgs ·{" "}
                          {row.imageFindingsMissing} missing
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="lg:col-span-3 rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Findings</h3>
            <p className="text-xs text-gray-500">
              {selectedResultId
                ? "Image-by-image audit for the selected page."
                : "Select a page to inspect its image audit."}
            </p>
          </div>
          {selectedResultId && findingsQuery.isLoading && (
            <p className="px-5 py-4 text-sm text-gray-500">Loading findings…</p>
          )}
          {findingsQuery.data && (
            <FindingsList findings={findingsQuery.data.findings} />
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "ok" | "warn" | "danger";
}): React.ReactElement {
  const colors: Record<string, string> = {
    neutral: "border-gray-200 bg-gray-50 text-gray-900",
    ok: "border-green-200 bg-green-50 text-green-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${colors[tone] ?? colors.neutral}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

function FindingsList({
  findings,
}: {
  findings: SeoImageFinding[];
}): React.ReactElement {
  if (findings.length === 0) {
    return (
      <p className="px-5 py-4 text-sm text-gray-500">
        No findings on this page.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-gray-100">
      {findings.map((f) => (
        <li key={f.id} className="px-5 py-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gray-900">
                {f.filename || f.src || "(og:image)"}
                {f.isOgImage && (
                  <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                    og:image
                  </span>
                )}
                {f.aboveFold && (
                  <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                    above the fold
                  </span>
                )}
              </p>
              {f.src && (
                <p className="truncate text-xs text-gray-500">{f.src}</p>
              )}
              <p className="mt-1 text-xs text-gray-600">
                <span className="font-medium">Alt:</span>{" "}
                {f.alt ? `"${f.alt}"` : <em>missing</em>} ·{" "}
                <span className="font-medium">Dims:</span> {f.widthAttr ?? "?"}×
                {f.heightAttr ?? "?"} ·{" "}
                <span className="font-medium">Loading:</span>{" "}
                {f.loadingAttr ?? "auto"} ·{" "}
                <span className="font-medium">In sitemap:</span>{" "}
                {f.inSitemap ? "yes" : "no"}
              </p>
              {f.flags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {f.flags.map((flag) => (
                    <span
                      key={flag}
                      className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700"
                    >
                      {formatFlag(flag)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
