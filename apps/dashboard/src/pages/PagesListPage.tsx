import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePages } from "../hooks/usePages";
import { usePublishPage } from "../hooks/usePublishPage";
import { useAuth } from "../auth/useAuth";
import {
  deletePage,
  duplicatePage,
  restorePage,
  permanentlyDeletePage,
  bulkPublishPages,
  bulkUnpublishPages,
  bulkDeletePages,
  bulkRestorePages,
  bulkPermanentlyDeletePages,
} from "../api/pages";
import { PageStatusBadge } from "../components/PageStatusBadge";
import { LocaleTabs } from "../components/LocaleTabs";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DuplicatePageDialog } from "../components/DuplicatePageDialog";
import { formatDate } from "../lib/formatDate";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Globe,
  Eye,
  Copy,
  RotateCcw,
  CheckSquare,
  Square,
  Archive,
  Loader2,
  ShieldAlert,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";

export default function PagesListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [localeFilter, setLocaleFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "draft" | "trash"
  >("all");
  const [deleteTarget, setDeleteTarget] = useState<{
    slug: string;
    locale: string;
    title: string;
  } | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<{
    slug: string;
    locale: string;
    title: string;
  } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<{
    action: "publish" | "unpublish" | "delete" | "restore" | "permanent-delete";
    title: string;
    message: string;
  } | null>(null);
  const [permDeleteTarget, setPermDeleteTarget] = useState<{
    slug: string;
    locale: string;
    title: string;
  } | null>(null);
  // Track which row is currently being acted on (for per-row loading)
  const [actionPending, setActionPending] = useState<string | null>(null);

  type SortColumn = "title" | "status" | "updatedAt";
  type SortDir = "asc" | "desc";
  const [sortCol, setSortCol] = useState<SortColumn>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "updatedAt" ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  const isTrash = statusFilter === "trash";
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  // Fetch active (non-deleted) pages — omit `deleted` param entirely so the
  // server uses its default (WHERE deleted_at IS NULL). Sending deleted=false
  // is redundant and breaks when the boolean serialisation is inconsistent.
  const { data: activeData, isLoading: activeLoading } = usePages({
    locale: localeFilter ?? undefined,
    limit: 500,
  });

  // Lightweight trash count query always runs (just total, not full data)
  const { data: trashCountData } = usePages({
    locale: localeFilter ?? undefined,
    deleted: true,
    limit: 1,
  });
  const trashCount = trashCountData?.total ?? 0;

  // Full trash data — fetched lazily once the Trash tab is first opened
  const { data: trashData, isLoading: trashLoading } = usePages(
    isTrash
      ? { locale: localeFilter ?? undefined, deleted: true, limit: 500 }
      : undefined,
  );

  const isLoading = isTrash ? trashLoading : activeLoading;

  // Reset to page 1 whenever tab / locale / search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, localeFilter, search]);

  const publishMutation = usePublishPage();

  const deleteMutation = useMutation({
    mutationFn: ({ slug, locale }: { slug: string; locale: string }) =>
      deletePage(slug, locale),
    onSuccess: () => {
      toast.success("Page moved to trash");
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setDeleteTarget(null);
      setActionPending(null);
    },
    onError: () => {
      toast.error("Failed to delete page");
      setActionPending(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: ({ slug, locale }: { slug: string; locale: string }) =>
      restorePage(slug, locale),
    onSuccess: () => {
      toast.success("Page restored");
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setActionPending(null);
    },
    onError: () => {
      toast.error("Failed to restore page");
      setActionPending(null);
    },
  });

  const permDeleteMutation = useMutation({
    mutationFn: ({ slug, locale }: { slug: string; locale: string }) =>
      permanentlyDeletePage(slug, locale),
    onSuccess: () => {
      toast.success("Page permanently deleted");
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setPermDeleteTarget(null);
    },
    onError: () => {
      toast.error("Failed to permanently delete page");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: ({
      slug,
      locale,
      newSlug,
      newTitle,
      newLocale,
    }: {
      slug: string;
      locale: string;
      newSlug: string;
      newTitle: string;
      newLocale: string;
    }) => duplicatePage(slug, locale, { newSlug, newTitle, newLocale }),
    onSuccess: (page) => {
      toast.success("Page duplicated");
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setDuplicateTarget(null);
      navigate(`/editor/${page.slug}?locale=${page.locale}`);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to duplicate page";
      toast.error(message);
    },
  });

  // ─── Bulk mutations ─────────────────────────────────────

  const bulkPublishMutation = useMutation({
    mutationFn: bulkPublishPages,
    onSuccess: (res) => {
      toast.success(`${res.count} page(s) published`);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setSelected(new Set());
      setBulkConfirm(null);
    },
    onError: () => toast.error("Failed to publish pages"),
  });

  const bulkUnpublishMutation = useMutation({
    mutationFn: bulkUnpublishPages,
    onSuccess: (res) => {
      toast.success(`${res.count} page(s) unpublished`);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setSelected(new Set());
      setBulkConfirm(null);
    },
    onError: () => toast.error("Failed to unpublish pages"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeletePages,
    onSuccess: (res) => {
      toast.success(`${res.count} page(s) moved to trash`);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setSelected(new Set());
      setBulkConfirm(null);
    },
    onError: () => toast.error("Failed to delete pages"),
  });

  const bulkRestoreMutation = useMutation({
    mutationFn: bulkRestorePages,
    onSuccess: (res) => {
      toast.success(`${res.count} page(s) restored`);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setSelected(new Set());
      setBulkConfirm(null);
    },
    onError: () => toast.error("Failed to restore pages"),
  });

  const bulkPermanentlyDeleteMutation = useMutation({
    mutationFn: bulkPermanentlyDeletePages,
    onSuccess: (res) => {
      toast.success(`${res.count} page(s) permanently deleted`);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setSelected(new Set());
      setBulkConfirm(null);
    },
    onError: () => toast.error("Failed to permanently delete pages"),
  });

  const filteredPages = useMemo(() => {
    const source = isTrash ? (trashData?.data ?? []) : (activeData?.data ?? []);
    let pages = source;
    if (!isTrash) {
      if (statusFilter === "published")
        pages = pages.filter((p) => p.published);
      if (statusFilter === "draft") pages = pages.filter((p) => !p.published);
    }
    if (search) {
      const lower = search.toLowerCase();
      pages = pages.filter(
        (p) =>
          p.title.toLowerCase().includes(lower) ||
          p.slug.toLowerCase().includes(lower),
      );
    }
    // ─── Sort ───────────────────────────────────────────
    const sorted = [...pages].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "title") {
        cmp = a.title.localeCompare(b.title);
      } else if (sortCol === "status") {
        // published (true=1) before draft (false=0) when asc
        cmp = Number(a.published) - Number(b.published);
      } else {
        // updatedAt — compare ISO strings (lexicographic = chronological)
        cmp =
          a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [
    activeData?.data,
    trashData?.data,
    search,
    statusFilter,
    isTrash,
    sortCol,
    sortDir,
  ]);

  const totalPages = Math.ceil(filteredPages.length / ITEMS_PER_PAGE);
  const paginatedPages = useMemo(
    () =>
      filteredPages.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE,
      ),
    [filteredPages, currentPage, ITEMS_PER_PAGE],
  );

  const canPublish = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const canDelete = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const canPermDelete = user?.role === "SUPER_ADMIN";

  // True when any bulk mutation is in flight
  const bulkPending =
    bulkPublishMutation.isPending ||
    bulkUnpublishMutation.isPending ||
    bulkDeleteMutation.isPending ||
    bulkRestoreMutation.isPending ||
    bulkPermanentlyDeleteMutation.isPending;

  // ─── Selection helpers ──────────────────────────────────

  const pageKey = (p: { slug: string; locale: string }) =>
    `${p.slug}::${p.locale}`;

  // ─── Bulk action smart breakdown ──────────────────────
  // Called on-click only (not in render), so no useMemo cost.
  const getBulkBreakdown = (action: "publish" | "unpublish" | "delete") => {
    const sel = filteredPages.filter((p) => selected.has(pageKey(p)));
    const publishedCount = sel.filter((p) => p.published).length;
    const unpublishedCount = sel.length - publishedCount;
    if (action === "publish") {
      return {
        total: sel.length,
        affected: unpublishedCount, // will actually change
        skipped: publishedCount, // already published, no-op
        skippedLabel:
          publishedCount > 0
            ? `${publishedCount} already published will be skipped.`
            : "",
      };
    }
    if (action === "unpublish") {
      return {
        total: sel.length,
        affected: publishedCount, // will actually change
        skipped: unpublishedCount, // already unpublished, no-op
        skippedLabel:
          unpublishedCount > 0
            ? `${unpublishedCount} already unpublished will be skipped.`
            : "",
      };
    }
    // delete — all are affected; note how many are live
    return {
      total: sel.length,
      affected: sel.length,
      skipped: 0,
      skippedLabel:
        publishedCount > 0
          ? `${publishedCount} currently published will be taken offline.`
          : "",
    };
  };

  const toggleSelect = useCallback((p: { slug: string; locale: string }) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = pageKey(p);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelected(new Set(filteredPages.map(pageKey)));
  }, [filteredPages]);

  const allFilteredSelected =
    filteredPages.length > 0 &&
    filteredPages.every((p) => selected.has(pageKey(p)));

  const toggleSelectAll = useCallback(() => {
    const allOnPageSelected =
      paginatedPages.length > 0 &&
      paginatedPages.every((p) => selected.has(pageKey(p)));
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        paginatedPages.forEach((p) => next.delete(pageKey(p)));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        paginatedPages.forEach((p) => next.add(pageKey(p)));
        return next;
      });
    }
  }, [paginatedPages, selected]);

  const selectedPages = useMemo(
    () =>
      filteredPages
        .filter((p) => selected.has(pageKey(p)))
        .map((p) => ({ slug: p.slug, locale: p.locale })),
    [filteredPages, selected],
  );

  const handlePublishToggle = (
    slug: string,
    locale: string,
    currentlyPublished: boolean,
    targetPublished: boolean,
  ) => {
    // Guard: no-op if already in the desired state
    if (currentlyPublished === targetPublished) {
      toast(
        targetPublished
          ? "Page is already published."
          : "Page is already unpublished.",
        {
          icon: "ℹ️",
        },
      );
      return;
    }
    publishMutation.mutate(
      { slug, locale, publish: targetPublished },
      {
        onSuccess: () => {
          toast.success(
            targetPublished ? "Page published" : "Page unpublished",
          );
          setActionPending(null);
        },
        onError: () => {
          toast.error("Failed to update page status");
          setActionPending(null);
        },
      },
    );
  };

  const executeBulkAction = () => {
    if (!bulkConfirm || selectedPages.length === 0) return;
    const payload = { pages: selectedPages };
    switch (bulkConfirm.action) {
      case "publish":
        bulkPublishMutation.mutate(payload);
        break;
      case "unpublish":
        bulkUnpublishMutation.mutate(payload);
        break;
      case "delete":
        bulkDeleteMutation.mutate(payload);
        break;
      case "restore":
        bulkRestoreMutation.mutate(payload);
        break;
      case "permanent-delete":
        bulkPermanentlyDeleteMutation.mutate(payload);
        break;
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pages</h1>
        <button
          onClick={() => navigate("/pages/new")}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Page
        </button>
      </div>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <LocaleTabs activeLocale={localeFilter} onChange={setLocaleFilter} />
      </div>

      {/* ── Status filter tabs ── */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "published", "draft", "trash"] as const).map((s) => {
          const allActive = activeData?.data ?? [];
          const count =
            s === "all"
              ? allActive.length
              : s === "published"
                ? allActive.filter((p) => p.published).length
                : s === "draft"
                  ? allActive.filter((p) => !p.published).length
                  : trashCount;
          return (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setSelected(new Set());
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? s === "published"
                    ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                    : s === "draft"
                      ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                      : s === "trash"
                        ? "bg-red-100 text-red-700 ring-1 ring-red-200"
                        : "bg-blue-100 text-blue-700 ring-1 ring-blue-200"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {s === "all"
                ? "All"
                : s === "trash"
                  ? "Trash"
                  : s.charAt(0).toUpperCase() + s.slice(1)}{" "}
              ({count})
            </button>
          );
        })}
      </div>

      {/* ── Bulk action bar ── */}
      {canPublish && selected.size > 0 && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50">
          {/* Select-all-pages prompt — only shown when not every filtered page is selected */}
          {!allFilteredSelected && totalPages > 1 && (
            <div className="flex items-center gap-2 border-b border-blue-200 px-4 py-2 text-xs text-blue-700">
              <span>
                All{" "}
                <span className="font-semibold">{paginatedPages.length}</span>{" "}
                pages on this page are selected.
              </span>
              <button
                onClick={selectAllFiltered}
                className="font-semibold underline underline-offset-2 hover:text-blue-900"
              >
                Select all {filteredPages.length} pages
              </button>
            </div>
          )}
          {allFilteredSelected && totalPages > 1 && (
            <div className="flex items-center gap-2 border-b border-blue-200 px-4 py-2 text-xs text-blue-700">
              <span>
                All{" "}
                <span className="font-semibold">{filteredPages.length}</span>{" "}
                pages are selected.
              </span>
              <button
                onClick={() => setSelected(new Set())}
                className="font-semibold underline underline-offset-2 hover:text-blue-900"
              >
                Clear selection
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <span className="text-sm font-medium text-blue-800">
              {selected.size} selected
            </span>
            <div className="mx-2 h-4 w-px bg-blue-200" />
            {!isTrash && (
              <>
                <button
                  disabled={bulkPending}
                  onClick={() => {
                    const { total, affected, skipped, skippedLabel } =
                      getBulkBreakdown("publish");
                    if (affected === 0) {
                      toast(
                        skipped === 1
                          ? "That page is already published."
                          : "All selected pages are already published.",
                        { icon: "ℹ️" },
                      );
                      return;
                    }
                    const note = skippedLabel ? ` ${skippedLabel}` : "";
                    setBulkConfirm({
                      action: "publish",
                      title: "Publish Selected Pages",
                      message:
                        affected === total
                          ? `Publish ${total} page(s)? They will become visible on the website.`
                          : `${affected} of ${total} selected page(s) will be published and go live.${note}`,
                    });
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkPublishMutation.isPending && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  Publish All
                </button>
                <button
                  disabled={bulkPending}
                  onClick={() => {
                    const { total, affected, skipped, skippedLabel } =
                      getBulkBreakdown("unpublish");
                    if (affected === 0) {
                      toast(
                        skipped === 1
                          ? "That page is already unpublished."
                          : "All selected pages are already unpublished.",
                        { icon: "ℹ️" },
                      );
                      return;
                    }
                    const note = skippedLabel ? ` ${skippedLabel}` : "";
                    setBulkConfirm({
                      action: "unpublish",
                      title: "Unpublish Selected Pages",
                      message:
                        affected === total
                          ? `Unpublish ${total} page(s)? They will be hidden from the website.`
                          : `${affected} of ${total} selected page(s) will be unpublished.${note}`,
                    });
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkUnpublishMutation.isPending && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  Unpublish All
                </button>
                <button
                  disabled={bulkPending}
                  onClick={() => {
                    const { total, skippedLabel } = getBulkBreakdown("delete");
                    const note = skippedLabel ? ` ${skippedLabel}` : "";
                    setBulkConfirm({
                      action: "delete",
                      title: "Move to Trash",
                      message: `Move ${total} page(s) to trash?${note} You can restore them later from the Trash tab.`,
                    });
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkDeleteMutation.isPending && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  Delete All
                </button>
              </>
            )}
            {isTrash && (
              <div className="flex items-center gap-2">
                <button
                  disabled={bulkPending}
                  onClick={() =>
                    setBulkConfirm({
                      action: "restore",
                      title: "Restore All Selected",
                      message: `Restore ${selected.size} page(s) from trash?`,
                    })
                  }
                  className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkRestoreMutation.isPending && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  Restore All
                </button>
                <button
                  disabled={bulkPending}
                  onClick={() =>
                    setBulkConfirm({
                      action: "permanent-delete",
                      title: "Permanently Delete All Selected",
                      message: `Permanently delete ${selected.size} page(s) from trash? This action cannot be undone.`,
                    })
                  }
                  className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkPermanentlyDeleteMutation.isPending && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  Permanently Delete All
                </button>
              </div>
            )}
            <button
              disabled={bulkPending}
              onClick={() => setSelected(new Set())}
              className="ml-auto text-xs text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {filteredPages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            {isTrash ? (
              <Archive className="mb-3 h-12 w-12 text-gray-300" />
            ) : (
              <Globe className="mb-3 h-12 w-12 text-gray-300" />
            )}
            <h3 className="text-sm font-medium text-gray-900">
              {isTrash ? "Trash is empty" : "No pages found"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {isTrash
                ? "Deleted pages will appear here"
                : search
                  ? "Try adjusting your search"
                  : "Get started by creating your first page"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  {canPublish && (
                    <th className="w-10 px-4 py-3">
                      <button
                        onClick={toggleSelectAll}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {paginatedPages.length > 0 &&
                        paginatedPages.every((p) =>
                          selected.has(pageKey(p)),
                        ) ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="px-4 py-3">
                    <SortHeader
                      label="Title"
                      col="title"
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">Slug</th>
                  <th className="px-4 py-3 font-medium text-gray-600">
                    Locale
                  </th>
                  <th className="px-4 py-3">
                    <SortHeader
                      label="Status"
                      col="status"
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3">
                    <SortHeader
                      label="Last Updated"
                      col="updatedAt"
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedPages.map((page) => {
                  const key = pageKey(page);
                  const isSelected = selected.has(key);
                  return (
                    <tr
                      key={page.id}
                      className={`hover:bg-gray-50 ${isSelected ? "bg-blue-50/50" : ""}`}
                    >
                      {canPublish && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleSelect(page)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {page.title}
                      </td>
                      <td className="px-4 py-3 text-gray-500">/{page.slug}</td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium uppercase text-gray-600">
                          {page.locale}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <PageStatusBadge
                          published={page.published}
                          deletedAt={page.deletedAt}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(page.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {isTrash ? (
                            /* ── Trash row actions ── */
                            <>
                              <button
                                onClick={() => {
                                  setActionPending(key);
                                  restoreMutation.mutate({
                                    slug: page.slug,
                                    locale: page.locale,
                                  });
                                }}
                                disabled={actionPending === key}
                                className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {actionPending === key &&
                                restoreMutation.isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                Restore
                              </button>
                              {canPermDelete && (
                                <button
                                  onClick={() =>
                                    setPermDeleteTarget({
                                      slug: page.slug,
                                      locale: page.locale,
                                      title: page.title,
                                    })
                                  }
                                  disabled={actionPending === key}
                                  className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  title="Permanently delete (cannot be undone)"
                                >
                                  <ShieldAlert className="h-3.5 w-3.5" />
                                  Delete Forever
                                </button>
                              )}
                            </>
                          ) : (
                            /* ── Normal row actions ── */
                            <>
                              <button
                                onClick={() =>
                                  navigate(
                                    `/editor/${page.slug}?locale=${page.locale}`,
                                  )
                                }
                                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  navigate(
                                    `/preview/${page.slug}?locale=${page.locale}`,
                                  )
                                }
                                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                title="Preview"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setDuplicateTarget({
                                    slug: page.slug,
                                    locale: page.locale,
                                    title: page.title,
                                  })
                                }
                                disabled={duplicateMutation.isPending}
                                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Duplicate"
                              >
                                {duplicateMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                              {canPublish && (
                                <button
                                  onClick={() => {
                                    setActionPending(key);
                                    handlePublishToggle(
                                      page.slug,
                                      page.locale,
                                      page.published,
                                      !page.published, // target state
                                    );
                                  }}
                                  disabled={
                                    publishMutation.isPending &&
                                    actionPending === key
                                  }
                                  className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                                    page.published
                                      ? "text-yellow-700 hover:bg-yellow-50"
                                      : "text-green-700 hover:bg-green-50"
                                  }`}
                                >
                                  {publishMutation.isPending &&
                                  actionPending === key ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : null}
                                  {page.published ? "Unpublish" : "Publish"}
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() =>
                                    setDeleteTarget({
                                      slug: page.slug,
                                      locale: page.locale,
                                      title: page.title,
                                    })
                                  }
                                  disabled={
                                    deleteMutation.isPending &&
                                    actionPending === key
                                  }
                                  className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                                  title="Move to Trash"
                                >
                                  {deleteMutation.isPending &&
                                  actionPending === key ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing{" "}
            {Math.min(
              (currentPage - 1) * ITEMS_PER_PAGE + 1,
              filteredPages.length,
            )}
            –{Math.min(currentPage * ITEMS_PER_PAGE, filteredPages.length)} of{" "}
            {filteredPages.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Single delete confirm ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Page"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? It will be moved to the Trash and can be restored later.`}
        confirmLabel="Move to Trash"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            setActionPending(pageKey(deleteTarget));
            deleteMutation.mutate({
              slug: deleteTarget.slug,
              locale: deleteTarget.locale,
            });
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ── Permanent delete confirm (SUPER_ADMIN only) ── */}
      <ConfirmDialog
        open={!!permDeleteTarget}
        title="⚠️ Permanently Delete Page"
        message={`This will PERMANENTLY delete "${permDeleteTarget?.title}" and all its version history. This cannot be undone. Are you absolutely sure?`}
        confirmLabel="Delete Forever"
        variant="danger"
        isPending={permDeleteMutation.isPending}
        onConfirm={() => {
          if (permDeleteTarget) {
            permDeleteMutation.mutate({
              slug: permDeleteTarget.slug,
              locale: permDeleteTarget.locale,
            });
          }
        }}
        onCancel={() => setPermDeleteTarget(null)}
      />

      {/* ── Bulk action confirm ── */}
      <ConfirmDialog
        open={!!bulkConfirm}
        title={bulkConfirm?.title ?? ""}
        message={bulkConfirm?.message ?? ""}
        confirmLabel="Confirm"
        variant={bulkConfirm?.action === "delete" ? "danger" : "default"}
        isPending={bulkPending}
        onConfirm={executeBulkAction}
        onCancel={() => setBulkConfirm(null)}
      />

      <DuplicatePageDialog
        open={!!duplicateTarget}
        sourceTitle={duplicateTarget?.title ?? ""}
        sourceLocale={duplicateTarget?.locale ?? "en"}
        isPending={duplicateMutation.isPending}
        onConfirm={(newSlug, newTitle, newLocale) => {
          if (duplicateTarget) {
            duplicateMutation.mutate({
              slug: duplicateTarget.slug,
              locale: duplicateTarget.locale,
              newSlug,
              newTitle,
              newLocale,
            });
          }
        }}
        onCancel={() => setDuplicateTarget(null)}
      />
    </div>
  );
}

// ─── Sortable column header ─────────────────────────────────

type SortColumn = "title" | "status" | "updatedAt";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  col,
  sortCol,
  sortDir,
  onSort,
}: {
  label: string;
  col: SortColumn;
  sortCol: SortColumn;
  sortDir: SortDir;
  onSort: (col: SortColumn) => void;
}) {
  const active = sortCol === col;
  const Icon = active
    ? sortDir === "asc"
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;
  return (
    <button
      onClick={() => onSort(col)}
      className={`group flex items-center gap-1 font-medium transition-colors ${
        active ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
      }`}
    >
      {label}
      <Icon
        className={`h-3.5 w-3.5 transition-colors ${
          active ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500"
        }`}
      />
    </button>
  );
}
