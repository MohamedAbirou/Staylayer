import { useCallback, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { PlanEnforcementBanner } from "./PlanEnforcementBanner";

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 520;
const SIDEBAR_DEFAULT_WIDTH = 352; // 22rem at 16px base

export function Layout() {
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("dashboard:sidebar-width");
      if (stored) {
        const n = Number(stored);
        if (n >= SIDEBAR_MIN_WIDTH && n <= SIDEBAR_MAX_WIDTH) return n;
      }
    } catch {
      // ignore
    }
    return SIDEBAR_DEFAULT_WIDTH;
  });

  const [isDragging, setIsDragging] = useState(false);
  const sidebarWidthRef = useRef(sidebarWidth);

  const handleDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    setIsDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      const next = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, startWidth + ev.clientX - startX),
      );
      sidebarWidthRef.current = next;
      setSidebarWidth(next);
    };

    const onMouseUp = (ev: MouseEvent) => {
      const final = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, startWidth + ev.clientX - startX),
      );
      sidebarWidthRef.current = final;
      setSidebarWidth(final);
      try {
        localStorage.setItem("dashboard:sidebar-width", String(final));
      } catch {
        // ignore
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setIsDragging(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  const handleDoubleClick = useCallback(() => {
    sidebarWidthRef.current = SIDEBAR_DEFAULT_WIDTH;
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
    try {
      localStorage.setItem(
        "dashboard:sidebar-width",
        String(SIDEBAR_DEFAULT_WIDTH),
      );
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar wrapper – width driven by drag state */}
      <div style={{ width: sidebarWidth }} className="h-full shrink-0">
        <Sidebar />
      </div>

      {/* ── Resize handle ───────────────────────────────────── */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        className="group relative z-20 shrink-0 cursor-col-resize"
        onMouseDown={handleDragStart}
        onDoubleClick={handleDoubleClick}
        title="Drag to resize · Double-click to reset"
      >
        {/* Track */}
        <div
          className={`absolute inset-y-0 left-1/2 -translate-x-1/2 transition-all duration-200 ${
            isDragging
              ? "w-0.5 bg-[#12392f]/70 shadow-[0_0_10px_rgba(18,57,47,0.3)]"
              : "w-px bg-slate-200 group-hover:w-0.5 group-hover:bg-[#12392f]/50 group-hover:shadow-[0_0_10px_rgba(18,57,47,0.2)]"
          }`}
        />
        {/* Grip pill */}
        <div
          className={`absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.75 rounded-full bg-white px-0.75 py-1.75 shadow-md ring-1 ring-slate-200 transition-all duration-200 ${
            isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-0.75 w-0.75 rounded-full bg-slate-400" />
          ))}
        </div>
      </div>

      {/* Main content */}
      <main
        className={`flex flex-1 flex-col overflow-auto bg-gray-50${
          isDragging ? " pointer-events-none" : ""
        }`}
      >
        <PlanEnforcementBanner />
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
