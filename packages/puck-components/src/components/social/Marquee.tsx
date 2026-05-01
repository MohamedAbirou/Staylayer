import { useRef, useState, useEffect } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";

interface MarqueeItem {
  imageUrl: string;
  alt: string;
  link: string;
}

export interface MarqueeProps {
  title: string;
  titleFontSize: number;
  titleFontWeight: string;
  items: MarqueeItem[];
  speed: string;
  direction: string;
  pauseOnHover: boolean;
  itemHeight: string;
  grayscale: boolean;
  gap: string;
  dragToScroll: boolean;
}

// px per frame at 60 fps
const speedMap: Record<string, number> = {
  slow: 0.3,
  normal: 0.6,
  fast: 1.2,
};

const heightMap: Record<string, string> = {
  sm: "h-6",
  md: "h-8",
  lg: "h-10",
  xl: "h-12",
};

export const Marquee = ({
  title = "",
  titleFontSize = 16,
  titleFontWeight = "normal",
  items = [],
  speed = "normal",
  direction = "left",
  pauseOnHover = true,
  itemHeight = "md",
  grayscale = true,
  gap = "lg",
  dragToScroll = true,
}: MarqueeProps) => {
  const pxPerFrame = speedMap[speed] ?? 0.6;

  // ── RAF-based scroll state (mirrors OTASlider exactly) ──────────────────
  const [translateX, setTranslateX] = useState(0);
  const [currentDir, setCurrentDir] = useState(direction === "right" ? 1 : -1);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, translate: 0 });
  const [totalWidth, setTotalWidth] = useState(0);
  const animationRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasDragged = useRef(false);

  // Sync direction prop from Puck editor
  useEffect(() => {
    setCurrentDir(direction === "right" ? 1 : -1);
  }, [direction]);

  // Measure actual item width after render (same pattern as OTASlider)
  useEffect(() => {
    if (containerRef.current) {
      const firstChild = containerRef.current
        .firstElementChild as HTMLElement | null;
      if (firstChild) {
        const measuredItemWidth = firstChild.offsetWidth;
        const calculatedTotalWidth = items.length * measuredItemWidth;
        setTotalWidth(calculatedTotalWidth);
      }
    }
  }, [items]);

  // Set starting position once widths are known
  useEffect(() => {
    if (totalWidth > 0) {
      setTranslateX(-totalWidth);
    }
  }, [totalWidth]);

  // RAF animation loop (identical logic to OTASlider)
  useEffect(() => {
    if (totalWidth === 0) return;
    const shouldPause = isDragging || (pauseOnHover && isHovered);

    const animate = () => {
      if (!shouldPause) {
        setTranslateX((prev) => {
          const next = prev + currentDir * pxPerFrame;
          // Wraparound: same math as OTASlider
          if (currentDir < 0 && next <= -totalWidth * 2) return -totalWidth;
          if (currentDir > 0 && next >= 0) return -totalWidth;
          return next;
        });
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [currentDir, isDragging, isHovered, pauseOnHover, totalWidth, pxPerFrame]);

  // ── Drag handlers (same logic as OTASlider) ─────────────────────────────
  const handleStart = (clientX: number) => {
    if (!dragToScroll) return;
    hasDragged.current = false;
    setIsDragging(true);
    setDragStart({ x: clientX, translate: translateX });
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || totalWidth === 0 || !dragToScroll) return;
    hasDragged.current = true;
    const deltaX = clientX - dragStart.x;
    let newTranslate = dragStart.translate + deltaX;

    // Seamless wraparound during drag
    if (newTranslate <= -totalWidth * 2) {
      const overflow = newTranslate + totalWidth * 2;
      newTranslate = -totalWidth + overflow;
      setDragStart({ x: clientX, translate: -totalWidth });
    } else if (newTranslate >= 0) {
      const overflow = newTranslate;
      newTranslate = -totalWidth + overflow;
      setDragStart({ x: clientX, translate: -totalWidth });
    }

    setTranslateX(newTranslate);
  };

  const handleEnd = (clientX: number) => {
    if (!isDragging) return;
    const deltaX = clientX - dragStart.x;
    if (Math.abs(deltaX) > 30) {
      setCurrentDir(deltaX > 0 ? 1 : -1);
    }
    setIsDragging(false);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };
  const handleMouseUp = (e: React.MouseEvent) => {
    handleEnd(e.clientX);
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches[0]) handleEnd(e.changedTouches[0].clientX);
  };

  // Render 3 copies for seamless looping (same as OTASlider's allLogos)
  const allItems = [...items, ...items, ...items];

  // Gap as px value for item padding
  const gapPxMap: Record<string, number> = { sm: 8, md: 16, lg: 24, xl: 40 };
  const gapPx = gapPxMap[gap] ?? 24;

  return (
    <div className="w-full overflow-hidden py-8 md:py-12">
      {title && (
        <p
          className={`mb-8 text-center text-sm uppercase tracking-wider text-gray-500 font-${titleFontWeight}`}
          style={{
            ...(titleFontSize > 0 ? { fontSize: `${titleFontSize}px` } : {}),
          }}
        >
          {title}
        </p>
      )}

      <div className="relative overflow-hidden w-full">
        {/* Edge fade masks */}
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-gradient-to-l from-white to-transparent" />

        <div
          ref={containerRef}
          className={cn(
            "flex select-none",
            isDragging ? "cursor-grabbing" : dragToScroll ? "cursor-grab" : "",
          )}
          style={{
            transform: `translateX(${translateX}px)`,
            transition: "none",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={(e) => {
            setIsHovered(false);
            handleMouseUp(e);
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseEnter={() => setIsHovered(true)}
        >
          {allItems.map((item, i) => {
            const img = (
              <img
                src={item.imageUrl}
                alt={item.alt || `Logo ${(i % Math.max(items.length, 1)) + 1}`}
                className={cn(
                  "w-full object-contain transition-all duration-300",
                  heightMap[itemHeight],
                  grayscale
                    ? "grayscale hover:grayscale-0 hover:scale-110 opacity-70 hover:opacity-100"
                    : "hover:scale-110",
                )}
                draggable={false}
              />
            );

            const wrapper = item.link ? (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => hasDragged.current && e.preventDefault()}
                className="flex items-center justify-center"
              >
                {img}
              </a>
            ) : (
              <div className="flex items-center justify-center">{img}</div>
            );

            return (
              <div
                key={`${i}`}
                className="flex-shrink-0 bg-white p-4 mb-2 mt-2"
                style={{
                  width: 128,
                  paddingLeft: gapPx / 2,
                  paddingRight: gapPx / 2,
                  userSelect: "none",
                }}
              >
                {wrapper}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const marqueeConfig: ComponentConfig<MarqueeProps> = {
  label: "Marquee",
  fields: {
    title: { type: "text", label: "Title (optional)", contentEditable: true },
    titleFontSize: {
      type: "number",
      label: "Title Font Size (px, 0 = responsive auto)",
      min: 0,
      max: 120,
    },
    titleFontWeight: {
      type: "select",
      label: "Title Font Weight",
      options: [
        { label: "Thin", value: "thin" },
        { label: "Extra Light", value: "extralight" },
        { label: "Light", value: "light" },
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
        { label: "Extra Bold", value: "extrabold" },
        { label: "Black", value: "black" },
      ],
    },
    items: {
      type: "array",
      label: "Logos / Items",
      arrayFields: {
        imageUrl: { type: "text", label: "Image URL" },
        alt: { type: "text", label: "Alt Text" },
        link: { type: "text", label: "Link (optional)" },
      },
      defaultItemProps: {
        imageUrl: "https://placehold.co/200x60/e2e8f0/64748b?text=Logo",
        alt: "Logo",
        link: "",
      },
    },
    speed: {
      type: "radio",
      label: "Speed",
      options: [
        { label: "Slow", value: "slow" },
        { label: "Normal", value: "normal" },
        { label: "Fast", value: "fast" },
      ],
    },
    direction: {
      type: "radio",
      label: "Default Direction",
      options: [
        { label: "← Left", value: "left" },
        { label: "→ Right", value: "right" },
      ],
    },
    pauseOnHover: {
      type: "radio",
      label: "Pause on Hover",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    dragToScroll: {
      type: "radio",
      label: "Drag to Change Direction",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    itemHeight: {
      type: "radio",
      label: "Logo Height",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
    grayscale: {
      type: "radio",
      label: "Grayscale Effect",
      options: [
        { label: "Yes — b&w until hover", value: true },
        { label: "No — always full color", value: false },
      ],
    },
    gap: {
      type: "radio",
      label: "Gap Between Logos",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
  },
  defaultProps: {
    title: "Trusted by industry leaders",
    titleFontSize: 16,
    titleFontWeight: "normal",
    items: [
      {
        imageUrl: "/images/otas/agoda.svg",
        alt: "Agoda",
        link: "",
      },
      {
        imageUrl: "/images/otas/airbnb.svg",
        alt: "Airbnb",
        link: "",
      },
      {
        imageUrl: "/images/otas/booking.svg",
        alt: "Booking",
        link: "",
      },
      {
        imageUrl: "/images/otas/despegar.svg",
        alt: "Despegar",
        link: "",
      },
      {
        imageUrl: "/images/otas/didatravel.png",
        alt: "Didatravel",
        link: "",
      },
      {
        imageUrl: "/images/otas/expedia.svg",
        alt: "Expedia",
        link: "",
      },
      {
        imageUrl: "/images/otas/hipcamp.svg",
        alt: "Hipcamp",
        link: "",
      },
      {
        imageUrl: "/images/otas/hopper.svg",
        alt: "Hopper",
        link: "",
      },
      {
        imageUrl: "/images/otas/hotelbeds.svg",
        alt: "Hotelbeds",
        link: "",
      },
      {
        imageUrl: "/images/otas/hoterip.png",
        alt: "Hoterip",
        link: "",
      },
      {
        imageUrl: "/images/otas/hrs.svg",
        alt: "HRS",
        link: "",
      },
      {
        imageUrl: "/images/otas/inntopia.svg",
        alt: "Inntopia",
        link: "",
      },
      {
        imageUrl: "/images/otas/makemytrip.svg",
        alt: "MakeMyTrip",
        link: "",
      },
      {
        imageUrl: "/images/otas/moverii.avif",
        alt: "Moverii",
        link: "",
      },
      {
        imageUrl: "/images/otas/pitchup.png",
        alt: "Pitchup",
        link: "",
      },
      {
        imageUrl: "/images/otas/pricetravel.svg",
        alt: "PriceTravel",
        link: "",
      },
      {
        imageUrl: "/images/otas/ratedock.svg",
        alt: "RateDock",
        link: "",
      },
      {
        imageUrl: "/images/otas/roombeast.png",
        alt: "Roombeast",
        link: "",
      },
      {
        imageUrl: "/images/otas/spot2nite.png",
        alt: "Spot2nite",
        link: "",
      },
      {
        imageUrl: "/images/otas/szallas.svg",
        alt: "Szallas",
        link: "",
      },
      {
        imageUrl: "/images/otas/tablethotels.svg",
        alt: "TabletHotels",
        link: "",
      },
      {
        imageUrl: "/images/otas/traveloka.svg",
        alt: "Traveloka",
        link: "",
      },
      {
        imageUrl: "/images/otas/trip.svg",
        alt: "Trip",
        link: "",
      },
      {
        imageUrl: "/images/otas/tripadvisor.svg",
        alt: "TripAdvisor",
        link: "",
      },
      {
        imageUrl: "/images/otas/vrbo.svg",
        alt: "Vrbo",
        link: "",
      },
    ],
    speed: "normal",
    direction: "left",
    pauseOnHover: true,
    dragToScroll: true,
    itemHeight: "md",
    grayscale: true,
    gap: "lg",
  },
  render: Marquee,
};
