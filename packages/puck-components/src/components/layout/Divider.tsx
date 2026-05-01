import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { backgroundColorField } from "../../lib/fields";

export interface DividerProps {
  style: string;
  color: string;
  thickness: number;
  width: string;
}

const widthMap: Record<string, string> = {
  full: "w-full",
  wide: "w-3/4",
  medium: "w-1/2",
  narrow: "w-1/4",
};

const borderStyleMap: Record<string, string> = {
  solid: "border-t-solid",
  dashed: "border-t-dashed",
  dotted: "border-t-dotted",
};

export const Divider = ({
  style = "solid",
  color = "#e5e7eb",
  thickness = 1,
  width = "full",
}: DividerProps) => {
  return (
    <div className="flex justify-center py-2">
      <hr
        className={cn(
          "border-0 border-t-(--divider-color)",
          borderStyleMap[style],
          widthMap[width],
        )}
        style={
          {
            "--divider-color": color,
            borderTopWidth: thickness,
          } as React.CSSProperties
        }
      />
    </div>
  );
};

export const dividerConfig: ComponentConfig<DividerProps> = {
  label: "Divider",
  fields: {
    style: {
      type: "radio",
      label: "Style",
      options: [
        { label: "Solid", value: "solid" },
        { label: "Dashed", value: "dashed" },
        { label: "Dotted", value: "dotted" },
      ],
    },
    color: {
      ...backgroundColorField,
      label: "Color",
    },
    thickness: {
      type: "number",
      label: "Thickness (px)",
      min: 1,
      max: 8,
    },
    width: {
      type: "radio",
      label: "Width",
      options: [
        { label: "Full", value: "full" },
        { label: "3/4", value: "wide" },
        { label: "1/2", value: "medium" },
        { label: "1/4", value: "narrow" },
      ],
    },
  },
  defaultProps: {
    style: "solid",
    color: "#e5e7eb",
    thickness: 1,
    width: "full",
  },
  render: Divider,
};
