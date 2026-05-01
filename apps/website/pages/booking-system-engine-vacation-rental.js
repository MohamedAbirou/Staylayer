import FAQ from "@/components/faq";
import HeroSection from "@/components/heroSection";
import {
  FluentTent28Filled,
  MaterialSymbolsLightGlobe,
  MatrialIconsAgriculture,
  MatrialIconsHome,
  MatrialIconsHotel,
  MatrialIconsTrendingUp,
  MdiCalendarSyncOutline,
  MdiCode,
  MdiCoffee,
  MdiEuro,
  MdiHeart,
  MdiStar,
  MdiViewDashboardOutline,
} from "@/components/icons";
import Quote from "@/components/quote";
import UnifiedCTA from "@/components/unifiedCTA";
import FeatureCard, { FeatureCardWrapper } from "@/components/unorderedList";
import SEOHead from "@/components/seoHead";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import { getPageData } from "@/lib/cmsClient";
import PuckRenderer from "@/lib/puckRenderer";

const pageDetails = {
  pageTitle: `${BRAND_NAME} Booking Engine | Direct Booking System for Vacation Rentals, B&Bs, and Boutique Hotels`,
  pageDescription: `Increase your vacation rental revenue with ${BRAND_NAME}’s direct booking engine. Sync calendars, automate guest messaging, and manage reservations commission-free. Perfect for property managers, B&Bs, boutique hotels, and short-term rental hosts.`,
  pageKeywords:
    "vacation rental booking engine, direct booking system, property management software, channel manager, dynamic pricing, guest messaging automation, B&B software, boutique hotel booking, commission-free reservations, calendar sync",
};

