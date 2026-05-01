import fs from 'fs';
import path from 'path';

const readJSON = (p) => {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
};

const deepMerge = (base, override) => {
    if (Array.isArray(base) || Array.isArray(override)) return override ?? base;
    const out = { ...base };
    for (const [k, v] of Object.entries(override || {})) {
        const bv = base?.[k];
        out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(bv, v) : v;
    }
    return out;
};

export const getTranslations = async (locale, pageFile) => {
    const localesDir = path.join(process.cwd(), 'locales');
    const page = pageFile || 'index'; // default if you want

    const en = readJSON(path.join(localesDir, 'en', `${page}.json`));
    const loc = locale === 'en' ? {} : readJSON(path.join(localesDir, locale || 'en', `${page}.json`));

    return deepMerge(en, loc);
};
