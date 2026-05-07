import { randomUUID } from "crypto";
import { Request, Response } from "express";

type RequestUserContext = {
  sub?: string;
  id?: string;
  activeTenantId?: string | null;
  activeSiteId?: string | null;
  platformRole?: string | null;
  activeMembershipRole?: string | null;
};

export type RequestWithContext = Request & {
  requestId?: string;
  user?: RequestUserContext;
  query: Record<string, unknown>;
};

export const REQUEST_ID_HEADER = "X-Request-Id";

export function ensureRequestId(
  request: RequestWithContext,
  response?: Pick<Response, "setHeader">,
): string {
  const requestId =
    request.requestId ?? readRequestIdHeader(request) ?? randomUUID();

  request.requestId = requestId;
  response?.setHeader(REQUEST_ID_HEADER, requestId);

  return requestId;
}

export function getRequestContext(request: RequestWithContext) {
  const user = request.user;

  return {
    requestId: ensureRequestId(request),
    userId: user?.sub ?? user?.id ?? null,
    tenantId:
      (request.query.tenantId as string | undefined) ??
      user?.activeTenantId ??
      null,
    siteId:
      (request.query.siteId as string | undefined) ??
      user?.activeSiteId ??
      null,
    platformRole: user?.platformRole ?? null,
    membershipRole: user?.activeMembershipRole ?? null,
  };
}

function readRequestIdHeader(request: Request): string | undefined {
  const header = request.headers[REQUEST_ID_HEADER.toLowerCase()];

  if (typeof header === "string" && header.length > 0) {
    return header;
  }

  if (Array.isArray(header)) {
    return header.find(
      (value) => typeof value === "string" && value.length > 0,
    );
  }

  return undefined;
}
