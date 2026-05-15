import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import imageCompression from "browser-image-compression";
import { cn } from "./cn";

export type ImageAssetPreset =
  | "content"
  | "logo"
  | "avatar"
  | "icon"
  | "email-logo";

type ImageAssetPresetConfig = {
  accept: string;
  allowedTypes: string[];
  maxSourceBytes: number;
  maxStoredBytes: number;
  targetStoredBytes: number;
  maxWidth: number;
  maxHeight: number;
  preferredRasterMimeType: "image/webp" | "preserve";
  previewFit: "cover" | "contain";
  emptyStateText: string;
  helperText: string;
};

type UploadFeedback = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type PreparedInlineImage = {
  value: string;
  message: string;
};

export const IMAGE_ASSET_PRESETS: Record<
  ImageAssetPreset,
  ImageAssetPresetConfig
> = {
  content: {
    accept: "image/png,image/jpeg,image/webp,image/avif,image/svg+xml",
    allowedTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/avif",
      "image/svg+xml",
    ],
    maxSourceBytes: 12 * 1024 * 1024,
    maxStoredBytes: 300 * 1024,
    targetStoredBytes: 220 * 1024,
    maxWidth: 2400,
    maxHeight: 2400,
    preferredRasterMimeType: "image/webp",
    previewFit: "cover",
    emptyStateText: "Drop an image here, upload one, or paste a hosted URL.",
    helperText:
      "Large uploads are optimized automatically before they are stored inline.",
  },
  logo: {
    accept: "image/png,image/jpeg,image/webp,image/avif,image/svg+xml",
    allowedTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/avif",
      "image/svg+xml",
    ],
    maxSourceBytes: 6 * 1024 * 1024,
    maxStoredBytes: 180 * 1024,
    targetStoredBytes: 120 * 1024,
    maxWidth: 1800,
    maxHeight: 900,
    preferredRasterMimeType: "image/webp",
    previewFit: "contain",
    emptyStateText: "Upload a logo or paste a hosted logo URL.",
    helperText:
      "Compact logos keep the editor responsive. Hosted URLs are best for larger brand assets.",
  },
  avatar: {
    accept: "image/png,image/jpeg,image/webp,image/avif,image/svg+xml",
    allowedTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/avif",
      "image/svg+xml",
    ],
    maxSourceBytes: 5 * 1024 * 1024,
    maxStoredBytes: 140 * 1024,
    targetStoredBytes: 96 * 1024,
    maxWidth: 1200,
    maxHeight: 1200,
    preferredRasterMimeType: "image/webp",
    previewFit: "cover",
    emptyStateText: "Upload an avatar or paste a hosted image URL.",
    helperText:
      "Avatars are resized automatically so they stay lightweight in saved page data.",
  },
  icon: {
    accept: "image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon",
    allowedTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
      "image/x-icon",
    ],
    maxSourceBytes: 2 * 1024 * 1024,
    maxStoredBytes: 96 * 1024,
    targetStoredBytes: 64 * 1024,
    maxWidth: 512,
    maxHeight: 512,
    preferredRasterMimeType: "preserve",
    previewFit: "contain",
    emptyStateText: "Upload a compact icon or paste a hosted icon URL.",
    helperText:
      "Small icons keep metadata lean and load faster across devices.",
  },
  "email-logo": {
    accept: "image/png,image/jpeg,image/svg+xml,image/webp",
    allowedTypes: ["image/png", "image/jpeg", "image/svg+xml", "image/webp"],
    maxSourceBytes: 4 * 1024 * 1024,
    maxStoredBytes: 120 * 1024,
    targetStoredBytes: 80 * 1024,
    maxWidth: 1200,
    maxHeight: 400,
    preferredRasterMimeType: "preserve",
    previewFit: "contain",
    emptyStateText: "Upload a compact email logo or paste a hosted URL.",
    helperText:
      "Hosted URLs remain the safest option for inbox rendering and keep payloads small.",
  },
};

