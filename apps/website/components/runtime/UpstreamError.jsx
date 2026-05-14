// Branded fallback rendered when the upstream Public Runtime API cannot be
// reached or returns a non-404 error. Keeps the user on a styled page that
// matches the platform's tone instead of falling through to a misleading
// "Page not found" or a raw 500.
export function UpstreamError({ requestId }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 py-16 text-center">
      <div className="max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7 text-amber-600"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-gray-900">
          We can&apos;t reach this site right now
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          Our publishing service is temporarily unavailable. Please refresh in a
          moment. If the problem persists, contact the site operator.
        </p>
        {requestId ? (
          <p className="mt-6 text-xs text-gray-400">
            Reference: <code className="font-mono">{requestId}</code>
          </p>
        ) : null}
      </div>
    </main>
  );
}
