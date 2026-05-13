/**
 * Extracts translatable text segments from Puck JSON page data and
 * re-injects translated text back into the structure. Preserves
 * component types, IDs, layout keys, links, asset references, numeric
 * values, booleans, and any technical/structural keys.
 */

const NON_TRANSLATABLE_VALUE_KEYS = new Set([
  "id",
  "type",
  "readOnly",
  "index",
  "zone",
  "href",
  "src",
  "url",
  "link",
  "icon",
  "iconName",
  "image",
  "imageSrc",
  "imageUrl",
  "videoUrl",
  "embedUrl",
  "color",
  "backgroundColor",
  "textColor",
  "borderColor",
  "className",
  "variant",
  "size",
  "width",
  "height",
  "gap",
  "padding",
  "margin",
  "columns",
  "rows",
  "align",
  "justify",
  "direction",
  "display",
  "position",
  "overflow",
  "opacity",
  "fontWeight",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "borderRadius",
  "borderWidth",
  "shadow",
  "animation",
  "animationType",
  "animationDuration",
  "animationDelay",
  "speed",
  "delay",
  "duration",
  "autoPlay",
  "loop",
  "muted",
  "controls",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "aspectRatio",
  "objectFit",
  "target",
  "rel",
]);

export interface TextSegment {
  path: string;
  text: string;
}

export function extractTranslatableText(puckData: unknown): TextSegment[] {
  const segments: TextSegment[] = [];
  walk(puckData, "", segments);
  return segments;
}

export function injectTranslatedText(
  puckData: unknown,
  translations: Map<string, string>,
): unknown {
  return walkAndReplace(structuredClone(puckData), "", translations);
}

export function estimateCharacterCount(segments: TextSegment[]): number {
  return segments.reduce((sum, s) => sum + s.text.length, 0);
}

function walk(value: unknown, path: string, segments: TextSegment[]): void {
  if (value === null || value === undefined) return;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0 && isTranslatableString(trimmed, path)) {
      segments.push({ path, text: value });
    }
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      walk(value[i], `${path}[${i}]`, segments);
    }
    return;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      walk(obj[key], path ? `${path}.${key}` : key, segments);
    }
  }
}

function walkAndReplace(
  value: unknown,
  path: string,
  translations: Map<string, string>,
): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    const translated = translations.get(path);
    return translated !== undefined ? translated : value;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = walkAndReplace(value[i], `${path}[${i}]`, translations);
    }
    return value;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      obj[key] = walkAndReplace(
        obj[key],
        path ? `${path}.${key}` : key,
        translations,
      );
    }
    return obj;
  }

  return value;
}

function isTranslatableString(text: string, path: string): boolean {
  if (/^https?:\/\//.test(text)) return false;
  if (/^(\/|#|mailto:|tel:|\.\/|\.\.\/)/.test(text)) return false;
  if (/^#[0-9a-fA-F]{3,8}$/.test(text)) return false;
  if (/^\d+(\.\d+)?(px|rem|em|%|vh|vw|s|ms)?$/.test(text)) return false;
  if (/^[a-z_-]+$/.test(text) && text.length < 30) return false;
  if (/^[A-Z_]+$/.test(text) && text.length < 30) return false;

  const lastKey = path.split(".").pop() ?? "";
  if (NON_TRANSLATABLE_VALUE_KEYS.has(lastKey)) return false;

  return text.length >= 2;
}