export type ImageAssetFieldProps = {
  value?: string;
  onChange: (value: string) => void;
  preset?: ImageAssetPreset;
  label?: string;
  placeholder?: string;
  previewAlt?: string;
  uploadLabel?: string;
  removeLabel?: string;
  urlLabel?: string;
  helperText?: string;
  emptyStateText?: string;
  rootClassName?: string;
  previewClassName?: string;
  previewWrapperClassName?: string;
  inputClassName?: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function measureStoredBytes(value: string) {
  return new TextEncoder().encode(value).length;
}

function isInlineImageValue(value: string | undefined) {
  return typeof value === "string" && value.startsWith("data:image/");
}

function isVectorLikeFile(file: File) {
  return file.type === "image/svg+xml" || file.type === "image/x-icon";
}

function getRasterOutputTypes(
  sourceType: string,
  preferredMimeType: ImageAssetPresetConfig["preferredRasterMimeType"],
) {
  if (preferredMimeType === "preserve") {
    if (sourceType === "image/jpeg") {
      return ["image/jpeg"];
    }

    if (sourceType === "image/png" || sourceType === "image/webp") {
      return [sourceType, "image/png"];
    }

    return ["image/png"];
  }

  return ["image/webp", "image/jpeg", "image/png"];
}

function toMegabytes(bytes: number) {
  return bytes / (1024 * 1024);
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Could not read the selected image."));
    };
    reader.onerror = () =>
      reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(blob);
  });
}

function loadImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not decode the selected image."));
    };

    image.src = objectUrl;
  });
}

async function optimizeUploadedImage(
  file: File,
  preset: ImageAssetPresetConfig,
): Promise<PreparedInlineImage> {
  if (!preset.allowedTypes.includes(file.type)) {
    throw new Error("Choose a PNG, JPG, SVG, WebP, or AVIF image asset.");
  }

  if (file.size > preset.maxSourceBytes) {
    throw new Error(
      `Choose an image smaller than ${formatBytes(preset.maxSourceBytes)} or use a hosted URL instead.`,
    );
  }

  const originalDataUrl = await readBlobAsDataUrl(file);
  const originalStoredBytes = measureStoredBytes(originalDataUrl);

  if (isVectorLikeFile(file)) {
    if (originalStoredBytes > preset.maxStoredBytes) {
      throw new Error(
        `This asset is still larger than ${formatBytes(preset.maxStoredBytes)} when stored inline. Use a hosted URL instead.`,
      );
    }

    return {
      value: originalDataUrl,
      message: `Stored inline at ${formatBytes(originalStoredBytes)}.`,
    };
  }

  const { width, height } = await loadImageDimensions(file);
  const exceedsDimensions =
    width > preset.maxWidth || height > preset.maxHeight;

  if (!exceedsDimensions && originalStoredBytes <= preset.maxStoredBytes) {
    return {
      value: originalDataUrl,
      message: `Stored inline at ${formatBytes(originalStoredBytes)}.`,
    };
  }

  const maxSide = Math.max(preset.maxWidth, preset.maxHeight);
  const sizeBudgetBytes = Math.max(
    Math.floor(preset.targetStoredBytes * 0.72),
    48 * 1024,
  );
  const dimensionSteps = [1, 0.92, 0.84, 0.76, 0.68, 0.6];
  const outputTypes = getRasterOutputTypes(
    file.type,
    preset.preferredRasterMimeType,
  );
  let bestCandidate: { value: string; storedBytes: number } | null = null;

  for (const outputType of outputTypes) {
    for (const step of dimensionSteps) {
      const compressed = await imageCompression(file, {
        maxSizeMB: toMegabytes(sizeBudgetBytes),
        maxWidthOrHeight: Math.max(320, Math.round(maxSide * step)),
        fileType: outputType,
        initialQuality: outputType === "image/png" ? 1 : 0.88,
        maxIteration: 10,
        useWebWorker: true,
        alwaysKeepResolution: false,
      });
      const compressedDataUrl = await readBlobAsDataUrl(compressed);
      const compressedStoredBytes = measureStoredBytes(compressedDataUrl);

      if (!bestCandidate || compressedStoredBytes < bestCandidate.storedBytes) {
        bestCandidate = {
          value: compressedDataUrl,
          storedBytes: compressedStoredBytes,
        };
      }

      if (compressedStoredBytes <= preset.maxStoredBytes) {
        return {
          value: compressedDataUrl,
          message: `Optimized from ${formatBytes(originalStoredBytes)} to ${formatBytes(compressedStoredBytes)} for inline storage.`,
        };
      }
    }
  }

  if (bestCandidate && bestCandidate.storedBytes <= preset.maxStoredBytes) {
    return {
      value: bestCandidate.value,
      message: `Optimized to ${formatBytes(bestCandidate.storedBytes)} for inline storage.`,
    };
  }

  throw new Error(
    `This image is still larger than ${formatBytes(preset.maxStoredBytes)} after optimization. Use a hosted URL or a smaller source image.`,
  );
}

