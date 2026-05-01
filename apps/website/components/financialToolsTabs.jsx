import React, { useState } from "react";
import CTASection, { CTAHeading, CTAParagraph } from "./ctaSection";
import { HeroTextImageSection } from "./heroTextImageSection";
import { DOMAIN_NAME } from "@/lib/brand";

const tabsData = [
  {
    key: "channel-manager",
    label: "Channel Manager",
    description:
      "Instant calendar sync across Airbnb, Booking.com, Vrbo, and 100+ other channels",
    textColor: "text-blue-600 lg:text-white",
    image: "/images/crm/rooms.png",
    imageAlt: "Channel Manager",
  },
  {
    key: "pms",
    label: "Property Management System (PMS)",
    description: `Control every listing, rate, and reservation from a single login`,
    textColor: "text-blue-600 lg:text-white",
    image: "/images/crm/overview.png",
    imageAlt: "Property Management System (PMS)",
  },
  {
    key: "reporting",
    label: "Reporting",
    description: `Gain insights into your business performance with comprehensive reports`,
    textColor: "text-blue-600 lg:text-white",
    image: "/images/crm/reports-cashflow.png",
    imageAlt: "Reporting",
  },
];

export default function FinancialToolsTabs() {
  const [selectedTab, setSelectedTab] = useState("channel-manager");

  return (
    <CTASection>
      <CTAHeading>Manage Smarter, Not Harder</CTAHeading>
      <CTAParagraph className="text-white! ">
        Streamline your operations and boost efficiency with our integrated
        solutions.
      </CTAParagraph>

      <HeroTextImageSection
        src={tabsData.find((tab) => tab.key === selectedTab).image}
        alt={tabsData.find((tab) => tab.key === selectedTab).imageAlt}
        url={`app.${DOMAIN_NAME}`}
      >
        <div className="-mx-4 flex overflow-x-auto pb-4 sm:mx-0 sm:overflow-visible sm:pb-0 lg:col-span-5">
          <div
            className="relative z-10 flex flex-col lg:flex-row gap-x-4 px-4 whitespace-nowrap sm:mx-auto sm:px-0 lg:mx-0 lg:block lg:gap-x-0 lg:gap-y-1 lg:whitespace-normal"
            role="tablist"
            aria-orientation="vertical"
          >
            {tabsData.map((tab) => (
              <div
                key={tab.key}
                className={`group relative rounded-full px-4 py-1 mb-2 lg:rounded-l-xl lg:rounded-r-none lg:p-6 ${
                  selectedTab === tab.key
                    ? "bg-white lg:bg-white/10 lg:ring-1 lg:ring-white/10 lg:ring-inset"
                    : "hover:bg-white/10 lg:hover:bg-white/5"
                }`}
              >
                <h3 className="text-start! !mb-0">
                  <button
                    className={`text-base! data-selected:not-data-focus:outline-hidden hover:!opacity-100 ${
                      selectedTab === tab.key
                        ? `${tab.textColor}`
                        : "text-white/80 hover:text-white"
                    }`}
                    id={`tab-${tab.key}`}
                    role="tab"
                    type="button"
                    aria-selected={selectedTab === tab.key}
                    tabIndex={selectedTab === tab.key ? 0 : -1}
                    data-headlessui-state={
                      selectedTab === tab.key ? "selected" : ""
                    }
                    aria-controls={`panel-${tab.key}`}
                    data-selected={selectedTab === tab.key ? "" : undefined}
                    onClick={() => setSelectedTab(tab.key)}
                  >
                    <span className="absolute inset-0 rounded-full lg:rounded-l-xl lg:rounded-r-none text-start!" />
                    {tab.label}
                  </button>
                </h3>
                <p
                  className={`mt-2 hidden text-sm! lg:block text-start! ${
                    selectedTab === tab.key
                      ? "text-white!"
                      : "text-white! opacity-80 !group-hover:text-white group-hover:opacity-100"
                  }`}
                >
                  {tab.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </HeroTextImageSection>
    </CTASection>
  );
}
