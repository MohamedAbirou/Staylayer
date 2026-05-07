import React from "react";
import CTASection, { CTAHeading, CTALink } from "./ctaSection";

export default function UnifiedCTA({
  heading = "Ready to plan your stay?",
  secondary = "Send us an inquiry",
}) {
  return (
    <CTASection>
      <CTAHeading>{heading}</CTAHeading>
      <div>
        <CTALink
          href="/contact-us"
          linkText={secondary}
          className="border border-white"
        />
      </div>
    </CTASection>
  );
}
