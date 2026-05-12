import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { buildMarketingLoginUrl } from "../lib/constants";

function sanitizeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

export default function MarketingLoginRedirectPage() {
  const location = useLocation();
  const requestedReturnTo = sanitizeReturnTo(
    new URLSearchParams(location.search).get("returnTo"),
  );

  useEffect(() => {
    window.location.replace(buildMarketingLoginUrl(requestedReturnTo));
  }, [requestedReturnTo]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-gray-900">
          Redirecting to the customer login...
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Customer authentication now lives in the StayLayer marketing app.
        </p>
      </div>
    </div>
  );
}