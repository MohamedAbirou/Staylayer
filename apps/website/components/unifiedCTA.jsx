import React from "react";
import CTASection, { CTAHeading, CTALink } from "./ctaSection";

export default function UnifiedCTA({
  heading = "Ready to Take Control of Your Vacation Rental Business?",
  secondary = "Get started",
}) {
  return (
    <CTASection>
      <CTAHeading>
        {heading}
      </CTAHeading>
      <div>
        <CTALink
          href="/pricing"
          linkText={secondary}
          className="border border-white"
        />
      </div>
    </CTASection>
  );
}
