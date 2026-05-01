import HeroSection from "@/components/heroSection";
import OrderList from "@/components/orderList";
import Quote from "@/components/quote";
import SEOHead from "@/components/seoHead";
import UnifiedCTA from "@/components/unifiedCTA";
import FeatureCard, { FeatureCardWrapper } from "@/components/unorderedList";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import PuckRenderer from "@/lib/puckRenderer";
import { getPageData } from "@/lib/cmsClient";

const pageDetails = {
  pageTitle: `${BRAND_NAME} | Boutique Hotel Management Software – Direct Bookings, Channel Manager & Automation`,
  pageDescription: `Discover ${BRAND_NAME}, the all-in-one management platform for boutique hotels and independent properties. Boost direct bookings, automate guest messaging, manage rates and availability across channels, and streamline operations with a central dashboard. Trusted by boutique hotel owners and property managers worldwide.`,
  pageKeywords:
    "boutique hotel software, boutique hotel management, direct booking engine, channel manager, guest messaging automation, dynamic pricing, property management system, independent hotel software, hospitality automation, hotel website builder",
};

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData("boutique", locale || "en");

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function boutique({ cmsPage }) {
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
        <main id="boutique">
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
          h1={`${BRAND_NAME} – All-in-One Boutique Hotel Management Software`}
          p={`Boost direct bookings, streamline operations and grow revenue, boutique properties that switch to ${BRAND_NAME} typically increase income by 20 percent. `}
        />

        <section>
          <div className="title">
            <h2>Why Boutique Hotels Choose {BRAND_NAME}</h2>
          </div>

          <div className="table-wrapper max-w-3xl mx-auto">
            <div>
              <table>
                <thead>
                  <tr>
                    <th className="text-center!">Before {BRAND_NAME}</th>
                    <th className="text-center!">After {BRAND_NAME}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Juggling multiple OTAs and calendars</td>
                    <td className="table-cell-category">
                      One central dashboard for every channel
                    </td>
                  </tr>
                  <tr>
                    <td>Paying high commission fees</td>
                    <td className="table-cell-category">
                      0% commission on direct bookings
                    </td>
                  </tr>
                  <tr>
                    <td>Listings that look just like everyone else’s</td>
                    <td className="table-cell-category">
                      A distinctive brand that guests remember
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Built for People Who Run Independent Properties</h2>
          </div>

          <div>
            <OrderList
              list={[
                {
                  title: "Boutique-Hotel Owners",
                  description:
                    "Run the day-to-day with fewer clicks, showcase what makes your hotel special and turn first-time guests into loyal fans.",
                },
                {
                  title: "Property Managers",
                  description:
                    "Manage an entire portfolio just as easily as a single inn. Automate routine tasks so you can focus on guest experience and revenue growth.",
                },
              ]}
            />
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Everything You Need in One Platform</h2>
          </div>

          <FeatureCardWrapper className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            <FeatureCard
              icon1={false}
              icon2={true}
              textBg="bg-blue-100"
              textColor="text-blue-700"
              title="Booking Engine"
              paragraphs={[
                "Drive commission-free, direct reservations via your own website.",
                "Optimised for mobile, SEO and fast checkout.",
              ]}
              // Icon: ShoppingCart/Globe
            />
            <FeatureCard
              icon1={false}
              icon2={true}
              textBg="bg-yellow-100"
              textColor="text-yellow-700"
              title="Dynamic Pricing & Channel Manager"
              paragraphs={[
                "Real-time rate optimisation to maximise RevPAR.",
                "Instantly sync rates and availability across Airbnb, Booking.com, Expedia and more.",
              ]}
              // Icon: TrendingUp/Sync
            />
            <FeatureCard
              icon1={false}
              icon2={true}
              textBg="bg-green-100"
              textColor="text-green-700"
              title="Guest Communication Hub"
              paragraphs={[
                "Automate personalised emails and SMS at every stage of the journey.",
                "Schedule messages (check-in details, upsell offers, review requests) so they send at exactly the right moment.",
              ]}
              // Icon: ChatBubble/Envelope
            />
            <FeatureCard
              icon1={false}
              icon2={true}
              textBg="bg-purple-100"
              textColor="text-purple-700"
              title="Team & Owner Portal"
              paragraphs={[
                "Create role-based logins for front-desk staff, housekeepers and accountants.",
                "Keep everyone aligned with live updates and task lists.",
              ]}
              // Icon: Users/Clipboard
            />
            <FeatureCard
              icon1={false}
              icon2={true}
              textBg="bg-pink-100"
              textColor="text-pink-700"
              title="Website Builder"
              paragraphs={[
                "Launch a fast, secure and SEO-friendly site, no coding needed.",
                "Showcase rooms, add local guides and convert visitors into guests.",
              ]}
              // Icon: Website/Lightning
            />
          </FeatureCardWrapper>
        </section>

        <section>
          <div className="title">
            <h2>Trusted by Hosts Worldwide</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            <Quote
              quote={`“${BRAND_NAME} is the best channel manager we’ve tried, every feature we need, no hidden fees.”`}
              author={"Hasan, 12-room boutique hotel"}
            />

            <Quote
              quote={`“Running six properties used to feel chaotic. ${BRAND_NAME}’s booking engine just works, and setting it up was simple.”`}
              author={"Rebecca, property manager"}
            />

            <Quote
              quote={
                "“Manual tasks disappeared overnight, and the price is still affordable.”"
              }
              author={"Stefano, eco-lodge owner"}
            />
          </div>
        </section>

        <UnifiedCTA />
      </main>
    </>
  );
}
