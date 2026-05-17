// ─── Curated Google Fonts catalog ──────────────────────────────────────────
// Grouped by category so customers can pick a font that matches the tone
// of their property (lodge, villa, boutique hotel, etc.). The value is the
// exact family name as it appears in the Google Fonts CSS2 API.

export type FontCategory =
  | "Sans Serif"
  | "Serif"
  | "Display"
  | "Handwriting"
  | "Monospace";

export interface FontDefinition {
  family: string;
  category: FontCategory;
  weights: string; // CSS2 weight axis spec, e.g. "wght@300;400;500;600;700"
}

export const GOOGLE_FONTS: FontDefinition[] = [
  // Sans Serif — modern, clean, hospitality-friendly defaults
  { family: "Inter", category: "Sans Serif", weights: "wght@300;400;500;600;700;800" },
  { family: "Plus Jakarta Sans", category: "Sans Serif", weights: "wght@300;400;500;600;700;800" },
  { family: "DM Sans", category: "Sans Serif", weights: "wght@300;400;500;700" },
  { family: "Manrope", category: "Sans Serif", weights: "wght@300;400;500;600;700;800" },
  { family: "Poppins", category: "Sans Serif", weights: "wght@300;400;500;600;700" },
  { family: "Nunito", category: "Sans Serif", weights: "wght@300;400;600;700;800" },
  { family: "Nunito Sans", category: "Sans Serif", weights: "wght@300;400;600;700;800" },
  { family: "Work Sans", category: "Sans Serif", weights: "wght@300;400;500;600;700" },
  { family: "Mulish", category: "Sans Serif", weights: "wght@300;400;600;700;800" },
  { family: "Rubik", category: "Sans Serif", weights: "wght@300;400;500;600;700" },
  { family: "Outfit", category: "Sans Serif", weights: "wght@300;400;500;600;700" },
  { family: "Sora", category: "Sans Serif", weights: "wght@300;400;500;600;700" },
  { family: "Lato", category: "Sans Serif", weights: "wght@300;400;700;900" },
  { family: "Open Sans", category: "Sans Serif", weights: "wght@300;400;500;600;700" },
  { family: "Roboto", category: "Sans Serif", weights: "wght@300;400;500;700" },
  { family: "Source Sans 3", category: "Sans Serif", weights: "wght@300;400;600;700" },
  { family: "Montserrat", category: "Sans Serif", weights: "wght@300;400;500;600;700" },
  { family: "Raleway", category: "Sans Serif", weights: "wght@300;400;500;600;700" },
  { family: "Karla", category: "Sans Serif", weights: "wght@300;400;500;700" },
  { family: "Be Vietnam Pro", category: "Sans Serif", weights: "wght@300;400;500;600;700" },

  // Serif — editorial, boutique, villa rentals
  { family: "Playfair Display", category: "Serif", weights: "wght@400;500;600;700;800" },
  { family: "Cormorant Garamond", category: "Serif", weights: "wght@300;400;500;600;700" },
  { family: "Lora", category: "Serif", weights: "wght@400;500;600;700" },
  { family: "Merriweather", category: "Serif", weights: "wght@300;400;700;900" },
  { family: "Source Serif 4", category: "Serif", weights: "wght@300;400;600;700" },
  { family: "EB Garamond", category: "Serif", weights: "wght@400;500;600;700" },
  { family: "Crimson Pro", category: "Serif", weights: "wght@300;400;500;600;700" },
  { family: "Libre Baskerville", category: "Serif", weights: "wght@400;700" },
  { family: "Libre Caslon Text", category: "Serif", weights: "wght@400;700" },
  { family: "Bitter", category: "Serif", weights: "wght@300;400;500;600;700" },
  { family: "PT Serif", category: "Serif", weights: "wght@400;700" },
  { family: "Spectral", category: "Serif", weights: "wght@300;400;500;600;700" },
  { family: "Fraunces", category: "Serif", weights: "wght@300;400;500;600;700;800" },
  { family: "DM Serif Display", category: "Serif", weights: "wght@400" },
  { family: "DM Serif Text", category: "Serif", weights: "wght@400" },

  // Display — bold accents, hero typography
  { family: "Bebas Neue", category: "Display", weights: "wght@400" },
  { family: "Oswald", category: "Display", weights: "wght@300;400;500;600;700" },
  { family: "Archivo", category: "Display", weights: "wght@300;400;500;600;700;800" },
  { family: "Archivo Black", category: "Display", weights: "wght@400" },
  { family: "Abril Fatface", category: "Display", weights: "wght@400" },
  { family: "Anton", category: "Display", weights: "wght@400" },
  { family: "Righteous", category: "Display", weights: "wght@400" },
  { family: "Comfortaa", category: "Display", weights: "wght@300;400;500;600;700" },
  { family: "Quicksand", category: "Display", weights: "wght@300;400;500;600;700" },
  { family: "Josefin Sans", category: "Display", weights: "wght@300;400;500;600;700" },

  // Handwriting — accents, captions, signatures
  { family: "Caveat", category: "Handwriting", weights: "wght@400;500;600;700" },
  { family: "Dancing Script", category: "Handwriting", weights: "wght@400;500;600;700" },
  { family: "Great Vibes", category: "Handwriting", weights: "wght@400" },
  { family: "Pacifico", category: "Handwriting", weights: "wght@400" },
  { family: "Sacramento", category: "Handwriting", weights: "wght@400" },
  { family: "Parisienne", category: "Handwriting", weights: "wght@400" },

  // Monospace — technical accents
  { family: "JetBrains Mono", category: "Monospace", weights: "wght@300;400;500;600;700" },
  { family: "Fira Code", category: "Monospace", weights: "wght@300;400;500;600;700" },
  { family: "IBM Plex Mono", category: "Monospace", weights: "wght@300;400;500;600;700" },
];

