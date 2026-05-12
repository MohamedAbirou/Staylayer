"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { OrbitButton } from "@/components/orbit-button";
import {
  type LegalDocumentSummary,
  sanitizeReturnTo,
  type RegisterResponse,
  getBrowserApiBaseUrl,
} from "@/lib/public-api";
import { PLAN_SELECTION_COPY, type MarketingPlanKey } from "@/lib/pricing-flow";

interface RegisterFormProps {
  legalDocuments: LegalDocumentSummary[];
  selectedPlanKey?: MarketingPlanKey | null;
  returnTo?: string | null;
}

interface RegisterState {
  name: string;
  workEmail: string;
  password: string;
  companyName: string;
  propertyName: string;
  hospitalityType: string;
  primaryLocale: string;
}

const INITIAL_STATE: RegisterState = {
  name: "",
  workEmail: "",
  password: "",
  companyName: "",
  propertyName: "",
  hospitalityType: "VACATION_RENTAL",
  primaryLocale: "en",
};

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message || "Unable to create the workspace";
  } catch {
    return "Unable to create the workspace";
  }
}

export function RegisterForm({
  legalDocuments,
  selectedPlanKey,
  returnTo,
}: RegisterFormProps) {
  const [form, setForm] = useState(INITIAL_STATE);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedKeys, setAcceptedKeys] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const planCopy = PLAN_SELECTION_COPY[selectedPlanKey || "free"];
  const safeReturnTo = sanitizeReturnTo(returnTo || null);
  const buttonLabel =
    selectedPlanKey && selectedPlanKey !== "free"
      ? "Create workspace and continue"
      : "Create free workspace";
  const loginHref = safeReturnTo
    ? `/login?returnTo=${encodeURIComponent(safeReturnTo)}`
    : "/login";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    if (form.password !== confirmPassword) {
      setSubmitting(false);
      setError("Password confirmation does not match.");
      return;
    }

    const missingAcceptance = legalDocuments.find(
      (document) => !acceptedKeys.includes(document.key),
    );

    if (missingAcceptance) {
      setSubmitting(false);
      setError(`You must accept ${missingAcceptance.title} to continue.`);
      return;
    }

    try {
      const response = await fetch(
        `${getBrowserApiBaseUrl()}/public/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            ...form,
            legalAcceptances: legalDocuments.map((document) => ({
              documentKey: document.key,
              version: document.version,
            })),
          }),
        },
      );

      if (!response.ok) {
        setError(await extractErrorMessage(response));
        return;
      }

      const payload = (await response.json()) as RegisterResponse;
      if (!payload.accepted || !payload.verificationRequired) {
        setError(
          "Your workspace was created, but verification could not start.",
        );
        return;
      }

      const redirectUrl = new URL(payload.redirectTo, window.location.origin);
      if (safeReturnTo) {
        redirectUrl.searchParams.set("returnTo", safeReturnTo);
      }
      window.location.href = `${redirectUrl.pathname}${redirectUrl.search}`;
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
          Workspace setup
        </p>
        <h1 className="orbit-heading text-4xl text-[var(--orbit-midnight)]">
          {planCopy.registerTitle}
        </h1>
        <p className="text-sm leading-6 text-[rgba(16,42,54,0.72)]">
          {planCopy.registerSummary} Email verification activates customer
          access before the first dashboard session begins.
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
          />
        </label>

        <label className="text-sm font-medium text-[var(--orbit-midnight)]">
          Work email
          <input
            type="email"
            required
            value={form.workEmail}
            onChange={(event) =>
              setForm({ ...form, workEmail: event.target.value })
            }
            className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
          />
        </label>

        <label className="text-sm font-medium text-[var(--orbit-midnight)]">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
            className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
          />
        </label>

        <label className="text-sm font-medium text-[var(--orbit-midnight)]">
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

        <label className="text-sm font-medium text-[var(--orbit-midnight)]">
          Company or brand name
          <input
            required
            value={form.companyName}
            onChange={(event) =>
              setForm({ ...form, companyName: event.target.value })
            }
            className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
          />
        </label>

        <label className="text-sm font-medium text-[var(--orbit-midnight)] sm:col-span-2">
          First property or site name
          <input
            required
            value={form.propertyName}
            onChange={(event) =>
              setForm({ ...form, propertyName: event.target.value })
            }
            className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
          />
        </label>

        <label className="text-sm font-medium text-[var(--orbit-midnight)]">
          Hospitality type
          <select
            value={form.hospitalityType}
            onChange={(event) =>
              setForm({ ...form, hospitalityType: event.target.value })
            }
            className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
          >
            <option value="VACATION_RENTAL">Villa</option>
            <option value="BOUTIQUE_HOTEL">Boutique hotel</option>
            <option value="BNB">B&amp;B</option>
            <option value="GUEST_HOUSE">Guest house</option>
            <option value="GLAMPING">Glamping</option>
          </select>
        </label>

        <label className="text-sm font-medium text-[var(--orbit-midnight)]">
          Primary locale
          <select
            value={form.primaryLocale}
            onChange={(event) =>
              setForm({ ...form, primaryLocale: event.target.value })
            }
            className="mt-2 w-full rounded-2xl border border-[rgba(16,42,54,0.12)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--orbit-teal)] focus:ring-2 focus:ring-[rgba(44,140,136,0.16)]"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </label>
      </div>

      <div className="mt-8 space-y-4 rounded-[1.6rem] border border-[rgba(16,42,54,0.1)] bg-[rgba(255,255,255,0.6)] p-5">
        <p className="orbit-kicker text-xs text-[rgba(16,42,54,0.55)]">
          Required legal acceptance
        </p>
        {legalDocuments.map((document) => {
          const checked = acceptedKeys.includes(document.key);

          return (
            <label
              key={document.key}
              className="flex items-start gap-3 text-sm text-[rgba(16,42,54,0.76)]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  setAcceptedKeys((previous) => {
                    if (event.target.checked) {
                      return [...previous, document.key];
                    }

                    return previous.filter((key) => key !== document.key);
                  });
                }}
                className="mt-1 h-4 w-4 rounded border-[rgba(16,42,54,0.2)] text-[var(--orbit-midnight)]"
              />
              <span>
                I accept the{" "}
                <Link
                  href={`/legal/${document.slug}`}
                  className="font-semibold text-[var(--orbit-midnight)] underline decoration-[rgba(16,42,54,0.2)] underline-offset-4"
                >
                  {document.title}
                </Link>{" "}
                version {document.version}.
              </span>
            </label>
          );
        })}
      </div>

      {error ? (
        <p className="mt-6 rounded-2xl border border-[rgba(163,72,52,0.18)] bg-[rgba(255,244,240,0.85)] px-4 py-3 text-sm text-[#8d3b2b]">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm leading-6 text-[rgba(16,42,54,0.72)]">
          We always create the workspace first so billing, domains, and access
          permissions stay attached to the right account from day one.
        </p>
        <OrbitButton type="submit" tone="amber" disabled={submitting}>
          {submitting ? "Creating workspace..." : buttonLabel}
        </OrbitButton>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-[rgba(16,42,54,0.72)]">
        <Link href={loginHref} className="hover:text-[var(--orbit-midnight)]">
          Already have a workspace? Sign in
        </Link>
      </div>
    </form>
  );
}
