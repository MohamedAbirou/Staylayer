import React from "react";

/**
 * Parses a subset of inline markup in a plain string and returns React nodes.
 *
 * Supported syntax:
 *   **bold text**            → <strong>
 *   [colored text]{#hexOrName}  → <span style={{ color }}>
 *
 * When Puck passes a React node (contentEditable / live-edit mode) the value
 * is not a string, so it is returned unchanged.
 */
export function parseMarkup(text: unknown): React.ReactNode {
  if (typeof text !== "string") return text as React.ReactNode;

  const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\{[^}]+\})/g;
  const parts = text.split(TOKEN);

  return parts.map((part, i) => {
    // ── Bold ────────────────────────────────────────────────────────────────
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }

    // ── Colored span ────────────────────────────────────────────────────────
    const colorMatch = part.match(/^\[([^\]]+)\]\{([^}]+)\}$/);
    if (colorMatch) {
      return (
        <span key={i} style={{ color: colorMatch[2] }}>
          {parseMarkup(colorMatch[1])}
        </span>
      );
    }

    return part;
  });
}
