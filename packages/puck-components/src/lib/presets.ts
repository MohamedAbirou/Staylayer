/**
 * Hospitality preset helpers.
 *
 * A preset is a curated set of overrides applied at render-time over the
 * component's current props. Presets never mutate stored props — they only
 * override style / layout fields when the customer picks a named look.
 *
 * Switching to "custom" turns the preset off and the component uses its
 * own raw props.
 */

export type PresetOption = {
  label: string;
  value: string;
  description?: string;
};

export const PRESET_CUSTOM = "custom" as const;

export const customPresetOption: PresetOption = {
  label: "Custom (use my values below)",
  value: PRESET_CUSTOM,
};

/**
 * Build a Puck `select` field for choosing a preset.
 * Place it as the first field on the component so customers see it first.
 */
export function buildPresetField<TPreset extends string>(args: {
  label: string;
  options: { label: string; value: TPreset; description?: string }[];
}): {
  type: "select";
  label: string;
  options: { label: string; value: string }[];
} {
  return {
    type: "select",
    label: args.label,
    options: [
      customPresetOption,
      ...args.options.map((o) => ({
        label: o.description ? `${o.label} — ${o.description}` : o.label,
        value: o.value,
      })),
    ],
  };
}

/**
 * Merge a preset's overrides over the current props.
 * Returns a new object — never mutates the input.
 */
export function applyPreset<TProps extends object>(
  preset: string | undefined,
  props: TProps,
  presetMap: Record<string, Partial<TProps>>,
): TProps {
  if (!preset || preset === PRESET_CUSTOM) return props;
  const overrides = presetMap[preset];
  if (!overrides) return props;
  return { ...props, ...overrides };
}
