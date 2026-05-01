import HeroSection from "@/components/heroSection";
import { ImageTextSection } from "@/components/imageTextSection";
import Quote from "@/components/quote";
import SEOHead from "@/components/seoHead";
import { TextImageSection } from "@/components/textImageSection";
import UnifiedCTA from "@/components/unifiedCTA";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import { getPageData } from "@/lib/cmsClient";
import PuckRenderer from "@/lib/puckRenderer";

const pageDetails = {
  pageTitle: "Vacations, Camping & Glamping - " + BRAND_NAME,
  pageDescription: `${BRAND_NAME} is the all-in-one software solution for campgrounds and glamping sites. Manage bookings, automate guest communication, and boost direct reservations with our user-friendly platform designed for outdoor hospitality.`,
};

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData(
    "vacations-camping-glamping",
    locale || "en",
  );

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function VacationsCampingGlamping({ cmsPage }) {
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
        <main id="vacations-camping-glamping">
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
          h1={`${BRAND_NAME}: The Complete Camping & Glamping Software`}
        >
          <p>
            Running a campground or glamping retreat shouldn’t feel like
            juggling flaming torches. {BRAND_NAME} puts every essential tool,
            dynamic pricing, channel management, guest messaging, and a built-in
            booking engine, into a single, friendly dashboard. Most users see
            revenue jump by <span className="font-bold raw">20 % or more</span>{" "}
            in the first season. Start your{" "}
          </p>
        </HeroSection>

        <section>
          <div className="div title">
            <h2>Why Campground Owners Switch to {BRAND_NAME}</h2>
          </div>

          <div className="table-wrapper mx-auto max-w-5xl">
            <div>
              <table>
                <thead>
                  <tr>
                    <th>Before {BRAND_NAME}</th>
                    <th>After {BRAND_NAME}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Hours lost answering the same guest questions</td>
                    <td>
                      Automated, personalized messages sent exactly when guests
                      need them
                    </td>
                  </tr>
                  <tr>
                    <td>Double bookings and tangled availability calendars</td>
                    <td>
                      Avoid double-bookings with live sync across {BRAND_NAME}{" "}
                      and major OTAs.
                    </td>
                  </tr>
                  <tr>
                    <td>Generic listings that blend into the crowd</td>
                    <td>
                      Brand-rich, eye-catching pages that tell your property’s
                      unique story
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <TextImageSection
          sectionTitle="Built for Every Outdoor Host"
          title="Campsite Owners"
          description={
            "Easily assign pitches, share arrival instructions, and keep the fresh-air charm that makes your site special."
          }
        />

        <ImageTextSection
          title="Property & Park Managers"
          description={"Property & Park Managers"}
        />

        <TextImageSection
          sectionTitle="Features That Drive More Direct Bookings"
          title="Dynamic Pricing"
          description={
            "Let our smart algorithms adjust nightly rates to market demand and seasonal trends, no manual math required."
          }
        />

        <ImageTextSection
          title="Booking Engine"
          description={
            "Turn lookers into bookers on your own site with a mobile-friendly, commission-free reservation system."
          }
        />

        <TextImageSection
          title="Guest Communication Hub"
          description={
            "Schedule welcome emails, upsell fire-wood bundles, and collect reviews, all from one inbox."
          }
        />

        <ImageTextSection
          title="Team Access & Permissions"
          description={
            "Give staff the exact tools they need, from housekeeping schedules to maintenance requests, without oversharing sensitive data."
          }
        />

        <TextImageSection
          title="Website Builder"
          description={
            "Launch a search-optimized website in minutes and climb Google rankings for “camping reservations,” “glamping pods,” “campground booking engine,” and more."
          }
        />

        <section>
          <div className="title">
            <h2>What Hosts Say About {BRAND_NAME}</h2>
          </div>

          <div className="max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mx-auto">
            <Quote
              quote={
                "“This is hands-down the best campground channel manager, every feature I need with no hidden fees.”"
              }
              author={",  Hasan, coastal campsite owner"}
            />

            <Quote
              quote={`“After four years and six listings, ${BRAND_NAME} still feels effortless to use.”`}
              author={"Rebecca, glamping pod host"}
            />

            <Quote
              quote={
                "“It slashed my manual workload and costs a fraction of legacy tools.”"
              }
              author={"Stefano, RV park manager"}
            />
          </div>
        </section>

        <UnifiedCTA />
      </main>
    </>
  );
}
