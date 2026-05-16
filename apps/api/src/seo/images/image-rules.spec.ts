import {
  analyzeImage,
  classifyAlt,
  parseFilename,
  OG_RECOMMENDED_MIN_WIDTH,
  OG_RECOMMENDED_MIN_HEIGHT,
} from "./image-rules";
import { ImageAltQuality } from "@prisma/client";

describe("image-rules", () => {
  describe("parseFilename", () => {
    it("returns last segment of absolute URL", () => {
      expect(parseFilename("https://cdn.example.com/img/hero-photo.jpg")).toBe(
        "hero-photo.jpg",
      );
    });
    it("handles query/hash", () => {
      expect(parseFilename("/images/foo.png?v=2#x")).toBe("foo.png");
    });
    it("returns null for empty/invalid", () => {
      expect(parseFilename("")).toBeNull();
    });
  });

  describe("classifyAlt", () => {
    it("MISSING when null", () => {
      expect(classifyAlt(null, "foo.jpg")).toBe(ImageAltQuality.MISSING);
    });
    it("EMPTY when whitespace only", () => {
      expect(classifyAlt("   ", "foo.jpg")).toBe(ImageAltQuality.EMPTY);
    });
    it("FILENAME_LIKE when alt mirrors filename", () => {
      expect(classifyAlt("hero-photo", "hero-photo.jpg")).toBe(
        ImageAltQuality.FILENAME_LIKE,
      );
    });
    it("FILENAME_LIKE for IMG_1234 style", () => {
      expect(classifyAlt("IMG_1234", "anything.png")).toBe(
        ImageAltQuality.FILENAME_LIKE,
      );
    });
    it("TOO_SHORT for very short descriptive text", () => {
      expect(classifyAlt("hi", "x.jpg")).toBe(ImageAltQuality.TOO_SHORT);
    });
    it("TOO_LONG for overly long alt", () => {
      const long = "a".repeat(200);
      expect(classifyAlt(long, "x.jpg")).toBe(ImageAltQuality.TOO_LONG);
    });
    it("GOOD for descriptive alt within bounds", () => {
      expect(
        classifyAlt("Sunset over the harbor with sailboats", "x.jpg"),
      ).toBe(ImageAltQuality.GOOD);
    });
  });

  describe("analyzeImage", () => {
    const base = {
      src: "https://example.com/img/hero.jpg",
      alt: "A wide ocean view at sunset",
      width: 1200,
      height: 630,
      loading: null as string | null,
      hasSrcset: true,
      domIndex: 0,
      isOgImage: false,
      inSitemap: true,
    };

    it("returns no flags for a clean image", () => {
      const result = analyzeImage(base);
      expect(result.flags).toEqual([]);
      expect(result.hasAlt).toBe(true);
      expect(result.altQuality).toBe(ImageAltQuality.GOOD);
      expect(result.aboveFold).toBe(true);
    });

    it("flags above-fold lazy", () => {
      const result = analyzeImage({ ...base, loading: "lazy", domIndex: 0 });
      expect(result.flags).toContain("above_fold_lazy");
      expect(result.aboveFold).toBe(true);
    });

    it("flags below-fold eager (no loading attr)", () => {
      const result = analyzeImage({ ...base, loading: null, domIndex: 10 });
      expect(result.flags).toContain("below_fold_eager");
      expect(result.aboveFold).toBe(false);
    });

    it("flags missing dimensions for raster", () => {
      const result = analyzeImage({
        ...base,
        width: null,
        height: null,
      });
      expect(result.flags).toContain("missing_dimensions");
    });

    it("does not flag missing dims for SVG", () => {
      const result = analyzeImage({
        ...base,
        src: "https://example.com/logo.svg",
        width: null,
        height: null,
      });
      expect(result.flags).not.toContain("missing_dimensions");
    });

    it("flags og_too_small when og:image is undersized", () => {
      const result = analyzeImage({
        ...base,
        isOgImage: true,
        width: OG_RECOMMENDED_MIN_WIDTH - 100,
        height: OG_RECOMMENDED_MIN_HEIGHT - 100,
      });
      expect(result.flags).toContain("og_too_small");
    });

    it("flags og_aspect_off when ratio is wrong", () => {
      const result = analyzeImage({
        ...base,
        isOgImage: true,
        width: 1200,
        height: 1200, // 1:1 instead of 1.91:1
      });
      expect(result.flags).toContain("og_aspect_off");
    });

    it("flags not_in_sitemap when image isn't in sitemap and looks like a raster", () => {
      const result = analyzeImage({ ...base, inSitemap: false });
      expect(result.flags).toContain("not_in_sitemap");
    });

    it("emits missing_alt for null alt", () => {
      const result = analyzeImage({ ...base, alt: null });
      expect(result.flags).toContain("missing_alt");
      expect(result.hasAlt).toBe(false);
    });

    it("emits empty_alt for whitespace alt (decorative)", () => {
      const result = analyzeImage({ ...base, alt: "" });
      expect(result.flags).toContain("empty_alt");
      expect(result.hasAlt).toBe(true); // empty alt is still a present attr
    });
  });
});
