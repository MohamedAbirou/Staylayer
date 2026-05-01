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
  pageTitle: `${BRAND_NAME} Farm Stay Management Software | Cabins, Cottages & Rural Retreats`,
  pageDescription: `Manage your farm stay, cabin, or rural retreat with ${BRAND_NAME}’s all-in-one software. Automate bookings, guest messaging, dynamic pricing, and team management. Boost revenue, prevent double-bookings, and deliver memorable guest experiences with tools built for rural vacation rentals.`,
  pageKeywords:
    "farm stay software, rural vacation rental management, cabin booking system, cottage channel manager, automated guest messaging, dynamic pricing, team portal, country retreat software, property management, direct booking engine, hospitality automation",
};

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData("farm-stays", locale || "en");

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function FarmStays({ cmsPage }) {
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
        <main id="farm-stays">
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
          h1={`${BRAND_NAME} ,  Farm Stay Management Software for Cabins, Cottages & Country Retreats`}
          p="Run every aspect of your rural vacation rental business in one place and boost revenue by an average of 20 percent."
        />

        <section>
          <div className="title">
            <h2>Why Hosts Switch to {BRAND_NAME}</h2>
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
                    <td>Juggling calendars across multiple OTAs</td>
                    <td className="table-cell-category">
                      Unified channel manager , no double-bookings, ever
                    </td>
                  </tr>
                  <tr>
                    <td>Listings that blend into the crowd</td>
                    <td className="table-cell-category">
                      Eye-catching, brand-consistent pages that convert
                    </td>
                  </tr>
                  <tr>
                    <td>Few repeat guests</td>
                    <td className="table-cell-category">
                      Automated guest journeys that drive loyalty
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <TextImageSection
          sectionTitle="Built for Growing Farm-Stay Businesses"
          title={"For Individual Farm Owners"}
          description="Streamline reservations, payments, and guest communication so you can focus on welcoming visitors and tending the land."
          src={""}
          alt="For Individual Farm Owners"
          fullWidth={true}
        />
        <ImageTextSection
          title={"For Property Managers"}
          description="Centralize multi-property operations, apply smart pricing, and promote authentic rural experiences at scale."
          src={""}
          alt="For Property Managers"
          fullWidth={true}
        />

        <TextImageSection
          sectionTitle="All-in-One Tool Kit"
          title="Dynamic Pricing Engine"
          description={
            "Maximize nightly rates with AI-driven pricing that adapts to demand and local events."
          }
          src="/images/dynamic-pricing-1.png"
          alt="Dynamic Pricing Engine"
          fullWidth={true}
        />

        <ImageTextSection
          title="Booking Engine & Website Builder"
          description={
            "Capture direct reservations, own your guest data, and rank higher in search with a fast, mobile-first website."
          }
          src="/images/website-builder.png"
          alt="Website Builder for B&Bs"
          fullWidth={true}
        />

        <TextImageSection
          title="Automated Guest Messaging"
          description={
            "Schedule personalized emails and texts, from pre-arrival directions to post-stay review requests, at exactly the right moment."
          }
          src="/images/automated-guest-messaging-2.png"
          alt="Automated Guest Messaging"
          fullWidth={true}
        />

        <ImageTextSection
          title="Team & Owner Portal"
          description={
            "Give staff, cleaners, and co-owners role-based access, keeping everyone aligned and accountable."
          }
          src="/images/crm/users.png"
          alt="Team & Owner Portal"
          fullWidth={true}
        />

        <section>
          <div className="title">
            <h2>Trusted by Rural Hosts Worldwide</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 ">
            <Quote
              quote={`“${BRAND_NAME} is the most complete channel manager I’ve tried. Every feature works as advertised, with no hidden fees.”`}
              author={",  Hasan, Maple Grove Farm"}
            />

            <Quote
              quote={`“After four years and six listings, I still love how easy ${BRAND_NAME} is to set up and use as my primary booking platform.”`}
              author={" ,  Rebecca, Green Pastures Cottages"}
            />

            <Quote
              quote={
                "“Tasks that used to take hours are now automated, and the price is still affordable.”"
              }
              author={",  Stefano, Tuscan Hillside Retreats"}
            />
          </div>
        </section>

        <UnifiedCTA />
      </main>
    </>
  );
}
