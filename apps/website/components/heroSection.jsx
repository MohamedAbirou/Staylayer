import React from "react";

export default function HeroSection({ h1 = "", p = "", children }) {
  return (
    <div className="hero min-h-screen  breakout-section bg-gradient-to-b from-blue-50 via-white to-white px-4 pt-32">
      <div className="container title mx-auto text-center space-y-8">
        {h1 && (
          <h1 className="text-3xl sm:text-4xl md:text-5xl text-balance font-semibold!">
            {h1}
          </h1>
        )}
        {p && (
          <p className="raw text-lg sm:text-xl text-slate-700 font-medium max-w-max lg:max-w-2/3 mx-auto">
            {p}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
