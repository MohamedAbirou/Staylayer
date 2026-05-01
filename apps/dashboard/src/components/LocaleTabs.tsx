import { LOCALES } from "../lib/constants";

interface LocaleTabsProps {
  activeLocale: string | null;
  onChange: (locale: string | null) => void;
  showAll?: boolean;
}

export function LocaleTabs({
  activeLocale,
  onChange,
  showAll = true,
}: LocaleTabsProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      {showAll && (
        <button
          onClick={() => onChange(null)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeLocale === null
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          All
        </button>
      )}
      {LOCALES.map((locale) => (
        <button
          key={locale}
          onClick={() => onChange(locale)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium uppercase transition-colors ${
            activeLocale === locale
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
