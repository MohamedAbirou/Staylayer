import { headers } from "next/headers";
import { fetchHostResolution, getRequestHostname } from "@/lib/runtime/host";
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

  if (!hostname) {
    return null;
  }

  const resolution = await fetchHostResolution({
    hostname,
    pathname: pageSlug || "/",
    requestId,
  });

  return resolution.action === "serve" ? resolution.siteId : null;
}

export async function POST(request) {
  const headerList = await headers();
  const requestId = ensureRequestId(headerList);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: "Invalid JSON body" }, 400, requestId);
  }

  const pageSlug = typeof body?.pageSlug === "string" ? body.pageSlug : "";

  let siteId;
  try {
    siteId = await resolveSiteId({ headerList, pageSlug, requestId });
  } catch (error) {
    console.error(
      `[website] forms/submit host resolution failed requestId=${requestId} status=${
        error?.status ?? "?"
      } message=${error?.message ?? "unknown"}`,
    );
    return jsonResponse(
      { message: "Failed to submit public form" },
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

  try {
    const upstream = await fetch(`${getApiBaseUrl()}/public/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        ...body,
        siteId,
      }),
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
      `[website] forms/submit upstream error requestId=${requestId} message=${
        error?.message ?? "unknown"
      }`,
    );
    return jsonResponse(
      {
        message: "Failed to submit public form",
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
