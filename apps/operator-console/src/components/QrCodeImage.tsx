import { useMemo } from "react";
import { toSvgString } from "../lib/qrcode";

interface QrCodeImageProps {
  /** Text/URI to encode. Typically an otpauth:// URI. */
  data: string;
  /** Square pixel size. Defaults to 192px. */
  size?: number;
  /** ECC level — higher is more resilient but produces denser codes. */
  ecl?: "L" | "M" | "Q" | "H";
  /** Accessible label. */
  alt?: string;
  /** Optional class for the wrapping container. */
  className?: string;
}

/**
 * Self-contained QR renderer for the operator console.
 *
 * The QR matrix is generated in-process (`src/lib/qrcode.ts`) and embedded
 * as an inline SVG `data:` URL. No network request is performed, so the
 * component works under strict Content-Security-Policy (no need to allow
 * external image hosts such as `api.qrserver.com`).
 */
export function QrCodeImage({
  data,
  size = 192,
  ecl = "M",
  alt = "QR code",
  className,
}: QrCodeImageProps) {
  const svgUrl = useMemo(() => {
    try {
      const svg = toSvgString(data, { ecl });
      // `encodeURIComponent` is safer than btoa for arbitrary unicode.
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    } catch {
      return null;
    }
  }, [data, ecl]);

  if (!svgUrl) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={className}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <img
      src={svgUrl}
      alt={alt}
      width={size}
      height={size}
      className={className}
      // Block the browser from interpreting this as anything other than an image.
      draggable={false}
    />
  );
}
