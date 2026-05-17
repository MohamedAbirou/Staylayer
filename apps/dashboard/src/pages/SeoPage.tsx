import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Info,
  Plus,
  Trash2,
  Upload,
  Loader as Loader2,
  ToggleLeft,
  ToggleRight,
  MapPin,
  Building,
  Phone,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { getPages, updatePage } from "../api/pages";
import {
  getRedirects,
  createRedirect,
  toggleRedirect,
  deleteRedirect,
  validatePageSeo,
  getStructuredData,
  upsertStructuredData,
  getRedirectAnalysis,
  exportRedirectsCsv,
  importRedirectsCsv,
  type StructuredDataDto,
  type StructuredOffer,
  type StructuredRoomType,
  type RedirectImportMode,
  type RedirectImportSummary,
} from "../api/seo";
import { useSettings } from "../hooks/useSettings";
import { RobotsSitemapPanel } from "./seo/RobotsSitemapPanel";
import { IndexNowPanel } from "./seo/IndexNowPanel";
import { SiteCrawlPanel } from "./seo/SiteCrawlPanel";
import { SearchConsolePanel } from "./seo/SearchConsolePanel";
import { BingWebmasterPanel } from "./seo/BingWebmasterPanel";
import { PsiPanel } from "./seo/PsiPanel";
import { HreflangPanel } from "./seo/HreflangPanel";
import { PageSchemaPanel } from "./seo/PageSchemaPanel";
import { ImagesPanel } from "./seo/ImagesPanel";
import { PreviewsPanel } from "./seo/PreviewsPanel";
import { AiCitationPanel } from "./seo/AiCitationPanel";
import { ScheduledAuditsPanel } from "./seo/ScheduledAuditsPanel";
import { AuditTasksPanel } from "./seo/AuditTasksPanel";

type Tab =
  | "audit"
  | "redirects"
  | "structured-data"
  | "robots"
  | "indexnow"
  | "site-crawl"
  | "search-console"
  | "bing-webmaster"
  | "psi"
  | "hreflang"
  | "page-schema"
  | "images"
  | "previews"
  | "ai-citation"
  | "scheduled-audits"
  | "audit-tasks";

function isSeoTab(value: string | null): value is Tab {
  return (
    value === "audit" ||
    value === "redirects" ||
    value === "structured-data" ||
    value === "robots" ||
    value === "indexnow" ||
    value === "site-crawl" ||
    value === "search-console" ||
    value === "bing-webmaster" ||
    value === "psi" ||
    value === "hreflang" ||
    value === "page-schema" ||
    value === "images" ||
    value === "previews" ||
    value === "ai-citation" ||
    value === "scheduled-audits" ||
    value === "audit-tasks"
  );
}

