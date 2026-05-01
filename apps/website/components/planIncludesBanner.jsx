import React from "react";

export default function PlanIncludesBanner({ title, paragraph, className }) {
  return (
    <div
      className={`mt-8 flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-6 py-3 max-w-max mx-auto text-slate-800 text-base font-semibold shadow ${className}`}
    >
      <svg
        className="w-5 h-5 shrink-0 text-blue-500 opacity-80"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
      <span className="font-semibold text-slate-800">
        {title && <span className="font-bold">{title}</span>}
        {paragraph && <span> {paragraph}</span>}
      </span>
    </div>
  );
}
