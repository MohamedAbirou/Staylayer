function trimTrailingSlash(value) {
  return String(value || "").replace(/\/$/, "");
}

export function hasDedicatedSiteRuntime() {
  const serverSiteId = (process.env.SITE_ID || "").trim();
  const publicSiteId = (process.env.NEXT_PUBLIC_SITE_ID || "").trim();

  if (serverSiteId && publicSiteId && serverSiteId !== publicSiteId) {
    throw new Error(
      "SITE_ID and NEXT_PUBLIC_SITE_ID must match for dedicated site runtime routing",
    );
  }

  return Boolean(serverSiteId || publicSiteId);
}

export function getMarketingRedirect(pathname = "/") {
  const marketingBaseUrl = trimTrailingSlash(
    process.env.NEXT_PUBLIC_MARKETING_URL ||
      process.env.MARKETING_URL ||
      "http://localhost:3002",
  );
  const normalizedPath = pathname === "/" ? "" : pathname;

  return {
    redirect: {
      destination: `${marketingBaseUrl}${normalizedPath}`,
      permanent: false,
    },
  };
}