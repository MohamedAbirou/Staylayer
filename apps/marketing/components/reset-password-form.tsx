"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { OrbitButton } from "@/components/orbit-button";
import { getBrowserApiBaseUrl } from "@/lib/public-api";

export function ResetPasswordForm({
  token,
  email,
}: {
  token: string | null;
  email: string | null;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setError("This password reset link is missing or invalid.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${getBrowserApiBaseUrl()}/public/auth/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token, password }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(body?.message || "Unable to reset your password.");
        return;
      }

      setSuccess(
        "Your password has been reset. You can sign in with the new password now.",
      );
      setPassword("");
      setConfirmPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="orbit-card rounded-[2rem] p-8 sm:p-10"
    >
      <div className="space-y-3">
        <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
          Reset password
        </p>
        <h1 className="orbit-heading text-4xl text-[var(--orbit-midnight)]">
          Choose a new password.
        </h1>
        <p className="text-sm leading-6 text-[rgba(16,42,54,0.72)]">
          {email
            ? `Set a new password for ${email}.`
            : "Set a new password for your StayLayer account."}
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <label className="block text-sm font-medium text-[var(--orbit-midnight)]">
          New password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
          />
        </label>

        <label className="block text-sm font-medium text-[var(--orbit-midnight)]">
          Confirm password
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-6 rounded-2xl border border-[rgba(163,72,52,0.18)] bg-[rgba(255,244,240,0.85)] px-4 py-3 text-sm leading-6 text-[#8d3b2b]">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-6 rounded-2xl border border-[rgba(16,42,54,0.1)] bg-white/70 px-4 py-3 text-sm leading-6 text-[rgba(16,42,54,0.78)]">
          {success}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <OrbitButton type="submit" tone="primary" disabled={submitting}>
          {submitting ? "Resetting..." : "Reset password"}
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
