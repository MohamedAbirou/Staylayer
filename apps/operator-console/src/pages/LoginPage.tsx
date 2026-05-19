import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { APP_NAME } from "../lib/constants";
import { useOperatorAuth } from "../auth/useOperatorAuth";

interface BackendErrorBody {
  code?: string;
  message?: string;
}

function describeError(error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const body = error.response?.data as
      | { error?: BackendErrorBody; code?: string; message?: string }
      | undefined;
    const code = body?.error?.code ?? body?.code;
    const message = body?.error?.message ?? body?.message;

    if (status === 401 || code === "OPERATOR_INVALID_CREDENTIALS") {
      return "Invalid operator credentials.";
    }
    if (code === "ACCOUNT_LOCKED") {
      return message ?? "Account locked. Try again later.";
    }
    if (status === 429) {
      return "Too many sign-in attempts. Try again in a few minutes.";
    }
    if (status && status >= 500) {
      return "The operator API is unavailable. Try again shortly.";
    }
    if (message) {
      return message;
    }
  }
  return "Unable to sign in. Try again.";
}

function isSafeReturnTo(value: string | null): value is string {
  if (!value) return false;
  // Only allow same-origin, absolute paths. Prevents open-redirects.
  return value.startsWith("/") && !value.startsWith("//");
}

export default function LoginPage() {
  const { login, verifyMfa, session, loading } = useOperatorAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 12 — MFA second step. When the backend reports `mfaRequired`,
  // we hold the short-lived challenge token here and render the TOTP /
  // recovery code form in place of the password form. The challenge
  // token never leaves memory; it expires after 5 minutes regardless.
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const params = new URLSearchParams(location.search);
  const returnToParam = params.get("returnTo");
  const returnTo = isSafeReturnTo(returnToParam) ? returnToParam : "/";

  useEffect(() => {
    // If a session bootstrap completes (e.g. cookie refresh succeeded) while
    // the user is sitting on /login, send them on without forcing a click.
    if (!loading && session) {
      navigate(returnTo, { replace: true });
    }
  }, [loading, session, navigate, returnTo]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      </div>
    );
  }

  if (session) {
    return <Navigate to={returnTo} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);
    try {
      const outcome = await login(email.trim(), password);
      if (outcome.kind === "mfa-required") {
        setMfaChallenge(outcome.challengeToken);
        setMfaCode("");
      } else {
        navigate(returnTo, { replace: true });
      }
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !mfaChallenge) return;
    setError(null);
    setSubmitting(true);
    try {
      await verifyMfa(mfaChallenge, mfaCode.trim());
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      {mfaChallenge ? (
        <form
          onSubmit={handleMfaSubmit}
          noValidate
          className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl"
          aria-labelledby="operator-mfa-heading"
        >
          <div className="mb-6 text-center">
            <h1
              id="operator-mfa-heading"
              className="text-xl font-semibold text-white"
            >
              Two-factor verification
            </h1>
            <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">
              Enter authenticator code
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="mb-4 rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200"
            >
              {error}
            </div>
          ) : null}

          <label className="block text-xs font-medium text-slate-300">
            6-digit code or recovery code
            <input
              type="text"
              name="otp"
              autoComplete="one-time-code"
              inputMode="text"
              required
              minLength={6}
              maxLength={32}
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm tracking-widest text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              placeholder="123 456"
              autoFocus
            />
          </label>

          <button
            type="submit"
            disabled={submitting || mfaCode.trim().length < 6}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {submitting ? "Verifying…" : "Verify"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMfaChallenge(null);
              setMfaCode("");
              setError(null);
            }}
            className="mt-3 w-full text-xs text-slate-400 hover:text-slate-200"
          >
            Use a different account
          </button>

          <p className="mt-6 text-[11px] leading-relaxed text-slate-500">
            Lost your device and recovery codes? Ask a Platform Owner to reset
            your MFA enrollment.
          </p>
        </form>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl"
          aria-labelledby="operator-login-heading"
        >
          <div className="mb-6 text-center">
            <h1
              id="operator-login-heading"
              className="text-xl font-semibold text-white"
            >
              {APP_NAME}
            </h1>
            <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">
              Internal sign-in
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="mb-4 rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200"
            >
              {error}
            </div>
          ) : null}

          <label className="block text-xs font-medium text-slate-300">
            Email
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              placeholder="operator@staylayer.com"
            />
          </label>

          <label className="mt-4 block text-xs font-medium text-slate-300">
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || !email || password.length < 8}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <p className="mt-6 text-[11px] leading-relaxed text-slate-500">
            This is a separate app from the customer dashboard. Customer
            accounts cannot sign in here. All sign-in attempts are rate-limited
            and audited.
          </p>
        </form>
      )}
    </div>
  );
}
