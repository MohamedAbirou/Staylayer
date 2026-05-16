import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { getPages } from "../../api/pages";
import {
  analyzeAiCitation,
  getAiCitationOverview,
  getAiCitationReport,
  type AiCitationFinding,
  type AiCitationGrade,
  type AiCitationOverviewRow,
  type AiCitationReport,
  type AiCitationSeverity,
} from "../../api/seo";
import { SITE_ADMIN_MEMBERSHIP_ROLES, hasMembershipRole } from "../../auth/access";
import { useAuth } from "../../auth/useAuth";
import type { PageListItem } from "../../lib/constants";

interface Props {
  siteId: string;
}

const GRADE_COLORS: Record<AiCitationGrade, string> = {
  A: "bg-green-100 text-green-800 border-green-200",
  B: "bg-emerald-100 text-emerald-800 border-emerald-200",
  C: "bg-amber-100 text-amber-800 border-amber-200",
  D: "bg-orange-100 text-orange-800 border-orange-200",
  F: "bg-red-100 text-red-800 border-red-200",
};

const SEVERITY_ICON: Record<AiCitationSeverity, React.ReactElement> = {
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  info: <Info className="h-4 w-4 text-sky-500" />,
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
};

export function AiCitationPanel({ siteId }: Props): React.ReactElement {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const canReanalyze = hasMembershipRole(session, SITE_ADMIN_MEMBERSHIP_ROLES);
  const [selected, setSelected] = useState<{
    slug: string;
    locale: string;
  } | null>(null);
  const [pageKey, setPageKey] = useState("");

  const overviewQuery = useQuery({
    queryKey: ["seo", "ai-citation", "overview", siteId],
    queryFn: () => getAiCitationOverview(siteId),
    enabled: !!siteId,
  });

  const reportQuery = useQuery({
    queryKey: [
      "seo",
      "ai-citation",
      "report",
      siteId,
      selected?.slug,
      selected?.locale,
    ],
    queryFn: () =>
      getAiCitationReport(siteId, selected!.slug, selected!.locale),
    enabled: !!siteId && !!selected,
  });

  const pagesQuery = useQuery({
    queryKey: ["seo", "ai-citation", "pages", siteId],
    queryFn: () => getPages({ limit: 200 }),
    enabled: !!siteId,
  });

  const analyzeMutation = useMutation({
    mutationFn: async (row: { slug: string; locale: string }) =>
      analyzeAiCitation(siteId, row.slug, row.locale),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["seo", "ai-citation", "overview", siteId],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "seo",
          "ai-citation",
          "report",
          siteId,
          vars.slug,
          vars.locale,
        ],
      });
    },
  });

  const rows = overviewQuery.data?.rows ?? [];
  const averageScore = overviewQuery.data?.averageScore ?? null;
  const pageCount = overviewQuery.data?.pageCount ?? 0;
  const pageOptions = useMemo(
    () =>
      (pagesQuery.data?.data ?? [])
        .filter((page) => !page.deletedAt)
        .sort((a, b) => {
          if (a.locale !== b.locale) return a.locale.localeCompare(b.locale);
          return a.slug.localeCompare(b.slug);
        }),
    [pagesQuery.data?.data],
  );
  const selectedPageKey = pageKey || toPageKey(pageOptions[0]);
  const selectedPage = pageOptions.find(
    (page) => toPageKey(page) === selectedPageKey,
  );

  useEffect(() => {
    if (reportQuery.data) {
      queryClient.invalidateQueries({
        queryKey: ["seo", "ai-citation", "overview", siteId],
      });
    }
  }, [queryClient, reportQuery.data, siteId]);

  const openPageReport = (page: PageListItem) => {
    const next = { slug: page.slug, locale: page.locale };
    const isAlreadySelected =
      selected?.slug === next.slug && selected?.locale === next.locale;
    setSelected(next);
    if (isAlreadySelected) {
      void reportQuery.refetch();
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 text-purple-600" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              AI Citation Readiness
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Heuristic score for how citable each page is by LLM answer engines
              (ChatGPT, Perplexity, Gemini, Claude). We grade entity facts,
              answer-ready sections, freshness, robots permissions, and
              structured-data coverage.
            </p>
          </div>
        </div>
      </div>

      <SummaryCards
        pageCount={pageCount}
        averageScore={averageScore}
        rows={rows}
      />

      <PageAnalysisLauncher
        pages={pageOptions}
        isLoading={pagesQuery.isLoading}
        selectedKey={selectedPageKey}
        onSelectedKeyChange={setPageKey}
        onAnalyze={() => selectedPage && openPageReport(selectedPage)}
        disabled={!selectedPage || reportQuery.isLoading}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <OverviewTable
          rows={rows}
          isLoading={overviewQuery.isLoading}
          selected={selected}
          onSelect={(r) => setSelected({ slug: r.slug, locale: r.locale })}
          onAnalyze={(r) =>
            analyzeMutation.mutate({ slug: r.slug, locale: r.locale })
          }
          analyzingKey={
            analyzeMutation.isPending
              ? `${analyzeMutation.variables?.slug}|${analyzeMutation.variables?.locale}`
              : null
          }
          canReanalyze={canReanalyze}
        />

        <ReportPane
          siteId={siteId}
          selected={selected}
          data={reportQuery.data}
          isLoading={reportQuery.isLoading}
          onAnalyze={() =>
            selected &&
            analyzeMutation.mutate({
              slug: selected.slug,
              locale: selected.locale,
            })
          }
          isAnalyzing={analyzeMutation.isPending}
          canReanalyze={canReanalyze}
        />
      </div>
    </div>
  );
}

