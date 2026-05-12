import { useRouter } from "next/router";
import { useState, useRef, useEffect } from "react";

const FLAG_EMOJI = { en: "🇬🇧", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪" };
const LANG_NAMES = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

const LanguageSelector = ({ className = "" }) => {
  const router = useRouter();
  const { locale, locales, asPath } = router;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const availableLocales = Array.isArray(locales)
    ? locales.filter(Boolean)
    : [];
  const currentLocale = locale || availableLocales[0] || "en";

  if (availableLocales.length < 2) {
    return null;
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const switchLocale = (loc) => {
    setOpen(false);
    // Persist the choice: Next.js reads NEXT_LOCALE cookie on every request,
    // so the selected language survives navigations and page refreshes.
    document.cookie = `NEXT_LOCALE=${loc}; path=/; max-age=31536000; SameSite=Lax`;
    router.push(asPath, asPath, { locale: loc });
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        aria-label="Change language"
      >
        <span>{FLAG_EMOJI[currentLocale] || "🌐"}</span>
        <span className="hidden sm:inline">{currentLocale.toUpperCase()}</span>
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-35 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {availableLocales.map((loc) => (
            <button
              key={loc}
              onClick={() => switchLocale(loc)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                currentLocale === loc
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{FLAG_EMOJI[loc] || "🌐"}</span>
              <span>{LANG_NAMES[loc] || loc.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
