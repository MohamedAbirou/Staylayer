import React, { useRef, useEffect, useState } from "react";
import { Resources } from "./navItems/resources";
import PlatformNavItems from "./navItems/platform";

export function DisplayActive({ activeTab, leftOffset, headerHeight }) {
  const contentRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (contentRef.current) {
      const { offsetWidth, offsetHeight } = contentRef.current;
      setDimensions({ width: offsetWidth, height: offsetHeight });
    }
  }, [activeTab]);

  if (!activeTab) {
    return null;
  }

  return (
    <>
      <div
        className="fixed top-[40px] z-[999]"
        style={{
          marginTop: `${headerHeight - 40}px`,
        }}
      >
        <div
          className="content absolute z-[999] top-0 left-0  origin-top-left pointer-events-none group-[.open]/wrap:pointer-events-auto"
          style={{
            width: dimensions.width,
            height: dimensions.height,
            transform: `translateX(${leftOffset - 20}px)`,
          }}
        >
          <div
            ref={contentRef}
            className="z-[999] flex gap-x-6 bg-white shadow-lg menu w-max absolute transition-opacity p-5 overflow-hidden opacity-0 [&.active]:opacity-100 pointer-events-none [&.active]:pointer-events-auto tabs group/item section-platform active"
          >
            {(activeTab === "resources" && <Resources />) ||
              (activeTab === "platform" && <PlatformNavItems />)}
          </div>
        </div>
      </div>
    </>
  );
}
