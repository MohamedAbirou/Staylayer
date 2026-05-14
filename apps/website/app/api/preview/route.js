import { draftMode } from "next/headers";
import { NextResponse } from "next/server";
import {
  assertPreviewRequest,
  verifyPreviewToken,
} from "@/lib/runtime/preview-token";
import { normalizePathname } from "@/lib/runtime/host";

export async function GET(request) {
  const token = request.nextUrl.searchParams.get("token");
  const pathname = normalizePathname(
    request.nextUrl.searchParams.get("path") || "/",
  );

  if (!token) {
    return NextResponse.json(
      {
        message: "Preview token is required",
      },
      { status: 400 },
    );
  }

  try {
    const claims = assertPreviewRequest(verifyPreviewToken(token), pathname);
    const currentDraftMode = await draftMode();
    currentDraftMode.enable();

    const response = NextResponse.redirect(
      new URL(`https://${claims.host}${pathname === "/" ? "" : pathname}`),
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Invalid preview token",
      },
      { status: 401 },
    );
  }
}
