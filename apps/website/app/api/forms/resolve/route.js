import { headers } from "next/headers";
import {
  fetchHostResolution,
  getRequestHostname,
  normalizePathname,
} from "@/lib/runtime/host";
import { ensureRequestId } from "@/lib/runtime/request-id";

export const dynamic = "force-dynamic";

function getApiBaseUrl() {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.API_URL ||
    "http://localhost:4000"
  );
}

async function resolveSiteId({ headerList, pageSlug, requestId }) {
  const hostname = getRequestHostname(headerList);
  const pathname = pageSlug ? normalizePathname(pageSlug) : "/";

  if (!hostname) {
    return null;
  }

  const resolution = await fetchHostResolution({
    hostname,
    pathname,
    requestId,
  });

  return resolution.action === "serve" ? resolution.siteId : null;
}

export async function GET(request) {
  const headerList = await headers();
  const requestId = ensureRequestId(headerList);
  const { searchParams } = new URL(request.url);
  const pageSlug = searchParams.get("pageSlug") ?? "";

  let siteId;
  try {
    siteId = await resolveSiteId({ headerList, pageSlug, requestId });
  } catch (error) {
    console.error(
      `[website] forms/resolve host resolution failed requestId=${requestId} status=${
        error?.status ?? "?"
      } message=${error?.message ?? "unknown"}`,
    );
    return jsonResponse(
      { message: "Failed to resolve public form" },
      502,
      requestId,
    );
  }

  if (!siteId) {
    return jsonResponse(
      { message: "No published site is available for this host" },
      404,
      requestId,
    );
  }

  const url = new URL("/public/forms/resolve", getApiBaseUrl());
  url.searchParams.set("siteId", siteId);

  for (const [key, value] of searchParams.entries()) {
    if (key === "siteId") continue;
    if (value === "") continue;
    url.searchParams.append(key, value);
  }

  try {
    const upstream = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
      },
      cache: "no-store",
    });
    const text = await upstream.text();
    return new Response(text || "null", {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    console.error(
      `[website] forms/resolve upstream error requestId=${requestId} message=${
        error?.message ?? "unknown"
      }`,
    );
    return jsonResponse(
      {
        message: "Failed to resolve public form",
        error: error instanceof Error ? error.message : String(error),
      },
      502,
      requestId,
    );
  }
}

function jsonResponse(body, status, requestId) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
    },
  });
}
