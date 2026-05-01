import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { imageField } from "../../lib/fields";

export interface AvatarProps {
  src: string;
  alt: string;
  fallback: string;
  size: string;
  shape: string;
  bordered: boolean;
  borderColor: string;
  status: string;
}

const sizeMap: Record<string, string> = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-lg",
  "2xl": "w-20 h-20 text-xl",
  "3xl": "w-24 h-24 text-2xl",
};

const shapeMap: Record<string, string> = {
  circle: "rounded-full",
  rounded: "rounded-lg",
  square: "rounded-none",
};

const statusColorMap: Record<string, string> = {
  none: "",
  online: "bg-green-500",
  offline: "bg-gray-400",
  busy: "bg-red-500",
  away: "bg-yellow-500",
};

const statusSizeMap: Record<string, string> = {
  xs: "w-1.5 h-1.5",
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3",
  xl: "w-3.5 h-3.5",
  "2xl": "w-4 h-4",
  "3xl": "w-5 h-5",
};

export const Avatar = ({
  src = "",
  alt = "Avatar",
  fallback = "AB",
  size = "md",
  shape = "circle",
  bordered = false,
  borderColor = "#ffffff",
  status = "none",
}: AvatarProps) => {
  const initials = fallback
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative inline-flex shrink-0">
      {src ? (
        <img
          src={src}
          alt={alt}
          className={cn(
            "object-cover",
            sizeMap[size],
            shapeMap[shape],
            bordered && "ring-2 ring-offset-1 ring-(--ring-color)",
          )}
          style={
            bordered
              ? ({ "--ring-color": borderColor } as React.CSSProperties)
              : undefined
          }
          loading="lazy"
        />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center bg-gray-200 text-gray-600 font-semibold",
            sizeMap[size],
            shapeMap[shape],
            bordered && "ring-2 ring-offset-1 ring-(--ring-color)",
          )}
          style={
            bordered
              ? ({ "--ring-color": borderColor } as React.CSSProperties)
              : undefined
          }
        >
          {initials}
        </div>
      )}
      {status !== "none" && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-white",
            statusColorMap[status],
            statusSizeMap[size],
          )}
        />
      )}
    </div>
  );
};

export const avatarConfig: ComponentConfig<AvatarProps> = {
  label: "Avatar",
  fields: {
    src: { ...imageField, label: "Image URL" },
    alt: { type: "text", label: "Alt Text" },
    fallback: { type: "text", label: "Fallback Initials" },
    size: {
      type: "select",
      label: "Size",
      options: [
        { label: "Extra Small", value: "xs" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
        { label: "2X Large", value: "2xl" },
        { label: "3X Large", value: "3xl" },
      ],
    },
    shape: {
      type: "radio",
      label: "Shape",
      options: [
        { label: "Circle", value: "circle" },
        { label: "Rounded", value: "rounded" },
        { label: "Square", value: "square" },
      ],
    },
    bordered: {
      type: "radio",
      label: "Border Ring",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    borderColor: { type: "text", label: "Border Color" },
    status: {
      type: "select",
      label: "Status Indicator",
      options: [
        { label: "None", value: "none" },
        { label: "Online", value: "online" },
        { label: "Offline", value: "offline" },
        { label: "Busy", value: "busy" },
        { label: "Away", value: "away" },
      ],
    },
  },
  defaultProps: {
    src: "",
    alt: "Avatar",
    fallback: "AB",
    size: "md",
    shape: "circle",
    bordered: false,
    borderColor: "#ffffff",
    status: "none",
  },
  render: Avatar,
};
