import { Link } from "react-router-dom";
import { useOperatorAuth } from "../auth/useOperatorAuth";

export default function ForbiddenPage() {
  const { session, logout } = useOperatorAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <h1 className="text-lg font-semibold text-white">Not authorized</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your operator role does not grant access to this area.
        </p>
        {session ? (
          <p className="mt-2 text-xs text-slate-500">
            Signed in as{" "}
            <span className="font-medium text-slate-300">
              {session.user.email}
            </span>{" "}
            ({session.user.platformRole}).
          </p>
        ) : null}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Back to Command Center
          </Link>
          {session ? (
            <button
              type="button"
              onClick={() => {
                void logout();
              }}
              className="inline-flex items-center rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
