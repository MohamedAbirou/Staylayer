import FAQ from "@/components/faq";
import HeroSection from "@/components/heroSection";
import {
  MaterialSymbolsPolicy,
  MatrialIconsMenuBook,
  MatrialIconsStars,
  MatrialIconsTrendingUp,
} from "@/components/icons";
import { ImageTextSection } from "@/components/imageTextSection";
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
    q: "Do I need a Channel Manager if I already list on Booking.com?",
    a: {
      paragraphs: [
        `Yes. A channel manager like ${BRAND_NAME} keeps calendars, rates and reservations perfectly in sync across Booking.com, Airbnb, Vrbo and your direct-booking website, preventing overbookings and manual errors.`,
      ],
    },
  },
  {
    q: `How does ${BRAND_NAME} connect to Booking.com?`,
    a: {
      paragraphs: [
        "We use a secure, real-time API connection, far faster and more reliable than basic iCal feeds, so every update appears on Booking.com within seconds.",
      ],
    },
  },
  {
    q: "What’s the best Channel Manager for Booking.com?",
    a: {
      paragraphs: [
        `${BRAND_NAME} offers all the tools you need for smooth, scalable operations: instant sync, unified messaging, dynamic pricing, mobile app and 5-star support.`,
      ],
    },
  },
  {
    q: `How much does ${BRAND_NAME} cost?`,
    a: {
      paragraphs: [
        "Our plan, including the full Channel Manager, " +
          process.env.NEXT_PUBLIC_PRICE +
          " per property per month.",
      ],
    },
  },
];

const images = [
  "/images/premier-connectivity.jpg",
  "/images/crm/overview.png",
  "/images/unified-guest-messaging-2.png",
  "/images/crm/settings-policy.png",
  "/images/crm/third-party-payments.png",
  "/images/crm/channel-manager.png",
];

const features = [
  {
    sectionTitle: `Why Choose ${BRAND_NAME} as Your Booking.com Partner?`,
    title: "Premier Connectivity Partner Status",
    description: `${BRAND_NAME} is a certified Premier Connectivity Partner, recognised by Booking.com for outstanding technical integration, reliability and customer support.`,
    src: images[0],
    alt: "Premier Connectivity Partner",
    fullWidth: true,
  },
  {
    title: "Instant Calendar Synchronisation",
    description:
      "Stop worrying about double bookings. Our two-way API connection refreshes your Booking.com calendar (and every other connected channel) instantly, so availability is always accurate.",
    src: images[1],
    alt: "Instant Calendar Sync",
    fullWidth: true,
  },
  {
    title: "Unified Guest Messaging",
    description:
      "Answer every guest message from Booking.com, Airbnb, Vrbo and your direct site in one clean inbox. Faster replies lead to better reviews and higher search ranking.",
    src: images[2],
    alt: "Unified Guest Messaging",
    fullWidth: true,
  },
  {
    title: "Centralised Rate & Rule Management",
    description:
      "Adjust nightly rates, minimum-stay rules and discounts in one dashboard; push them to Booking.com and all other portals with a single click.",
    src: images[3],
    alt: "Centralised Rate & Rule Management",
    fullWidth: true,
  },
  {
    title: "Powerful Third-Party Integrations",
    description:
      "Plug in payment gateways, smart locks, cleaning apps, accounting tools and more to build the tech stack that suits your holiday-rental business.",
    src: images[4],
    alt: "Third-Party Integrations",
    fullWidth: true,
  },
  {
    title: "Quick, Hassle-Free Setup",
    description: `Linking your Booking.com account to ${BRAND_NAME} takes just a few clicks, no coding or lengthy approval processes.`,
    src: images[5],
    alt: "Quick Setup",
    fullWidth: true,
  },
];

const pageDetails = {
  pageTitle: `${BRAND_NAME} Booking.com Channel Manager | Sync, Automate & Grow Your Vacation Rental Revenue`,
  pageDescription: `Connect your Booking.com listings to ${BRAND_NAME} for instant calendar sync, unified guest messaging, dynamic pricing, and powerful integrations. ${BRAND_NAME} is a certified Premier Connectivity Partner, trusted by property managers and hosts to prevent overbookings and boost revenue.`,
  pageKeywords:
    "Booking.com channel manager, vacation rental software, calendar sync, guest messaging automation, dynamic pricing, Booking.com API, property management, unified inbox, short-term rental automation, Premier Connectivity Partner, holiday rental software",
};

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData(
    "channel-manager-booking-com",
    locale || "en",
  );

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function ChannelManagerBookingCom({ cmsPage }) {
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
        <main id="channel-manager-booking-com">
          <PuckRenderer data={cmsPage.puckData} />
        </main>
      </>
    );
  }

  return (
    <>
      <SEOHead {...pageDetails} />
      <main className="relative -mt-10">
        <HeroSection
          h1={`${BRAND_NAME} ,  Booking.com Channel Manager for Vacation & Holiday Rentals`}
          p="Unlock More Revenue From Every Booking"
        >
          <p className="max-w-3xl mx-auto">
            Property managers who connect their rentals to {BRAND_NAME} see
            <span className="font-semibold!">
              average revenue gains of 20 percent
            </span>{" "}
            thanks to smarter pricing and real-time availability updates.
          </p>
        </HeroSection>

        {features.map((feature, idx) =>
          idx % 2 === 0 ? (
            <ImageTextSection key={feature.title} {...feature} />
          ) : (
            <TextImageSection key={feature.title} {...feature} />
          ),
        )}

        <section>
          <div className="title">
            <h2>Master Booking.com With Our Free Guides</h2>
          </div>

          <FeatureCardWrapper className="grid grid-cols-1 md:grid-cols-2 !max-w-5xl mx-auto items-stretch">
            <FeatureCard
              icon1={MatrialIconsMenuBook}
              textBg="bg-blue-100"
              textColor="text-blue-600"
              title="Beginner’s Guide to Booking.com"
              paragraphs={[
                "step-by-step instructions for listing a holiday home successfully.",
              ]}
            />
            <FeatureCard
              icon1={MatrialIconsTrendingUp}
              textBg="bg-green-100"
              textColor="text-green-600"
              title="Increase Visibility & Get More Bookings"
              paragraphs={[
                "proven tactics to climb search results and convert browsers into guests.",
              ]}
            />
            <FeatureCard
              icon1={MaterialSymbolsPolicy}
              textBg="bg-yellow-100"
              textColor="text-yellow-600"
              title="Understanding Booking.com’s Cancellation Policies"
              paragraphs={[
                "minimise revenue loss with flexible yet protective terms.",
              ]}
            />
            <FeatureCard
              icon1={MatrialIconsStars}
              textBg="bg-pink-100"
              textColor="text-pink-600"
              title="The Booking.com Genius Programme Explained"
              paragraphs={["learn how to qualify and when it pays to opt-in."]}
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
