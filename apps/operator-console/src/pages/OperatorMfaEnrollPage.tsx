import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import {
  operatorMfaEnrollConfirm,
  operatorMfaEnrollInitiate,
  operatorMfaRegenerateRecoveryCodes,
} from "../api/auth";
import { useOperatorAuth } from "../auth/useOperatorAuth";
import { QrCodeImage } from "../components/QrCodeImage";

/**
 * Phase 12 — operator self-service MFA enrollment.
 *
 * Flow:
 *  1. The signed-in operator clicks "Enroll" — the page calls
 *     `/operator/auth/mfa/enroll/initiate` and shows the otpauth URI
 *     + base32 secret so they can scan / paste it into an authenticator.
 *  2. They type the first 6-digit code from the authenticator and submit;
 *     the page calls `/operator/auth/mfa/enroll/confirm` which verifies
 *     the TOTP, marks the operator as enrolled, and returns 10 single-
 *     use recovery codes.
 *  3. The codes are displayed once with a strong "save these now" CTA.
 *     They are *not* persisted client-side and cannot be re-fetched.
 *
 * The page is permission-less — every authenticated operator can use it
 * for their own account. Resetting MFA for another operator goes through
 * the Platform-Owner-only path on the user detail page.
 *
 * Phase 13 additions:
 *  - QR rendering is local (`QrCodeImage`) so the page works behind
 *    strict Content-Security-Policy without allowing external image
 *    hosts.
 *  - Operators can regenerate their recovery codes any time after
 *    enrollment by submitting a fresh TOTP code. This is the supported
 *    self-service recovery path when codes are lost but the
 *    authenticator is still available.
 */