const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const FONT_CATEGORY_FALLBACK: Record<FontCategory, string> = {
  "Sans Serif": "sans-serif",
  Serif: "serif",
  Display: "sans-serif",
  Handwriting: "cursive",
  Monospace: "monospace",
};

const normalizeFamily = (raw: string | undefined): string => {
  if (!raw) return "";
  // Strip wrapping single/double quotes from legacy stored values
  // (e.g. "'Plus Jakarta Sans'").
  return raw.replace(/^['"]+|['"]+$/g, "").trim();
};

// ─── Public helpers ────────────────────────────────────────────────────────

/**
 * Build the option list rendered inside the page-level Font Family select.
 * Category prefix in the label gives a lightweight visual grouping inside the
 * flat Puck select.
 */
export const fontFamilyOptions = (): Array<{ label: string; value: string }> => [
  { label: "System Default", value: "system" },
  ...GOOGLE_FONTS.map((f) => ({
    label: `${f.category} · ${f.family}`,
    value: f.family,
  })),
];

/**
 * Build a Google Fonts CSS2 stylesheet URL for the selected family, or null
 * when the family is the system stack / not in the curated catalog.
 */
export const googleFontsStylesheetUrl = (
  fontFamily: string | undefined,
): string | null => {
  const family = normalizeFamily(fontFamily);
  if (!family || family === "system") return null;
  const def = GOOGLE_FONTS.find((f) => f.family === family);
  if (!def) return null;
  const familyParam = `${def.family.replace(/\s+/g, "+")}:${def.weights}`;
  return `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`;
};

/**
 * Resolve the css `font-family` value (with a category-aware fallback) for a
 * page-level selection.
 */
export const resolveFontFamilyCss = (
  fontFamily: string | undefined,
): string => {
  const family = normalizeFamily(fontFamily);
  if (!family || family === "system") return SYSTEM_FONT_STACK;
  const def = GOOGLE_FONTS.find((f) => f.family === family);
  const fallback = def ? FONT_CATEGORY_FALLBACK[def.category] : "sans-serif";
  return `"${family}", ${fallback}`;
};