export default function SeoPage() {
  const { session } = useAuth();
  const siteId = session?.activeSite?.id ?? null;
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("audit");

  useEffect(() => {
    const queryTab = searchParams.get("tab");
    if (isSeoTab(queryTab)) {
      setTab(queryTab);
    }
  }, [searchParams]);

  if (!siteId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">SEO</h1>
        <p className="mt-2 text-sm text-gray-600">
          Select a site to manage SEO settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SEO</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage redirects, structured data, and search engine optimization.
        </p>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-5">
        <h2 className="text-sm font-semibold text-gray-900">
          Automatic Technical SEO
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Technical SEO resources are generated automatically for each live
          tenant host. That includes robots.txt, sitemap.xml,
          manifest.webmanifest, canonical URLs, hreflang alternates, analytics
          tags, and Google site verification.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-white/80 bg-white/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Site-wide
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Use Settings to manage the favicon, title template, default meta
              description, default OG image, indexing, analytics, and Google
              site verification.
            </p>
          </div>
          <div className="rounded-lg border border-white/80 bg-white/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Per-page
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Use the Editor SEO panel for page title, description, keywords, OG
              image, canonical overrides, and per-page noindex.
            </p>
          </div>
          <div className="rounded-lg border border-white/80 bg-white/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Domain & locale
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Domains and localization decide the canonical host, sitemap URLs,
              and hreflang alternates that search engines receive.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 overflow-x-auto">
        <button
          onClick={() => setTab("audit")}
          className={`shrink-0 min-w-max rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "audit"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          SEO Audit
        </button>
        <button
          onClick={() => setTab("redirects")}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "redirects"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Redirects
        </button>
        <button
          onClick={() => setTab("structured-data")}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "structured-data"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Structured Data
        </button>
        <button
          onClick={() => setTab("robots")}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "robots"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Robots &amp; Sitemap
        </button>
        <button
          onClick={() => setTab("indexnow")}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "indexnow"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          IndexNow
        </button>
        <button
          onClick={() => setTab("site-crawl")}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "site-crawl"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Site Crawl
        </button>
        <button
          onClick={() => setTab("search-console")}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "search-console"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Search Console
        </button>
        <button
          onClick={() => setTab("bing-webmaster")}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "bing-webmaster"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Bing Webmaster
        </button>
        <button
          onClick={() => setTab("psi")}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "psi"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Performance
        </button>
        <button
          onClick={() => setTab("hreflang")}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "hreflang"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Hreflang
        </button>
        <button
          onClick={() => setTab("page-schema")}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "page-schema"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Page Schema
        </button>
        <button
          onClick={() => setTab("images")}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "images"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Images
        </button>
        <button
          onClick={() => setTab("previews")}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "previews"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Previews
        </button>
        <button
          onClick={() => setTab("ai-citation")}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "ai-citation"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          AI Citation
        </button>
        <button
          onClick={() => setTab("scheduled-audits")}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "scheduled-audits"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Scheduled Audits
        </button>
        <button
          onClick={() => setTab("audit-tasks")}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "audit-tasks"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Audit Tasks
        </button>
      </div>

      {tab === "audit" && <SeoAuditPanel siteId={siteId} />}
      {tab === "redirects" && <RedirectsPanel siteId={siteId} />}
      {tab === "structured-data" && <StructuredDataPanel siteId={siteId} />}
      {tab === "robots" && siteId && <RobotsSitemapPanel siteId={siteId} />}
      {tab === "indexnow" && siteId && <IndexNowPanel siteId={siteId} />}
      {tab === "site-crawl" && siteId && <SiteCrawlPanel siteId={siteId} />}
      {tab === "search-console" && siteId && (
        <SearchConsolePanel siteId={siteId} />
      )}
      {tab === "bing-webmaster" && siteId && (
        <BingWebmasterPanel siteId={siteId} />
      )}
      {tab === "psi" && siteId && <PsiPanel siteId={siteId} />}
      {tab === "hreflang" && siteId && <HreflangPanel siteId={siteId} />}
      {tab === "page-schema" && siteId && <PageSchemaPanel siteId={siteId} />}
      {tab === "images" && siteId && <ImagesPanel siteId={siteId} />}
      {tab === "previews" && siteId && <PreviewsPanel siteId={siteId} />}
      {tab === "ai-citation" && siteId && <AiCitationPanel siteId={siteId} />}
      {tab === "scheduled-audits" && siteId && (
        <ScheduledAuditsPanel siteId={siteId} />
      )}
      {tab === "audit-tasks" && siteId && <AuditTasksPanel siteId={siteId} />}
    </div>
  );
}

type SeoAuditRow = {
  key: string;
  slug: string;
  locale: string;
  title: string;
  published: boolean;
  seoTitle: string;
  seoDescription: string;
  seoOgImage: string;
  seoNoindex: boolean;
  score: number;
  pass: boolean;
  issues: { field: string; severity: string; message: string }[];
};

function SeoAuditPanel({ siteId }: { siteId: string }) {
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const locales = useMemo(
    () => (settings?.activeLocales?.length ? settings.activeLocales : ["en"]),
    [settings?.activeLocales],
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkForm, setBulkForm] = useState({
    seoDescription: "",
    seoOgImage: "",
    seoNoindex: "keep" as "keep" | "true" | "false",
  });

  const auditQuery = useQuery({
    queryKey: ["seo", "audit", siteId, locales],
    enabled: Boolean(settings),
    queryFn: async (): Promise<SeoAuditRow[]> => {
      const pageResponses = await Promise.all(
        locales.map((locale) => getPages({ locale, limit: 200 })),
      );
      const pages = pageResponses.flatMap((response) => response.data);

      return Promise.all(
        pages.map(async (page) => {
          try {
            const result = await validatePageSeo(
              siteId,
              page.slug,
              page.locale,
            );
            return {
              key: `${page.locale}:${page.slug}`,
              slug: page.slug,
              locale: page.locale,
              title: page.title,
              published: page.published,
              seoTitle: page.seoTitle,
              seoDescription: page.seoDescription,
              seoOgImage: page.seoOgImage,
              seoNoindex: page.seoNoindex,
              score: result.score,
              pass: result.pass,
              issues: result.issues,
            };
          } catch {
            return {
              key: `${page.locale}:${page.slug}`,
              slug: page.slug,
              locale: page.locale,
              title: page.title,
              published: page.published,
              seoTitle: page.seoTitle,
              seoDescription: page.seoDescription,
              seoOgImage: page.seoOgImage,
              seoNoindex: page.seoNoindex,
              score: 0,
              pass: false,
              issues: [
                {
                  field: "audit",
                  severity: "error",
                  message: "SEO audit could not validate this page",
                },
              ],
            };
          }
        }),
      );
    },
  });

  const rows = auditQuery.data ?? [];
  const selectedRows = rows.filter((row) => selected.includes(row.key));
  const issueCount = rows.reduce((total, row) => total + row.issues.length, 0);
  const averageScore = rows.length
    ? Math.round(
        rows.reduce((total, row) => total + row.score, 0) / rows.length,
      )
    : 0;
  const warningRows = rows.filter((row) => row.issues.length > 0).length;
  const hasBulkPayload =
    bulkForm.seoDescription.trim() ||
    bulkForm.seoOgImage.trim() ||
    bulkForm.seoNoindex !== "keep";

  useEffect(() => {
    if (!auditQuery.data) return;
    const rowKeys = new Set(auditQuery.data.map((row) => row.key));
    setSelected((current) => current.filter((key) => rowKeys.has(key)));
  }, [auditQuery.data]);

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const payload: {
        seoDescription?: string;
        seoOgImage?: string;
        seoNoindex?: boolean;
      } = {};

      if (bulkForm.seoDescription.trim()) {
        payload.seoDescription = bulkForm.seoDescription.trim();
      }
      if (bulkForm.seoOgImage.trim()) {
        payload.seoOgImage = bulkForm.seoOgImage.trim();
      }
      if (bulkForm.seoNoindex !== "keep") {
        payload.seoNoindex = bulkForm.seoNoindex === "true";
      }

      await Promise.all(
        selectedRows.map((row) => updatePage(row.slug, row.locale, payload)),
      );
    },
    onSuccess: () => {
      setSelected([]);
      setBulkForm({ seoDescription: "", seoOgImage: "", seoNoindex: "keep" });
      void queryClient.invalidateQueries({
        queryKey: ["seo", "audit", siteId],
      });
    },
  });

  const toggleAll = () => {
    setSelected((current) =>
      current.length === rows.length ? [] : rows.map((row) => row.key),
    );
  };

  const toggleRow = (key: string) => {
    setSelected((current) =>
      current.includes(key)
        ? current.filter((selectedKey) => selectedKey !== key)
        : [...current, key],
    );
  };

  if (auditQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Auditing pages...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        {[
          {
            label: "Average score",
            value: rows.length ? `${averageScore}/100` : "-",
            icon: ClipboardCheck,
          },
          { label: "Pages checked", value: rows.length, icon: FileText },
          { label: "Pages with issues", value: warningRows, icon: AlertCircle },
          { label: "Total issues", value: issueCount, icon: CheckCircle2 },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Icon className="h-4 w-4" />
              {label}
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Bulk SEO edit
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Apply shared descriptions, OG images, or indexing status to
              selected page-locale rows.
            </p>
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-3 lg:max-w-3xl">
            <input
              type="text"
              value={bulkForm.seoDescription}
              onChange={(e) =>
                setBulkForm((previous) => ({
                  ...previous,
                  seoDescription: e.target.value,
                }))
              }
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Meta description"
            />
            <input
              type="url"
              value={bulkForm.seoOgImage}
              onChange={(e) =>
                setBulkForm((previous) => ({
                  ...previous,
                  seoOgImage: e.target.value,
                }))
              }
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="OG image URL"
            />
            <select
              value={bulkForm.seoNoindex}
              onChange={(e) =>
                setBulkForm((previous) => ({
                  ...previous,
                  seoNoindex: e.target.value as "keep" | "true" | "false",
                }))
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="keep">Keep indexing</option>
              <option value="false">Allow indexing</option>
              <option value="true">Set noindex</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => bulkMutation.mutate()}
            disabled={
              !selectedRows.length || !hasBulkPayload || bulkMutation.isPending
            }
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {bulkMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Apply to {selectedRows.length || 0}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Page and locale portfolio
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Includes metadata checks plus demo-copy and platform-reference
              warnings.
            </p>
          </div>
          <button
            type="button"
            onClick={() => auditQuery.refetch()}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh audit
          </button>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <FileText className="h-8 w-8 text-gray-200" />
            <p className="mt-3 text-sm text-gray-500">
              No pages found for active locales
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={
                        selected.length === rows.length && rows.length > 0
                      }
                      onChange={toggleAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3">Page</th>
                  <th className="px-4 py-3">Locale</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">SEO fields</th>
                  <th className="px-4 py-3">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => (
                  <tr key={row.key} className="hover:bg-gray-50/70">
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={selected.includes(row.key)}
                        onChange={() => toggleRow(row.key)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-gray-900">
                        {row.title}
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-gray-400">
                        /{row.slug}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {row.published ? "Published" : "Draft"}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-gray-600">
                      {row.locale}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.score >= 85
                            ? "bg-emerald-100 text-emerald-700"
                            : row.score >= 65
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {row.score}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-gray-600">
                      <div>{row.seoTitle ? "Title set" : "Missing title"}</div>
                      <div>
                        {row.seoDescription
                          ? "Description set"
                          : "Missing description"}
                      </div>
                      <div>
                        {row.seoOgImage ? "OG image set" : "No OG image"}
                      </div>
                      {row.seoNoindex && (
                        <div className="text-amber-700">Noindex</div>
                      )}
                    </td>
                    <td className="max-w-md px-4 py-3 align-top">
                      {row.issues.length === 0 ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Clean
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {row.issues.slice(0, 3).map((issue, index) => (
                            <div
                              key={`${row.key}-${index}`}
                              className="text-xs text-gray-700"
                            >
                              <span className="font-semibold capitalize text-amber-700">
                                {issue.severity}
                              </span>{" "}
                              {issue.message}
                            </div>
                          ))}
                          {row.issues.length > 3 && (
                            <div className="text-xs text-gray-400">
                              +{row.issues.length - 3} more
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function RedirectsPanel({ siteId }: { siteId: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [permanent, setPermanent] = useState(true);
  const [importMode, setImportMode] = useState<RedirectImportMode>("skip");
  const [importSummary, setImportSummary] =
    useState<RedirectImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const { data: redirects = [], isLoading } = useQuery({
    queryKey: ["seo", "redirects", siteId],
    queryFn: () => getRedirects(siteId),
  });

  const { data: analysis } = useQuery({
    queryKey: ["seo", "redirects", "analysis", siteId],
    queryFn: () => getRedirectAnalysis(siteId),
  });

  const createMutation = useMutation({
    mutationFn: () => createRedirect(siteId, { fromPath, toPath, permanent }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["seo", "redirects", siteId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["seo", "redirects", "analysis", siteId],
      });
      setShowAdd(false);
      setFromPath("");
      setToPath("");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      toggleRedirect(siteId, id, enabled),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["seo", "redirects", siteId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["seo", "redirects", "analysis", siteId],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRedirect(siteId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["seo", "redirects", siteId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["seo", "redirects", "analysis", siteId],
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: ({ csv, mode }: { csv: string; mode: RedirectImportMode }) =>
      importRedirectsCsv(siteId, csv, mode),
    onSuccess: (summary) => {
      setImportSummary(summary);
      setImportError(null);
      void queryClient.invalidateQueries({
        queryKey: ["seo", "redirects", siteId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["seo", "redirects", "analysis", siteId],
      });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        (err instanceof Error ? err.message : "CSV import failed.");
      setImportError(msg);
      setImportSummary(null);
    },
  });

  const handleExport = async () => {
    try {
      const csv = await exportRedirectsCsv(siteId);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `redirects-${siteId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Surface a minimal error; the user can retry.
      setImportError("Failed to download CSV.");
    }
  };

  const handleImportFile = async (file: File) => {
    setImportError(null);
    setImportSummary(null);
    if (file.size > 1_000_000) {
      setImportError("CSV file must be ≤ 1 MB.");
      return;
    }
    const csv = await file.text();
    importMutation.mutate({ csv, mode: importMode });
  };

  const errorIssues =
    analysis?.issues.filter((i) => i.severity === "error") ?? [];
  const warningIssues =
    analysis?.issues.filter((i) => i.severity === "warning") ?? [];
  const infoIssues =
    analysis?.issues.filter((i) => i.severity === "info") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          Redirect old URLs to prevent broken links after slug renames or page
          deletions.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Upload className="h-4 w-4" />
            Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <select
            value={importMode}
            onChange={(e) =>
              setImportMode(e.target.value as RedirectImportMode)
            }
            className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700"
            title="Import conflict mode"
          >
            <option value="skip">Skip existing</option>
            <option value="overwrite">Overwrite existing</option>
            <option value="strict">Strict (reject on errors)</option>
          </select>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add redirect
          </button>
        </div>
      </div>

      {(importSummary || importError) && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            importError
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {importError ? (
            <p>{importError}</p>
          ) : importSummary ? (
            <div className="space-y-1">
              <p className="font-semibold">
                Import complete: {importSummary.created} created,{" "}
                {importSummary.updated} updated, {importSummary.skipped}{" "}
                skipped, {importSummary.failed} failed (of{" "}
                {importSummary.totalRows} rows).
              </p>
              {importSummary.errors.length > 0 && (
                <ul className="ml-5 list-disc text-xs">
                  {importSummary.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>
                      Line {e.line}
                      {e.column ? ` (${e.column})` : ""}: {e.message}
                    </li>
                  ))}
                  {importSummary.errors.length > 10 && (
                    <li>… {importSummary.errors.length - 10} more.</li>
                  )}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      )}

      {analysis && analysis.issues.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Redirect health
          </h3>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
              <span className="font-semibold">{errorIssues.length}</span> errors
            </div>
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700">
              <span className="font-semibold">{warningIssues.length}</span>{" "}
              warnings
            </div>
            <div className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700">
              <span className="font-semibold">{infoIssues.length}</span> info
            </div>
          </div>
          <ul className="mt-3 space-y-2">
            {analysis.issues.slice(0, 12).map((issue, i) => {
              const Icon =
                issue.severity === "error"
                  ? AlertCircle
                  : issue.severity === "warning"
                    ? AlertTriangle
                    : Info;
              const color =
                issue.severity === "error"
                  ? "text-red-600"
                  : issue.severity === "warning"
                    ? "text-amber-600"
                    : "text-blue-600";
              return (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">
                      [{issue.code}] {issue.message}
                    </p>
                    {issue.chain && issue.chain.length > 0 && (
                      <p className="truncate font-mono text-[11px] text-gray-500">
                        {issue.chain.join(" → ")}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
            {analysis.issues.length > 12 && (
              <li className="text-xs text-gray-500">
                … {analysis.issues.length - 12} additional issues.
              </li>
            )}
          </ul>
        </div>
      )}

      {showAdd && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                From path
              </label>
              <input
                type="text"
                value={fromPath}
                onChange={(e) => setFromPath(e.target.value)}
                placeholder="/old-page"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                To path
              </label>
              <input
                type="text"
                value={toPath}
                onChange={(e) => setToPath(e.target.value)}
                placeholder="/new-page"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={permanent}
              onChange={(e) => setPermanent(e.target.checked)}
              className="rounded border-gray-300"
            />
            Permanent (301) - use for pages that have moved forever
          </label>
          {createMutation.isError && (
            <p className="mt-2 text-xs text-red-600">
              {(
                createMutation.error as {
                  response?: { data?: { message?: string } };
                }
              )?.response?.data?.message ?? "Failed to create redirect."}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => createMutation.mutate()}
              disabled={
                !fromPath.trim() || !toPath.trim() || createMutation.isPending
              }
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-blue-700"
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Create
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : redirects.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <ArrowRight className="h-8 w-8 text-gray-200" />
            <p className="mt-3 text-sm text-gray-500">
              No redirects configured
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {redirects.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      r.permanent
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.statusCode}
                  </span>
                  <span className="truncate font-mono text-sm text-gray-900">
                    {r.fromPath}
                  </span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-gray-400" />
                  <span className="truncate font-mono text-sm text-gray-600">
                    {r.toPath}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      toggleMutation.mutate({ id: r.id, enabled: !r.enabled })
                    }
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                    title={r.enabled ? "Disable" : "Enable"}
                  >
                    {r.enabled ? (
                      <ToggleRight className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(r.id)}
                    disabled={deleteMutation.isPending}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const STRUCTURED_SCHEMA_OPTIONS = [
  {
    value: "HospitalityBusiness",
    label: "Hospitality business",
    description: "Primary lodging or hospitality identity schema.",
  },
  {
    value: "BreadcrumbList",
    label: "Breadcrumbs",
    description: "Path-based breadcrumb schema on nested pages.",
  },
  {
    value: "FAQPage",
    label: "FAQ pages",
    description: "Generated from FAQ components when present on a page.",
  },
  {
    value: "HotelRoom",
    label: "Room types",
    description: "Room or villa types managed below.",
  },
  {
    value: "Offer",
    label: "Offers",
    description: "Book-direct packages or seasonal offers managed below.",
  },
];

function linesToList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatRoomTypes(roomTypes: StructuredRoomType[] | null | undefined) {
  return (roomTypes ?? [])
    .map((room) =>
      [
        room.name,
        room.description ?? "",
        room.occupancy ? String(room.occupancy) : "",
        room.bedType ?? "",
        room.imageUrl ?? "",
      ].join(" | "),
    )
    .join("\n");
}

function parseRoomTypes(value: string): StructuredRoomType[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, description, occupancy, bedType, imageUrl] = line
        .split("|")
        .map((part) => part.trim());
      return {
        name,
        description,
        occupancy: occupancy ? Number(occupancy) : null,
        bedType,
        imageUrl,
      };
    })
    .filter((room) => room.name);
}

function formatOffers(offers: StructuredOffer[] | null | undefined) {
  return (offers ?? [])
    .map((offer) =>
      [
        offer.name,
        offer.description ?? "",
        offer.price ?? "",
        offer.priceCurrency ?? "",
        offer.url ?? "",
        offer.availability ?? "",
      ].join(" | "),
    )
    .join("\n");
}

function parseOffers(value: string): StructuredOffer[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, description, price, priceCurrency, url, availability] = line
        .split("|")
        .map((part) => part.trim());
      return { name, description, price, priceCurrency, url, availability };
    })
    .filter((offer) => offer.name);
}

function StructuredDataPanel({ siteId }: { siteId: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["seo", "structured-data", siteId],
    queryFn: () => getStructuredData(siteId),
  });

  const [form, setForm] = useState<Partial<StructuredDataDto>>({});
  const [amenitiesText, setAmenitiesText] = useState("");
  const [roomTypesText, setRoomTypesText] = useState("");
  const [offersText, setOffersText] = useState("");

  useEffect(() => {
    if (!data) return;
    setForm({
      ...data,
      enabledSchemas: data.enabledSchemas ?? [
        "HospitalityBusiness",
        "BreadcrumbList",
      ],
    });
    setAmenitiesText((data.amenities ?? []).join("\n"));
    setRoomTypesText(formatRoomTypes(data.roomTypes));
    setOffersText(formatOffers(data.offers));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertStructuredData(siteId, {
        ...form,
        amenities: linesToList(amenitiesText),
        roomTypes: parseRoomTypes(roomTypesText),
        offers: parseOffers(offersText),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["seo", "structured-data", siteId],
      });
    },
  });

  const updateField = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSchema = (schema: string) => {
    const current = form.enabledSchemas ?? [
      "HospitalityBusiness",
      "BreadcrumbList",
    ];
    updateField(
      "enabledSchemas",
      current.includes(schema)
        ? current.filter((entry) => entry !== schema)
        : [...current, schema],
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Configure Schema.org structured data for rich search results. This
        information helps search engines display enhanced listings for your
        hospitality business.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">
            Schema Coverage
          </h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {STRUCTURED_SCHEMA_OPTIONS.map((option) => {
            const enabledSchemas = form.enabledSchemas ?? [
              "HospitalityBusiness",
              "BreadcrumbList",
            ];
            const checked = enabledSchemas.includes(option.value);
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                  checked
                    ? "border-blue-200 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSchema(option.value)}
                  className="mt-1 rounded border-gray-300"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Building className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">
            Business Identity
          </h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Business type"
            value={form.businessType ?? "Hotel"}
            onChange={(v) => updateField("businessType", v)}
            type="select"
            options={[
              "Hotel",
              "Resort",
              "Hostel",
              "Motel",
              "BedAndBreakfast",
              "VacationRental",
              "LodgingBusiness",
            ]}
          />
          <Field
            label="Business name"
            value={form.businessName ?? ""}
            onChange={(v) => updateField("businessName", v)}
          />
          <Field
            label="Description"
            value={form.description ?? ""}
            onChange={(v) => updateField("description", v)}
            className="sm:col-span-2"
          />
          <Field
            label="Image URL"
            value={form.imageUrl ?? ""}
            onChange={(v) => updateField("imageUrl", v)}
            placeholder="https://..."
            className="sm:col-span-2"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <MapPin className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Location</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Street address"
            value={form.streetAddress ?? ""}
            onChange={(v) => updateField("streetAddress", v)}
            className="sm:col-span-2"
          />
          <Field
            label="City"
            value={form.city ?? ""}
            onChange={(v) => updateField("city", v)}
          />
          <Field
            label="Region/State"
            value={form.region ?? ""}
            onChange={(v) => updateField("region", v)}
          />
          <Field
            label="Postal code"
            value={form.postalCode ?? ""}
            onChange={(v) => updateField("postalCode", v)}
          />
          <Field
            label="Country"
            value={form.country ?? ""}
            onChange={(v) => updateField("country", v)}
          />
          <Field
            label="Latitude"
            value={form.latitude?.toString() ?? ""}
            onChange={(v) => updateField("latitude", v ? parseFloat(v) : null)}
            placeholder="e.g. 40.7128"
          />
          <Field
            label="Longitude"
            value={form.longitude?.toString() ?? ""}
            onChange={(v) => updateField("longitude", v ? parseFloat(v) : null)}
            placeholder="e.g. -74.0060"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Phone className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">
            Contact & Details
          </h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Telephone"
            value={form.telephone ?? ""}
            onChange={(v) => updateField("telephone", v)}
          />
          <Field
            label="Email"
            value={form.email ?? ""}
            onChange={(v) => updateField("email", v)}
          />
          <Field
            label="Price range"
            value={form.priceRange ?? ""}
            onChange={(v) => updateField("priceRange", v)}
            placeholder="e.g. $$"
          />
          <Field
            label="Star rating"
            value={form.starRating?.toString() ?? ""}
            onChange={(v) =>
              updateField("starRating", v ? parseInt(v, 10) : null)
            }
            placeholder="1-5"
          />
          <Field
            label="Check-in time"
            value={form.checkInTime ?? ""}
            onChange={(v) => updateField("checkInTime", v)}
            placeholder="e.g. 15:00"
          />
          <Field
            label="Check-out time"
            value={form.checkOutTime ?? ""}
            onChange={(v) => updateField("checkOutTime", v)}
            placeholder="e.g. 11:00"
          />
          <Field
            label="Room count"
            value={form.roomCount?.toString() ?? ""}
            onChange={(v) =>
              updateField("roomCount", v ? parseInt(v, 10) : null)
            }
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">
            Amenities, Rooms & Offers
          </h3>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Amenities
            </label>
            <textarea
              rows={5}
              value={amenitiesText}
              onChange={(event) => setAmenitiesText(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder={"Pool\nBeach access\nBreakfast included"}
            />
            <p className="mt-1 text-xs text-gray-400">
              One amenity per line or comma-separated; emitted as
              LocationFeatureSpecification entries.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Room types
            </label>
            <textarea
              rows={5}
              value={roomTypesText}
              onChange={(event) => setRoomTypesText(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder={
                "Sea View Suite | Private terrace and king bed | 2 | King bed | https://..."
              }
            />
            <p className="mt-1 text-xs text-gray-400">
              Format: name | description | occupancy | bed type | image URL.
            </p>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Offers
            </label>
            <textarea
              rows={4}
              value={offersText}
              onChange={(event) => setOffersText(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder={
                "Direct booking package | Breakfast and late checkout | 240 | EUR | https://... | InStock"
              }
            />
            <p className="mt-1 text-xs text-gray-400">
              Format: name | description | price | currency | URL |
              availability.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saveMutation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          Save structured data
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
  type,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  type?: "text" | "select";
  options?: string[];
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-gray-700">
        {label}
      </label>
      {type === "select" && options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
      )}
    </div>
  );
}
