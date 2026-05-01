import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";

export interface VideoEmbedProps {
  url: string;
  aspectRatio: string;
  rounded: string;
}

function getEmbedUrl(url: string): string | null {
  if (!url) return null;

  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/,
  );
  if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return null;
}

const aspectMap: Record<string, string> = {
  "16/9": "aspect-video",
  "4/3": "aspect-[4/3]",
  "1/1": "aspect-square",
  "21/9": "aspect-[21/9]",
};

const roundedMap: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
};

export const VideoEmbed = ({
  url = "",
  aspectRatio = "16/9",
  rounded = "lg",
}: VideoEmbedProps) => {
  const embedUrl = getEmbedUrl(url);

  if (!embedUrl) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gray-100 text-gray-400",
          aspectMap[aspectRatio],
          roundedMap[rounded],
        )}
      >
        Paste a YouTube or Vimeo URL
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden", roundedMap[rounded])}>
      <iframe
        src={embedUrl}
        className={cn("w-full", aspectMap[aspectRatio])}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        title="Embedded video"
      />
    </div>
  );
};

export const videoEmbedConfig: ComponentConfig<VideoEmbedProps> = {
  label: "Video",
  fields: {
    url: {
      type: "text",
      label: "YouTube or Vimeo URL",
    },
    aspectRatio: {
      type: "radio",
      label: "Aspect Ratio",
      options: [
        { label: "16:9", value: "16/9" },
        { label: "4:3", value: "4/3" },
        { label: "Square", value: "1/1" },
        { label: "Ultra Wide", value: "21/9" },
      ],
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
      ],
    },
  },
  defaultProps: {
    url: "",
    aspectRatio: "16/9",
    rounded: "lg",
  },
  render: VideoEmbed,
};
