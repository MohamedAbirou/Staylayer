import client from "./client";
import type { Page, PageListItem, PaginatedResponse } from "../lib/constants";

function normalizePuckData(
  puckData?: Record<string, unknown>,
): Record<string, unknown> {
  if (!puckData || typeof puckData !== "object") {
    return { content: [], root: { props: {} } };
  }

  const root =
    puckData.root && typeof puckData.root === "object"
      ? (puckData.root as Record<string, unknown>)
      : {};

  return ensurePuckNodeIds(
    "props" in root
      ? puckData
      : {
          ...puckData,
          root: { props: root },
        },
  );
}

function toSafePuckIdPart(value: string) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function createStableNodeId(
  type: string,
  path: Array<string | number>,
  usedIds: Set<string>,
) {
  const base = [toSafePuckIdPart(type) || "block", ...path]
    .map((part) => toSafePuckIdPart(String(part)) || "item")
    .join("-");
  let candidate = base;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

function isPuckNode(value: unknown): value is {
  type: string;
  props?: Record<string, unknown>;
} {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as { type?: unknown }).type === "string",
  );
}

function normalizePuckNode(
  node: { type: string; props?: Record<string, unknown> },
  path: Array<string | number>,
  usedIds: Set<string>,
) {
  const props =
    node.props && typeof node.props === "object" ? { ...node.props } : {};
  const currentId = typeof props.id === "string" ? props.id.trim() : "";
  if (currentId && !usedIds.has(currentId)) {
    usedIds.add(currentId);
    props.id = currentId;
  } else {
    props.id = createStableNodeId(node.type, path, usedIds);
  }

  Object.entries(props).forEach(([key, value]) => {
    if (!Array.isArray(value)) {
      return;
    }

    props[key] = value.map((item, index) =>
      isPuckNode(item)
        ? normalizePuckNode(item, [...path, key, index], usedIds)
        : item,
    );
  });

  return { ...node, props };
}

function ensurePuckNodeIds(puckData: Record<string, unknown>) {
  const usedIds = new Set<string>();
  const content = Array.isArray(puckData.content)
    ? puckData.content.map((item, index) =>
        isPuckNode(item) ? normalizePuckNode(item, [index], usedIds) : item,
      )
    : [];
  const zones =
    puckData.zones && typeof puckData.zones === "object"
      ? Object.fromEntries(
          Object.entries(puckData.zones as Record<string, unknown>).map(
            ([zoneId, zoneContent]) => [
              zoneId,
              Array.isArray(zoneContent)
                ? zoneContent.map((item, index) =>
                    isPuckNode(item)
                      ? normalizePuckNode(
                          item,
                          ["zone", zoneId, index],
                          usedIds,
                        )
                      : item,
                  )
                : zoneContent,
            ],
          ),
        )
      : puckData.zones;

  return { ...puckData, content, zones };
}

function normalizePage(page: Page): Page {
  return {
    ...page,
    puckData: normalizePuckData(page.puckData),
  };
}

interface GetPagesParams {
  locale?: string;
  published?: boolean;
  deleted?: boolean;
  page?: number;
  limit?: number;
  search?: string;
}

export async function getPages(
  params?: GetPagesParams,
): Promise<PaginatedResponse<PageListItem>> {
  const { data } = await client.get<PaginatedResponse<PageListItem>>("/pages", {
    params,
  });
  return data;
}

export async function getPage(slug: string, locale: string): Promise<Page> {
  const { data } = await client.get<Page>(`/pages/${slug}`, {
    params: { locale },
  });
  return normalizePage(data);
}

export async function getPagePreview(
  slug: string,
  locale: string,
): Promise<Page> {
  const { data } = await client.get<Page>(`/pages/${slug}/preview`, {
    params: { locale },
  });
  return normalizePage(data);
}

interface CreatePagePayload {
  slug: string;
  locale: string;
  title: string;
  puckData?: Record<string, unknown>;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  seoOgImage?: string;
  seoCanonical?: string;
  seoNoindex?: boolean;
}

export async function createPage(payload: CreatePagePayload): Promise<Page> {
  const { data } = await client.post<Page>("/pages", payload);
  return normalizePage(data);
}

interface UpdatePagePayload {
  title?: string;
  puckData?: Record<string, unknown>;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  seoOgImage?: string;
  seoCanonical?: string;
  seoNoindex?: boolean;
}

export async function updatePage(
  slug: string,
  locale: string,
  payload: UpdatePagePayload,
): Promise<Page> {
  const { data } = await client.put<Page>(`/pages/${slug}`, payload, {
    params: { locale },
  });
  return normalizePage(data);
}

export async function deletePage(slug: string, locale: string): Promise<void> {
  await client.delete(`/pages/${slug}`, { params: { locale } });
}

export async function publishPage(slug: string, locale: string): Promise<void> {
  await client.post(`/pages/${slug}/publish`, null, { params: { locale } });
}

export async function unpublishPage(
  slug: string,
  locale: string,
): Promise<void> {
  await client.post(`/pages/${slug}/unpublish`, null, { params: { locale } });
}

export async function getVersions(
  slug: string,
  locale: string,
  params?: { page?: number; limit?: number },
): Promise<
  PaginatedResponse<{
    id: string;
    savedBy: string;
    note: string;
    savedAt: string;
  }>
> {
  const { data } = await client.get(`/pages/${slug}/versions`, {
    params: { locale, ...params },
  });
  return data;
}

export async function restoreVersion(
  slug: string,
  versionId: string,
  locale: string,
): Promise<Page> {
  const { data } = await client.post<Page>(
    `/pages/${slug}/versions/${versionId}/restore`,
    null,
    { params: { locale } },
  );
  return normalizePage(data);
}

interface DuplicatePagePayload {
  newSlug: string;
  newTitle: string;
  newLocale?: string;
}

export async function duplicatePage(
  slug: string,
  locale: string,
  payload: DuplicatePagePayload,
): Promise<Page> {
  const { data } = await client.post<Page>(
    `/pages/${slug}/duplicate`,
    payload,
    { params: { locale } },
  );
  return normalizePage(data);
}

// ─── Soft-delete & Restore ─────────────────────────────────

export async function restorePage(slug: string, locale: string): Promise<void> {
  await client.post(`/pages/${slug}/restore`, null, { params: { locale } });
}

export async function permanentlyDeletePage(
  slug: string,
  locale: string,
): Promise<void> {
  await client.delete(`/pages/${slug}/permanent`, { params: { locale } });
}

// ─── Bulk operations ───────────────────────────────────────

interface BulkPayload {
  pages: { slug: string; locale: string }[];
}

export async function bulkPublishPages(
  payload: BulkPayload,
): Promise<{ message: string; count: number }> {
  const { data } = await client.post("/pages/bulk/publish", payload);
  return data;
}

export async function bulkUnpublishPages(
  payload: BulkPayload,
): Promise<{ message: string; count: number }> {
  const { data } = await client.post("/pages/bulk/unpublish", payload);
  return data;
}

export async function bulkDeletePages(
  payload: BulkPayload,
): Promise<{ message: string; count: number }> {
  const { data } = await client.post("/pages/bulk/delete", payload);
  return data;
}

export async function bulkRestorePages(
  payload: BulkPayload,
): Promise<{ message: string; count: number }> {
  const { data } = await client.post("/pages/bulk/restore", payload);
  return data;
}

export async function bulkPermanentlyDeletePages(
  payload: BulkPayload,
): Promise<{ message: string; count: number }> {
  const { data } = await client.post("/pages/bulk/permanent-delete", payload);
  return data;
}
