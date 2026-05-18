import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * Modal dialog used to capture a free-text "reason" before a sensitive
 * operator mutation is dispatched. Sensitive endpoints on the backend
 * (assign / status / resolve / reopen / close / handoff.open / handoff.close)
 * have an audit interceptor that REQUIRES a non-empty `reason` field in
 * the request body — this component is the canonical UX for that.
 *
 * Invariants:
 *  - Backend trims/truncates reasons to 2000 chars; we enforce the same
 *    limit and a 1-char minimum so the audit log is meaningful.
 *  - The modal is rendered as a child of <body> via a fixed overlay so it
 *    sits above sticky headers and table containers.
 *  - When `submitting` is true the form is locked and a busy state is
 *    surfaced. Errors propagated by the caller can be shown via `error`.
 */
export interface ReasonModalProps {
  open: boolean;
  title: string;
  description?: string;
  /** Optional helper preset shown above the textarea (e.g. "Resolution"). */
  fieldLabel?: string;
  confirmLabel?: string;
  confirmTone?: "primary" | "danger";
  /** Optional secondary free-text input rendered above the reason field. */
  secondaryField?: {
    label: string;
    placeholder?: string;
    value: string;
    onChange: (next: string) => void;
    maxLength?: number;
    rows?: number;
    required?: boolean;
  };
  /** Arbitrary content rendered above the reason field (e.g. selectors). */
  slotBefore?: React.ReactNode;
  /** When true, blocks confirmation regardless of other validation. */
  extraInvalid?: boolean;
  /** Whether the reason field is required (defaults to true). */
  reasonRequired?: boolean;
  /** Minimum length when required (defaults to 1). */
  minReasonLength?: number;
  maxReasonLength?: number;
  submitting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => unknown | Promise<unknown>;
  /** When true a stronger "DANGER" banner is rendered. */
  highRisk?: boolean;
  /** When highRisk, the operator must type this token to enable confirm. */
  highRiskToken?: string;
}

const MAX_REASON = 2000;

export function ReasonModal({
  open,
  title,
  description,
  fieldLabel = "Reason",
  confirmLabel = "Confirm",
  confirmTone = "primary",
  secondaryField,
  slotBefore,
  extraInvalid,
  reasonRequired = true,
  minReasonLength = 1,
  maxReasonLength = MAX_REASON,
  submitting,
  error,
  onCancel,
  onConfirm,
  highRisk,
  highRiskToken,
}: ReasonModalProps) {
  const [reason, setReason] = useState("");
  const [token, setToken] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const headingId = useId();
  const descId = useId();

  const handleClose = useCallback(() => {
    if (submitting) return;
    onCancel();
  }, [onCancel, submitting]);

  useEffect(() => {
    if (!open) {
      setReason("");
      setToken("");
      return;
    }
    const id = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  if (!open) return null;

  const trimmedReason = reason.trim();
  const reasonValid = reasonRequired
    ? trimmedReason.length >= minReasonLength &&
      trimmedReason.length <= maxReasonLength
    : trimmedReason.length <= maxReasonLength;
  const secondaryValid =
    !secondaryField?.required || secondaryField.value.trim().length > 0;
  const tokenValid = !highRisk || !highRiskToken || token === highRiskToken;
  const canSubmit =
    !submitting && reasonValid && secondaryValid && tokenValid && !extraInvalid;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    void onConfirm(trimmedReason);
  };

  const confirmClass =
    confirmTone === "danger"
      ? "bg-rose-600 text-white hover:bg-rose-500 disabled:bg-rose-900 disabled:text-rose-300"
      : "bg-cyan-600 text-white hover:bg-cyan-500 disabled:bg-cyan-900 disabled:text-cyan-300";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={description ? descId : undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 id={headingId} className="text-base font-semibold text-white">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1 text-xs text-slate-400">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
            disabled={submitting}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 px-5 py-4">
          {highRisk ? (
            <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                This is an irreversible operator action. It will be recorded in
                the operator audit log with your reason.
              </p>
            </div>
          ) : null}

          {secondaryField ? (
            <label className="block text-xs text-slate-300">
              <span className="mb-1 block font-medium text-slate-200">
                {secondaryField.label}
                {secondaryField.required ? (
                  <span className="ml-1 text-rose-400">*</span>
                ) : (
                  <span className="ml-1 text-slate-500">(optional)</span>
                )}
              </span>
              <textarea
                rows={secondaryField.rows ?? 3}
                value={secondaryField.value}
                onChange={(event) =>
                  secondaryField.onChange(event.target.value)
                }
                maxLength={secondaryField.maxLength ?? 20000}
                placeholder={secondaryField.placeholder}
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </label>
          ) : null}

          {slotBefore}

          <label className="block text-xs text-slate-300">
            <span className="mb-1 block font-medium text-slate-200">
              {fieldLabel}
              {reasonRequired ? (
                <span className="ml-1 text-rose-400">*</span>
              ) : null}
            </span>
            <textarea
              ref={textareaRef}
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={maxReasonLength}
              placeholder="Explain why this action is necessary…"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <span className="mt-1 block text-[10px] uppercase tracking-widest text-slate-500">
              {trimmedReason.length} / {maxReasonLength}
            </span>
          </label>

          {highRisk && highRiskToken ? (
            <label className="block text-xs text-slate-300">
              <span className="mb-1 block font-medium text-slate-200">
                Type{" "}
                <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-rose-300">
                  {highRiskToken}
                </span>{" "}
                to confirm
              </span>
              <input
                type="text"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoComplete="off"
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-rose-500 focus:outline-none"
              />
            </label>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
            >
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-800 bg-slate-950/40 px-5 py-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={[
              "rounded-md px-3 py-1.5 text-xs font-semibold",
              confirmClass,
            ].join(" ")}
          >
            {submitting ? "Working…" : confirmLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}
