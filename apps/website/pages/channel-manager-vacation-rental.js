import FAQ from "@/components/faq";
import HeroSection from "@/components/heroSection";
import { ImageTextSection } from "@/components/imageTextSection";
import Quote from "@/components/quote";
import SEOHead from "@/components/seoHead";
import { TextImageSection } from "@/components/textImageSection";
import UnifiedCTA from "@/components/unifiedCTA";
import FeatureCard, { FeatureCardWrapper } from "@/components/unorderedList";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import { getPageData } from "@/lib/cmsClient";
import PuckRenderer from "@/lib/puckRenderer";

const faqContent = [
  {
    q: "What is a vacation-rental channel manager?",
    a: {
      paragraphs: [
        "It’s software that syncs your availability, rates, and reservations across multiple booking platforms, Airbnb, Booking.com, your own website, and more, in real time. No spreadsheets, no double-bookings.",
      ],
    },
  },
  {
    q: `How much does ${BRAND_NAME} cost?`,
    a: {
      paragraphs: [
        "Plans start at " +
          process.env.NEXT_PUBLIC_PRICE +
          " per month for one property. Every plan includes unlimited channels, automated messaging, and performance analytics.",
      ],
    },
  },
  {
    q: "Why do hosts need a channel manager?",
    a: {
      paragraphs: [
        `Whether you list on one OTA or ten, calendars can drift out of sync within minutes. ${BRAND_NAME} updates every platform instantly, so guests always see accurate prices and availability, and you stay overbooking-free.`,
      ],
    },
  },
  {
    q: "Can I manage Airbnb and Booking.com simultaneously?",
    a: {
      paragraphs: [
        `Absolutely. Connect both accounts (and any others) once; ${BRAND_NAME} handles the rest, syncing every new booking, cancellation, or modification within seconds.`,
      ],
    },
  },
];

const pageDetails = {
  pageTitle: `${BRAND_NAME} Channel Manager for Vacation Rentals | Sync, Automate & Grow Revenue`,
  pageDescription: `Effortlessly manage your vacation rentals with ${BRAND_NAME}’s channel manager. Instantly sync calendars, automate guest messaging, manage rates and availability, and boost occupancy—all from one intuitive dashboard. Trusted by hosts, property managers, and boutique hotels worldwide.`,
  pageKeywords:
    "vacation rental channel manager, property management software, calendar sync, guest messaging automation, dynamic pricing, Airbnb channel manager, Booking.com channel manager, unified dashboard, short-term rental automation, hospitality software",
};

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData(
    "channel-manager-vacation-rental",
    locale || "en",
  );

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function ChannelManagerVacationRental({ cmsPage }) {
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
        <main id="channel-manager-vacation-rental">
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
          h1={`${BRAND_NAME}: Effortless Channel Management for Vacation Rentals`}
          p="Boost occupancy, prevent double-bookings, and grow revenue,  all from one intuitive dashboard."
        />

        <TextImageSection
          sectionTitle={`Why Property Owners Choose ${BRAND_NAME}`}
          title="Unified Channel Manager"
          src="/images/crm/channel-manager.png"
          alt="Unified Channel Manager"
          fullWidth={true}
        >
          <ul className="list-disc pl-6 space-y-2 text-white">
            <li>
              Real-time calendar sync with Airbnb, Booking.com, Vrbo, Agoda,
              Expedia, and dozens of niche OTAs.
            </li>

            <li>
              Automatic updates slash the risk of double-bookings and angry
              guests.
            </li>
          </ul>
        </TextImageSection>

        <ImageTextSection
          title="Smart Dynamic Pricing"
          src="/images/dynamic-pricing-2.png"
          alt="Smart Dynamic Pricing"
          fullWidth={true}
        >
          <ul className="list-disc pl-6 space-y-2 text-white">
            <li>
              Increase nightly rates when demand surges, fill gaps when it dips.
            </li>

            <li>
              Hosts using {BRAND_NAME}’s pricing engine see{" "}
              <span className="font-semibold raw">up to 20% more revenue</span>{" "}
              on average.
            </li>
          </ul>
        </ImageTextSection>

        <TextImageSection
          title="Centralized Property Dashboard"
          src="/images/crm/overview.png"
          alt="Centralized Property Dashboard"
          fullWidth={true}
        >
          <ul className="list-disc pl-6 space-y-2 text-white">
            <li>
              View every reservation, message, and payout in a single place, no
              more juggling tabs.
            </li>

            <li>
              Filter by property, date, or platform to spot trends and
              streamline operations.
            </li>
          </ul>
        </TextImageSection>

        <ImageTextSection
          title="Simple Rate & Fee Management"
          src="/images/crm/rooms-and-rates.png"
          alt="Simple Rate & Fee Management"
          fullWidth={true}
        >
          <ul className="list-disc pl-6 space-y-2 text-white">
            <li>
              Set a base price once; {BRAND_NAME} pushes it (plus your cleaning
              fees, taxes, and markup) everywhere.
            </li>

            <li>Keep parity across all booking sites without manual edits.</li>
          </ul>
        </ImageTextSection>

        <section>
          <div className="title">
            <h2>Designed for Every Type of Stay</h2>
          </div>

          <FeatureCardWrapper className="grid grid-cols-1 md:grid-cols-2 items-stretch gap-5">
            <FeatureCard
              title="●	Vacation apartments & holiday homes"
              paragraphs={[
                "centralize bookings for single units or large portfolios.",
              ]}
              icon2={false}
            />

            <FeatureCard
              title="●	Boutique hotels & B&Bs "
              paragraphs={[
                "drive direct bookings while keeping your unique vibe intact.",
              ]}
              icon2={false}
            />

            <FeatureCard
              title="●	Guest houses & farm stays"
              paragraphs={[
                "automate guest messaging without losing the personal touch.",
              ]}
              icon2={false}
            />

            <FeatureCard
              title="●	Camping, glamping & eco-lodges"
              paragraphs={[
                "manage pitch or cabin availability with bespoke branding.",
              ]}
              icon2={false}
            />
          </FeatureCardWrapper>
        </section>

        <section>
          <div className="title">
            <h2>Trusted by Hosts Worldwide</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            <Quote
              quote={`“${BRAND_NAME} is the best channel manager I’ve tried. Full-featured, affordable, and it just works.”`}
              author={" ,  Hasan, 12 listings"}
            />

            <Quote
              quote={
                "“Four years in and six properties later, I’m still impressed. The setup was painless and support is solid.”"
              }
              author={" ,  Rebecca, Superhost"}
            />

            <Quote
              quote={`“What used to be a manual nightmare is now automated. ${BRAND_NAME} saves hours every week.”`}
              author={" ,  Stefano, Property Manager"}
            />
          </div>
        </section>
        <section className="max-w-3xl mx-auto">
          <FAQ content={faqContent} />
        </section>

        <UnifiedCTA />
      </main>
    </>
  );
}
