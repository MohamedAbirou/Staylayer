import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { imageField } from "../../lib/fields";

export interface ImageBlockProps {
  url: string;
  alt: string;
  caption: string;
  rounded: string;
  shadow: string;
  aspectRatio: string;
  objectFit: string;
  maxWidth: string;
}

const roundedMap: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

const shadowMap: Record<string, string> = {
  none: "",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
};

const aspectMap: Record<string, string> = {
  auto: "",
  square: "aspect-square",
  video: "aspect-video",
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
};

const fitMap: Record<string, string> = {
  cover: "object-cover",
  contain: "object-contain",
  fill: "object-fill",
};

const maxWidthMap: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  "2xl": "max-w-3xl",
  full: "max-w-full",
};

export const ImageBlock = ({
  url = "https://images.unsplash.com/photo-1687204209659-3bded6aecd79?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2670&q=80",
  alt = "Image",
  caption = "",
  rounded = "lg",
  shadow = "md",
  aspectRatio = "auto",
  objectFit = "cover",
  maxWidth = "full",
}: ImageBlockProps) => {
  return (
    <figure className={cn("mx-auto", maxWidthMap[maxWidth])}>
      {url ? (
        <img
          src={url}
          alt={alt}
          className={cn(
            "w-full",
            roundedMap[rounded],
            shadowMap[shadow],
            aspectMap[aspectRatio],
            fitMap[objectFit],
          )}
          loading="lazy"
        />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center bg-gray-100 text-gray-400",
            roundedMap[rounded],
            aspectMap[aspectRatio] || "aspect-video",
          )}
        >
          No image set
        </div>
      )}
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-gray-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

export const imageBlockConfig: ComponentConfig<ImageBlockProps> = {
  label: "Image",
  fields: {
    url: {
      ...imageField,
      label: "Image URL",
    },
    alt: {
      type: "text",
      label: "Alt Text (for accessibility)",
    },
    caption: {
      type: "text",
      label: "Caption (optional)",
    },
    rounded: {
      type: "select",
      label: "Corner Rounding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
        { label: "2X Large", value: "2xl" },
        { label: "Circle", value: "full" },
      ],
    },
    shadow: {
      type: "select",
      label: "Shadow",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
    aspectRatio: {
      type: "select",
      label: "Aspect Ratio",
      options: [
        { label: "Auto", value: "auto" },
        { label: "Square (1:1)", value: "square" },
        { label: "Video (16:9)", value: "video" },
        { label: "Photo (4:3)", value: "4/3" },
        { label: "Classic (3:2)", value: "3/2" },
      ],
    },
    objectFit: {
      type: "radio",
      label: "Image Fit",
      options: [
        { label: "Cover", value: "cover" },
        { label: "Contain", value: "contain" },
        { label: "Fill", value: "fill" },
      ],
    },
    maxWidth: {
      type: "select",
      label: "Max Width",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
        { label: "2X Large", value: "2xl" },
        { label: "Full", value: "full" },
      ],
    },
  },
  defaultProps: {
    url: "https://placehold.co/800x450/e2e8f0/64748b?text=Your+Image",
    alt: "Image",
    caption: "",
    rounded: "lg",
    shadow: "md",
    aspectRatio: "auto",
    objectFit: "cover",
    maxWidth: "full",
  },
  render: ImageBlock,
};
