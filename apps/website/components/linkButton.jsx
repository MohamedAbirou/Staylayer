import Link from "next/link";
import React from "react";

export default function LinkButton({ children, className = "", href, props }) {
  return (
    <Link
      href={href}
      {...props}
      className={`group  inline-flex ring-1 items-center justify-center rounded-full py-2 px-4 text-sm ${className}`}
    >
      {children}
    </Link>
  );
}
