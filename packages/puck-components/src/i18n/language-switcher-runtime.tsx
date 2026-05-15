import { createContext, useContext, type ReactNode } from "react";

export interface LanguageSwitcherRuntimeValue {
  pageSlug?: string | null;
  currentLocale?: string | null;
  defaultLocale?: string | null;
  availableLocales?: string[];
  buildHref?: (locale: string) => string;
}

const LanguageSwitcherRuntimeContext =
  createContext<LanguageSwitcherRuntimeValue | null>(null);

export function LanguageSwitcherRuntimeProvider({
  value,
  children,
}: {
  value: LanguageSwitcherRuntimeValue;
  children: ReactNode;
}) {
  return (
    <LanguageSwitcherRuntimeContext.Provider value={value}>
      {children}
    </LanguageSwitcherRuntimeContext.Provider>
  );
}

export function useLanguageSwitcherRuntime() {
  return useContext(LanguageSwitcherRuntimeContext);
}