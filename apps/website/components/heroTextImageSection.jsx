import React from "react";
import { baseContainer, baseGrid, baseSection } from "./textImageSection";
import BrowserView from "./browserView";

export const HeroTextImageSection = ({ children, src, alt, url }) => {
  return (
    <section className={`${baseSection} bg-transparent`}>
      <div className={baseContainer}>
        <div className={baseGrid}>
          <div className="lg:pt-4 lg:mr-auto lg:pr-0 w-full flex justify-end">
            <div className="lg:max-w-lg title">{children}</div>
          </div>

          <BrowserView url={url} alt={alt} imageSrc={src} />
        </div>
      </div>
    </section>
  );
};
