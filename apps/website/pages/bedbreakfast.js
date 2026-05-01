import OrderList from "@/components/orderList";
import Quote from "@/components/quote";
import SEOHead from "@/components/seoHead";
import { TextImageSection } from "@/components/textImageSection";
import UnifiedCTA from "@/components/unifiedCTA";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import PuckRenderer from "@/lib/puckRenderer";
import { getPageData } from "@/lib/cmsClient";

const pageDetails = {
  pageTitle: `${BRAND_NAME} | Bed & Breakfast Property Management Software for B&Bs, Inns, and Guesthouses`,
  pageDescription: `Discover ${BRAND_NAME}, the all-in-one property management software designed for bed and breakfasts, guesthouses, and boutique stays. Automate bookings, guest messaging, dynamic pricing, and direct reservations to boost revenue and guest satisfaction.`,
  pageKeywords:
    "bed and breakfast software, B&B property management, guesthouse management, direct booking engine, automated guest messaging, dynamic pricing, channel manager, boutique inn software, hospitality automation",
};

const audiences = [
  {
    title: "Bed & Breakfast Owners",
    description: `Focus on hospitality while ${BRAND_NAME} takes care of channel syncing, guest communication, payments, and performance analytics.`,
  },
  {
    title: "Property Managers",
    description: `Scale multiple B&Bs without losing the personal touch. ${BRAND_NAME} centralizes housekeeping schedules, owner statements, and team permissions in one intuitive dashboard.`,
  },
];

const features = [
  {
    title: "Channel Manager & Dynamic Pricing",
    description:
      "Sync Airbnb, Booking.com, Expedia, and more while our revenue engine adjusts nightly rates in real-time.",
  },

  {
    title: "Commission-Free Booking Engine",
    description:
      "Capture more direct reservations through a mobile-friendly checkout that lives on your own domain.",
  },
  {
    title: "Automated Guest Messaging",
    description:
      "Send welcome notes, arrival instructions, and upsell offers exactly when they matter.",
  },
  {
    title: "Website Builder for B&Bs",
    description:
      "Launch a fast, SEO-ready site that showcases your rooms, local experiences, and reviews.",
  },
  {
    title: "Team & Owner Access Control",
    description:
      "Give cleaners, co-hosts, and accountants the precise permissions they need, nothing more, nothing less.",
  },
];

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData("bedbreakfast", locale || "en");

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function bedbreakfast({ cmsPage }) {
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
        <main id="bedbreakfast">
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
        <div className="hero h-screen breakout-section bg-gradient-to-b from-blue-50 via-white to-white px-4 pt-20">
          <div className="container title mx-auto text-center space-y-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl text-balance lg:leading-[80px] font-semibold!">
              {BRAND_NAME} , B&B Property Management Software That Feels
              Personal
            </h1>
            <p className="raw text-lg sm:text-xl text-slate-700 font-medium max-w-max lg:max-w-2/3 mx-auto">
              Running a bed and breakfast is more than managing calendars and
              keys , it’s about creating memories for every guest who walks
              through your door. {BRAND_NAME} gives independent hosts and
              property managers the same smart technology big hotel chains use,
              wrapped in tools that are simple, friendly, and built for
              <span className="text-blue-700 font-bold raw">
                {" "}
                B&Bs, guesthouses, inns, and boutique stays.
              </span>{" "}
            </p>
          </div>
        </div>

        <TextImageSection
          title="Earn More From Every Room"
          description={`Hosts who switch to ${BRAND_NAME} increase direct revenue by an average of 20 percent thanks to built-in dynamic pricing, automated upsells, and a commission-free booking engine. Stop leaving money on the table and start turning first-time visitors into loyal, repeat guests.`}
          src="/images/crm/overview.png"
          alt={`Overview of ${BRAND_NAME}'s Benefits`}
          textSmall={false}
        />

        <section>
          <div className="title">
            <h2>What Changes With {BRAND_NAME}?</h2>
          </div>

          <div className="table-wrapper max-w-2xl mx-auto">
            <div>
              <table>
                <thead>
                  <tr>
                    <th className="text-center">Before {BRAND_NAME}</th>
                    <th className="text-center">After {BRAND_NAME}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Generic listings that blend into OTA search results</td>
                    <td>
                      A branded booking experience on your own website and
                      social channels
                    </td>
                  </tr>
                  <tr>
                    <td>Few repeat bookings and unpredictable seasons</td>
                    <td>
                      A steady flow of return guests and higher occupancy all
                      year round
                    </td>
                  </tr>
                  <tr>
                    <td>Late-night copy-paste messages</td>
                    <td>
                      Personalized, scheduled messages that delight guests
                      automatically
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Built for Two Audiences</h2>
          </div>

          <div>
            <OrderList list={audiences} />
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Features You’ll Actually Use</h2>
          </div>

          <div>
            <OrderList list={features} />
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Real Stories From Real Hosts</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Quote
              quote={
                "“The best all-in-one channel manager I’ve used. Every feature is included, no surprise fees, and it just works.”"
              }
              author={"Hasan"}
            />
            <Quote
              quote={`“Four years with ${BRAND_NAME} (six listings) and it powers my entire direct-booking engine. Setup was painless, support is stellar.”`}
              author={"– Rebecca"}
            />
            <Quote
              quote={
                "“My workload shrank overnight. Tasks that took hours are now fully automated, and the price is still affordable.”"
              }
              author={" – Stefano"}
            />
          </div>
        </section>

        <UnifiedCTA />
      </main>
    </>
  );
}
