"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { OrbitButton } from "@/components/orbit-button";
import {
  buildDashboardAuthHandoffUrl,
  getBrowserApiBaseUrl,
  resolveDashboardPath,
  type AcceptInvitationResponse,
  type WorkspaceInvitationPreview,
} from "@/lib/public-api";

export function AcceptInviteForm({ token }: { token: string | null }) {
  const [preview, setPreview] = useState<WorkspaceInvitationPreview | null>(
    null,
  );
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("This invitation link is missing or invalid.");
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      const response = await fetch(
        `${getBrowserApiBaseUrl()}/public/auth/invitations/${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        if (!cancelled) {
          setError(
            body?.message || "This invitation link is invalid or has expired.",
          );
          setLoading(false);
        }
        return;
      }

      const payload = (await response.json()) as WorkspaceInvitationPreview;
      if (!cancelled) {
        setPreview(payload);
        setLoading(false);
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `${getBrowserApiBaseUrl()}/public/auth/invitations/accept`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            token,
            password,
            name: preview?.existingAccount ? undefined : name,
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(body?.message || "Unable to accept this invitation.");
        return;
      }

      const payload = (await response.json()) as AcceptInvitationResponse;
      window.location.href = buildDashboardAuthHandoffUrl(
        payload,
        resolveDashboardPath(payload),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="orbit-card rounded-[2rem] p-8 sm:p-10">
        <p className="text-sm text-[rgba(16,42,54,0.72)]">
          Loading invitation details...
        </p>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="orbit-card rounded-[2rem] p-8 sm:p-10">
        <p className="rounded-2xl border border-[rgba(163,72,52,0.18)] bg-[rgba(255,244,240,0.85)] px-4 py-3 text-sm leading-6 text-[#8d3b2b]">
          {error || "This invitation link is invalid or has expired."}
        </p>
        <div className="mt-6 text-sm text-[rgba(16,42,54,0.72)]">
          <Link href="/login" className="hover:text-[var(--orbit-midnight)]">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="orbit-card rounded-[2rem] p-8 sm:p-10"
    >
      <div className="space-y-3">
        <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
          Workspace invitation
        </p>
        <h1 className="orbit-heading text-4xl text-[var(--orbit-midnight)]">
          Join {preview.tenantName}.
        </h1>
        <p className="text-sm leading-6 text-[rgba(16,42,54,0.72)]">
          {preview.existingAccount
            ? `Sign in with the password for ${preview.email} to accept your ${preview.role.toLowerCase()} invitation.`
            : `Create a password for ${preview.email} to accept your ${preview.role.toLowerCase()} invitation.`}
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {!preview.existingAccount ? (
          <label className="block text-sm font-medium text-[var(--orbit-midnight)]">
            Your name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
            />
          </label>
        ) : null}

        <label className="block text-sm font-medium text-[var(--orbit-midnight)]">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-6 rounded-2xl border border-[rgba(163,72,52,0.18)] bg-[rgba(255,244,240,0.85)] px-4 py-3 text-sm leading-6 text-[#8d3b2b]">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <OrbitButton type="submit" tone="primary" disabled={submitting}>
          {submitting ? "Joining..." : "Accept invitation"}
        </OrbitButton>
        <Link
          href="/login"
          className="text-sm text-[rgba(16,42,54,0.72)] hover:text-[var(--orbit-midnight)]"
        >
          Back to login
        </Link>
      </div>
    </form>
  );
}
