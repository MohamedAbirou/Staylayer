import { useState, useEffect, useCallback, useRef } from "react";
import {
  useParams,
  useSearchParams,
  useNavigate,
  useBlocker,
} from "react-router-dom";
import { Puck, type Data } from "@puckeditor/core";
import { puckConfig } from "@myallocator/puck-components";
import { usePage } from "../hooks/usePage";
import { useSavePage } from "../hooks/useSavePage";
import { usePublishPage } from "../hooks/usePublishPage";
import { useVersions } from "../hooks/useVersions";
import { canPublishContent } from "../auth/access";
import { useAuth } from "../auth/useAuth";
import { restoreVersion, updatePage } from "../api/pages";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatDate } from "../lib/formatDate";
import {
  ArrowLeft,
  Save,
  Globe,
  Eye,
  History,
  Monitor,
  Loader2,
  RotateCcw,
  X,
  Search,
  EyeOff,
  AlertCircle,
  Image,
  Link,
} from "lucide-react";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import "@puckeditor/core/puck.css";

const AUTOSAVE_INTERVAL = 3_000;

function getDraftKey(slug: string, locale: string) {
  return `draft__${slug}__${locale}`;
}

export default function EditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const locale = searchParams.get("locale") || "en";
  const navigate = useNavigate();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const { data: page, isLoading, error } = usePage(slug, locale);
  const saveMutation = useSavePage();
  const publishMutation = usePublishPage();

  const [isDirty, setIsDirty] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showSeoPanel, setShowSeoPanel] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftTime, setDraftTime] = useState<string | null>(null);
  const [showDesktopWarning, setShowDesktopWarning] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);
  const [puckKey, setPuckKey] = useState(0);
  const latestDataRef = useRef<Data | null>(null);

  // ─── Page-level SEO state ─────────────────────────────────
  const [seoForm, setSeoForm] = useState({
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
    seoOgImage: "",
    seoCanonical: "",
    seoNoindex: false,
  });
  const [seoDirty, setSeoDirty] = useState(false);

  const { data: versionsData } = useVersions(slug, locale, showVersions);

  const saveSeoMutation = useMutation({
    mutationFn: (form: typeof seoForm) => updatePage(slug!, locale, form),
    onSuccess: () => {
      toast.success("SEO settings saved");
      setSeoDirty(false);
      void queryClient.invalidateQueries({ queryKey: ["page", slug, locale] });
    },
    onError: () => {
      toast.error("Failed to save SEO settings");
    },
  });

  const canPublish = canPublishContent(session);

  // Check for local draft on mount
  useEffect(() => {
    if (!slug || !page) return;
    const key = getDraftKey(slug, locale);
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (
          parsed.savedAt &&
          new Date(parsed.savedAt) > new Date(page.updatedAt)
        ) {
          setShowDraftBanner(true);
          setDraftTime(parsed.savedAt);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  }, [slug, locale, page]);

  // Populate SEO form from loaded page
  useEffect(() => {
    if (page) {
      setSeoForm({
        seoTitle: page.seoTitle ?? "",
        seoDescription: page.seoDescription ?? "",
        seoKeywords: page.seoKeywords ?? "",
        seoOgImage: page.seoOgImage ?? "",
        seoCanonical: page.seoCanonical ?? "",
        seoNoindex: page.seoNoindex ?? false,
      });
      setSeoDirty(false);
    }
  }, [page]);

  // Desktop-only warning
  useEffect(() => {
    const check = () => setShowDesktopWarning(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    if (!slug) return;
    const timer = setInterval(() => {
      if (latestDataRef.current && isDirty) {
        const key = getDraftKey(slug, locale);
        localStorage.setItem(
          key,
          JSON.stringify({
            data: latestDataRef.current,
            savedAt: new Date().toISOString(),
          }),
        );
      }
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [slug, locale, isDirty]);

  // Warn on navigation away
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useBlocker(
    useCallback(() => {
      if (isDirty) {
        return !window.confirm("You have unsaved changes. Leave anyway?");
      }
      return false;
    }, [isDirty]),
  );

  const handleSave = useCallback(
    (data: Data) => {
      if (!slug) return;
      saveMutation.mutate(
        { slug, locale, puckData: data as unknown as Record<string, unknown> },
        {
          onSuccess: () => {
            setIsDirty(false);
            localStorage.removeItem(getDraftKey(slug, locale));
            toast.success("Page saved");
          },
          onError: () => {
            toast.error("Save failed — please retry");
          },
        },
      );
    },
    [slug, locale, saveMutation],
  );

  const handlePublish = () => {
    if (!slug) return;
    publishMutation.mutate(
      { slug, locale, publish: !page?.published },
      {
        onSuccess: () => {
          toast.success(
            page?.published ? "Page unpublished" : "Page published",
          );
        },
        onError: () => {
          toast.error("Failed to update publish status");
        },
      },
    );
  };

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => restoreVersion(slug!, versionId, locale),
    onSuccess: async () => {
      toast.success("Version restored");
      await queryClient.refetchQueries({ queryKey: ["page", slug, locale] });
      queryClient.invalidateQueries({ queryKey: ["versions", slug, locale] });
      setRestoreConfirm(null);
      setShowVersions(false);
      setIsDirty(false);
      setPuckKey((prev) => prev + 1);
    },
    onError: () => {
      toast.error("Failed to restore version");
    },
  });

  const handleRestoreDraft = () => {
    if (!slug) return;
    const key = getDraftKey(slug, locale);
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        latestDataRef.current = parsed.data;
        setShowDraftBanner(false);
        // Force remount by incrementing the key
        setPuckKey((prev) => prev + 1);
        // Update page data for the new mount
        queryClient.setQueryData(["page", slug, locale], (old: unknown) => ({
          ...(old as Record<string, unknown>),
          puckData: parsed.data,
        }));
      } catch {
        localStorage.removeItem(key);
      }
    }
  };

  const handleDismissDraft = () => {
    if (!slug) return;
    localStorage.removeItem(getDraftKey(slug, locale));
    setShowDraftBanner(false);
  };

  if (showDesktopWarning) {
    return (
      <div className="flex min-h-100 items-center justify-center p-8">
        <div className="max-w-sm rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <Monitor className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            Desktop Required
          </h2>
          <p className="text-sm text-gray-600">
            The page editor requires a screen width of at least 1024px. Please
            use a desktop browser.
          </p>
          <button
            onClick={() => navigate("/pages")}
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to Pages
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) return <LoadingSpinner />;

  if (error || !page) {
    return (
      <div className="flex min-h-100 flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-lg font-semibold text-gray-900">Page not found</h2>
        <button
          onClick={() => navigate("/pages")}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to Pages
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="sticky top-0 z-30 bg-white">
        {/* Editor top bar */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/pages")}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">
                {page.title}
              </h2>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium uppercase text-gray-600">
                {locale}
              </span>
              {isDirty && (
                <span className="text-xs text-yellow-600">Unsaved changes</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowVersions(!showVersions);
                setShowSeoPanel(false);
              }}
              className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              <History className="h-4 w-4" />
              History
            </button>
            <button
              onClick={() => {
                setShowSeoPanel(!showSeoPanel);
                setShowVersions(false);
              }}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm cursor-pointer ${
                showSeoPanel
                  ? "border-blue-400 bg-blue-50 text-blue-700"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Search className="h-4 w-4" />
              SEO
              {seoDirty && (
                <span className="ml-1 h-2 w-2 rounded-full bg-amber-400" />
              )}
            </button>
            <button
              onClick={() =>
                window.open(`/preview/${slug}?locale=${locale}`, "_blank")
              }
              className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
            {canPublish && (
              <button
                onClick={handlePublish}
                disabled={publishMutation.isPending}
                className={`flex items-center cursor-pointer gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
                  page.published
                    ? "border border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {publishMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <Globe className="h-4 w-4" />
                {page.published ? "Unpublish" : "Publish"}
              </button>
            )}
          </div>
        </div>

        {/* Draft recovery banner */}
        {showDraftBanner && (
          <div className="flex items-center justify-between bg-blue-50 px-4 py-2 text-sm">
            <span className="text-blue-800">
              You have an unsaved draft from{" "}
              {draftTime ? formatDate(draftTime) : "earlier"}. Restore it?
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleRestoreDraft}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                Restore
              </button>
              <button
                onClick={handleDismissDraft}
                className="rounded bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Main editor area with version history sidebar */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          {/* Puck Editor */}
          <div className="flex-1 overflow-hidden">
            <Puck
              key={puckKey}
              config={puckConfig}
              iframe={{ enabled: true }}
              data={
                (page.puckData as Data) || { content: [], root: { props: {} } }
              }
              headerTitle={page.title}
              headerPath={`/pages/${slug}?locale=${locale}`}
              onPublish={handleSave}
              onChange={(data: Data) => {
                latestDataRef.current = data;
                setIsDirty(true);
              }}
              overrides={{
                headerActions: () => (
                  <button
                    onClick={() => {
                      if (latestDataRef.current) {
                        handleSave(latestDataRef.current);
                      }
                    }}
                    disabled={saveMutation.isPending || !isDirty}
                    className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </button>
                ),
              }}
            />
          </div>

          {/* Version History Sidebar */}
          {showVersions && (
            <div className="w-80 border-l border-gray-200 bg-white shadow-lg z-20 flex flex-col max-h-screen">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-[1.33rem]">
                <h3 className="text-md font-semibold text-gray-900">
                  Version History
                </h3>
                <button
                  onClick={() => setShowVersions(false)}
                  className="rounded p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {versionsData?.data && versionsData.data.length > 0 ? (
                  <div className="space-y-3">
                    {versionsData.data.map((version) => (
                      <div
                        key={version.id}
                        className="rounded-md border border-gray-200 p-3"
                      >
                        <div className="mb-1 text-xs text-gray-500">
                          {formatDate(version.savedAt)}
                        </div>
                        <div className="mb-1 text-sm text-gray-700">
                          {version.note || "Auto-save"}
                        </div>
                        <div className="mb-2 text-xs text-gray-400">
                          by {version.savedBy}
                        </div>
                        {canPublish && (
                          <button
                            onClick={() => setRestoreConfirm(version.id)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Restore
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-sm text-gray-500">
                    No version history
                  </p>
                )}
              </div>
            </div>
          )}

          {/* SEO Sidebar */}
          {showSeoPanel && (
            <PageSeoPanel
              slug={slug!}
              locale={locale}
              page={page}
              form={seoForm}
              dirty={seoDirty}
              saving={saveSeoMutation.isPending}
              onChange={(next) => {
                setSeoForm(next);
                setSeoDirty(true);
              }}
              onSave={() => saveSeoMutation.mutate(seoForm)}
              onClose={() => setShowSeoPanel(false)}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!restoreConfirm}
        title="Restore Version"
        message="Are you sure you want to restore this version? Current changes will be overwritten."
        confirmLabel="Restore"
        onConfirm={() => {
          if (restoreConfirm) {
            restoreMutation.mutate(restoreConfirm);
          }
        }}
        onCancel={() => setRestoreConfirm(null)}
      />
    </div>
  );
}

// ─── Page SEO Panel ──────────────────────────────────────────────────────────

interface SeoFormState {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  seoOgImage: string;
  seoCanonical: string;
  seoNoindex: boolean;
}

function PageSeoPanel({
  slug,
  locale,
  page,
  form,
  dirty,
  saving,
  onChange,
  onSave,
  onClose,
}: {
  slug: string;
  locale: string;
  page: { title: string; seoTitle?: string };
  form: SeoFormState;
  dirty: boolean;
  saving: boolean;
  onChange: (next: SeoFormState) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const effectiveTitle = form.seoTitle || page.title || slug;
  const descLen = form.seoDescription.length;
  const titleLen = effectiveTitle.length;

  return (
    <div className="w-96 border-l border-gray-200 bg-white shadow-lg z-20 flex flex-col max-h-screen overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5 shrink-0">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Page SEO</h3>
          {dirty && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              Unsaved
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* SERP Preview */}
        <div className="border-b border-gray-100 bg-gray-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Search result preview
          </p>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500">
              <div className="h-4 w-4 rounded-sm bg-gray-200" />
              <span>yourdomain.com</span>
              <span className="text-gray-300">›</span>
              <span>{slug}</span>
            </div>
            <p
              className={`text-base font-medium leading-snug text-blue-700 line-clamp-1 ${
                titleLen > 60 ? "text-amber-700" : ""
              }`}
            >
              {effectiveTitle || "Page title"}
            </p>
            <p className="mt-0.5 text-sm text-gray-600 line-clamp-2 leading-relaxed">
              {form.seoDescription || (
                <span className="text-gray-300 italic">
                  No description — add one below
                </span>
              )}
            </p>
          </div>
          {titleLen > 60 && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              Title is {titleLen} chars — Google clips at ~60
            </p>
          )}
          {descLen > 160 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              Description is {descLen} chars — aim for under 160
            </p>
          )}
          {form.seoNoindex && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
              <EyeOff className="h-3.5 w-3.5" />
              This page is set to noindex — it will not appear in search results
            </p>
          )}
        </div>

        {/* OG / Social card preview */}
        {form.seoOgImage && (
          <div className="border-b border-gray-100 bg-gray-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Social card preview
            </p>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <img
                src={form.seoOgImage}
                alt="OG preview"
                className="aspect-[1200/630] w-full object-cover"
                onError={(e) =>
                  ((e.target as HTMLImageElement).style.display = "none")
                }
              />
              <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-xs font-medium text-gray-900 line-clamp-1">
                  {effectiveTitle}
                </p>
                <p className="text-[11px] text-gray-500 line-clamp-1">
                  {form.seoDescription}
                </p>
                <p className="mt-0.5 text-[10px] uppercase text-gray-400">
                  yourdomain.com
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Fields */}
        <div className="space-y-5 p-4">
          {/* SEO title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700">
              SEO title
            </label>
            <input
              type="text"
              value={form.seoTitle}
              onChange={(e) => onChange({ ...form, seoTitle: e.target.value })}
              placeholder={page.title || "Leave blank to use page title"}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              {titleLen}/60 chars · Overrides the page title in search results
            </p>
          </div>

          {/* Meta description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700">
              Meta description
            </label>
            <textarea
              rows={3}
              value={form.seoDescription}
              onChange={(e) =>
                onChange({ ...form, seoDescription: e.target.value })
              }
              placeholder="Describe this page for search engines…"
              className="mt-1.5 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p
              className={`mt-1 text-[11px] ${
                descLen > 160
                  ? "text-red-500"
                  : descLen > 140
                    ? "text-amber-500"
                    : "text-gray-400"
              }`}
            >
              {descLen}/160 chars
            </p>
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-xs font-semibold text-gray-700">
              Keywords
            </label>
            <input
              type="text"
              value={form.seoKeywords}
              onChange={(e) =>
                onChange({ ...form, seoKeywords: e.target.value })
              }
              placeholder="vacation rental, direct bookings…"
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Comma-separated · Optional, low weight in modern search
            </p>
          </div>

          {/* OG Image */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Image className="h-3.5 w-3.5" />
              OG / Social image URL
            </label>
            <input
              type="text"
              value={form.seoOgImage}
              onChange={(e) =>
                onChange({ ...form, seoOgImage: e.target.value })
              }
              placeholder="https://example.com/og-image.jpg"
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Recommended 1200×630px · Shown when shared on social platforms
            </p>
          </div>

          {/* Canonical */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Link className="h-3.5 w-3.5" />
              Canonical URL override
            </label>
            <input
              type="text"
              value={form.seoCanonical}
              onChange={(e) =>
                onChange({ ...form, seoCanonical: e.target.value })
              }
              placeholder="https://yourdomain.com/page-slug"
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Leave blank to use the default canonical derived from the page
              slug
            </p>
          </div>

          {/* noindex toggle */}
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-800">
                Exclude from search results
              </p>
              <p className="text-xs text-gray-500">
                Adds a noindex meta tag so search engines skip this page
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onChange({ ...form, seoNoindex: !form.seoNoindex })
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.seoNoindex ? "bg-red-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white shadow transition-transform ${
                  form.seoNoindex ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>

          {/* Locale note */}
          <p className="text-[11px] text-gray-400">
            These settings apply to the{" "}
            <span className="font-semibold">{locale}</span> version of this
            page.
          </p>
        </div>
      </div>

      {/* Save bar */}
      <div className="shrink-0 border-t border-gray-200 px-4 py-3">
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save SEO settings
        </button>
      </div>
    </div>
  );
}
