import React, { useRef, useEffect, useState } from "react";

export default function Accordion({
  title,
  children,
  isOpen,
  setOpen,
  allowOverFlow = true,
  border = true,
  className = "",
}) {
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState("0px");

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(isOpen ? `${contentRef.current.scrollHeight}px` : "0px");
    }
  }, [isOpen, children]);

  return (
    <div className="w-full">
      <button
        className={`flex items-center  px-6 justify-between w-full text-left py-6 font-semibold text-gray-900 ${
          border && "border-y border-gray-200"
        } transition-colors duration-200 hover:bg-gray-50 ${className}`}
        onClick={setOpen}
        aria-expanded={isOpen}
      >
        <span className="capitalize">{title}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-chevron-down h-5 w-5 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <path d="m6 9 6 6 6-6"></path>
        </svg>
      </button>

      <div
        ref={contentRef}
        style={{ maxHeight: contentHeight }}
        className={`
          transition-all duration-300 ease-in-out overflow-hidden
          ${isOpen && allowOverFlow && "overflow-y-auto"}
        `}
      >
        <div className="py-2 px-3">{children}</div>
      </div>
    </div>
  );
}
