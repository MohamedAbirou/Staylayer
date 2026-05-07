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
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const siteId = getSiteId();
  if (!siteId) {
    return res.status(503).json({
      message: "Dedicated site form submission is not configured",
    });
  }

  try {
    const response = await fetch(`${getCmsApiUrl()}/public/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...req.body,
        siteId,
      }),
    });
    const text = await response.text();

    res.status(response.status);
    res.setHeader("Content-Type", "application/json");
    return res.send(text || "null");
  } catch (error) {
    return res.status(502).json({
      message: "Failed to submit public form",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
