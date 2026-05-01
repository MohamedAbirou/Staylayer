import FAQ from "@/components/faq";
import HeroSection from "@/components/heroSection";
import OrderList from "@/components/orderList";
import SEOHead from "@/components/seoHead";
import { TextImageSection } from "@/components/textImageSection";
import UnifiedCTA from "@/components/unifiedCTA";
import FeatureCard, { FeatureCardWrapper } from "@/components/unorderedList";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import PuckRenderer from "@/lib/puckRenderer";
import { getPageData } from "@/lib/cmsClient";

const faqContent = [
  {
    q: `How do I connect Airbnb to ${BRAND_NAME}?`,
    a: {
      paragraphs: [
        `Create a free ${BRAND_NAME} trial, select Connect Airbnb, and follow the guided steps to link your listing. The process takes about five minutes.`,
      ],
    },
  },
  {
    q: "Which channel managers work best with Airbnb?",
    a: {
      paragraphs: [
        `Look for a provider with a full Airbnb API connection (not just iCal). ${BRAND_NAME} is an official Airbnb Preferred Partner, ensuring reliable two-way sync.`,
      ],
    },
  },
  {
    q: `What does ${BRAND_NAME} cost?`,
    a: {
      paragraphs: [
        `Plans start at " + process.env.NEXT_PUBLIC_PRICE + " per month for ${BRAND_NAME} Pro, which includes the Channel Manager, Dynamic Pricing, unified inbox, and guest guidebook.`,
      ],
    },
  },
];

const pageDetails = {
  pageTitle: `${BRAND_NAME} Airbnb Channel Manager | Sync, Automate & Boost Your Vacation Rental Revenue`,
  pageDescription: `Discover ${BRAND_NAME}, the top-rated Airbnb channel manager and vacation rental software. Instantly sync calendars, automate guest messaging, and optimize pricing for more bookings and higher earnings. Official Airbnb Preferred Partner.`,
  pageKeywords:
    "Airbnb channel manager, vacation rental software, calendar sync, guest messaging automation, dynamic pricing, Airbnb API, property management, unified inbox, short-term rental automation, Airbnb integration, preferred partner",
};

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData("channel-manager-airbnb", locale || "en");

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function ChannelManagerAirbnb({ cmsPage }) {
  // ── CMS page is ready: render it via Puck ──────────────────────────────
  if (cmsPage?.puckData) {
    const rootProps = cmsPage.puckData?.root?.props || {};
    return (
      <>
        <SEOHead
          pageTitle={
            cmsPage.seoTitle ||
            rootProps.seoTitle ||
            cmsPage.title ||
            pageDetails.pageTitle
          }
          pageDescription={
            cmsPage.seoDescription ||
            rootProps.seoDescription ||
            pageDetails.pageDescription
          }
          pageKeywords={
            cmsPage.seoKeywords ||
            rootProps.seoKeywords ||
            pageDetails.pageKeywords
          }
        />
        <main id="channel-manager-airbnb">
          <PuckRenderer data={cmsPage.puckData} />
        </main>
      </>
    );
  }

  // ── Fallback: original hardcoded page ──────────────────────────────────
  return (
    <>
      <SEOHead {...pageDetails} />
      <main className="relative -mt-10">
        <HeroSection
          h1={`${BRAND_NAME}, Your Top-Rated Airbnb Channel Manager & Vacation-Rental Software`}
          p="Boost your earnings by up to 20 % with smart automation, real-time syncing, and data-driven pricing ,  purpose-built for short-term rental hosts and property managers."
        />

        <section>
          <div className="title">
            <h2>Why Airbnb Hosts Choose {BRAND_NAME}</h2>
          </div>

          <div className="table-wrapper max-w-5xl mx-auto">
            <div>
              <table>
                <colgroup>
                  <col className="w-1/3" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-center!">Powerful Feature</th>
                    <th className="text-center!">How It Helps You Earn More</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="table-cell-category">
                      True Real-Time Calendar Sync
                    </td>
                    <td>
                      Instantly updates availability across Airbnb and every
                      connected booking site, eliminating double bookings and
                      manual errors.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">Unified Guest Inbox</td>
                    <td>
                      Read and reply to every Airbnb message (and messages from
                      other channels) in one dashboard, saving hours each week.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">
                      Dynamic Pricing Engine
                    </td>
                    <td>
                      Automatically adjusts nightly rates based on seasonality,
                      demand, local events, and occupancy trends to capture
                      higher revenue.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">
                      Flexible Rate & Rules Editor
                    </td>
                    <td>
                      Set base rates, weekend premiums, minimum stays, and
                      last-minute discounts in seconds.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">
                      Digital Guest Guidebook
                    </td>
                    <td>
                      Deliver a branded, mobile-friendly handbook with Wi-Fi
                      details, house rules, local tips, and upsell offers.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">5-Minute Setup</td>
                    <td>
                      Connect your Airbnb listing with {BRAND_NAME}’s Preferred
                      API integration and start syncing immediately , no
                      technical skills required.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Complete Airbnb Integration</h2>
          </div>

          <FeatureCardWrapper className="flex flex-col items-stretch !max-w-2xl">
            <FeatureCard
              textBg="bg-blue-100"
              textColor="text-blue-600"
              title="Preferred Software Partner"
              paragraphs={[
                `Airbnb recognizes ${BRAND_NAME} for reliable performance and deep API connectivity. Your listings, rates, and restrictions update instantly.`,
              ]}
            />
            <FeatureCard
              textBg="bg-green-100"
              textColor="text-green-600"
              title="One-Click Sync"
              paragraphs={[
                "Import existing listings, photos, amenities, and policies. Future edits flow both directions.",
              ]}
            />
            <FeatureCard
              textBg="bg-yellow-100"
              textColor="text-yellow-600"
              title="Auto-Responder & Messaging Templates"
              paragraphs={[
                "Send personalized booking confirmations, check-in instructions, review reminders, and upsell campaigns without lifting a finger.",
              ]}
            />
          </FeatureCardWrapper>
        </section>

        <section>
          <TextImageSection
            title={"Smarter Pricing, More Bookings"}
            description={`${BRAND_NAME}’s Dynamic Pricing tool analyzes historical booking data, competitor rates, and real-time demand signals to recommend the optimal nightly price. Hosts who enable Dynamic Pricing see an average 20 % jump in revenue within the first three months.`}
            src="/images/dynamic-pricing-1.png"
            alt="Dynamic Pricing Engine"
            fullWidth={true}
          />
        </section>

        <section>
          <div className="title">
            <h2>Learn the Secrets of Airbnb Success</h2>

            <p>
              Whether you manage one apartment or a portfolio of villas, our
              free{" "}
              <span className="raw font-semibold">
                {BRAND_NAME} Host Academy
              </span>{" "}
              accelerates your growth:
            </p>
          </div>

          <div>
            <OrderList
              list={[
                {
                  title: "Beginner’s Guide to Airbnb Hosting",
                  description:
                    "nail the fundamentals and optimize your listing.",
                },
                {
                  title: "Mastering Airbnb Reviews",
                  description: "drive 5-star feedback that boosts search rank.",
                },
                {
                  title: "Revenue-Maximization Playbook",
                  description:
                    "advanced tactics for occupancy, upsells, and repeat stays.",
                },
                {
                  title: "Path to Superhost",
                  description:
                    "actionable checklist to hit Airbnb’s top tier faster.",
                },
              ]}
            />
          </div>
        </section>
        <section>
          <FAQ content={faqContent} />
        </section>

        <UnifiedCTA />
      </main>
    </>
  );
}
