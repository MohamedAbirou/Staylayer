import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Globe,
  Loader2,
  RefreshCw,
  Save,
  TestTubeDiagonal,
} from "lucide-react";

import {
  getRobotsSettings,
  previewRobots,
  previewSitemap,
  testRobots,
  updateRobotsSettings,
  validateRobots,
  type RobotsCatalogEntry,
  type RobotsPolicy,
  type RobotsSettingsResponse,
  type SitemapPreviewResponse,
} from "../../api/seo";

interface Props {
  siteId: string;
}

const CATEGORY_LABEL: Record<RobotsCatalogEntry["category"], string> = {
  search_engine: "Search engines",
  ai_assistant: "AI assistants",
  ai_training: "AI training",
  ai_search: "AI search",
};

export function RobotsSitemapPanel({ siteId }: Props) {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["seo", "robots", siteId],
    queryFn: () => getRobotsSettings(siteId),
    enabled: Boolean(siteId),
  });

  if (settingsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading robots & sitemap
        settings…
      </div>
    );
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle className="mt-0.5 h-4 w-4" />
        Failed to load robots settings.{" "}
        <button
          onClick={() => settingsQuery.refetch()}
          className="font-medium underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <RobotsEditor
      siteId={siteId}
      settings={settingsQuery.data}
      onSaved={() =>
        queryClient.invalidateQueries({
          queryKey: ["seo", "robots", siteId],
        })
      }
    />
  );
}

