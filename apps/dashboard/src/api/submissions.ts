import client from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubmissionStatus = "RECEIVED" | "REVIEWED" | "SPAM" | "ARCHIVED";

export type FormType =
  | "CONTACT"
  | "INQUIRY"
  | "AVAILABILITY_REQUEST"
  | "GROUP_STAY";

export interface Submission {
  id: string;
  formType: FormType;
  pageSlug: string | null;
  locale: string;
  name: string;
  email: string;
  message: string;
  extra: Record<string, unknown>;
  status: SubmissionStatus;
  createdAt: string;
}

export interface SubmissionsPage {
  data: Submission[];
  total: number;
  page: number;
  limit: number;
}

// ─── Customer endpoints ───────────────────────────────────────────────────────

// GET /submissions?siteId=...&status=...&page=...&limit=...
export async function getSubmissions(
  siteId: string,
  params?: { status?: SubmissionStatus; page?: number; limit?: number },
): Promise<SubmissionsPage> {
  const { data } = await client.get<SubmissionsPage>("/submissions", {
    params: { siteId, ...params },
  });
  return data;
}

// PATCH /submissions/:id/status?siteId=...  { status }
export async function updateSubmissionStatus(
  siteId: string,
  submissionId: string,
  status: SubmissionStatus,
): Promise<Submission> {
  const { data } = await client.patch<Submission>(
    `/submissions/${submissionId}/status`,
    { status },
    { params: { siteId } },
  );
  return data;
}

// ─── Public endpoint (used by website) ────────────────────────────────────────

export interface PublicSubmitPayload {
  siteId: string;
  formType: FormType;
  pageSlug?: string;
  locale?: string;
  name: string;
  email: string;
  message: string;
  extra?: Record<string, unknown>;
}

// POST /public/submissions  (no auth)
export async function submitPublicInquiry(
  payload: PublicSubmitPayload,
  apiBaseUrl: string,
): Promise<{ id: string; accepted: boolean }> {
  const { data } = await client.post<{ id: string; accepted: boolean }>(
    `${apiBaseUrl}/public/submissions`,
    payload,
  );
  return data;
}
