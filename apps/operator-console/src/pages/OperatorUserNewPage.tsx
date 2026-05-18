import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, ArrowLeft, AlertTriangle } from "lucide-react";

import { createOperatorUser, type PlatformRole } from "../api/operator";

const PASSWORD_MIN = 12;
const REASON_MIN = 8;

interface FormState {
  email: string;
  password: string;
  confirm: string;
  platformRole: PlatformRole;
  reason: string;
}

const INITIAL: FormState = {
  email: "",
  password: "",
  confirm: "",
  platformRole: "SUPPORT_ADMIN",
  reason: "",
};

function passwordComplexity(password: string): string | null {
  if (password.length < PASSWORD_MIN)
    return `Must be at least ${PASSWORD_MIN} characters.`;
  if (!/[A-Z]/.test(password)) return "Must include an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Must include a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Must include a digit.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Must include a symbol.";
  return null;
}

export default function OperatorUserNewPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [state, setState] = useState<FormState>(INITIAL);
  const [serverError, setServerError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createOperatorUser,
    onSuccess: (detail) => {
      void qc.invalidateQueries({ queryKey: ["operator-users"] });
      navigate(`/operator-users/${detail.id}`);
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === "object" && "response" in err
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((err as any).response?.data?.message as string | undefined)
          : undefined;
      setServerError(message ?? "Failed to create operator user.");
    },
  });

  const pwError = state.password ? passwordComplexity(state.password) : null;
  const mismatch = state.confirm.length > 0 && state.confirm !== state.password;
  const reasonTooShort = state.reason.trim().length < REASON_MIN;
  const valid =
    state.email.includes("@") &&
    !pwError &&
    !mismatch &&
    !reasonTooShort &&
    state.password.length >= PASSWORD_MIN &&
    state.confirm === state.password;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setServerError(null);
    mutation.mutate({
      email: state.email.trim(),
      password: state.password,
      platformRole: state.platformRole,
      reason: state.reason.trim(),
    });
  }

  return (
    <div className="px-8 py-8">
      <Link
        to="/operator-users"
        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to operator users
      </Link>
      <header className="mt-4 flex items-center gap-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-cyan-400">
          <UserPlus className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">
            Create operator user
          </h1>
          <p className="text-xs text-slate-400">
            Grants access to the operator console. The new user must change
            their password on first login.
          </p>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mt-6 max-w-2xl space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6"
      >
        <Field
          label="Email"
          hint="Use a dedicated operator address. Customer accounts cannot be reused."
        >
          <input
            type="email"
            required
            autoComplete="off"
            value={state.email}
            onChange={(event) => update("email", event.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-700 focus:outline-none"
          />
        </Field>

        <Field
          label="Platform role"
          hint="Defines which operator surfaces this user can read and mutate."
        >
          <select
            value={state.platformRole}
            onChange={(event) =>
              update("platformRole", event.target.value as PlatformRole)
            }
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-700 focus:outline-none"
          >
            <option value="PLATFORM_OWNER">Platform Owner — full access</option>
            <option value="SUPPORT_ADMIN">Support Admin — support + ops</option>
            <option value="FINANCE_ADMIN">
              Finance Admin — billing + reconciliation
            </option>
          </select>
        </Field>

        <Field
          label="Temporary password"
          hint={`Minimum ${PASSWORD_MIN} chars with upper, lower, digit, symbol.`}
          error={pwError}
        >
          <input
            type="password"
            required
            autoComplete="new-password"
            value={state.password}
            onChange={(event) => update("password", event.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-700 focus:outline-none"
          />
        </Field>

        <Field
          label="Confirm password"
          error={mismatch ? "Passwords do not match." : null}
        >
          <input
            type="password"
            required
            autoComplete="new-password"
            value={state.confirm}
            onChange={(event) => update("confirm", event.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-700 focus:outline-none"
          />
        </Field>

        <Field
          label="Reason (audited)"
          hint={`Minimum ${REASON_MIN} characters. Logged immutably for this action.`}
        >
          <textarea
            required
            rows={3}
            minLength={REASON_MIN}
            maxLength={500}
            value={state.reason}
            onChange={(event) => update("reason", event.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-700 focus:outline-none"
          />
        </Field>

        {serverError ? (
          <div className="flex items-center gap-2 rounded-md border border-rose-800 bg-rose-950 px-3 py-2 text-xs text-rose-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            {serverError}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Link
            to="/operator-users"
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!valid || mutation.isPending}
            className="rounded-md border border-cyan-700 bg-cyan-900/60 px-4 py-1.5 text-xs font-semibold text-cyan-50 hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? "Creating…" : "Create operator user"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {error ? (
        <p className="mt-1 text-[11px] text-rose-300">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
      ) : null}
    </label>
  );
}
