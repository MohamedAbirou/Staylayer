import { useMemo, useState, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  ExternalLink,
  Eye,
  FileJson,
  Info,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";

import { getPages } from "../../api/pages";
import {
  clearPageSchemaOverride,
  getPageSchemaOverride,
  previewPageSchema,
  testPageSchemaRuntime,
  upsertPageSchemaOverride,
  validateJsonLdNodes,
  type JsonLdIssue,
  type JsonLdIssueSeverity,
  type JsonLdNode,
  type JsonLdOverrideMode,
  type OverrideDto,
  type PreviewResult,
  type RuntimeTestResult,
} from "../../api/page-schema";

interface PageSchemaPanelProps {
  siteId: string;
}

const COMMON_DISABLABLE_TYPES = [
  "WebSite",
  "Organization",
  "BreadcrumbList",
  "LocalBusiness",
  "Hotel",
  "LodgingBusiness",
  "FAQPage",
  "Offer",
];

const severityStyles: Record<JsonLdIssueSeverity, string> = {
  ERROR: "bg-rose-50 text-rose-700 border border-rose-200",
  WARNING: "bg-amber-50 text-amber-700 border border-amber-200",
  INFO: "bg-sky-50 text-sky-700 border border-sky-200",
};

const severityIcon: Record<JsonLdIssueSeverity, ReactElement> = {
  ERROR: <XCircle className="h-3.5 w-3.5" />,
  WARNING: <AlertTriangle className="h-3.5 w-3.5" />,
  INFO: <Info className="h-3.5 w-3.5" />,
};

export function PageSchemaPanel({
  siteId,
}: PageSchemaPanelProps): ReactElement {
  const queryClient = useQueryClient();

  const pagesQuery = useQuery({
    queryKey: ["pages-for-schema"],
    queryFn: () => getPages({ limit: 200 }),
  });

  const pageOptions = useMemo(() => {
    const items = pagesQuery.data?.data ?? [];
    return items
      .filter((p) => p.deletedAt === null)
      .map((p) => ({
        key: `${p.slug}::${p.locale}`,
        slug: p.slug,
        locale: p.locale,
        title: p.title,
      }));
  }, [pagesQuery.data]);

  const [selectedKey, setSelectedKey] = useState<string>("");

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    return pageOptions.find((p) => p.key === selectedKey) ?? null;
  }, [selectedKey, pageOptions]);

  const overrideQuery = useQuery({
    queryKey: ["page-schema-override", siteId, selected?.slug, selected?.locale],
    enabled: Boolean(selected),
    queryFn: () =>
      getPageSchemaOverride(siteId, selected!.slug, selected!.locale),
  });

  const [mode, setMode] = useState<JsonLdOverrideMode>("merge");
  const [disabledTypes, setDisabledTypes] = useState<string[]>([]);
  const [customNodesText, setCustomNodesText] = useState<string>("[]");
  const [parseError, setParseError] = useState<string | null>(null);

  // Sync state from loaded override when selection changes
  const loadedOverrideKey = `${selected?.slug ?? ""}::${selected?.locale ?? ""}::${overrideQuery.dataUpdatedAt}`;
  const [lastLoadedKey, setLastLoadedKey] = useState<string>("");
  if (overrideQuery.data && loadedOverrideKey !== lastLoadedKey) {
    setLastLoadedKey(loadedOverrideKey);
    setMode(overrideQuery.data.mode);
    setDisabledTypes(overrideQuery.data.disabledTypes);
    setCustomNodesText(JSON.stringify(overrideQuery.data.customNodes, null, 2));
    setParseError(null);
  }

  const parsedNodes = useMemo<JsonLdNode[] | null>(() => {
    try {
      const value = JSON.parse(customNodesText);
      if (!Array.isArray(value)) {
        setParseError("Custom nodes must be a JSON array.");
        return null;
      }
      setParseError(null);
      return value as JsonLdNode[];
    } catch (err) {
      setParseError((err as Error).message);
      return null;
    }
  }, [customNodesText]);

  const validateMutation = useMutation({
    mutationFn: async () => {
      if (!parsedNodes) throw new Error("Custom nodes JSON is invalid.");
      return validateJsonLdNodes(siteId, parsedNodes);
    },
  });

  const previewMutation = useMutation<PreviewResult>({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a page first.");
      const override =
        parsedNodes !== null
          ? { mode, disabledTypes, customNodes: parsedNodes }
          : undefined;
      return previewPageSchema(siteId, selected.slug, selected.locale, override);
    },
  });

  const testMutation = useMutation<RuntimeTestResult>({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a page first.");
      return testPageSchemaRuntime(siteId, selected.slug, selected.locale);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a page first.");
      if (parsedNodes === null) {
        throw new Error("Custom nodes JSON is invalid; fix before saving.");
      }
      return upsertPageSchemaOverride(siteId, selected.slug, selected.locale, {
        mode,
        disabledTypes,
        customNodes: parsedNodes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "page-schema-override",
          siteId,
          selected?.slug,
          selected?.locale,
        ],
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a page first.");
      return clearPageSchemaOverride(siteId, selected.slug, selected.locale);
    },
    onSuccess: (data: OverrideDto) => {
      setMode(data.mode);
      setDisabledTypes(data.disabledTypes);
      setCustomNodesText("[]");
      queryClient.invalidateQueries({
        queryKey: [
          "page-schema-override",
          siteId,
          selected?.slug,
          selected?.locale,
        ],
      });
    },
  });

  const toggleDisabled = (type: string) => {
    setDisabledTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const validation = validateMutation.data ?? previewMutation.data?.validation;

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <FileJson className="h-6 w-6 text-indigo-600" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">
              Per-page JSON-LD overrides
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Disable specific auto-generated schema nodes or add custom
              JSON-LD. Use <span className="font-medium">merge</span> to extend
              the auto graph, or <span className="font-medium">replace</span>{" "}
              to ship a fully hand-authored graph.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <label className="block text-sm font-medium text-gray-700">
          Page
        </label>
        <select
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          disabled={pagesQuery.isLoading}
        >
          <option value="">— Select a page —</option>
          {pageOptions.map((p) => (
            <option key={p.key} value={p.key}>
              [{p.locale}] /{p.slug} — {p.title}
            </option>
          ))}
        </select>
        {pagesQuery.isLoading && (
          <p className="mt-2 text-xs text-gray-500">Loading pages…</p>
        )}
      </section>

      {selected && (
        <>
          <section className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Mode</h3>
            <div className="mt-3 flex gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={mode === "merge"}
                  onChange={() => setMode("merge")}
                />
                Merge with auto graph
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                />
                Replace auto graph
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">
              Disabled auto types
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Auto-generated nodes matching these <code>@type</code>s will be
              removed from the merged graph. Ignored when mode is{" "}
              <em>replace</em>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {COMMON_DISABLABLE_TYPES.map((t) => {
                const active = disabledTypes.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleDisabled(t)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {active ? "✕ " : "+ "}
                    {t}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">
                Custom JSON-LD nodes
              </h3>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              JSON array of schema.org node objects (max 30 nodes, 64 KB
              total).
            </p>
            <textarea
              value={customNodesText}
              onChange={(e) => setCustomNodesText(e.target.value)}
              className="mt-3 h-64 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
              spellCheck={false}
            />
            {parseError && (
              <p className="mt-2 text-xs text-rose-600">JSON: {parseError}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => validateMutation.mutate()}
                disabled={parsedNodes === null || validateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {validateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Validate
              </button>
              <button
                type="button"
                onClick={() => previewMutation.mutate()}
                disabled={previewMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {previewMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Preview merged
              </button>
              <button
                type="button"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {testMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Test live runtime
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={parsedNodes === null || saveMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </button>
              <button
                type="button"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                {clearMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Clear
              </button>
            </div>

            {saveMutation.isError && (
              <p className="mt-3 text-sm text-rose-600">
                {(saveMutation.error as Error).message}
              </p>
            )}
            {saveMutation.isSuccess && (
              <p className="mt-3 text-sm text-emerald-700">Saved.</p>
            )}
          </section>

          {validation && <ValidationResultBlock validation={validation} />}

          {previewMutation.data && (
            <PreviewBlock preview={previewMutation.data} />
          )}

          {testMutation.data && (
            <RuntimeTestBlock result={testMutation.data} />
          )}
          {testMutation.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {(testMutation.error as Error).message}
            </div>
          )}
        </>
      )}

      {overrideQuery.isFetching && selected && (
        <p className="text-xs text-gray-500">
          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
          Loading override…
        </p>
      )}

      <button
        type="button"
        onClick={() => pagesQuery.refetch()}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        <RefreshCw className="mr-1 inline h-3 w-3" />
        Refresh page list
      </button>
    </div>
  );
}

function ValidationResultBlock({
  validation,
}: {
  validation: { issues: JsonLdIssue[]; bySeverity: Record<JsonLdIssueSeverity, number> };
}): ReactElement {
  const { issues, bySeverity } = validation;
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-900">Validation</h3>
      <div className="mt-2 flex gap-3 text-xs">
        <span className="rounded bg-rose-50 px-2 py-0.5 text-rose-700">
          {bySeverity.ERROR} errors
        </span>
        <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-700">
          {bySeverity.WARNING} warnings
        </span>
        <span className="rounded bg-sky-50 px-2 py-0.5 text-sky-700">
          {bySeverity.INFO} info
        </span>
      </div>
      {issues.length === 0 ? (
        <p className="mt-3 text-sm text-emerald-700">
          <CheckCircle2 className="mr-1 inline h-4 w-4" />
          No issues found.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {issues.map((issue, i) => (
            <li
              key={`${i}-${issue.ruleId}`}
              className={`flex items-start gap-2 rounded-md p-3 text-xs ${severityStyles[issue.severity]}`}
            >
              <span className="mt-0.5">{severityIcon[issue.severity]}</span>
              <div className="flex-1">
                <div className="font-medium">{issue.message}</div>
                <div className="mt-0.5 font-mono text-[11px] opacity-75">
                  rule: {issue.ruleId} · node #{issue.nodeIndex} ·{" "}
                  {issue.path || "root"}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PreviewBlock({ preview }: { preview: PreviewResult }): ReactElement {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-900">
        <Eye className="mr-1 inline h-4 w-4" />
        Merged graph preview
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        {preview.merged.length} merged node(s), {preview.auto.length} auto
        node(s).
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-gray-700">
          Merged graph (what will be served)
        </summary>
        <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-gray-50 p-3 font-mono text-[11px]">
          {JSON.stringify(preview.merged, null, 2)}
        </pre>
      </details>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-gray-700">
          Auto graph (before override)
        </summary>
        <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-gray-50 p-3 font-mono text-[11px]">
          {JSON.stringify(preview.auto, null, 2)}
        </pre>
      </details>
    </section>
  );
}

function RuntimeTestBlock({
  result,
}: {
  result: RuntimeTestResult;
}): ReactElement {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-900">
        <ExternalLink className="mr-1 inline h-4 w-4" />
        Live runtime test
      </h3>
      {result.error ? (
        <p className="mt-2 text-sm text-rose-700">{result.error}</p>
      ) : (
        <>
          <p className="mt-2 text-xs text-gray-600">
            URL:{" "}
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-indigo-600 hover:underline"
            >
              {result.url}
            </a>
          </p>
          <div className="mt-2 flex gap-3 text-xs">
            <span className="rounded bg-gray-100 px-2 py-0.5">
              status: {result.status ?? "–"}
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5">
              {result.scriptCount} ld+json script(s)
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5">
              {result.parsedNodes.length} parsed node(s)
            </span>
          </div>
          {result.parseErrors.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              <div className="font-medium">Parse errors:</div>
              <ul className="mt-1 list-disc pl-4">
                {result.parseErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {result.parsedNodes.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-gray-700">
                Parsed nodes from live HTML
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-gray-50 p-3 font-mono text-[11px]">
                {JSON.stringify(result.parsedNodes, null, 2)}
              </pre>
            </details>
          )}
        </>
      )}
    </section>
  );
}
