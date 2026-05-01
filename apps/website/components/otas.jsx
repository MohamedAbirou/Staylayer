import React, { useEffect, useRef, useState } from "react";

export default function OTASlider({
  direction: initialDirection = -1,
  offset = 0,
}) {
  const [translateX, setTranslateX] = useState(0);
  const [direction, setDirection] = useState(initialDirection); // -1 for right to left, 1 for left to right
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, translate: 0 });
  const [totalWidth, setTotalWidth] = useState(0);
  const [itemWidth, setItemWidth] = useState(0);
  const animationRef = useRef();
  const containerRef = useRef();

  const OTA_LOGOS = [
    { name: "Airbnb", src: "/images/otas/airbnb.svg" },
    { name: "Booking.com", src: "/images/otas/booking.svg" },
    { name: "Agoda", src: "/images/otas/agoda.svg" },
    { name: "Vrbo", src: "/images/otas/vrbo.svg" },
    { name: "Expedia", src: "/images/otas/expedia.svg" },
    { name: "Tripadvisor", src: "/images/otas/tripadvisor.svg" },
    { name: "Trip.com", src: "/images/otas/trip.svg" },
    { name: "Despegar", src: "/images/otas/despegar.svg" },
    { name: "Hopper", src: "/images/otas/hopper.svg" },
    { name: "MakeMyTrip", src: "/images/otas/makemytrip.svg" },
    { name: "PriceTravel", src: "/images/otas/pricetravel.svg" },
    { name: "Traveloka", src: "/images/otas/traveloka.svg" },
    { name: "Tablethotels", src: "/images/otas/tablethotels.svg" },
    { name: "Inntopia", src: "/images/otas/inntopia.svg" },
    { name: "HRS", src: "/images/otas/hrs.svg" },
    { name: "Hotelbeds", src: "/images/otas/hotelbeds.svg" },
    { name: "Pitchup", src: "/images/otas/pitchup.png" },
    { name: "Hoterip", src: "/images/otas/hoterip.png" },
    { name: "Hipcamp", src: "/images/otas/hipcamp.svg" },
    { name: "Ratedock", src: "/images/otas/ratedock.svg" },
    { name: "Roombeast", src: "/images/otas/roombeast.png" },
    { name: "Moverii", src: "/images/otas/moverii.avif" },
    { name: "Didatravel", src: "/images/otas/didatravel.png" },
    { name: "Szallas", src: "/images/otas/szallas.svg" },
    { name: "Spot2nite", src: "/images/otas/spot2nite.png" },
  ];

  const allLogos = [...OTA_LOGOS, ...OTA_LOGOS, ...OTA_LOGOS];

  // Measure actual width after render
  useEffect(() => {
    if (containerRef.current) {
      const firstChild = containerRef.current.firstElementChild;
      if (firstChild) {
        const measuredItemWidth = firstChild.offsetWidth;
        const calculatedTotalWidth = OTA_LOGOS.length * measuredItemWidth;
        setItemWidth(measuredItemWidth);
        setTotalWidth(calculatedTotalWidth);
      }
    }
  }, []);

  useEffect(() => {
    if (totalWidth > 0 && itemWidth > 0) {
      // Calculate starting position based on offset
      const offsetPosition = offset * itemWidth;
      setTranslateX(-totalWidth + offsetPosition);
    }
  }, [totalWidth, itemWidth, offset]);

  useEffect(() => {
    if (totalWidth === 0) return; // Don't animate until we have proper width

    const animate = () => {
      if (!isDragging) {
        setTranslateX((prev) => {
          const newX = prev + direction * 0.5; // Fixed animation speed

          // Fixed infinite scrolling for both directions
          if (direction < 0) {
            // Moving right to left
            if (newX <= -totalWidth * 2) {
              return -totalWidth;
            }
          } else {
            // Moving left to right
            if (newX >= 0) {
              return -totalWidth;
            }
          }

          return newX;
        });
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [direction, isDragging, totalWidth]);

  // Update direction when prop changes
  useEffect(() => {
    setDirection(initialDirection);
  }, [initialDirection]);

  const handleStart = (clientX) => {
    setIsDragging(true);
    setDragStart({
      x: clientX,
      translate: translateX,
    });
  };

  const handleMove = (clientX) => {
    if (!isDragging || totalWidth === 0) return;

    const deltaX = clientX - dragStart.x;
    let newTranslate = dragStart.translate + deltaX;

    // Handle wrapping during drag for seamless infinite scroll
    if (newTranslate <= -totalWidth * 2) {
      // When dragging too far right to left, wrap to the beginning
      const overflow = newTranslate + totalWidth * 2;
      newTranslate = -totalWidth + overflow;
      setDragStart({
        x: clientX,
        translate: -totalWidth,
      });
    } else if (newTranslate >= 0) {
      // When dragging too far left to right, wrap to the end
      const overflow = newTranslate;
      newTranslate = -totalWidth + overflow;
      setDragStart({
        x: clientX,
        translate: -totalWidth,
      });
    }

    setTranslateX(newTranslate);
  };

  const handleEnd = (clientX) => {
    if (!isDragging) return;

    const deltaX = clientX - dragStart.x;

    if (Math.abs(deltaX) > 30) {
      setDirection(deltaX > 0 ? 1 : -1);
    }

    setIsDragging(false);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  const handleMouseMove = (e) => {
    handleMove(e.clientX);
  };

  const handleMouseUp = (e) => {
    handleEnd(e.clientX);
  };

  const handleTouchStart = (e) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    handleMove(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (e.changedTouches[0]) {
      handleEnd(e.changedTouches[0].clientX);
    }
  };

  return (
    <div className="w-full">
      <div className="relative overflow-hidden w-full">
        <div
          ref={containerRef}
          className={`flex select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{
            transform: `translateX(${translateX}px)`,
            transition: "none",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {allLogos.map((ota, index) => (
            <div
              key={`${ota.name}-${index}`}
              className="
                            flex-shrink-0 
                            mx-4 p-4 mb-5 mt-2 
                            bg-white 
                            grayscale 
                            hover:grayscale-0 
                            hover:scale-110 transition-all duration-300"
              style={{ width: "128px", userSelect: "none" }}
            >
              <img
                src={ota.src}
                alt={ota.name}
                className="h-10 w-full object-contain transition-all duration-300"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
