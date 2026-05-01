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
import { useAuth } from "../auth/useAuth";
import { restoreVersion } from "../api/pages";
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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: page, isLoading, error } = usePage(slug, locale);
  const saveMutation = useSavePage();
  const publishMutation = usePublishPage();

  const [isDirty, setIsDirty] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftTime, setDraftTime] = useState<string | null>(null);
  const [showDesktopWarning, setShowDesktopWarning] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);
  const [puckKey, setPuckKey] = useState(0);
  const latestDataRef = useRef<Data | null>(null);

  const { data: versionsData } = useVersions(slug, locale, showVersions);

  const canPublish = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

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
              onClick={() => setShowVersions(!showVersions)}
              className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              <History className="h-4 w-4" />
              History
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
