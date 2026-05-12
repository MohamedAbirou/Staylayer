export interface MarketingLink {
  label: string;
  href: string;
}

export type MarketingPlanKey =
  | "free"
  | "starter_stay"
  | "boutique_growth"
  | "portfolio";

export type ContactPlanInterest = MarketingPlanKey | "custom";

export interface MarketingShowcaseStory {
  id: string;
  title: string;
  category: string;
  localeFootprint: string[];
  summary: string;
  highlights: string[];
  proof: string;
  privacy: string;
}

export interface MarketingContent {
  generatedAt: string;
  brand: {
    name: string;
    eyebrow: string;
    tagline: string;
  };
  navigation: MarketingLink[];
  footer: {
    productLinks: MarketingLink[];
    legalLinks: MarketingLink[];
  };
  home: {
    hero: {
      heading: string;
      body: string;
      primaryCta: MarketingLink;
      secondaryCta: MarketingLink;
    };
    pillars: Array<{ title: string; body: string }>;
    bands: Array<{ title: string; body: string }>;
    faqs: Array<{ question: string; answer: string }>;
  };
  platform: {
    intro: string;
    capabilities: string[];
  };
  solutions: Array<{
    slug: string;
    title: string;
    body: string;
  }>;
  showcase: MarketingShowcaseStory[];
  security: {
    heading: string;
    body: string;
    highlights: string[];
  };
  contact: {
    heading: string;
    body: string;
    contactEmail: string | null;
    contactEmailConfigured: boolean;
  };
}

export interface PublicPlanLimits {
  sites: number;
  locales: number;
  seats: number;
  formSubmissions: number;
  pages: number | null;
  domains: number;
  allowedLanguages: string[];
  translationCharactersPerMonth: number;
  deploymentRetention: number;
  rollbackEnabled: boolean;
  analyticsEnabled: boolean;
  exportEnabled: boolean;
  scheduledExports: boolean;
  supportTier: string;
}

export interface PublicPlanComparison {
  siteCapacity: string;
  languageCoverage: string;
  seatCapacity: string;
  inquiryCapacity: string;
  pageCapacity: string;
  domainCapacity: string;
  analytics: string;
  exports: string;
  translationAllowance: string;
  support: string;
}

export interface PublicBillingPlan {
  key: MarketingPlanKey;
  name: string;
  description: string;
  isFree: boolean;
  audience: string;
  promise: string;
  upgradeTrigger: string;
  ctaLabel: string;
  salesMotion: "self_serve" | "workspace_checkout" | "contact_sales";
  checkoutEnabled: boolean;
  featured: boolean;
  limits: PublicPlanLimits;
  comparison: PublicPlanComparison;
}

export interface PublicBillingCatalog {
  generatedAt: string;
  planCount: number;
  plans: PublicBillingPlan[];
}

export interface LegalDocumentSummary {
  key: string;
  slug: string;
  title: string;
  version: string;
  effectiveAt: string;
  summary: string;
  requiresAcceptanceAtSignup: boolean;
}

export interface LegalDocument extends LegalDocumentSummary {
  sections: Array<{
    title: string;
    paragraphs: string[];
  }>;
}

export interface CustomerAuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    platformRole: string | null;
  };
  memberships: Array<{
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
    tenantStatus: string;
    role: string;
    isDefault: boolean;
    sites: Array<{
      id: string;
      slug: string;
      name: string;
      status: string;
    }>;
  }>;
  activeTenant: {
    id: string;
    slug: string;
    name: string;
    status: string;
  } | null;
  activeSite: {
    id: string;
    slug: string;
    name: string;
    status: string;
  } | null;
  activeMembershipRole: string | null;
}

export interface RegisterResponse {
  accepted: boolean;
  verificationRequired: boolean;
  email: string;
  redirectTo: string;
  provisionedPlanKey: string;
  acceptedLegalDocuments: Array<{
    documentKey: string;
    title: string;
    version: string;
    effectiveAt: string;
  }>;
}

export interface VerificationResponse extends CustomerAuthResponse {
  redirectTo: string;
}

export interface PublicAckResponse {
  accepted: boolean;
}

export interface WorkspaceInvitationPreview {
  email: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "BILLING";
  tenantName: string;
  tenantSlug: string;
  existingAccount: boolean;
  expiresAt: string;
}

export interface AcceptInvitationResponse extends CustomerAuthResponse {
  redirectTo: string;
}

export interface PublicContactInquiryPayload {
  name: string;
  email: string;
  companyName: string;
  planInterest?: ContactPlanInterest;
  message: string;
  website?: string;
}

export interface PublicContactInquiryResponse {
  accepted: boolean;
  messageId?: string;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

const PUBLIC_API_BASE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
);
const SERVER_API_BASE_URL = trimTrailingSlash(
  process.env.API_URL || PUBLIC_API_BASE_URL,
);

export const DASHBOARD_APP_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:5173",
);

function toBase64Url(value: string): string {
  return btoa(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function fetchJson<T>(path: string, revalidate = 300): Promise<T> {
  const response = await fetch(`${SERVER_API_BASE_URL}${path}`, {
    next: { revalidate },
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getBrowserApiBaseUrl(): string {
  return PUBLIC_API_BASE_URL;
}

export async function refreshCustomerWorkspaceSession(
  context: { tenantId?: string; siteId?: string } = {},
): Promise<CustomerAuthResponse | null> {
  const response = await fetch(`${getBrowserApiBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(context),
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const payload = (await response.json()) as CustomerAuthResponse;

  if (payload.user.platformRole) {
    return null;
  }

  if (!payload.activeTenant || !payload.activeMembershipRole) {
    return null;
  }

  return payload;
}

export async function getMarketingContent(): Promise<MarketingContent> {
  return fetchJson<MarketingContent>("/public/marketing/content");
}

export async function getPublicBillingCatalog(): Promise<PublicBillingCatalog> {
  return fetchJson<PublicBillingCatalog>("/public/billing/plans");
}

export async function getLegalDocuments(): Promise<LegalDocumentSummary[]> {
  const response = await fetchJson<{ documents: LegalDocumentSummary[] }>(
    "/public/legal/documents",
  );

  return response.documents;
}

export async function getLegalDocument(slug: string): Promise<LegalDocument> {
  return fetchJson<LegalDocument>(`/public/legal/documents/${slug}`);
}

export function resolveDashboardPath(session: CustomerAuthResponse): string {
  if (
    session.activeMembershipRole === "OWNER" ||
    session.activeMembershipRole === "ADMIN"
  ) {
    if (!session.activeSite) {
      return "/workspace";
    }

    return "/";
  }

  if (session.activeMembershipRole === "EDITOR") {
    return session.activeSite ? "/pages" : "/";
  }

  if (session.activeMembershipRole === "BILLING") {
    return "/billing";
  }

  return session.activeSite ? "/" : "/workspace";
}

export function sanitizeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/")) {
    return null;
  }

  if (value.startsWith("//")) {
    return null;
  }

  return value;
}

export function buildDashboardAuthHandoffUrl(
  payload: CustomerAuthResponse,
  destination: string,
): string {
  const next = sanitizeReturnTo(destination) || resolveDashboardPath(payload);
  const handoff = toBase64Url(JSON.stringify(payload));
  return `${DASHBOARD_APP_URL}/auth/handoff#payload=${encodeURIComponent(handoff)}&next=${encodeURIComponent(next)}`;
}
