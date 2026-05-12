"use client";

import { useState, type FormEvent } from "react";
import { OrbitButton } from "@/components/orbit-button";
import {
  getBrowserApiBaseUrl,
  type ContactPlanInterest,
  type PublicContactInquiryPayload,
  type PublicContactInquiryResponse,
} from "@/lib/public-api";

interface ContactFormProps {
  contactEmail: string | null;
  defaultPlanInterest?: ContactPlanInterest | null;
}

const PLAN_OPTIONS: Array<{ value: ContactPlanInterest; label: string }> = [
  { value: "free", label: "Free workspace" },
  { value: "starter_stay", label: "Starter Stay" },
  { value: "boutique_growth", label: "Boutique Growth" },
  { value: "portfolio", label: "Portfolio" },
  { value: "custom", label: "Not sure yet" },
];

const INITIAL_STATE: PublicContactInquiryPayload = {
  name: "",
  email: "",
  companyName: "",
  planInterest: "custom",
  message: "",
  website: "",
};

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message || "Unable to send your message right now.";
  } catch {
    return "Unable to send your message right now.";
  }
}

export function ContactForm({
  contactEmail,
  defaultPlanInterest,
}: ContactFormProps) {
  const [form, setForm] = useState<PublicContactInquiryPayload>({
    ...INITIAL_STATE,
    planInterest: defaultPlanInterest || INITIAL_STATE.planInterest,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `${getBrowserApiBaseUrl()}/public/marketing/contact`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        },
      );

      if (!response.ok) {
        setError(await extractErrorMessage(response));
        return;
      }

      await response
        .json()
        .catch(() => ({ accepted: true }) as PublicContactInquiryResponse);
      setSubmitted(true);
      setForm({
        ...INITIAL_STATE,
        planInterest: defaultPlanInterest || INITIAL_STATE.planInterest,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="orbit-card rounded-[2rem] p-8 sm:p-10">
        <p className="orbit-kicker text-xs text-[var(--sl-teal)]">
          Message sent
        </p>
        <h2 className="orbit-heading mt-4 text-4xl text-[var(--orbit-midnight)]">
          We have your note.
        </h2>
        <p className="mt-4 text-sm leading-7 text-[rgba(16,42,54,0.72)]">
          We will reply using the details you shared. If you prefer to follow up
          directly, you can also write to{" "}
          {contactEmail || "the StayLayer inbox"}.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <OrbitButton
            type="button"
            tone="amber"
            onClick={() => setSubmitted(false)}
          >
            Send another message
          </OrbitButton>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="orbit-card rounded-[2rem] p-8 sm:p-10"
    >
      <div className="space-y-2">
        <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
          Contact StayLayer
        </p>
        <h2 className="orbit-heading text-4xl text-[var(--orbit-midnight)]">
          Start the conversation.
        </h2>
        <p className="text-sm leading-6 text-[rgba(16,42,54,0.72)]">
          Tell us about your brand, your launch timing, and the plan or rollout
          you are considering.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-[var(--orbit-midnight)]">
          Your name
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
            placeholder="Your name"
          />
        </label>

        <label className="text-sm font-medium text-[var(--orbit-midnight)]">
          Work email
          <input
            type="email"
            required
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
            className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
            placeholder="owner@yourproperty.com"
          />
        </label>

        <label className="text-sm font-medium text-[var(--orbit-midnight)]">
          Company or brand
          <input
            required
            value={form.companyName}
            onChange={(event) =>
              setForm({ ...form, companyName: event.target.value })
            }
            className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
            placeholder="Azure Bay Villas"
          />
        </label>

        <label className="text-sm font-medium text-[var(--orbit-midnight)]">
          Plan interest
          <select
            value={form.planInterest || "custom"}
            onChange={(event) =>
              setForm({
                ...form,
                planInterest: event.target.value as ContactPlanInterest,
              })
            }
            className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
          >
            {PLAN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-[var(--orbit-midnight)] sm:col-span-2">
          Message
          <textarea
            required
            minLength={20}
            rows={7}
            value={form.message}
            onChange={(event) =>
              setForm({ ...form, message: event.target.value })
            }
            className="mt-2 w-full rounded-[1.5rem] border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
            placeholder="Tell us what you are launching, where you need help, and any timing or migration details we should know."
          />
        </label>

        <label className="hidden" aria-hidden="true">
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.website || ""}
            onChange={(event) =>
              setForm({ ...form, website: event.target.value })
            }
          />
        </label>
      </div>

      {error ? (
        <p className="mt-6 rounded-2xl border border-[rgba(163,72,52,0.18)] bg-[rgba(255,244,240,0.85)] px-4 py-3 text-sm text-[#8d3b2b]">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm leading-6 text-[rgba(16,42,54,0.72)]">
          Your note goes straight to the StayLayer inbox. We use your email as
          the reply address so the follow-up stays in one thread.
        </p>
        <OrbitButton type="submit" tone="amber" disabled={submitting}>
          {submitting ? "Sending..." : "Send message"}
        </OrbitButton>
      </div>
    </form>
  );
}
