import { useState, useRef } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { backgroundColorField, textColorField } from "../../lib/fields";

interface TestimonialItem {
  quote: string;
  author: string;
  role: string;
  company: string;
  avatarUrl: string;
  rating: number;
}

export interface TestimonialCarouselProps {
  heading: string;
  subheading: string;
  testimonials: TestimonialItem[];
  autoplay: boolean;
  showDots: boolean;
  showArrows: boolean;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  // ── Heading typography ──
  headingColor: string;
  headingFontSize: number;
  headingWeight: string;
  // ── Subheading typography ──
  subheadingColor: string;
  subheadingFontSize: number;
  subheadingOpacity: number;
}

export const TestimonialCarousel = ({
  heading = "What our customers say",
  subheading = "Don't just take our word for it.",
  testimonials = [],
  showDots = true,
  showArrows = true,
  backgroundColor = "",
  textColor = "",
  accentColor = "#2563eb",
  headingColor = "",
  headingFontSize = 0,
  headingWeight = "bold",
  subheadingColor = "",
  subheadingFontSize = 0,
  subheadingOpacity = 70,
}: TestimonialCarouselProps) => {
  const [active, setActive] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  // Use a ref as the authoritative dragging flag to avoid stale-closure issues
  // in rapid pointer events, while isDragging state drives the CSS.
  const dragging = useRef(false);
  const startX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = testimonials.length;

  const prev = () => setActive((i) => (i - 1 + total) % total);
  const next = () => setActive((i) => (i + 1) % total);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    setIsDragging(true);
    startX.current = e.clientX;
    setDragOffset(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setDragOffset(e.clientX - startX.current);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    const offset = e.clientX - startX.current;
    const threshold = (containerRef.current?.offsetWidth ?? 300) * 0.25;
    if (offset < -threshold && total > 1) next();
    else if (offset > threshold && total > 1) prev();
    setDragOffset(0);
  };

  if (total === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        Add testimonials to display the carousel.
      </div>
    );
  }

  return (
    <div
      className="w-full px-4 py-12 md:px-6 md:py-20 bg-(--bg) text-(--fg)"
      style={
        {
          "--bg": backgroundColor || "transparent",
          "--fg": textColor || "inherit",
          "--accent": accentColor,
          "--slide-w": `${100 / total}%`,
        } as React.CSSProperties
      }
    >
      <div className="mx-auto max-w-3xl">
        {(heading || subheading) && (
          <div className="mb-10 text-center">
            {heading && (
              <h2
                style={{
                  color: headingColor || textColor || undefined,
                  ...(headingFontSize > 0
                    ? { fontSize: `${headingFontSize}px` }
                    : {}),
                }}
                className={`font-${headingWeight || "bold"} ${headingFontSize === 0 ? " text-2xl md:text-3xl" : ""}`}
              >
                {heading}
              </h2>
            )}
            {subheading && (
              <p
                style={{
                  color: subheadingColor || textColor || undefined,
                  opacity: subheadingOpacity / 100,
                  ...(subheadingFontSize > 0
                    ? { fontSize: `${subheadingFontSize}px` }
                    : {}),
                }}
                className={`mt-3 ${subheadingFontSize === 0 ? " text-base" : ""}`}
              >
                {subheading}
              </p>
            )}
          </div>
        )}

        <div className="relative">
          {/* Drag-to-swipe container */}
          <div
            ref={containerRef}
            className={cn(
              "overflow-hidden select-none touch-pan-y",
              isDragging ? "cursor-grabbing" : "cursor-grab",
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Sliding track — all slides laid out side by side */}
            <div
              className="flex will-change-transform w-(--track-w) [transform:var(--track-translate)] [transition:var(--track-transition)]"
              style={
                {
                  "--track-w": `${total * 100}%`,
                  "--track-translate": `translateX(calc(${-(active * 100) / total}% + ${dragOffset}px))`,
                  "--track-transition": isDragging
                    ? "none"
                    : "transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)",
                } as React.CSSProperties
              }
            >
              {testimonials.map((t, idx) => (
                <div
                  key={idx}
                  className="flex-shrink-0 text-center px-4 w-(--slide-w)"
                >
                  {/* Stars */}
                  {t.rating > 0 && (
                    <div className="mb-4 flex justify-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <svg
                          key={i}
                          className={cn(
                            "w-5 h-5",
                            i < t.rating ? "text-amber-400" : "text-gray-300",
                          )}
                          fill={i < t.rating ? "currentColor" : "none"}
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                          />
                        </svg>
                      ))}
                    </div>
                  )}

                  {/* Quote */}
                  <blockquote className="text-lg leading-relaxed md:text-xl">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>

                  {/* Author */}
                  <div className="mt-6 flex items-center justify-center gap-3">
                    {t.avatarUrl ? (
                      <img
                        src={t.avatarUrl}
                        alt={t.author}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                        loading="lazy"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 bg-(--accent)">
                        {t.author
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                    )}
                    <div className="text-left">
                      <p className="text-sm font-semibold">{t.author}</p>
                      {(t.role || t.company) && (
                        <p className="text-xs opacity-60">
                          {t.role}
                          {t.role && t.company && ", "}
                          {t.company}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation arrows */}
          {showArrows && total > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Previous testimonial"
              >
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 19.5L8.25 12l7.5-7.5"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Next testimonial"
              >
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Indicator dots */}
        {showDots && total > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            {testimonials.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300 bg-(--dot-bg)",
                  active === i ? "w-6" : "w-2",
                )}
                style={
                  {
                    "--dot-bg": active === i ? accentColor : "#d1d5db",
                  } as React.CSSProperties
                }
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const testimonialCarouselConfig: ComponentConfig<TestimonialCarouselProps> =
  {
    label: "Testimonial Carousel",
    fields: {
      heading: { type: "text", label: "Heading", contentEditable: true },
      subheading: { type: "text", label: "Subheading", contentEditable: true },
      testimonials: {
        type: "array",
        label: "Testimonials",
        arrayFields: {
          quote: { type: "textarea", label: "Quote", contentEditable: true },
          author: { type: "text", label: "Author" },
          role: { type: "text", label: "Role", contentEditable: true },
          company: { type: "text", label: "Company", contentEditable: true },
          avatarUrl: { type: "text", label: "Avatar URL" },
          rating: {
            type: "number",
            label: "Rating (0-5, 0 = hidden)",
            min: 0,
            max: 5,
          },
        },
        defaultItemProps: {
          quote: "Amazing product!",
          author: "Jane Doe",
          role: "CEO",
          company: "Acme Co.",
          avatarUrl: "",
          rating: 5,
        },
        getItemSummary: (item) => item.author || "Testimonial",
      },
      showArrows: {
        type: "radio",
        label: "Show Arrows",
        options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ],
      },
      showDots: {
        type: "radio",
        label: "Show Dots",
        options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ],
      },
      accentColor: { ...textColorField, label: "Accent Color" },
      backgroundColor: backgroundColorField,
      textColor: { ...textColorField, label: "Text Color (global fallback)" },
      // ── Heading typography ──
      headingColor: { ...textColorField, label: "Heading Color" },
      headingFontSize: {
        type: "number",
        label: "Heading Font Size (px, 0 = auto)",
        min: 0,
        max: 120,
      },
      headingWeight: {
        type: "select",
        label: "Heading Font Weight",
        options: [
          { label: "Normal", value: "normal" },
          { label: "Semibold", value: "semibold" },
          { label: "Bold", value: "bold" },
          { label: "Extra Bold", value: "extrabold" },
        ],
      },
      // ── Subheading typography ──
      subheadingColor: { ...textColorField, label: "Subheading Color" },
      subheadingFontSize: {
        type: "number",
        label: "Subheading Font Size (px, 0 = auto)",
        min: 0,
        max: 60,
      },
      subheadingOpacity: {
        type: "number",
        label: "Subheading Opacity (%)",
        min: 10,
        max: 100,
      },
      autoplay: {
        type: "radio",
        label: "Autoplay",
        options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ],
      },
    },
    defaultProps: {
      heading: "What our customers say",
      subheading: "Don't just take our word for it.",
      testimonials: [
        {
          quote:
            "This platform has completely transformed how we manage our business. The tools are intuitive and the support is world-class.",
          author: "Sarah Johnson",
          role: "CEO",
          company: "TechStart Inc.",
          avatarUrl: "",
          rating: 5,
        },
        {
          quote:
            "We saw a 3x increase in efficiency within the first month. Couldn't recommend it more highly.",
          author: "Michael Chen",
          role: "CTO",
          company: "GrowthLabs",
          avatarUrl: "",
          rating: 5,
        },
        {
          quote:
            "The best investment we've made for our team. Simple, powerful, and beautifully designed.",
          author: "Emily Davis",
          role: "VP of Operations",
          company: "ScaleUp Co.",
          avatarUrl: "",
          rating: 4,
        },
      ],
      autoplay: false,
      showDots: true,
      showArrows: true,
      backgroundColor: "",
      textColor: "",
      accentColor: "#2563eb",
      headingColor: "",
      headingFontSize: 0,
      headingWeight: "bold",
      subheadingColor: "",
      subheadingFontSize: 0,
      subheadingOpacity: 70,
    },
    render: TestimonialCarousel,
  };
