import crypto from "crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { normalizeHostname, normalizePathname } from "@/lib/runtime/host";

function resolveSecret() {
  return (
    process.env.WEBSITE_RUNTIME_SECRET || process.env.REVALIDATE_SECRET || ""
  );
}

function secretsMatch(a, b) {
  if (!a || !b) {
    return false;
  }

  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

export async function POST(request) {
  const secret =
    request.headers.get("x-website-runtime-secret") ||
    request.headers.get("x-revalidate-secret") ||
    "";

  if (!secretsMatch(secret, resolveSecret())) {
    return NextResponse.json(
      {
        message: "Invalid runtime revalidation secret",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const siteId = String(body?.siteId || "").trim();
  const hosts = Array.isArray(body?.hosts) ? body.hosts : [];
  const paths = Array.isArray(body?.paths) ? body.paths : [];
  const normalizedHosts = Array.from(
    new Set(hosts.map((host) => normalizeHostname(host)).filter(Boolean)),
  );
  const normalizedPaths = Array.from(
    new Set(paths.map((path) => normalizePathname(path))),
  );

  if (!siteId) {
    return NextResponse.json(
      {
        message: "siteId is required",
      },
      { status: 400 },
    );
  }

  revalidateTag(`site:${siteId}`);

  normalizedHosts.forEach((host) => {
    revalidateTag(`host:${host}`);
    revalidateTag(`routes:${host}`);

    normalizedPaths.forEach((path) => {
      revalidateTag(`page:${host}:${path}`);
    });
  });

  return NextResponse.json({
    revalidated: true,
    siteId,
    hosts: normalizedHosts,
    paths: normalizedPaths,
  });
}
