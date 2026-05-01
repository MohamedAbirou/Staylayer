import { useRouter } from 'next/router';
import { useCallback, useMemo } from 'react';

const getByPath = (obj, path) => {
    return path
        .split('.')
        .reduce((acc, part) => (acc && acc[part] != null ? acc[part] : undefined), obj);
};

const format = (str, values) => {
    if (typeof str !== 'string' || !values) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => (values[k] ?? `{${k}}`));
};
export function createT(messages) {
    const getByPath = (obj, path) =>
        path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);

    return (key, opts = {}) => {
        const val = getByPath(messages, key);

        if (opts.returnObjects) {
            // return arrays/objects as-is for lists/sections
            return (val && typeof val === 'object') ? val : undefined;
        }

        // default to empty string if missing or non-string
        return typeof val === 'string' ? val : (val != null ? String(val) : '');
    };
}


export const useTranslation = (translations) => {
    const { locale, defaultLocale } = useRouter();
    const dict = useMemo(() => {
        if (!translations) return {};
        if (translations.en || translations[locale]) {
            return (
                translations[locale] ||
                translations[defaultLocale] ||
                translations.en ||
                {}
            );
        }
        return translations;
    }, [translations, locale, defaultLocale]);

    const t = useCallback(
        (key, values) => {
            const raw = getByPath(dict, key);
            if (raw == null) {
                if (process.env.NODE_ENV !== 'production') {
                    console.warn(`[i18n] Missing key "${key}" for locale "${locale}"`);
                }
                return key;
            }
            return typeof raw === 'string' ? format(raw, values) : raw;
        },
        [dict, locale]
    );

    return { t, locale };
};
