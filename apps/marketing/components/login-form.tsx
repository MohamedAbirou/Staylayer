"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { OrbitButton } from "@/components/orbit-button";
import {
  buildDashboardAuthHandoffUrl,
  type CustomerAuthResponse,
  getBrowserApiBaseUrl,
  refreshCustomerWorkspaceSession,
  resolveDashboardPath,
  sanitizeReturnTo,
} from "@/lib/public-api";

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; code?: string };
    return body.message || body.code || "Unable to sign in";
  } catch {
    return "Unable to sign in";
  }
}

async function clearSessionCookie() {
  await fetch(`${getBrowserApiBaseUrl()}/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => undefined);
}

export function LoginForm({ returnTo }: { returnTo: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);

  const safeReturnTo = sanitizeReturnTo(returnTo);

  useEffect(() => {
    let active = true;

    void refreshCustomerWorkspaceSession()
      .then((session) => {
        if (!active) {
          return;
        }

        if (!session) {
          setCheckingSession(false);
          return;
        }

        const destination = safeReturnTo || resolveDashboardPath(session);
        window.location.replace(
          buildDashboardAuthHandoffUrl(session, destination),
        );
      })
      .catch(() => {
        if (active) {
          setCheckingSession(false);
        }
      });

    return () => {
      active = false;
    };
  }, [safeReturnTo]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (checkingSession) {
      return;
    }
    setSubmitting(true);
    setError("");
    setNeedsVerification(false);

    try {
      const response = await fetch(`${getBrowserApiBaseUrl()}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const message = await extractErrorMessage(response);
        setNeedsVerification(message.includes("Verify your email"));
        setError(message);
        return;
      }

      const payload = (await response.json()) as CustomerAuthResponse;
      if (payload.user.platformRole) {
        await clearSessionCookie();
        setError(
          "This account uses a separate internal access path, not the customer workspace sign-in.",
        );
        return;
      }

      if (!payload.activeTenant || !payload.activeMembershipRole) {
        await clearSessionCookie();
        setError(
          "We could not match this sign-in to a customer workspace yet. If this is an internal account, use the appropriate internal sign-in instead.",
        );
        return;
      }

      const destination = safeReturnTo || resolveDashboardPath(payload);
      window.location.href = buildDashboardAuthHandoffUrl(payload, destination);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="orbit-card rounded-[2rem] p-8 sm:p-10"
    >
      <div className="space-y-2">
        <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
          Customer access
        </p>
        <h1 className="orbit-heading text-4xl text-[var(--orbit-midnight)]">
          Sign in to the workspace
        </h1>
        <p className="text-sm leading-6 text-[rgba(16,42,54,0.72)]">
          Access your site, inquiries, domains, and billing from the same
          customer workspace.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <label className="block text-sm font-medium text-[var(--orbit-midnight)]">
          Work email
          <input
            type="email"
            required
            disabled={submitting || checkingSession}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
            placeholder="owner@yourproperty.com"
          />
        </label>

        <label className="block text-sm font-medium text-[var(--orbit-midnight)]">
          Password
          <input
            type="password"
            required
            minLength={8}
            disabled={submitting || checkingSession}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
            placeholder="Enter your password"
          />
        </label>

        {error ? (
          <p className="rounded-2xl border border-[rgba(163,72,52,0.18)] bg-[rgba(255,244,240,0.85)] px-4 py-3 text-sm text-[#8d3b2b]">
            {error}
          </p>
        ) : null}

        <OrbitButton
          type="submit"
          tone="primary"
          disabled={submitting || checkingSession}
          className="w-full"
        >
          {checkingSession
            ? "Checking session..."
            : submitting
              ? "Signing in..."
              : "Sign in"}
        </OrbitButton>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-[rgba(16,42,54,0.72)]">
        <Link
          href="/forgot-password"
          className="hover:text-[var(--orbit-midnight)]"
        >
          Forgot password?
        </Link>
        <Link href="/register" className="hover:text-[var(--orbit-midnight)]">
          Need a workspace? Start free
        </Link>
      </div>

      {needsVerification ? (
        <div className="mt-4 text-sm text-[rgba(16,42,54,0.72)]">
          <Link
            href={`/resend-verification?email=${encodeURIComponent(email.trim())}`}
            className="font-medium text-[var(--orbit-midnight)] hover:text-[var(--orbit-teal)]"
          >
            Resend verification email
          </Link>
        </div>
      ) : null}
    </form>
  );
}
