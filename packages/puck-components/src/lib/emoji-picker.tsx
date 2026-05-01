import { createElement, useEffect, useRef, useState } from "react";

// ─── Emoji List ───────────────────────────────────────────────────────────────

export const EMOJI_LIST = [
  // Faces & people
  "😀",
  "😎",
  "🤩",
  "😊",
  "🥳",
  "😍",
  "🤗",
  "😇",
  "🤓",
  "😏",
  // Hands & gestures
  "👍",
  "🙌",
  "💪",
  "🤝",
  "👋",
  "🤜",
  "✌️",
  "🤞",
  "👏",
  "🫶",
  // Stars & fire
  "⭐",
  "🔥",
  "💡",
  "✅",
  "❌",
  "⚡",
  "💥",
  "❤️",
  "🔔",
  "🔑",
  // Tech & devices
  "📱",
  "💻",
  "🖥️",
  "📺",
  "📷",
  "🎥",
  "🤖",
  "💾",
  "📡",
  "⌚",
  // Music & art
  "🎵",
  "🎨",
  "🎯",
  "🎁",
  "🎓",
  "🎮",
  "🎸",
  "🎹",
  "🎤",
  "🎭",
  // Business & productivity
  "💼",
  "📊",
  "📈",
  "📉",
  "💰",
  "🏆",
  "📝",
  "📋",
  "📌",
  "📍",
  // Nature & travel
  "🌍",
  "🌐",
  "🏠",
  "🏢",
  "🏦",
  "✈️",
  "🚀",
  "🚗",
  "🏔️",
  "🌊",
  // Food & drink
  "☕",
  "🍕",
  "🍎",
  "🌮",
  "🍺",
  "🍔",
  "🍣",
  "🍰",
  "🥗",
  "🥤",
  // Health & fitness
  "🏋️",
  "🌱",
  "💊",
  "🩺",
  "🩹",
  "🧬",
  "🧪",
  "🔬",
  "🌡️",
  "🧘",
  // Symbols & tools
  "🌟",
  "🌈",
  "🦋",
  "⚙️",
  "🔧",
  "🛡️",
  "🔒",
  "🔓",
  "🔗",
  "🗂️",
  "📦",
  "📣",
  "🗓️",
  "⏰",
  "⏳",
  "🧭",
  "🗺️",
  "⚠️",
  "💬",
  "📢",
  // More favorites
  "✨",
  "🚀",
  "🌟",
  "💫",
  "🎉",
  "🎊",
  "🔮",
  "🪄",
  "🦄",
  "🐉",
];

// ─── Component ────────────────────────────────────────────────────────────────

interface EmojiPickerProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function EmojiPickerField({
  value,
  onChange,
  placeholder = "+",
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return createElement(
    "div",
    {
      ref: containerRef,
      style: { position: "relative", display: "inline-block" },
    },
    createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 6 } },
      // Trigger button
      createElement(
        "button",
        {
          type: "button",
          onClick: () => setOpen((v) => !v),
          title: "Choose icon emoji",
          style: {
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "5px 12px",
            background: open ? "#f9fafb" : "#fff",
            minWidth: 52,
            textAlign: "center" as const,
            transition: "background 0.15s",
          },
        },
        value || placeholder,
      ),
      // Clear button
      value &&
        createElement(
          "button",
          {
            type: "button",
            onClick: () => onChange(""),
            title: "Clear icon",
            style: {
              fontSize: 11,
              cursor: "pointer",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              padding: "5px 9px",
              background: "#fff",
              color: "#6b7280",
              lineHeight: 1,
            },
          },
          "✕ Clear",
        ),
    ),
    // Dropdown grid
    open &&
      createElement(
        "div",
        {
          style: {
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 9999,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 8,
            display: "flex",
            flexWrap: "wrap" as const,
            gap: 2,
            width: 300,
            maxHeight: 280,
            overflowY: "auto" as const,
            boxShadow: "0 8px 24px rgba(0,0,0,.14)",
          },
        },
        ...EMOJI_LIST.map((emoji) =>
          createElement(
            "button",
            {
              key: emoji,
              type: "button",
              title: emoji,
              onClick: () => {
                onChange(emoji);
                setOpen(false);
              },
              style: {
                fontSize: 20,
                lineHeight: 1,
                padding: 4,
                borderRadius: 6,
                border: "none",
                background: value === emoji ? "#eff6ff" : "transparent",
                cursor: "pointer",
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.1s",
              },
            },
            emoji,
          ),
        ),
      ),
  );
}

// ─── Puck Custom Field Definition ────────────────────────────────────────────

export const emojiField = {
  type: "custom" as const,
  label: "Icon (emoji)",
  render: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => createElement(EmojiPickerField, { value, onChange }),
};
