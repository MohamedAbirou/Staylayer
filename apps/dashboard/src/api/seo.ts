import client from "./client";

export interface RedirectDto {
  id: string;
  siteId: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  locale: string | null;
  reason: string | null;
  permanent: boolean;
  enabled: boolean;
  createdAt: string;
}

export interface SeoValidationResult {
  score: number;
  issues: { field: string; severity: string; message: string; suggestion?: string }[];
  pass: boolean;
}

export interface StructuredDataDto {
  id: string;
  siteId: string;
  businessType: string;
  businessName: string | null;
  description: string | null;
  streetAddress: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  telephone: string | null;
  email: string | null;
  starRating: number | null;
  priceRange: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  amenities: string[] | null;
  roomCount: number | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
}

export async function getRedirects(siteId: string): Promise<RedirectDto[]> {
  const { data } = await client.get<RedirectDto[]>("/seo/redirects", {
    params: { siteId },
  });
  return data;
}

export async function createRedirect(
  siteId: string,
  body: {
    fromPath: string;
    toPath: string;
    statusCode?: number;
    locale?: string;
    reason?: string;
    permanent?: boolean;
  },
): Promise<RedirectDto> {
  const { data } = await client.post<RedirectDto>("/seo/redirects", body, {
    params: { siteId },
  });
  return data;
}

export async function toggleRedirect(
  siteId: string,
  redirectId: string,
  enabled: boolean,
): Promise<RedirectDto> {
  const { data } = await client.patch<RedirectDto>(
    `/seo/redirects/${redirectId}/toggle`,
    { enabled },
    { params: { siteId } },
  );
  return data;
}

export async function deleteRedirect(
  siteId: string,
  redirectId: string,
): Promise<void> {
  await client.delete(`/seo/redirects/${redirectId}`, {
    params: { siteId },
  });
}

export async function validatePageSeo(
  siteId: string,
  slug: string,
  locale: string,
): Promise<SeoValidationResult> {
  const { data } = await client.get<SeoValidationResult>("/seo/validate", {
    params: { siteId, slug, locale },
  });
  return data;
}

export async function getStructuredData(
  siteId: string,
): Promise<StructuredDataDto | null> {
  const { data } = await client.get<StructuredDataDto | null>(
    "/seo/structured-data",
    { params: { siteId } },
  );
  return data;
}

export async function upsertStructuredData(
  siteId: string,
  body: Partial<StructuredDataDto>,
): Promise<StructuredDataDto> {
  const { data } = await client.post<StructuredDataDto>(
    "/seo/structured-data",
    body,
    { params: { siteId } },
  );
  return data;
}
