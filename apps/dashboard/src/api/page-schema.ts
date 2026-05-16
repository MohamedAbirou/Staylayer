import client from "./client";

export type JsonLdOverrideMode = "merge" | "replace";

export type JsonLdNode = Record<string, unknown>;

export type JsonLdIssueSeverity = "ERROR" | "WARNING" | "INFO";

export interface JsonLdIssue {
  nodeIndex: number;
  path: string;
  severity: JsonLdIssueSeverity;
  ruleId: string;
  message: string;
}

export interface JsonLdValidationResult {
  issues: JsonLdIssue[];
  bySeverity: { ERROR: number; WARNING: number; INFO: number };
}

export interface OverrideDto {
  mode: JsonLdOverrideMode;
  disabledTypes: string[];
  customNodes: JsonLdNode[];
}

export interface PreviewResult {
  page: { id: string; slug: string; locale: string; title: string };
  auto: JsonLdNode[];
  merged: JsonLdNode[];
  validation: JsonLdValidationResult;
  override: OverrideDto;
}

export interface RuntimeTestResult {
  url: string;
  status: number | null;
  fetched: boolean;
  scriptCount: number;
  parsedNodes: JsonLdNode[];
  parseErrors: string[];
  error: string | null;
}

const BASE = "/seo/page-schema";

export async function getPageSchemaOverride(
  siteId: string,
  slug: string,
  locale: string,
): Promise<OverrideDto> {
  const { data } = await client.get<OverrideDto>(`${BASE}/overrides`, {
    params: { siteId, slug, locale },
  });
  return data;
}

export async function upsertPageSchemaOverride(
  siteId: string,
  slug: string,
  locale: string,
  body: Partial<OverrideDto>,
): Promise<OverrideDto> {
  const { data } = await client.put<OverrideDto>(`${BASE}/overrides`, body, {
    params: { siteId, slug, locale },
  });
  return data;
}

export async function clearPageSchemaOverride(
  siteId: string,
  slug: string,
  locale: string,
): Promise<OverrideDto> {
  const { data } = await client.delete<OverrideDto>(`${BASE}/overrides`, {
    params: { siteId, slug, locale },
  });
  return data;
}

export async function validateJsonLdNodes(
  siteId: string,
  nodes: JsonLdNode[],
): Promise<JsonLdValidationResult> {
  const { data } = await client.post<JsonLdValidationResult>(
    `${BASE}/validate`,
    { nodes },
    { params: { siteId } },
  );
  return data;
}

export async function previewPageSchema(
  siteId: string,
  slug: string,
  locale: string,
  overrideOverride?: Partial<OverrideDto>,
): Promise<PreviewResult> {
  const { data } = await client.post<PreviewResult>(
    `${BASE}/preview`,
    overrideOverride ?? {},
    { params: { siteId, slug, locale } },
  );
  return data;
}

export async function testPageSchemaRuntime(
  siteId: string,
  slug: string,
  locale: string,
): Promise<RuntimeTestResult> {
  const { data } = await client.post<RuntimeTestResult>(
    `${BASE}/test`,
    {},
    { params: { siteId, slug, locale } },
  );
  return data;
}
