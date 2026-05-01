import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { textColorField } from "../../lib/fields";

export interface RichTextProps {
  content: string;
  paddingY: string;
  size: string;
  alignment: string;
  maxWidth: string;
  color: string;
}

const paraMaxWidthMap: Record<string, string> = {
  none: "",
  xs: "max-w-md",
  sm: "max-w-lg",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
};

const sizeMap: Record<string, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
};

const paddingYMap: Record<string, string> = {
  none: "",
  xs: "py-1",
  sm: "py-2",
  md: "py-4",
  lg: "py-8",
  xl: "py-12",
  "2xl": "py-16",
};

export const RichText = ({
  content = "",
  alignment = "left",
  maxWidth = "none",
  size = "md",
  color = "",
  paddingY = "none",
}: RichTextProps) => {
  const alignMap: Record<string, string> = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <div
      className={cn(
        "prose prose-sm md:prose-base",
        "prose-headings:font-bold prose-headings:tracking-tight",
        "prose-p:leading-relaxed",
        "prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800",
        "prose-strong:font-semibold",
        "prose-ul:list-disc prose-ol:list-decimal",
        "prose-li:leading-relaxed",
        "prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:italic",
        alignMap[alignment],
        paraMaxWidthMap[maxWidth],
        maxWidth && maxWidth !== "none" && "mx-auto",
        paddingYMap[paddingY],
        sizeMap[size],
        color && "text-(--fg)",
      )}
      style={
        color
          ? ({
              "--fg": color,
            } as React.CSSProperties)
          : undefined
      }
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

export const richTextConfig: ComponentConfig<RichTextProps> = {
  label: "Rich Text",
  fields: {
    content: {
      type: "textarea",
      label: "Content",
    },
    size: {
      type: "radio",
      label: "Size",
      options: [
        { label: "XS", value: "xs" },
        { label: "SM", value: "sm" },
        { label: "MD", value: "md" },
        { label: "LG", value: "lg" },
        { label: "XL", value: "xl" },
        { label: "2XL", value: "2xl" },
      ],
    },
    alignment: {
      type: "radio",
      label: "Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    maxWidth: {
      type: "select",
      label: "Max Width",
      options: [
        { label: "None", value: "none" },
        { label: "Extra Narrow", value: "xs" },
        { label: "Narrow", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Wide", value: "lg" },
        { label: "Extra Wide", value: "xl" },
      ],
    },
    paddingY: {
      type: "select",
      label: "Padding Y",
      options: [
        { label: "None", value: "none" },
        { label: "XS (4px)", value: "xs" },
        { label: "SM (8px)", value: "sm" },
        { label: "MD (16px)", value: "md" },
        { label: "LG (32px)", value: "lg" },
        { label: "XL (48px)", value: "xl" },
        { label: "2XL (64px)", value: "2xl" },
      ],
    },
    color: textColorField,
  },
  defaultProps: {
    content:
      "<p>Start writing your content here. You can use <strong>bold</strong>, <em>italic</em>, and other formatting options.</p>",
    size: "md",
    alignment: "left",
    maxWidth: "none",
    color: "",
    paddingY: "none",
  },
  render: RichText,
};
