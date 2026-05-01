import FAQ from "@/components/faq";
import Quote from "@/components/quote";
import SEOHead from "@/components/seoHead";
import { TextImageSection } from "@/components/textImageSection";
import UnifiedCTA from "@/components/unifiedCTA";
import FeatureCard, { FeatureCardWrapper } from "@/components/unorderedList";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import PuckRenderer from "@/lib/puckRenderer";
import { getPageData } from "@/lib/cmsClient";

const pageDetails = {
  pageTitle: `Automatic Guest Messaging & Channel Manager for Vacation Rentals | ${BRAND_NAME}`,
  pageDescription: `Boost your vacation rental revenue by up to 20% with ${BRAND_NAME}’s all-in-one platform. Automate guest communications, manage bookings from Airbnb, Booking.com, and more, and enjoy dynamic pricing, a central inbox, and powerful tools for hosts, property managers, and boutique hotels.`,
  pageKeywords:
    "vacation rental software, guest messaging automation, channel manager, dynamic pricing, Airbnb integration, Booking.com integration, property management, central inbox, automated guest communication, boutique hotel software",
};

const faqContent = [
  {
    q: "How can I communicate with guests on multiple booking sites?",
    a: {
      paragraphs: [
        `Connect your listings once. ${BRAND_NAME}’s Central Inbox lets you read and reply to Airbnb, Booking.com, and direct-booking messages without switching tabs.`,
      ],
    },
  },
  {
    q: "Can I automate guest communication?",
    a: {
      paragraphs: [
        "Yes. Create automated workflows that trigger at check-in, mid-stay, or check-out. Guests receive the right information at precisely the right time.",
      ],
    },
  },
  {
    q: `What does ${BRAND_NAME} cost?`,
    a: {
      paragraphs: [
        "All guest-communication features are included in every plan. Pricing starts at " +
          process.env.NEXT_PUBLIC_PRICE +
          "/month.",
      ],
    },
  },
  {
    q: `Does ${BRAND_NAME} work with Airbnb and Booking.com?`,
    a: {
      paragraphs: [
        `Absolutely. Once you connect your Airbnb and Booking.com accounts, all messages and reservations flow into your ${BRAND_NAME} dashboard in real time.`,
      ],
    },
  },
];

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData(
    "automatic-guest-communications-vacation-rentals",
    locale || "en",
  );

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function AutomaticGuestCommunicationsVacationRentals({
  cmsPage,
}) {
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
        <main id="automatic-guest-communications-vacation-rentals">
          <PuckRenderer data={cmsPage.puckData} />
        </main>
      </>
    );
  }

  // ── Fallback: original hardcoded page ──────────────────────────────────
  return (
    <>
      <SEOHead {...pageDetails} />
      <main
        id="automatic-guest-communications-vacation-rentals"
        className="relative -mt-10"
      >
        <div className="hero h-screen breakout-section bg-linear-to-b from-blue-50 via-white to-white px-4 pt-20">
          <div className="container title mx-auto text-center space-y-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl text-balance lg:leading-20 font-semibold!">
              Get More From{" "}
              <span className="relative whitespace-nowrap text-blue-600!">
                <span className="text-3xl! sm:text-4xl! md:text-5xl! lg:text-6xl! font-bold! mb-6! text-blue-600! relative">
                  Every Booking
                </span>
              </span>{" "}
              With {BRAND_NAME}
            </h1>
            <p className="raw text-lg sm:text-xl text-slate-700 font-medium max-w-max lg:max-w-2/3 mx-auto">
              Generate up to{" "}
              <span className="text-blue-700 font-bold raw">
                20% more revenue
              </span>{" "}
              and keep guests smiling with the all-in-one vacation-rental
              platform built for hosts, property managers, and boutique
              hoteliers. {BRAND_NAME} combines smart{" "}
              <span className="text-blue-700 font-bold raw">
                dynamic pricing
              </span>
              , automated{" "}
              <span className="text-blue-700 font-bold raw">
                guest messaging
              </span>
              , and a powerful{" "}
              <span className="text-blue-700 font-bold raw">
                {" "}
                channel manager
              </span>{" "}
              so you can focus on hospitality, not busywork.
            </p>
          </div>
        </div>

        <section className="breakout-section py-0! my-0!">
          <TextImageSection
            fullWidth={true}
            src="/images/dynamic-pricing-1.png"
            sectionTitle={`Why Hosts Choose ${BRAND_NAME}`}
            title="Dynamic Pricing That Pays Off"
            description={`Our data-driven engine adjusts your nightly rates in real-time, helping you capture demand and avoid leaving money on the table. Many users see a 20 % bump in income after the first month.`}
          >
            <div className="">
              <h3 className="mt-8 text-white! text-base! font-normal!">
                Human-Centric Guest Communication
              </h3>

              <ul className="space-y-2 text-white">
                <li className="group relative rounded-xl px-4 py-1  lg:p-6  bg-white/10 lg:ring-inset">
                  <span className=" text-white! raw text-sm">
                    Central Inbox
                  </span>{" "}
                  <span className="text-white! raw text-sm">
                    – Answer every Airbnb, Booking.com, Vrbo, and direct-booking
                    message from one place.
                  </span>
                </li>
                <li className="group relative rounded-xl px-4 py-1  lg:p-6 bg-white/10 lg:ring-inset">
                  <span className="text-white! raw text-sm">
                    Message Templates
                  </span>{" "}
                  <span className="text-white! raw text-sm">
                    – Start with proven, professionally written templates or
                    craft your own voice.
                  </span>
                </li>
                <li className="group relative rounded-xl px-4 py-1  lg:p-6 bg-white/10 lg:ring-1 lg:ring-white/10 lg:ring-inset">
                  <span className="text-white! raw text-sm">
                    Scheduled Messages
                  </span>{" "}
                  <span className="text-white! raw text-sm">
                    – Send arrival instructions, check-out reminders, and upsell
                    offers automatically at the perfect moment.
                  </span>
                </li>
                <li className="group relative rounded-xl px-4 py-1 lg:p-6 bg-white/10 lg:ring-1 lg:ring-white/10 lg:ring-inset">
                  <span className="text-white! raw text-sm">
                    Digital Check-In Form
                  </span>{" "}
                  <span className="text-white! raw text-sm">
                    – Collect IDs, arrival times, and special requests in
                    minutes, no paperwork, no hassle.
                  </span>
                </li>
              </ul>
            </div>

            <div className="title">
              <h3 className="mt-8 text-white! text-base! font-normal!">
                Built-In Trust and Transparency
              </h3>
              <p className=" text-white! text-sm!">
                {BRAND_NAME} complies with GDPR and major OTA requirements,
                keeping guest data secure and your reputation intact.
              </p>
            </div>
          </TextImageSection>
        </section>

        <section>
          <div className="title">
            <h2>Tailored for Every Property Type</h2>
          </div>

          <FeatureCardWrapper className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FeatureCard
              textBg="bg-blue-100"
              textColor="text-blue-600"
              paragraphs={["Vacation apartments & holiday homes"]}
            />
            <FeatureCard
              textBg="bg-pink-100"
              textColor="text-pink-600"
              paragraphs={["Boutique hotels & micro-hotels"]}
            />
            <FeatureCard
              textBg="bg-yellow-100"
              textColor="text-yellow-600"
              paragraphs={["Bed and breakfasts & guest houses"]}
            />
            <FeatureCard
              textBg="bg-green-100"
              textColor="text-green-600"
              paragraphs={["Camping, glamping, and farm stays"]}
            />
          </FeatureCardWrapper>

          <div className="max-w-xl text-center mx-auto mt-8">
            <p>
              Whether you manage a single flat or a global portfolio,{" "}
              {BRAND_NAME}
              centralizes bookings, tracks performance, and elevates guest
              satisfaction.
            </p>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>What Hosts Are Saying</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Quote
              quote={`“${BRAND_NAME} is easily the best channel manager I’ve tried. No hidden fees, just features that work.”`}
              author={"– Hasan, 12 listings"}
            />
            <Quote
              quote={`“I’ve run six properties with ${BRAND_NAME} for four years. Setup was simple, and the booking engine on my website converts like a dream.”`}
              author={"– Rebecca"}
            />
            <Quote
              quote={
                "“Automated messages and smart pricing have saved me hours each week, and boosted revenue.”"
              }
              author={" – Stefano"}
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
