import React from "react";

export default function Button({ children }) {
  return (
    <button className="group inline-flex ring-1 items-center justify-center rounded-full py-2 px-4 text-sm cursor-pointer">
      {children}
    </button>
  );
}
