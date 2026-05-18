import { APP_NAME } from "../lib/constants";

// Phase 1 placeholder login page. Phase 2 will replace the form with a real
// call to POST /operator/auth/login and handle MFA where required.
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-white">{APP_NAME}</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">
            Internal sign-in
          </p>
        </div>
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          Operator login is not wired up yet. The dedicated{" "}
          <code className="font-mono">/operator/auth/login</code> endpoint and
          form are introduced in Phase 2.
        </div>
        <p className="mt-6 text-xs text-slate-500">
          This is a separate app from the customer dashboard. Customer accounts
          cannot sign in here.
        </p>
      </div>
    </div>
  );
}
