import { Link } from "react-router-dom";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <h1 className="text-lg font-semibold text-white">Not authorized</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your operator role does not grant access to this area.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
        >
          Back to Command Center
        </Link>
      </div>
    </div>
  );
}