function toPageKey(page: Pick<PageListItem, "slug" | "locale"> | undefined) {
  return page ? `${page.slug}|${page.locale}` : "";
}

function PageAnalysisLauncher({
  pages,
  isLoading,
  selectedKey,
  onSelectedKeyChange,
  onAnalyze,
  disabled,
}: {
  pages: PageListItem[];
  isLoading: boolean;
  selectedKey: string;
  onSelectedKeyChange: (value: string) => void;
  onAnalyze: () => void;
  disabled: boolean;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Page to analyze</span>
          <select
            value={selectedKey}
            onChange={(event) => onSelectedKeyChange(event.target.value)}
            disabled={isLoading || pages.length === 0}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500 disabled:bg-gray-50 disabled:text-gray-400"
          >
            {pages.length === 0 ? (
              <option value="">
                {isLoading ? "Loading pages..." : "No pages available"}
              </option>
            ) : null}
            {pages.map((page) => (
              <option key={toPageKey(page)} value={toPageKey(page)}>
                [{page.locale}] /{page.slug} - {page.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={disabled}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          Analyze page
        </button>
      </div>
    </div>
  );
}

function SummaryCards({
  pageCount,
  averageScore,
  rows,
}: {
  pageCount: number;
  averageScore: number | null;
  rows: AiCitationOverviewRow[];
}): React.ReactElement {
  const highRisk = rows.filter((r) => r.score < 55).length;
  const strong = rows.filter((r) => r.score >= 85).length;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card label="Pages audited" value={pageCount.toString()} />
      <Card
        label="Average score"
        value={averageScore === null ? "—" : `${averageScore}/100`}
      />
      <Card
        label="Strong (A)"
        value={strong.toString()}
        tone="text-emerald-700"
      />
      <Card
        label="At risk (C-)"
        value={highRisk.toString()}
        tone={highRisk > 0 ? "text-red-700" : "text-gray-700"}
      />
    </div>
  );
}

function Card({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${tone ?? "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

function OverviewTable({
  rows,
  isLoading,
  selected,
  onSelect,
  onAnalyze,
  analyzingKey,
  canReanalyze,
}: {
  rows: AiCitationOverviewRow[];
  isLoading: boolean;
  selected: { slug: string; locale: string } | null;
  onSelect: (row: AiCitationOverviewRow) => void;
  onAnalyze: (row: AiCitationOverviewRow) => void;
  analyzingKey: string | null;
  canReanalyze: boolean;
}): React.ReactElement {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
        No AI citation audits yet. Choose a page above and run the first
        analysis.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">
              Page
            </th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">
              Score
            </th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">
              Top issue
            </th>
            <th className="px-3 py-2 text-right font-semibold text-gray-600" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => {
            const key = `${r.slug}|${r.locale}`;
            const isSelected =
              selected?.slug === r.slug && selected?.locale === r.locale;
            return (
              <tr
                key={key}
                className={`cursor-pointer hover:bg-gray-50 ${
                  isSelected ? "bg-purple-50/60" : ""
                }`}
                onClick={() => onSelect(r)}
              >
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-900">/{r.slug}</div>
                  <div className="text-xs text-gray-500">{r.locale}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${
                        GRADE_COLORS[r.grade]
                      }`}
                    >
                      {r.grade}
                    </span>
                    <span className="font-semibold text-gray-800">
                      {r.score}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {r.topIssue ?? (
                    <span className="text-emerald-700">No issues</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {canReanalyze ? (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onAnalyze(r);
                      }}
                      disabled={analyzingKey === key}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {analyzingKey === key ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Re-analyze
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReportPane({
  selected,
  data,
  isLoading,
  onAnalyze,
  isAnalyzing,
  canReanalyze,
}: {
  siteId: string;
  selected: { slug: string; locale: string } | null;
  data: AiCitationReport | undefined;
  isLoading: boolean;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  canReanalyze: boolean;
}): React.ReactElement {
  const findings = useMemo(
    () =>
      data
        ? [...data.findings].sort((a, b) => severityRank(a) - severityRank(b))
        : [],
    [data],
  );

  if (!selected) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
        Select a page from the list to see its detailed findings.
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading report…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            /{data.slug} · {data.locale}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-base font-bold ${
                GRADE_COLORS[data.grade]
              }`}
            >
              {data.grade}
            </span>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {data.score}
                <span className="ml-1 text-base font-normal text-gray-400">
                  /100
                </span>
              </p>
              <p className="text-xs text-gray-500">
                Analyzed {new Date(data.analyzedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        {canReanalyze ? (
          <button
            type="button"
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {isAnalyzing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Re-analyze
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-2">
        <SignalStat
          label="Entity facts"
          value={data.signals.entityFacts.count}
        />
        <SignalStat
          label="Answer-ready blocks"
          value={data.signals.answerReady.count}
        />
        <SignalStat label="Words" value={data.signals.wordCount} />
        <SignalStat
          label="Freshness"
          value={
            data.signals.freshness.daysSinceUpdate === null
              ? "Unknown"
              : `${data.signals.freshness.daysSinceUpdate} days (${data.signals.freshness.verdict})`
          }
        />
        <SignalStat
          label="Crawler"
          value={
            data.signals.robots.allowsCitation
              ? data.signals.robots.flags.length === 0
                ? "Fully open"
                : `OK (flags: ${data.signals.robots.flags.join(", ")})`
              : `Blocked (${data.signals.robots.flags.join(", ")})`
          }
        />
        <SignalStat
          label="Structured data"
          value={
            data.signals.structuredData.types.length === 0
              ? "None"
              : data.signals.structuredData.types.join(", ")
          }
        />
      </div>

      <div className="p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Findings ({findings.length})
        </p>
        {findings.length === 0 ? (
          <p className="text-sm text-gray-500">No findings.</p>
        ) : (
          <ul className="space-y-2">
            {findings.map((f, i) => (
              <FindingRow key={`${f.code}-${i}`} finding={f} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FindingRow({
  finding,
}: {
  finding: AiCitationFinding;
}): React.ReactElement {
  return (
    <li className="flex items-start gap-2 rounded-md border border-gray-100 bg-gray-50/60 p-3">
      <span className="mt-0.5">{SEVERITY_ICON[finding.severity]}</span>
      <div className="flex-1">
        <p className="text-sm text-gray-800">{finding.message}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          <span className="font-mono">{finding.code}</span>
          {finding.locator ? ` · ${finding.locator}` : ""}
          {finding.delta !== 0 ? (
            <span
              className={`ml-2 font-semibold ${
                finding.delta > 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {finding.delta > 0 ? `+${finding.delta}` : finding.delta} pts
            </span>
          ) : null}
        </p>
      </div>
    </li>
  );
}

function SignalStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}): React.ReactElement {
  return (
    <div className="rounded-md border border-gray-100 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

function severityRank(f: AiCitationFinding): number {
  switch (f.severity) {
    case "error":
      return 0;
    case "warning":
      return 1;
    case "info":
      return 2;
    case "success":
      return 3;
  }
}
