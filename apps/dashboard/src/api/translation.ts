import client from "./client";

export type TranslationJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REVIEW_REQUIRED"
  | "APPROVED";

export interface TranslationJob {
  id: string;
  tenantId: string;
  siteId: string;
  sourceLocale: string;
  targetLocale: string;
  status: TranslationJobStatus;
  totalPages: number;
  completedPages: number;
  failedPages: number;
  charactersUsed: number;
  overwrite: boolean;
  autoPublish: boolean;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  createdBy: string;
}

export interface LocaleCompleteness {
  locale: string;
  total: number;
  translated: number;
  stale: number;
}

export interface TranslationGlossary {
  id: string;
  tenantId: string;
  siteId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  terms: TranslationGlossaryTerm[];
}

export interface TranslationGlossaryTerm {
  id: string;
  glossaryId: string;
  sourceTerm: string;
  targetTerm: string;
  sourceLocale: string;
  targetLocale: string;
  caseSensitive: boolean;
  createdAt: string;
}

export async function createTranslationJob(
  siteId: string,
  body: {
    sourceLocale: string;
    targetLocale: string;
    pageIds?: string[];
    publishedOnly?: boolean;
    overwrite?: boolean;
    autoPublish?: boolean;
  },
): Promise<TranslationJob> {
  const { data } = await client.post<TranslationJob>(
    "/translation/jobs",
    body,
    { params: { siteId } },
  );
  return data;
}

export async function getTranslationJobs(
  siteId: string,
  params?: { limit?: number; cursor?: string },
): Promise<{ data: TranslationJob[]; hasMore: boolean }> {
  const { data } = await client.get<{
    data: TranslationJob[];
    hasMore: boolean;
  }>("/translation/jobs", {
    params: {
      siteId,
      ...(params?.limit ? { limit: params.limit } : {}),
      ...(params?.cursor ? { cursor: params.cursor } : {}),
    },
  });
  return data;
}

export async function getTranslationJob(
  siteId: string,
  jobId: string,
): Promise<TranslationJob> {
  const { data } = await client.get<TranslationJob>(
    `/translation/jobs/${jobId}`,
    { params: { siteId } },
  );
  return data;
}

export async function approveTranslationJob(
  siteId: string,
  jobId: string,
): Promise<TranslationJob> {
  const { data } = await client.post<TranslationJob>(
    `/translation/jobs/${jobId}/approve`,
    {},
    { params: { siteId } },
  );
  return data;
}

export async function retryTranslationJob(
  siteId: string,
  jobId: string,
): Promise<TranslationJob> {
  const { data } = await client.post<TranslationJob>(
    `/translation/jobs/${jobId}/retry`,
    {},
    { params: { siteId } },
  );
  return data;
}

export async function getLocaleCompleteness(
  siteId: string,
): Promise<LocaleCompleteness[]> {
  const { data } = await client.get<LocaleCompleteness[]>(
    "/translation/locale-completeness",
    { params: { siteId } },
  );
  return data;
}

export async function getGlossaries(
  siteId?: string,
): Promise<TranslationGlossary[]> {
  const { data } = await client.get<TranslationGlossary[]>(
    "/translation/glossaries",
    { params: siteId ? { siteId } : {} },
  );
  return data;
}

export async function createGlossary(body: {
  name: string;
  siteId?: string;
}): Promise<TranslationGlossary> {
  const { data } = await client.post<TranslationGlossary>(
    "/translation/glossaries",
    body,
  );
  return data;
}

export async function deleteGlossary(glossaryId: string): Promise<void> {
  await client.delete(`/translation/glossaries/${glossaryId}`);
}

export async function addGlossaryTerm(
  glossaryId: string,
  body: {
    sourceTerm: string;
    targetTerm: string;
    sourceLocale: string;
    targetLocale: string;
    caseSensitive?: boolean;
  },
): Promise<TranslationGlossaryTerm> {
  const { data } = await client.post<TranslationGlossaryTerm>(
    `/translation/glossaries/${glossaryId}/terms`,
    body,
  );
  return data;
}

export async function removeGlossaryTerm(termId: string): Promise<void> {
  await client.delete(`/translation/glossary-terms/${termId}`);
}
