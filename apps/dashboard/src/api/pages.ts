import client from "./client";
import type { Page, PageListItem, PaginatedResponse } from "../lib/constants";

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
  return data;
}

export async function getPagePreview(
  slug: string,
  locale: string,
): Promise<Page> {
  const { data } = await client.get<Page>(`/pages/${slug}/preview`, {
    params: { locale },
  });
  return data;
}

interface CreatePagePayload {
  slug: string;
  locale: string;
  title: string;
  puckData?: Record<string, unknown>;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}

export async function createPage(payload: CreatePagePayload): Promise<Page> {
  const { data } = await client.post<Page>("/pages", payload);
  return data;
}

interface UpdatePagePayload {
  title?: string;
  puckData?: Record<string, unknown>;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}

export async function updatePage(
  slug: string,
  locale: string,
  payload: UpdatePagePayload,
): Promise<Page> {
  const { data } = await client.put<Page>(`/pages/${slug}`, payload, {
    params: { locale },
  });
  return data;
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
  return data;
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
  return data;
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
