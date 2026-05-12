"use client";

import { useState, type FormEvent } from "react";
import { OrbitButton } from "@/components/orbit-button";
import { getBrowserApiBaseUrl, type PublicAckResponse } from "@/lib/public-api";

export function ResetRequestPlaceholder() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${getBrowserApiBaseUrl()}/public/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        },
      );

      if (!response.ok) {
        setError("Unable to send a reset link right now.");
        return;
      }

      await response
        .json()
        .catch(() => ({ accepted: true }) satisfies PublicAckResponse);
      setMessage(
        `If ${email.trim()} belongs to a StayLayer account, a password reset link is on its way.`,
      );
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
          Password recovery
        </p>
        <h1 className="orbit-heading text-4xl text-[var(--orbit-midnight)]">
          Request a reset link
        </h1>
        <p className="text-sm leading-6 text-[rgba(16,42,54,0.72)]">
          Request a secure reset link and choose a new password from your inbox.
        </p>
      </div>

      <label className="mt-8 block text-sm font-medium text-[var(--orbit-midnight)]">
        Work email
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
          placeholder="owner@yourproperty.com"
        />
      </label>

      <div className="mt-6">
        <OrbitButton type="submit" tone="secondary" disabled={submitting}>
          {submitting ? "Sending..." : "Request reset"}
        </OrbitButton>
      </div>

      {message ? (
        <p className="mt-6 rounded-2xl border border-[rgba(16,42,54,0.1)] bg-white/70 px-4 py-3 text-sm text-[rgba(16,42,54,0.78)]">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-6 rounded-2xl border border-[rgba(163,72,52,0.18)] bg-[rgba(255,244,240,0.85)] px-4 py-3 text-sm text-[#8d3b2b]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
