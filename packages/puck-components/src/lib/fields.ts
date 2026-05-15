import { createElement, type ReactElement } from "react";
import { ImageAssetField, type ImageAssetPreset } from "./image-asset-field";

// ─── Color Picker Custom Field ──────────────────────────────────────────────
export function colorFieldRender(
  value: string | undefined,
  onChange: (v: string) => void,
  placeholder = "#ffffff",
  label?: string,
): ReactElement {
  return createElement(
    "div",
    { className: "flex flex-col gap-1.5" },
    label
      ? createElement(
          "p",
          {
            style: {
              fontSize: 11,
              fontWeight: 700,
              color: "#6b7280",
              textTransform: "uppercase" as const,
              letterSpacing: "0.05em",
              margin: 0,
            },
          },
          label,
        )
      : null,
    createElement(
      "div",
      { className: "flex items-center gap-2" },
      createElement("input", {
        type: "color",
        value: value || "#ffffff",
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value),
        className:
          "w-9 h-9 border border-gray-300 rounded-md cursor-pointer p-0.5 shrink-0 bg-transparent",
      }),
      createElement("input", {
        type: "text",
        value: value || "",
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value),
        placeholder,
        className:
          "flex-1 px-2.5 py-1.5 border border-gray-300 rounded-md text-[13px] min-w-0",
      }),
    ),
  );
}

// ─── Image URL Custom Field ─────────────────────────────────────────────────
export function imageFieldRender(
  value: string | undefined,
  onChange: (v: string) => void,
  label?: string,
  preset: ImageAssetPreset = "content",
): ReactElement {
  return createElement(ImageAssetField, {
    value,
    onChange,
    label,
    preset,
    placeholder: "https://cdn.example.com/image.jpg",
  });
}

type CustomFieldRenderProps = {
  value: any;
  onChange: (v: any) => void;
  field?: { label?: string };
};

function createImageField(preset: ImageAssetPreset = "content") {
  return {
    type: "custom" as const,
    label: "Image URL",
    render: ({ value, onChange, field }: CustomFieldRenderProps) =>
      imageFieldRender(
        typeof value === "string" ? value : "",
        onChange,
        field?.label,
        preset,
      ),
  };
}

// ─── Reusable Field Definitions ─────────────────────────────────────────────
export const backgroundColorField = {
  type: "custom" as const,
  label: "Background Color",
  render: ({
    value,
    onChange,
    field,
  }: {
    value: any;
    onChange: (v: any) => void;
    field?: { label?: string };
  }) => colorFieldRender(value, onChange, "#ffffff", field?.label),
};

export const textColorField = {
  type: "custom" as const,
  label: "Text Color",
  render: ({
    value,
    onChange,
    field,
  }: {
    value: any;
    onChange: (v: any) => void;
    field?: { label?: string };
  }) => colorFieldRender(value, onChange, "#000000", field?.label),
};

export const imageField = createImageField("content");
export const logoImageField = createImageField("logo");
export const avatarImageField = createImageField("avatar");
export const iconImageField = createImageField("icon");
export const emailLogoImageField = createImageField("email-logo");

// ─── Tailwind Class Maps ────────────────────────────────────────────────────

export const maxWidthMap: Record<string, string> = {
  none: "max-w-none",
  xs: "max-w-[420px]",
  sm: "max-w-[640px]",
  md: "max-w-[768px]",
  lg: "max-w-[1024px]",
  xl: "max-w-[1280px]",
  "2xl": "max-w-[1536px]",
  full: "max-w-none",
};

export const textAlignMap: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

// ─── Responsive Padding Class Maps ─────────────────────────────────────────
// Values chosen to match Tailwind's 0.25rem spacing scale:
//   py-8=2rem  py-12=3rem  py-16=4rem  py-20=5rem  py-24=6rem  py-32=8rem  py-40=10rem
//   px-4=1rem  px-6=1.5rem  px-8=2rem  px-12=3rem  px-16=4rem

const paddingYClasses: Record<string, string> = {
  none: "py-0",
  sm: "py-8",
  md: "py-12 md:py-20",
  lg: "py-16 md:py-24 lg:py-32",
  xl: "py-24 md:py-32 lg:py-40",
  "2xl": "py-32 md:py-40 lg:py-48",
  "3xl": "py-40 md:py-48 lg:py-56",
  "4xl": "py-48 md:py-56 lg:py-64",
  "5xl": "py-56 md:py-64 lg:py-72",
  "6xl": "py-64 md:py-72 lg:py-80",
};

const paddingXClasses: Record<string, string> = {
  none: "px-0",
  sm: "px-4",
  md: "px-6 md:px-8",
  lg: "px-8 md:px-12",
  xl: "px-12 md:px-16",
};

/** Returns responsive Tailwind padding classes for the given size keys. */
export function resolvePaddingClasses(
  paddingY?: string,
  paddingX?: string,
): string {
  const parts: string[] = [];
  if (paddingY !== undefined && paddingYClasses[paddingY])
    parts.push(paddingYClasses[paddingY]);
  if (paddingX !== undefined && paddingXClasses[paddingX])
    parts.push(paddingXClasses[paddingX]);
  return parts.join(" ");
}

const MARKUP_HINT_SUFFIX = "supports **bold** and [text]{#hex}";

type MarkupField = {
  type?: string;
  label?: string;
  contentEditable?: boolean;
  arrayFields?: Record<string, MarkupField>;
};

function appendMarkupHint(label?: string) {
  if (!label) {
    return MARKUP_HINT_SUFFIX;
  }

  if (label.includes(MARKUP_HINT_SUFFIX)) {
    return label;
  }

  return `${label} · ${MARKUP_HINT_SUFFIX}`;
}

function decorateMarkupField<T extends MarkupField>(field: T): T {
  const nextField = { ...field };

  if (
    (nextField.type === "text" || nextField.type === "textarea") &&
    nextField.contentEditable
  ) {
    nextField.label = appendMarkupHint(nextField.label);
  }

  if (nextField.arrayFields) {
    nextField.arrayFields = Object.fromEntries(
      Object.entries(nextField.arrayFields).map(([key, value]) => [
        key,
        decorateMarkupField(value),
      ]),
    );
  }

  return nextField;
}

export function withMarkupHints(config: any) {
  if (!config.fields) {
    return config;
  }

  return {
    ...config,
    fields: Object.fromEntries(
      Object.entries(config.fields).map(([key, field]) => [
        key,
        decorateMarkupField(field as MarkupField),
      ]),
    ),
  };
}

export function withMarkupHintsForComponents<T extends Record<string, any>>(
  components: T,
): T {
  return Object.fromEntries(
    Object.entries(components).map(([key, config]) => [
      key,
      withMarkupHints(config),
    ]),
  ) as T;
}
