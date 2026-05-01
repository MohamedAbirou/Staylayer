// pages/api/translations/[locale].js
export default async function handler(req, res) {
    const { locale } = req.query;
    const ns = (req.query.ns || '').split(',').filter(Boolean); // e.g. ?ns=common,home

    const all = await getTranslations(locale); // your existing loader

    // Minimal payload: allow namespaced selection
    const pick = (obj, keys) =>
        keys.reduce((acc, k) => (obj[k] != null ? (acc[k] = obj[k], acc) : acc), {});

    const payload = ns.length
        ? pick(all, ns)
        : all; // fallback: full for debugging; you can restrict in prod if you like

    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json(payload);
}
