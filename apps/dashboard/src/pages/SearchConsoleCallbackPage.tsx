import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import {
  completeSearchConsoleOAuth,
  PENDING_STATE_KEY,
} from "./seo/SearchConsolePanel";

interface PendingState {
  siteId: string;
  state: string;
  startedAt: number;
}

function readPending(): PendingState | null {
  try {
    const raw = sessionStorage.getItem(PENDING_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingState;
  } catch {
    return null;
  }
}

export default function SearchConsoleCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<
    "working" | "needs-property" | "done" | "error"
  >("working");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [propertyUrl, setPropertyUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const code = params.get("code");
  const state = params.get("state");
  const googleError = params.get("error");
  const pending = useMemo(() => readPending(), []);

  useEffect(() => {
    if (googleError) {
      setStatus("error");
      setErrorMessage(`Google declined the authorization: ${googleError}`);
      return;
    }
    if (!code || !state) {
      setStatus("error");
      setErrorMessage("Missing code or state in callback URL.");
      return;
    }
    if (!pending) {
      setStatus("error");
      setErrorMessage(
        "No pending Search Console connection found in this browser. Restart the connection flow from the SEO page.",
      );
      return;
    }
    if (pending.state !== state) {
      setStatus("error");
      setErrorMessage("OAuth state mismatch. Restart the connection flow.");
      return;
    }
    setStatus("needs-property");
  }, [code, state, googleError, pending]);

  const submit = async () => {
    if (!code || !state || !pending) return;
    if (!propertyUrl.trim()) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await completeSearchConsoleOAuth(pending.siteId, {
        code,
        state,
        propertyUrl: propertyUrl.trim(),
      });
      sessionStorage.removeItem(PENDING_STATE_KEY);
      setStatus("done");
      setTimeout(() => navigate("/seo"), 1000);
    } catch (err) {
      const e = err as {
        response?: { data?: { message?: string; code?: string } };
      };
      setErrorMessage(
        e.response?.data?.message ??
          (err instanceof Error
            ? err.message
            : "Failed to complete Google authorization"),
      );
      setStatus("needs-property");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl p-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">
          Connecting Google Search Console
        </h1>
        {status === "working" && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying authorization…
          </div>
        )}
        {status === "needs-property" && (
          <>
            <p className="mt-3 text-sm text-gray-600">
              Almost done. Confirm which Search Console property to bind this
              site to. Use the full URL exactly as it appears in Search Console
              (with trailing slash for URL-prefix properties), or use{" "}
              <code>sc-domain:example.com</code> for Domain properties.
            </p>
            <label className="mt-4 block text-xs font-semibold text-gray-700">
              Property URL
            </label>
            <input
              type="text"
              value={propertyUrl}
              onChange={(e) => setPropertyUrl(e.target.value)}
              placeholder="https://example.com/  or  sc-domain:example.com"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            {errorMessage && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {errorMessage}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !propertyUrl.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Complete connection
              </button>
              <button
                type="button"
                onClick={() => navigate("/seo")}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </>
        )}
        {status === "done" && (
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Connected. Redirecting…
          </div>
        )}
        {status === "error" && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4" />
              <div>{errorMessage}</div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/seo")}
              className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              Back to SEO
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
