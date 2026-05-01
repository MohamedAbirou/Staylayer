import Image from "next/image";
import React from "react";
import LinkButton from "./linkButton";

export default function CTASection({ children }) {
  return (
    <section
      id="get-started-today"
      className="breakout-section relative bg-blue-600 py-32"
    >
      <Image
        loading="lazy"
        alt="Background image for call to action section"
        width={2347}
        height={1244}
        className="absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
        style={{ color: "transparent" }}
        src="/background-call-to-action.6a5a5672.jpg"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        <div className="mx-auto max-w-3xl text-center">{children}</div>
      </div>
    </section>
  );
}

export function CTAHeading({ children }) {
  return <h2 className="text-white! leading-tight">{children}</h2>;
}

export function CTAParagraph({ children, className = "" }) {
  return (
    <p
      className={`text-white text-base sm:text-lg md:text-xl font-medium text-center max-w-2xl mx-auto mt-2 px-4 drop-shadow ${className}`}
    >
      {children}
    </p>
  );
}

export function CTALink({ linkText, href, className = "" }) {
  return (
    <LinkButton
      href={href}
      className={`text-white max-w-fit px-5 mt-8 text-base! hover:bg-white transition-all duration-300 hover:ring-transparent hover:text-slate-900 ${className}`}
    >
      {linkText}
    </LinkButton>
  );
}