function RobotsEditor({
  siteId,
  settings,
  onSaved,
}: {
  siteId: string;
  settings: RobotsSettingsResponse;
  onSaved: () => void;
}) {
  const [customRules, setCustomRules] = useState(settings.robotsCustomRules);
  const [policy, setPolicy] = useState<Record<string, RobotsPolicy>>(
    settings.robotsAiCrawlerPolicy ?? {},
  );
  const [excluded, setExcluded] = useState<string>(
    settings.sitemapExcludedPaths.join("\n"),
  );
  const [includeImages, setIncludeImages] = useState(
    settings.sitemapIncludeImages,
  );

  const groupedCatalog = useMemo(() => {
    const groups: Record<string, RobotsCatalogEntry[]> = {};
    for (const entry of settings.catalog) {
      groups[entry.category] = groups[entry.category] ?? [];
      groups[entry.category]!.push(entry);
    }
    return groups;
  }, [settings.catalog]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateRobotsSettings(siteId, {
        robotsCustomRules: customRules,
        robotsAiCrawlerPolicy: policy,
        sitemapExcludedPaths: excluded
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
        sitemapIncludeImages: includeImages,
      }),
    onSuccess: () => onSaved(),
  });

  const validationQuery = useQuery({
    queryKey: ["seo", "robots", "validate", siteId, customRules],
    queryFn: () => validateRobots(siteId),
    enabled: Boolean(siteId),
    staleTime: 30_000,
  });

  const previewQuery = useQuery({
    queryKey: ["seo", "robots", "preview", siteId],
    queryFn: () => previewRobots(siteId),
    enabled: Boolean(siteId),
    staleTime: 30_000,
  });

  const sitemapQuery = useQuery({
    queryKey: ["seo", "sitemap", "preview", siteId],
    queryFn: () => previewSitemap(siteId),
    enabled: Boolean(siteId),
    staleTime: 30_000,
  });

  const isDirty =
    customRules !== settings.robotsCustomRules ||
    includeImages !== settings.sitemapIncludeImages ||
    excluded !== settings.sitemapExcludedPaths.join("\n") ||
    !shallowEqual(policy, settings.robotsAiCrawlerPolicy ?? {});

  return (
    <div className="space-y-6">
      {!settings.indexingEnabled && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <strong>Indexing is paused for this site.</strong> All crawlers will
            see <code className="rounded bg-amber-100 px-1">Disallow: /</code>{" "}
            regardless of the rules below. Re-enable indexing from{" "}
            <em>SEO &rarr; Audit &rarr; Site settings</em> to allow crawling.
          </div>
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              AI &amp; search-engine crawlers
            </h3>
            <p className="text-xs text-gray-500">
              Override the default policy for individual bots. Bots not listed
              below follow the wildcard group.
            </p>
          </div>
        </header>

        <div className="space-y-5">
          {(
            [
              "search_engine",
              "ai_assistant",
              "ai_search",
              "ai_training",
            ] as const
          ).map((category) => (
            <div key={category}>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                {CATEGORY_LABEL[category]}
              </h4>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {(groupedCatalog[category] ?? []).map((entry) => {
                  const current =
                    policy[entry.userAgent] ?? entry.defaultPolicy;
                  return (
                    <div
                      key={entry.userAgent}
                      className="flex items-start justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">
                          {entry.label}
                        </div>
                        <div className="font-mono text-xs text-gray-500">
                          {entry.userAgent}
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          {entry.description}
                        </div>
                      </div>
                      <select
                        value={current}
                        onChange={(e) =>
                          setPolicy((prev) => {
                            const next = { ...prev };
                            const value = e.target.value as RobotsPolicy;
                            if (value === entry.defaultPolicy) {
                              delete next[entry.userAgent];
                            } else {
                              next[entry.userAgent] = value;
                            }
                            return next;
                          })
                        }
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="allow">Allow</option>
                        <option value="disallow">Disallow</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <header className="mb-3">
          <h3 className="text-base font-semibold text-gray-900">
            Custom robots.txt rules
          </h3>
          <p className="text-xs text-gray-500">
            Free-form rules appended after the platform-managed groups. Max 8
            KB.
          </p>
        </header>
        <textarea
          value={customRules}
          onChange={(e) => setCustomRules(e.target.value)}
          rows={10}
          className="block w-full rounded-md border border-gray-300 bg-gray-50 p-3 font-mono text-xs focus:border-blue-500 focus:bg-white focus:outline-none"
          placeholder={`User-agent: SpecificBot\nDisallow: /staging\nCrawl-delay: 5`}
          spellCheck={false}
        />
        {validationQuery.data && (
          <ValidationIssues issues={validationQuery.data.issues} />
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <header className="mb-3">
          <h3 className="text-base font-semibold text-gray-900">
            Sitemap exclusions
          </h3>
          <p className="text-xs text-gray-500">
            One path or wildcard pattern per line. Matched routes are dropped
            from <code className="rounded bg-gray-100 px-1">/sitemap.xml</code>.
          </p>
        </header>
        <textarea
          value={excluded}
          onChange={(e) => setExcluded(e.target.value)}
          rows={5}
          className="block w-full rounded-md border border-gray-300 bg-gray-50 p-3 font-mono text-xs"
          placeholder={`/internal\n/drafts/*`}
          spellCheck={false}
        />
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={includeImages}
            onChange={(e) => setIncludeImages(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Include image sitemap entries (Google image extension)
        </label>
      </section>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t border-gray-200 bg-white/95 px-1 py-3 backdrop-blur">
        {saveMutation.isError && (
          <span className="text-xs text-red-600">
            {(saveMutation.error as Error)?.message ?? "Save failed"}
          </span>
        )}
        {saveMutation.isSuccess && !isDirty && (
          <span className="flex items-center gap-1 text-xs text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        <button
          disabled={!isDirty || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save changes
        </button>
      </div>

      <RobotsPreviewAndTest
        siteId={siteId}
        preview={previewQuery.data}
        previewLoading={previewQuery.isLoading}
        onRefreshPreview={() => previewQuery.refetch()}
      />

      <SitemapPreviewSection
        data={sitemapQuery.data}
        loading={sitemapQuery.isLoading}
        onRefresh={() => sitemapQuery.refetch()}
      />
    </div>
  );
}

function ValidationIssues({
  issues,
}: {
  issues: { line: number; severity: string; message: string }[];
}) {
  if (issues.length === 0) {
    return (
      <p className="mt-2 flex items-center gap-1 text-xs text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> No issues detected.
      </p>
    );
  }
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {issues.map((issue, idx) => (
        <li
          key={idx}
          className={
            issue.severity === "error"
              ? "text-red-700"
              : issue.severity === "warning"
                ? "text-amber-700"
                : "text-gray-600"
          }
        >
          <strong className="font-medium">Line {issue.line}:</strong>{" "}
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

function RobotsPreviewAndTest({
  siteId,
  preview,
  previewLoading,
  onRefreshPreview,
}: {
  siteId: string;
  preview: { content: string; canonicalHost: string } | undefined;
  previewLoading: boolean;
  onRefreshPreview: () => void;
}) {
  const [testUrl, setTestUrl] = useState("/");
  const [userAgent, setUserAgent] = useState("Googlebot");
  const testMutation = useMutation({
    mutationFn: () => testRobots(siteId, { url: testUrl, userAgent }),
  });

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-base font-semibold text-gray-900">
            <Eye className="h-4 w-4" /> robots.txt preview
          </h3>
          <button
            onClick={onRefreshPreview}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${previewLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </header>
        {preview?.canonicalHost && (
          <p className="mb-1 flex items-center gap-1 text-xs text-gray-500">
            <Globe className="h-3 w-3" /> {preview.canonicalHost}
          </p>
        )}
        <pre className="max-h-72 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs">
          {preview?.content ?? (previewLoading ? "Loading…" : "—")}
        </pre>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <header className="mb-3 flex items-center gap-1.5">
          <TestTubeDiagonal className="h-4 w-4" />
          <h3 className="text-base font-semibold text-gray-900">URL tester</h3>
        </header>
        <label className="mb-2 block text-xs font-medium text-gray-700">
          URL or path
        </label>
        <input
          type="text"
          value={testUrl}
          onChange={(e) => setTestUrl(e.target.value)}
          placeholder="/rooms/deluxe"
          className="mb-3 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <label className="mb-2 block text-xs font-medium text-gray-700">
          User-agent
        </label>
        <input
          type="text"
          value={userAgent}
          onChange={(e) => setUserAgent(e.target.value)}
          placeholder="Googlebot"
          className="mb-3 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          disabled={testMutation.isPending || !testUrl}
          onClick={() => testMutation.mutate()}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
        >
          {testMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : null}
          Test rule
        </button>
        {testMutation.data && (
          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
            <div>
              <strong>Decision:</strong>{" "}
              <span
                className={
                  testMutation.data.decision === "allow"
                    ? "text-green-700"
                    : "text-red-700"
                }
              >
                {testMutation.data.decision.toUpperCase()}
              </span>
            </div>
            <div>
              <strong>Matched group:</strong>{" "}
              <code>{testMutation.data.groupUserAgent}</code>
            </div>
            {testMutation.data.matchedRule && (
              <div>
                <strong>Rule:</strong>{" "}
                <code>{testMutation.data.matchedRule}</code>
              </div>
            )}
          </div>
        )}
        {testMutation.isError && (
          <p className="mt-2 text-xs text-red-600">
            {(testMutation.error as Error)?.message ?? "Test failed"}
          </p>
        )}
      </div>
    </section>
  );
}

function SitemapPreviewSection({
  data,
  loading,
  onRefresh,
}: {
  data: SitemapPreviewResponse | undefined;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Sitemap preview
          </h3>
          <p className="text-xs text-gray-500">
            What `/sitemap.xml` will emit for this site right now.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>
      {!data && loading && <p className="text-sm text-gray-500">Loading…</p>}
      {data && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Total pages" value={data.totalPages} />
            <Stat label="Included" value={data.includedRoutes} positive />
            <Stat label="Excluded" value={data.excludedRoutes} muted />
            <Stat
              label="Images"
              value={data.includeImages ? data.totalImages : "off"}
            />
          </div>
          <div className="max-h-72 overflow-auto rounded-md border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Path</th>
                  <th className="px-3 py-2 font-medium">Locales</th>
                  <th className="px-3 py-2 font-medium">Images</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.routes.map((route) => (
                  <tr key={route.path} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-mono">{route.path}</td>
                    <td className="px-3 py-1.5">{route.locales.join(", ")}</td>
                    <td className="px-3 py-1.5">{route.images.length}</td>
                    <td className="px-3 py-1.5">
                      {route.excluded ? (
                        <span className="text-amber-700">
                          Excluded · {route.excludedReason}
                        </span>
                      ) : (
                        <span className="text-green-700">Included</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  positive,
  muted,
}: {
  label: string;
  value: number | string;
  positive?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-2 text-center ${
        positive
          ? "border-green-200 bg-green-50"
          : muted
            ? "border-gray-200 bg-gray-50"
            : "border-gray-200 bg-white"
      }`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}