export default function OperatorMfaEnrollPage() {
  const { session } = useOperatorAuth();
  const [phase, setPhase] = useState<"start" | "verify" | "done">("start");
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [regenCode, setRegenCode] = useState("");
  const [regenCodes, setRegenCodes] = useState<string[] | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);

  // We don't have a dedicated "is enrolled" endpoint yet; the operator can
  // re-enroll any time (which rotates the secret + recovery codes), so the
  // page is always available.
  const enrollment = useQuery({
    enabled: false,
    queryKey: ["operator-self-mfa"],
    queryFn: async () => null,
  });
  void enrollment;

  const initiateMutation = useMutation({
    mutationFn: operatorMfaEnrollInitiate,
    onSuccess: (data) => {
      setSecret(data.secret);
      setOtpauthUri(data.otpauthUri);
      setPhase("verify");
      setError(null);
    },
    onError: (err: unknown) => setError(describe(err)),
  });

  const confirmMutation = useMutation({
    mutationFn: () => operatorMfaEnrollConfirm(code.trim()),
    onSuccess: (data) => {
      setRecoveryCodes(data.recoveryCodes);
      setPhase("done");
      setError(null);
    },
    onError: (err: unknown) => setError(describe(err)),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => operatorMfaRegenerateRecoveryCodes(regenCode.trim()),
    onSuccess: (data) => {
      setRegenCodes(data.recoveryCodes);
      setRegenCode("");
      setRegenError(null);
    },
    onError: (err: unknown) => setRegenError(describe(err)),
  });

  function handleVerify(event: FormEvent) {
    event.preventDefault();
    if (!code || code.trim().length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    confirmMutation.mutate();
  }

  function handleRegenerate(event: FormEvent) {
    event.preventDefault();
    if (!regenCode || regenCode.trim().length !== 6) {
      setRegenError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    regenerateMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 text-slate-100">
      <header className="mb-6 flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-cyan-400" />
        <div>
          <h1 className="text-xl font-semibold">Two-factor authentication</h1>
          <p className="text-xs text-slate-400">
            {session?.user.email ?? "Operator"} · scan with any TOTP app
            (1Password, Authy, Google Authenticator).
          </p>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200"
        >
          {error}
        </div>
      ) : null}

      {phase === "start" ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-300">
            Enrolling will rotate your MFA secret and recovery codes. The next
            sign-in to this console will require both your password and a
            6-digit code from your authenticator.
          </p>
          <button
            type="button"
            disabled={initiateMutation.isPending}
            onClick={() => initiateMutation.mutate()}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {initiateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Begin enrollment
          </button>
        </section>
      ) : null}

      {phase === "verify" && otpauthUri && secret ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-sm font-semibold text-white">
            Step 1 — Add to authenticator
          </h2>
          <p className="mt-2 text-xs text-slate-400">
            Scan the QR code or paste the secret into your authenticator app.
            Keep this window open until you have verified the first code.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-md border border-slate-800 bg-slate-950 p-4">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                Provisioning URI
              </div>
              <code className="mt-2 block break-all text-[11px] text-slate-300">
                {otpauthUri}
              </code>
              <div className="mt-3 inline-block rounded bg-white p-2">
                <QrCodeImage
                  data={otpauthUri}
                  size={160}
                  ecl="M"
                  alt="MFA QR code"
                />
              </div>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950 p-4">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                Manual secret (base32)
              </div>
              <code className="mt-2 block break-all text-[12px] tracking-widest text-slate-200">
                {secret}
              </code>
              <p className="mt-3 text-[11px] text-slate-500">
                30-second time step · SHA-1 · 6 digits.
              </p>
            </div>
          </div>

          <form onSubmit={handleVerify} className="mt-6">
            <h2 className="text-sm font-semibold text-white">
              Step 2 — Verify
            </h2>
            <label className="mt-2 block text-xs text-slate-300">
              6-digit code
              <input
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm tracking-widest text-white"
                placeholder="123456"
              />
            </label>
            <button
              type="submit"
              disabled={confirmMutation.isPending || code.length !== 6}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {confirmMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Confirm and finish
            </button>
          </form>
        </section>
      ) : null}

      {phase === "done" && recoveryCodes ? (
        <section className="rounded-2xl border border-emerald-900 bg-emerald-950/30 p-6">
          <h2 className="text-sm font-semibold text-emerald-200">
            Enrollment complete — save your recovery codes
          </h2>
          <p className="mt-2 text-xs text-emerald-200/80">
            Each code can be used <strong>once</strong> as a substitute for a
            TOTP code when signing in. Save them in a password manager now. They
            will not be shown again.
          </p>
          <ol className="mt-4 grid grid-cols-2 gap-2 font-mono text-[13px] text-emerald-100">
            {recoveryCodes.map((rc) => (
              <li
                key={rc}
                className="rounded border border-emerald-800 bg-emerald-950 px-3 py-1.5 tracking-widest"
              >
                {rc}
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(recoveryCodes.join("\n"))
                .catch(() => undefined);
            }}
            className="mt-4 rounded-md border border-emerald-800 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-900/40"
          >
            Copy all to clipboard
          </button>
        </section>
      ) : null}

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <header className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-amber-300" />
          <h2 className="text-sm font-semibold text-white">
            Regenerate recovery codes
          </h2>
        </header>
        <p className="mt-2 text-xs text-slate-400">
          If you have lost your saved recovery codes but your authenticator app
          still works, regenerate a fresh set here. This invalidates the
          previous codes. If you have lost <em>both</em>, contact a Platform
          Owner to reset your MFA.
        </p>

        {regenError ? (
          <div
            role="alert"
            className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200"
          >
            {regenError}
          </div>
        ) : null}

        {regenCodes ? (
          <div className="mt-4 rounded-md border border-emerald-900 bg-emerald-950/30 p-4">
            <p className="text-xs text-emerald-200">
              New recovery codes — save them now. The previous codes no longer
              work.
            </p>
            <ol className="mt-3 grid grid-cols-2 gap-2 font-mono text-[13px] text-emerald-100">
              {regenCodes.map((rc) => (
                <li
                  key={rc}
                  className="rounded border border-emerald-800 bg-emerald-950 px-3 py-1.5 tracking-widest"
                >
                  {rc}
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(regenCodes.join("\n"))
                  .catch(() => undefined);
              }}
              className="mt-3 rounded-md border border-emerald-800 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-900/40"
            >
              Copy all to clipboard
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleRegenerate}
            className="mt-3 flex items-end gap-2"
          >
            <label className="block text-xs text-slate-300">
              Current 6-digit code
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                value={regenCode}
                onChange={(event) =>
                  setRegenCode(
                    event.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                className="mt-1 w-40 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm tracking-widest text-white"
                placeholder="123456"
              />
            </label>
            <button
              type="submit"
              disabled={regenerateMutation.isPending || regenCode.length !== 6}
              className="inline-flex items-center gap-2 rounded-md border border-amber-700 bg-amber-700/30 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-700/50 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
            >
              {regenerateMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : null}
              Regenerate codes
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function describe(err: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (err as any)?.response?.data;
  return (
    data?.error?.message ??
    data?.message ??
    "Unable to complete MFA enrollment. Try again."
  );
}