export function ImageAssetField({
  value = "",
  onChange,
  preset = "content",
  label,
  placeholder = "https://cdn.example.com/image.jpg",
  previewAlt,
  uploadLabel = "Upload image",
  removeLabel = "Remove",
  urlLabel = "Hosted asset URL",
  helperText,
  emptyStateText,
  rootClassName,
  previewClassName,
  previewWrapperClassName,
  inputClassName,
}: ImageAssetFieldProps) {
  const presetConfig = IMAGE_ASSET_PRESETS[preset];
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<UploadFeedback | null>(null);

  const effectiveHelperText = helperText || presetConfig.helperText;
  const effectiveEmptyStateText = emptyStateText || presetConfig.emptyStateText;
  const storedBytes = value ? measureStoredBytes(value) : 0;
  const derivedFeedback =
    feedback ||
    (value
      ? {
          tone: "neutral" as const,
          text: isInlineImageValue(value)
            ? `Inline asset stored locally (${formatBytes(storedBytes)}).`
            : "Hosted URL stored. This keeps page JSON small.",
        }
      : {
          tone: "neutral" as const,
          text: effectiveHelperText,
        });

  const applyFile = async (file: File) => {
    setIsProcessing(true);
    setFeedback({
      tone: "neutral",
      text: "Optimizing image for inline storage...",
    });

    try {
      const nextValue = await optimizeUploadedImage(file, presetConfig);
      onChange(nextValue.value);
      setFeedback({ tone: "success", text: nextValue.message });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not process the selected image.";
      setFeedback({ tone: "error", text: message });
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      setIsProcessing(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    void applyFile(file);
  };

  const handleUrlChange = (nextValue: string) => {
    if (nextValue.trim().startsWith("data:")) {
      setFeedback({
        tone: "error",
        text: "Paste a hosted or relative asset URL here. Inline data URLs should go through the uploader so they can be optimized safely.",
      });
      return;
    }

    onChange(nextValue);
    setFeedback(null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    void applyFile(file);
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-3",
        rootClassName,
      )}
    >
      {label ? (
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-gray-500">
          {label}
        </div>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex min-h-28 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center transition-colors",
          isDragging && "border-blue-300 bg-blue-50",
          isProcessing && "cursor-progress opacity-75",
          previewWrapperClassName,
        )}
      >
        {value ? (
          <img
            src={value}
            alt={previewAlt || label || "Image preview"}
            className={cn(
              "max-h-40 w-full rounded-lg object-cover",
              presetConfig.previewFit === "contain" && "object-contain",
              previewClassName,
            )}
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-700">
              {effectiveEmptyStateText}
            </div>
            <div className="text-xs text-gray-500">
              Click to browse or drag and drop an image file.
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isProcessing ? "Processing..." : uploadLabel}
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setFeedback(null);
            }}
            disabled={isProcessing}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {removeLabel}
          </button>
        ) : null}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={presetConfig.accept}
        className="hidden"
        onChange={handleFileChange}
      />

      <label htmlFor={`${inputId}-url`} className="mt-3 block">
        <span className="text-xs font-semibold text-gray-700">{urlLabel}</span>
        <input
          id={`${inputId}-url`}
          value={isInlineImageValue(value) ? "" : value}
          onChange={(event) => handleUrlChange(event.target.value)}
          placeholder={placeholder}
          className={cn(
            "mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100",
            inputClassName,
          )}
        />
      </label>

      <p
        className={cn(
          "mt-2 text-xs",
          derivedFeedback.tone === "error"
            ? "text-red-600"
            : derivedFeedback.tone === "success"
              ? "text-emerald-700"
              : "text-gray-500",
        )}
      >
        {derivedFeedback.text}
      </p>
    </div>
  );
}
