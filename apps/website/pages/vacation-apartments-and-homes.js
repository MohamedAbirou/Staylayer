import HeroSection from "@/components/heroSection";
import { ImageTextSection } from "@/components/imageTextSection";
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
  pageTitle: `Vacation Apartments and Homes - ${BRAND_NAME} `,
  pageDescription: `Manage your vacation apartments and homes with ${BRAND_NAME}. Simplify bookings, automate communication, and maximize revenue with our all -in -one platform.`,
  pageKeywords:
    "vacation apartments, holiday homes, property management, vacation rental software, channel manager, direct bookings",
};

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData(
    "vacation-apartments-and-homes",
    locale || "en",
  );

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function VacationApartmentsAndHomes({ cmsPage }) {
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
        <main id="vacation-apartments-and-homes">
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
          h1="Vacation Apartments and Homes"
          p={`Simplify management and boost revenue with ${BRAND_NAME}.`}
        />

        <section>
          <div className="title">
            <h2>Why Choose {BRAND_NAME}?</h2>
            <p>
              {BRAND_NAME} provides a comprehensive suite of tools designed
              specifically for managing vacation apartments and homes. From
              channel management to automated guest communication, we have you
              covered.
            </p>
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
                    <td>Double bookings & costly cancellations</td>
                    <td>One calendar, zero overlaps</td>
                  </tr>
                  <tr>
                    <td>Endless back-and-forth with guests</td>
                    <td>Automated, personalized messages</td>
                  </tr>
                  <tr>
                    <td>Commission fees eat into profit</td>
                    <td>Keep 100 % of direct-booking revenue</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Built for Every Kind of Host</h2>
          </div>

          <div className="mx-auto w-fit">
            <OrderList
              list={[
                {
                  title: "Vacation-Rental Owners",
                  description:
                    "Manage a single apartment or a small portfolio without the spreadsheets or late-night logins.",
                },
                {
                  title: "Property Managers",
                  description:
                    "Control dozens of listings from one place, delegate tasks, and impress owners with transparent performance reports.",
                },
              ]}
            />
          </div>
        </section>

        <ImageTextSection
          sectionTitle="All the Tools You Need, Already Connected"
          title="Dynamic Pricing"
          description={
            "Stay competitive with AI-driven rate updates that adapt to demand, seasonality and local events."
          }
          src="/images/dynamic-pricing.png"
          alt="Dynamic Pricing"
        />

        <TextImageSection
          title={"Booking Engine"}
          description={
            "Drive commission-free reservations through a mobile-friendly checkout that lives on your own domain."
          }
        />

        <ImageTextSection
          title={"Guest Messaging"}
          description={
            "Schedule welcome notes, door-code reminders and review requests exactly when guests need them."
          }
          src="/images/automated-guest-messaging-2.png"
          alt={"Automated Guest Messaging"}
        />

        <TextImageSection
          title={"Team Access"}
          description={
            "Give cleaners, co-hosts and accountants the right permissions, no more email chains."
          }
          src={"/images/crm/users.png"}
          alt={"Team Access"}
        />

        <ImageTextSection
          title={"Website Builder"}
          description={
            "Publish a stunning, SEO-ready site in minutes and watch organic traffic grow."
          }
          alt={"Website Builder"}
          src={"/images/website-builder.png"}
        />

        <section className="max-w-5xl mx-auto">
          <div className="title">
            <h2>Proven Results</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Quote
              quote={`“${BRAND_NAME} is the most reliable channel manager I’ve tried, full-featured, no hidden costs.”`}
              author={",  Hasan, villa owner"}
            />

            <Quote
              quote={
                "“Six listings, four years, zero double bookings. Setup was a breeze.”"
              }
              author={",  Rebecca, apartment host"}
            />

            <Quote
              quote={
                "“Manual chores are gone, and the price is still affordable.”"
              }
              author={",  Stefano, chalet manager"}
            />
          </div>
        </section>

        <UnifiedCTA />
      </main>
    </>
  );
}
