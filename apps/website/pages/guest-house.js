import HeroSection from "@/components/heroSection";
import { ImageTextSection } from "@/components/imageTextSection";
import OrderList from "@/components/orderList";
import Quote from "@/components/quote";
import SEOHead from "@/components/seoHead";
import { TextImageSection } from "@/components/textImageSection";
import UnifiedCTA from "@/components/unifiedCTA";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import { getPageData } from "@/lib/cmsClient";
import PuckRenderer from "@/lib/puckRenderer";

const pageDetails = {
  pageTitle: `${BRAND_NAME} – Guest House & Vacation-Rental Management Software | Boost Bookings 20%`,
  pageDescription: `${BRAND_NAME} is the human-friendly property-management platform built for guest houses and small vacation-rental portfolios. Sync every channel, automate guest messages, apply AI-powered dynamic pricing, and grow revenue by up to 20 %. Free 14-day trial, no credit card required.`,
};

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData("guest-house", locale || "en");

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function GuestHouse({ cmsPage }) {
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
        <main id="guest-house">
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
        <HeroSection h1={`${BRAND_NAME}`}>
          <h2>Simplified Guest-House & Vacation-Rental Management</h2>

          <p className="max-w-5xl mx-auto">
            <span className="raw font-semibold">
              Do less admin, fill more nights, delight every guest.
            </span>{" "}
            Host teams using {BRAND_NAME} see average revenue gains of 20 %
            thanks to automated workflows and real-time pricing intelligence.
          </p>
        </HeroSection>

        <section>
          <div className="title">
            <h2>Why Upgrade to {BRAND_NAME}?</h2>
          </div>

          <div className="table-wrapper mx-auto max-w-5xl">
            <div>
              <table>
                <thead>
                  <tr>
                    <th className="text-center!">Before {BRAND_NAME}</th>
                    <th className="w-2/3 text-center!">After {BRAND_NAME}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Double bookings and tangled calendars</td>
                    <td>
                      <span className="raw font-semibold">
                        One unified calendar
                      </span>{" "}
                      that syncs Airbnb, Booking.com, Vrbo, and direct bookings
                      in seconds
                    </td>
                  </tr>

                  <tr>
                    <td>Generic templated emails</td>
                    <td>
                      <span className="raw font-semibold">
                        Personalised, scheduled messages
                      </span>{" "}
                      that feel like you wrote them yourself
                    </td>
                  </tr>

                  <tr>
                    <td>Guess-work pricing</td>
                    <td>
                      <span className="raw font-semibold">
                        Dynamic pricing engine
                      </span>{" "}
                      that updates nightly rates based on demand, seasonality,
                      and local events
                    </td>
                  </tr>

                  <tr>
                    <td>Spreadsheet chaos</td>
                    <td>
                      <span className="raw font-semibold">
                        Visual dashboards
                      </span>{" "}
                      with occupancy, ADR, RevPAR, and channel performance at a
                      glance
                    </td>
                  </tr>

                  <tr>
                    <td>Wearing every hat</td>
                    <td>
                      <span className="raw font-semibold">
                        Role-based accounts
                      </span>{" "}
                      so owners, cleaners, and co-hosts share the workload
                      securely
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Built for Real People</h2>
          </div>

          <div>
            <OrderList
              list={[
                {
                  title: "Guest-House Owners",
                  description:
                    "Keep operations smooth while still greeting every guest by name.",
                },
                {
                  title: "Property Managers",
                  description:
                    "Scale multiple guest houses without losing that warm, local vibe.",
                },
              ]}
            />
          </div>
        </section>

        <section>
          <div className="title">
            <h2>What Hosts Are Saying</h2>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Quote
              quote={
                "“Best channel manager out there, has every feature we need and zero hidden fees.”"
              }
              author={",  Hassan"}
            />

            <Quote
              quote={`“Running six listings for four years, ${BRAND_NAME}’s booking engine just works.”`}
              author={",  Rebecca"}
            />

            <Quote
              quote={
                "“Automated the boring stuff, saved hours weekly, and it’s still affordable!” "
              }
              author={",  Stefano"}
            />
          </div>
        </section>

        <ImageTextSection
          sectionTitle="All-in-One Toolkit"
          title={"Booking Engine"}
          description={
            "Drive direct reservations and keep more revenue in your pocket."
          }
          src="/images/crm/overview.png"
          alt="Booking Engine"
        />

        <TextImageSection
          title="Dynamic Pricing"
          description={
            "AI-powered rates that respond to real-time market data."
          }
          src={"/images/dynamic-pricing-1.png"}
          alt="Dynamic Pricing"
        />

        <ImageTextSection
          title="Team Access"
          description={
            "Give cleaners, owners, and VAs the exact permissions they need."
          }
          alt="Team Access"
          src={"/images/crm/users.png"}
        />

        <UnifiedCTA />
      </main>
    </>
  );
}
