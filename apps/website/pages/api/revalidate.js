import crypto from "crypto";

const LOCALES = ["en", "es", "fr", "de"];

function secretsMatch(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const secret = req.headers["x-revalidate-secret"];
  if (!secretsMatch(secret, process.env.REVALIDATION_SECRET)) {
    return res.status(401).json({ message: "Invalid revalidation secret" });
  }

  const { slug } = req.body;
  if (!slug) {
    return res.status(400).json({ message: "Missing slug" });
  }

  try {
    const results = await Promise.allSettled(
      LOCALES.map(async (locale) => {
        const path = locale === "en" ? `/${slug}` : `/${locale}/${slug}`;
        await res.revalidate(path);
        return { locale, path, status: "ok" };
      }),
    );

    // Also revalidate the homepage if slug is 'index' or 'home'
    if (slug === "index" || slug === "home" || slug === "") {
      await Promise.allSettled(
        LOCALES.map((locale) =>
          res.revalidate(locale === "en" ? "/" : `/${locale}`),
        ),
      );
    }

    return res.json({
      revalidated: true,
      results: results.map((r) =>
        r.status === "fulfilled"
          ? r.value
          : { status: "error", reason: r.reason?.message },
      ),
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Revalidation failed", error: err.message });
  }
}
