function getCmsApiUrl() {
  return (
    process.env.CMS_API_URL ||
    process.env.NEXT_PUBLIC_CMS_API_URL ||
    "http://localhost:4000"
  );
}

function getSiteId() {
  return (
    (process.env.SITE_ID || process.env.NEXT_PUBLIC_SITE_ID || "").trim() ||
    null
  );
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const siteId = getSiteId();
  if (!siteId) {
    return res.status(503).json({
      message: "Dedicated site form resolution is not configured",
    });
  }

  const url = new URL("/public/forms/resolve", getCmsApiUrl());
  url.searchParams.set("siteId", siteId);

  for (const [key, value] of Object.entries(req.query)) {
    if (key === "siteId") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry) {
          url.searchParams.append(key, String(entry));
        }
      }
      continue;
    }

    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const text = await response.text();

    res.status(response.status);
    res.setHeader("Content-Type", "application/json");
    return res.send(text || "null");
  } catch (error) {
    return res.status(502).json({
      message: "Failed to resolve public form",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
