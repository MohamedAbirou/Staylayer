"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  buildDashboardAuthHandoffUrl,
  getBrowserApiBaseUrl,
  resolveDashboardPath,
  sanitizeReturnTo,
  type VerificationResponse,
} from "@/lib/public-api";

export function VerifyEmailStatus({
  token,
  email,
  returnTo,
}: {
  token: string | null;
  email: string | null;
  returnTo: string | null;
}) {
  const [status, setStatus] = useState<"idle" | "verifying" | "error">(
    token ? "verifying" : "idle",
  );
  const [error, setError] = useState("");
  const safeReturnTo = sanitizeReturnTo(returnTo);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const verify = async () => {
      setStatus("verifying");
      setError("");

      const response = await fetch(
        `${getBrowserApiBaseUrl()}/public/auth/verify-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ token }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        if (!cancelled) {
          setStatus("error");
          setError(
            body?.message ||
              "This verification link is invalid or has expired.",
          );
        }
        return;
      }

      const payload = (await response.json()) as VerificationResponse;
      if (!cancelled) {
        const destination = safeReturnTo || resolveDashboardPath(payload);
        window.location.href = buildDashboardAuthHandoffUrl(
          payload,
          destination,
        );
      }
    };

    void verify();

    return () => {
      cancelled = true;
    };
  }, [safeReturnTo, token]);

  if (!token) {
    return (
      <div className="orbit-card rounded-[2rem] p-8 sm:p-10">
        <div className="space-y-3">
          <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
            Check your inbox
          </p>
          <h1 className="orbit-heading text-4xl text-[var(--orbit-midnight)]">
            Verify your email to activate the workspace.
          </h1>
          <p className="text-sm leading-6 text-[rgba(16,42,54,0.72)]">
            {email
              ? `We sent a verification link to ${email}. Open that email and come back through the secure link to finish activation.`
              : "Open the verification email we sent you and come back through the secure link to finish activation."}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-[rgba(16,42,54,0.72)]">
          <Link
            href={`/resend-verification${email ? `?email=${encodeURIComponent(email)}` : ""}`}
            className="font-medium text-[var(--orbit-midnight)] hover:text-[var(--orbit-teal)]"
          >
            Resend verification email
          </Link>
          <Link href="/login" className="hover:text-[var(--orbit-midnight)]">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="orbit-card rounded-[2rem] p-8 sm:p-10">
        <div className="space-y-3">
          <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
            Verification failed
          </p>
          <h1 className="orbit-heading text-4xl text-[var(--orbit-midnight)]">
            That verification link can’t be used anymore.
          </h1>
          <p className="rounded-2xl border border-[rgba(163,72,52,0.18)] bg-[rgba(255,244,240,0.85)] px-4 py-3 text-sm leading-6 text-[#8d3b2b]">
            {error}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-[rgba(16,42,54,0.72)]">
          <Link
            href={`/resend-verification${email ? `?email=${encodeURIComponent(email)}` : ""}`}
            className="font-medium text-[var(--orbit-midnight)] hover:text-[var(--orbit-teal)]"
          >
            Request a new verification email
          </Link>
          <Link href="/login" className="hover:text-[var(--orbit-midnight)]">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="orbit-card rounded-[2rem] p-8 sm:p-10">
      <div className="space-y-3">
        <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
          Verification in progress
        </p>
        <h1 className="orbit-heading text-4xl text-[var(--orbit-midnight)]">
          Verifying your email and opening the workspace.
        </h1>
        <p className="text-sm leading-6 text-[rgba(16,42,54,0.72)]">
          StayLayer is confirming your email and preparing your first dashboard
          session now.
        </p>
      </div>
    </div>
  );
}
