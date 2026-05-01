"use client";

import Image from "next/image";
import React from "react";

export const baseSection =
  "breakout-section overflow-hidden relative bg-blue-600";
export const baseContainer = "mx-auto max-w-7xl px-6 lg:px-8 relative z-10";

export const baseGrid =
  "mt-0 md:mt-8 lg:mt-16 grid grid-cols-1 items-center gap-y-2 pt-10 sm:gap-y-6 md:mt-20 lg:grid-cols-2 lg:pt-0"; // removed all gap/padding/margin

export const imageFullWidth =
  "w-[48rem] max-w-none rounded-xl shadow-2xl ring-1 ring-gray-400/10 sm:w-[57rem]";

export const wrapperFullWidth =
  "rounded-xl bg-gray-900/5 p-2 ring-1 ring-inset ring-gray-900/10 lg:rounded-2xl lg:p-4";

export const TextImageSection = ({
  children,
  title,
  description,
  src,
  alt,
  fullWidth = false,
  sectionTitle = "",
  textSmall = false,
}) => {
  const wrapperClass = fullWidth
    ? wrapperFullWidth
    : "rounded-xl bg-gray-900/5 lg:rounded-2xl lg:p-4";

  const imageClass = fullWidth
    ? imageFullWidth
    : "rounded-xl shadow-2xl ring-1 ring-gray-400/10";

  return (
    <section className={baseSection}>
      <Image
        src="/background-call-to-action.6a5a5672.jpg"
        alt="Background image for call to action section"
        fill
        className="absolute top-0 left-0 w-full h-full object-cover z-[1] opacity-80"
        style={{ color: "transparent" }}
        loading="lazy"
      />

      {sectionTitle && (
        <div className="title relative z-10 pt-10">
          <h2 className="text-white! font-semibold!">{sectionTitle}</h2>
        </div>
      )}

      <div className={baseContainer}>
        <div className={baseGrid}>
          <div className="lg:pt-4 lg:mr-auto lg:pr-4">
            <div className="lg:max-w-lg title">
              {title && (
                <h2 className={`text-white! ${textSmall && "text-base!"}`}>
                  {title}
                </h2>
              )}

              <div
                className={`mt-6 text-start text-white  group relative rounded-xl px-4 py-1  lg:p-6  bg-white/10 lg:ring-inset ${
                  textSmall && "text-sm!"
                }`}
              >
                {description && (
                  <p className={`text-white! ${textSmall && "text-sm!"}`}>
                    {description}
                  </p>
                )}
                {children}
              </div>
            </div>
          </div>

          <div className="flex items-start justify-start lg:order-last">
            <div className={wrapperClass}>
              <Image
                alt={alt}
                loading="lazy"
                width={2400}
                height={1800}
                className={imageClass}
                src={src}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