const faqContent = [
  {
    q: `How does the ${BRAND_NAME} booking engine work?`,
    a: {
      paragraphs: [
        "We provide a lightweight iframe or link that drops into any website, instantly turning your site into a fully fledged vacation-rental reservation system, no coding required.",
      ],
    },
  },
  {
    q: "Why use a dedicated booking engine?",
    a: {
      paragraphs: [
        "Running your own direct-booking site boosts revenue, protects you from OTA policy changes, and lets you collect guest data for future marketing.",
      ],
    },
  },
  {
    q: `Can I integrate ${BRAND_NAME} with an existing website?`,
    a: {
      paragraphs: [
        "Absolutely. Paste our embed code or link into WordPress, Wix, Squarespace, or any custom site and start accepting secure, commission-free bookings in minutes.",
      ],
    },
  },
  {
    q: "What does it cost?",
    a: {
      paragraphs: [
        "Our plan is " +
          process.env.NEXT_PUBLIC_PRICE +
          " / month for one property and includes the full booking engine, channel manager, and automation suite.",
      ],
    },
  },
];

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData(
    "booking-system-engine-vacation-rental",
    locale || "en",
  );

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function BookingSystemEngineVacationRental({ cmsPage }) {
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
        <main id="booking-system-engine-vacation-rental">
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
          h1={`Boost Your Vacation-Rental Revenue with ${BRAND_NAME}`}
          p="The all-in-one booking engine built for short-term rental pros"
        />

        <section>
          <div className="title">
            <h2>Why Property Owners Choose {BRAND_NAME}</h2>

            <div>
              <FeatureCardWrapper className="grid grid-cols-1 md:grid-cols-2 items-stretch gap-6 mt-8 !max-w-4xl">
                <FeatureCard
                  icon1={MatrialIconsTrendingUp}
                  icon2={true}
                  textBg="bg-blue-100"
                  textColor="text-blue-700"
                  paragraphs={[
                    "Earn up to 20% more per booking with smart dynamic pricing and commission-free reservations.",
                  ]}
                />
                <FeatureCard
                  icon1={MaterialSymbolsLightGlobe}
                  icon2={true}
                  textBg="bg-green-100"
                  textColor="text-green-700"
                  paragraphs={[
                    "Control the guest journey from first click to check-out on your own direct-booking website.",
                  ]}
                />
                <FeatureCard
                  icon1={MdiCalendarSyncOutline}
                  icon2={true}
                  textBg="bg-yellow-100"
                  textColor="text-yellow-700"
                  paragraphs={[
                    "Keep calendars perfectly in sync across Airbnb, Booking.com, Vrbo, and every major OTA, no double-bookings, ever.",
                  ]}
                  // Icon: CalendarSync
                />
                <FeatureCard
                  icon1={MdiHeart}
                  icon2={true}
                  textBg="bg-purple-100"
                  textColor="text-purple-700"
                  paragraphs={[
                    "Turn first-time guests into loyal fans with automated messages, upsells, and personalized offers.",
                  ]}
                  // Icon: Heart/Star
                />
              </FeatureCardWrapper>
            </div>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Freedom from Third-Party Fees</h2>

            <div>
              <FeatureCardWrapper className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 items-stretch !max-w-4xl">
                <FeatureCard
                  icon1={MdiViewDashboardOutline}
                  icon2={false}
                  textBg="bg-blue-100"
                  textColor="text-blue-700"
                  title="A Booking System You Own"
                  paragraph="Add room descriptions, photos, cleaning fees, custom discounts, check-in rules, taxes, and add-ons, all in one dashboard you control."
                  // Icon: Dashboard/Settings
                />
                <FeatureCard
                  icon1={MdiCode}
                  icon2={false}
                  textBg="bg-green-100"
                  textColor="text-green-700"
                  title="Fully Integrated & Simple"
                  paragraph="Drop a ready-made iframe or HTML snippet onto any website. Your real-time availability, rates, and promotions update instantly across every channel."
                  // Icon: Integration/Code
                />
                <FeatureCard
                  icon1={MdiEuro}
                  icon2={false}
                  textBg="bg-yellow-100"
                  textColor="text-yellow-700"
                  title="Commission-Free, Direct Bookings"
                  paragraph={`Stop paying 15% or more to intermediaries. ${BRAND_NAME} lets you keep the full booking value, boosting your profit margin on every stay.`}
                  // Icon: Euro/NoCommission
                />
                <FeatureCard
                  icon1={MdiStar}
                  icon2={false}
                  textBg="bg-purple-100"
                  textColor="text-purple-700"
                  title="Built-In Guest Loyalty Tools"
                  paragraph="Automated review requests, coupon codes, and stay extensions keep happy guests coming back, effortlessly."
                  // Icon: Loyalty/Star
                />
              </FeatureCardWrapper>
            </div>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Trusted by Hosts Worldwide</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            <Quote
              quote={
                " “Hands down the best channel manager I’ve tried. All the features you need, no hidden charges, and it just works.”"
              }
              author={"Hasan"}
            />

            <Quote
              quote={`“I’ve used ${BRAND_NAME} for four years across six listings and as a booking engine on my own site. It’s easy to set up and even easier to run day-to-day.”`}
              author={"Rebecca"}
            />

            <Quote
              quote={`“${BRAND_NAME} automated tasks I used to handle manually, saving hours each week, and it’s still affordable!”`}
              author={"Stefano"}
            />
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Built for Every Type of Stay</h2>
          </div>

          <FeatureCardWrapper className="grid grid-cols-1 md:grid-cols-2 items-stretch  gap-6 mt-8 !max-w-4xl mx-auto">
            <FeatureCard
              icon1={MatrialIconsHome}
              icon2={false}
              textBg="bg-blue-100"
              textColor="text-blue-700"
              title="Vacation Apartments & Holiday Homes"
              paragraph="Centralized bookings and performance tracking for a single unit or a large portfolio."
              // Icon: Home/Building
            />
            <FeatureCard
              icon1={MatrialIconsHotel}
              icon2={false}
              textBg="bg-green-100"
              textColor="text-green-700"
              title="Boutique Hotels & Guesthouses"
              paragraph="Direct bookings and automated guest communications without losing your personal touch."
              // Icon: Hotel/Key
            />
            <FeatureCard
              icon1={MdiCoffee}
              icon2={false}
              textBg="bg-yellow-100"
              textColor="text-yellow-700"
              title="B&Bs"
              paragraph="Combine warm hospitality with streamlined management."
              // Icon: Coffee/Breakfast
            />
            <FeatureCard
              icon1={FluentTent28Filled}
              icon2={false}
              textBg="bg-purple-100"
              textColor="text-purple-700"
              title="Camping & Glamping Sites"
              paragraph="Organize pitches, amenities, and unique experiences in one place."
              // Icon: Tent/Camp
            />
            <FeatureCard
              icon1={MatrialIconsAgriculture}
              icon2={false}
              textBg="bg-pink-100"
              textColor="text-pink-700"
              title="Farm Stays & Rural Retreats"
              paragraph="Offer authentic escapes while keeping operations tight."
              // Icon: Tractor/Leaf
            />
          </FeatureCardWrapper>
        </section>

        <section className="max-w-3xl mx-auto">
          <FAQ content={faqContent} />
        </section>

        <UnifiedCTA />
      </main>
    </>
  );
}
