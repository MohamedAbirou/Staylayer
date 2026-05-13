import client from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DomainStatus =
  | "PENDING"
  | "DNS_REQUIRED"
  | "VERIFYING"
  | "PROVIDER_ATTACH_PENDING"
  | "SSL_PROVISIONING"
  | "ACTIVE"
  | "FAILED";

export type DomainVerificationStatus =
  | "pending"
  | "dns_required"
  | "provider_attach_pending"
  | "ssl_provisioning"
  | "active"
  | "failed";

export interface SiteDomainRecommendedRecord {
  type: string;
  name: string;
  host: string;
  value: string;
  acceptedValues: string[];
  rank: number | null;
  isMatch: boolean | null;
}

export interface SiteDomain {
  id: string;
  hostname: string;
  status: DomainStatus;
  verificationStatus: DomainVerificationStatus;
  isPrimary: boolean;
  dnsTarget: string | null;
  dnsConfigured: boolean;
  dnsMatchesExpected: boolean | null;
  providerAttachmentStatus: string | null;
  providerVerificationStatus: string | null;
  providerAttached: boolean;
  providerVerified: boolean;
  providerError: string | null;
  providerConfiguredBy: string | null;
  providerMisconfigured: boolean | null;
  providerAcceptedChallenges: string[];
  recommendedRecords: SiteDomainRecommendedRecord[];
  observedCname: string | null;
  observedAddresses: string[];
  sslStatus: string | null;
  sslActive: boolean;
  nextAction: string;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

// ─── Customer endpoints ───────────────────────────────────────────────────────

// GET /domains?siteId=...
export async function getDomains(siteId: string): Promise<SiteDomain[]> {
  const { data } = await client.get<SiteDomain[]>("/domains", {
    params: { siteId },
  });
  return data;
}

// POST /domains?siteId=...  { hostname }
export async function addDomain(
  siteId: string,
  hostname: string,
): Promise<SiteDomain> {
  const { data } = await client.post<SiteDomain>(
    "/domains",
    { hostname },
    { params: { siteId } },
  );
  return data;
}

// PATCH /domains/:id/primary?siteId=...
export async function setDomainPrimary(
  siteId: string,
  domainId: string,
): Promise<SiteDomain> {
  const { data } = await client.patch<SiteDomain>(
    `/domains/${domainId}/primary`,
    {},
    { params: { siteId } },
  );
  return data;
}

// DELETE /domains/:id?siteId=...
export async function removeDomain(
  siteId: string,
  domainId: string,
): Promise<void> {
  await client.delete(`/domains/${domainId}`, { params: { siteId } });
}

export async function retryDomainVerification(
  siteId: string,
  domainId: string,
): Promise<SiteDomain> {
  const { data } = await client.post<SiteDomain>(
    `/domains/${domainId}/retry`,
    {},
    { params: { siteId } },
  );
  return data;
}
