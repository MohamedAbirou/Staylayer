import crypto from "crypto";

const SUPPORTED_LOCALES = ["en", "es", "fr", "de"];

function parseLocales() {
  const primaryLocale = (process.env.PRIMARY_LOCALE || "en").trim() || "en";
  const configuredLocales = (process.env.ENABLED_LOCALES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const locales = Array.from(new Set([primaryLocale, ...configuredLocales]));
  const invalidLocales = locales.filter(
    (locale) => !SUPPORTED_LOCALES.includes(locale),
  );

  if (!SUPPORTED_LOCALES.includes(primaryLocale) || invalidLocales.length > 0) {
    throw new Error(
      `Unsupported locale configuration for dedicated site runtime: ${locales.join(", ")}`,
    );
  }

  return locales;
}

function getRevalidationSecret() {
  return process.env.REVALIDATE_SECRET || process.env.REVALIDATION_SECRET || "";
}

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
  if (!secretsMatch(secret, getRevalidationSecret())) {
    return res.status(401).json({ message: "Invalid revalidation secret" });
  }

  const { slug } = req.body;
  if (!slug) {
    return res.status(400).json({ message: "Missing slug" });
  }

  try {
    const locales = parseLocales();
    const results = await Promise.allSettled(
      locales.map(async (locale) => {
        const path = locale === "en" ? `/${slug}` : `/${locale}/${slug}`;
        await res.revalidate(path);
        return { locale, path, status: "ok" };
      }),
    );

    // Also revalidate the homepage if slug is 'index' or 'home'
    if (slug === "index" || slug === "home" || slug === "") {
      await Promise.allSettled(
        locales.map((locale) =>
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
