import FAQ from "@/components/faq";
import HeroSection from "@/components/heroSection";
import OrderList from "@/components/orderList";
import PlanIncludesBanner from "@/components/planIncludesBanner";
import Quote from "@/components/quote";
import SEOHead from "@/components/seoHead";
import UnifiedCTA from "@/components/unifiedCTA";
import FeatureCard, { FeatureCardWrapper } from "@/components/unorderedList";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import PuckRenderer from "@/lib/puckRenderer";
import { getPageData } from "@/lib/cmsClient";

const pageDetails = {
  pageTitle: "Vacation Rental Website Builder for More Direct Bookings",
  pageDescription: `Create a custom, commission-free holiday-rental website in minutes with ${BRAND_NAME}. Real-time availability, dynamic pricing and built-in SEO help property owners boost direct booking revenue by up to 20 percent.`,
};

const faqContent = [
  {
    q: "How much does the Website Builder cost?",
    a: {
      paragraphs: [
        `${BRAND_NAME}’s Website Builder is included with every paid plan, starting at " + process.env.NEXT_PUBLIC_PRICE + " per month for one property.`,
      ],
    },
  },
  {
    q: "What is a direct booking?",
    a: {
      paragraphs: [
        "A direct booking is a reservation made straight between the guest and you, the host, no online travel agency involved. Benefits include zero commission, stronger brand loyalty and more control over guest communication.",
      ],
    },
  },
  {
    q: "How do I build a vacation-rental website?",
    a: {
      paragraphs: [
        `Sign up for ${BRAND_NAME}, import your listings, pick a template and publish. Your site goes live with secure payments, SEO-optimized pages and a real-time booking engine, typically in under 30 minutes.`,
      ],
    },
  },
];

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData(
    "website-builder-vacation-rentals",
    locale || "en",
  );

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function WebsiteBuilderVacationRentals({ cmsPage }) {
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
        <main id="website-builder-vacation-rentals">
          <PuckRenderer data={cmsPage.puckData} />
        </main>
      </>
    );
  }

  // ── Fallback: original hardcoded page ──────────────────────────────────
  return (
    <>
      <SEOHead {...pageDetails} />

      <main className=" relative -mt-10">
        <HeroSection
          h1={`${BRAND_NAME} ,  An Intuitive Vacation-Rental Website Builder`}
          p="Turn visitors into guests and earn more from every stay"
        >
          <p className="max-w-2xl mx-auto">
            {BRAND_NAME} gives hosts an easy, code-free way to launch a
            professional holiday-rental website that drives direct bookings, no
            middle-man, no commissions, no headaches.
          </p>
        </HeroSection>

        <section>
          <div className="title">
            <h2>Why {BRAND_NAME}?</h2>
          </div>

          <div className="table-wrapper mx-auto max-w-3xl">
            <div>
              <table>
                <thead>
                  <tr>
                    <th className="text-center!">Benefit</th>
                    <th className="text-center! w-2/3">
                      What it means for you
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="table-cell-category">20 % Higher Revenue</td>
                    <td>
                      Our users consistently report at least one-fifth more
                      income after switching from OTA-only listings.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">
                      Dynamic Pricing Engine
                    </td>
                    <td>
                      Optimize nightly rates automatically to stay competitive
                      and maximize occupancy.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">
                      Commission-Free Direct Bookings
                    </td>
                    <td>
                      Keep 100% of what you earn, stop paying marketplace fees.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">
                      Real-Time Availability Calendar
                    </td>
                    <td>
                      Avoid double-bookings with live sync across {BRAND_NAME}{" "}
                      and major OTAs.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">Custom Branding</td>
                    <td>
                      Build a site that reflects your unique style and makes
                      guests feel confident booking direct.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Launch Your Vacation-Rental Website in Three Steps</h2>
          </div>

          <div>
            <OrderList
              list={[
                {
                  title: "Sign Up & Import Listings",
                  description:
                    "Connect Airbnb, Booking.com or upload your property details manually.",
                },
                {
                  title: "Customize Your Site",
                  description:
                    "Choose a modern template, add photos, set policies and pick your domain.",
                },
                {
                  title: "Accept Direct Bookings",
                  description:
                    "Start taking secure, instant reservations while ${BRAND_NAME} handles calendars, payments and guest emails.",
                },
              ]}
            />
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Trusted by Hosts Worldwide</h2>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Quote
              quote={`${BRAND_NAME} is hands-down the best channel manager I’ve tried. No hidden fees and every feature just works.”`}
              author={"Hasan"}
            />
            <Quote
              quote={
                "“Four years, six listings and counting. The booking engine on my own site is seamless and easy to manage.”"
              }
              author={"Rebecca"}
            />

            <Quote
              quote={
                "“It automated tasks I used to do manually and still costs less than competitors.”"
              }
              author={"Stefano"}
            />
          </div>
        </section>
        <section>
          <div className="title">
            <h2>One Plan, Built to Grow With You</h2>
          </div>
          <div className="mx-auto max-w-4xl">
            <div className="rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
              <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold mb-0.5 leading-none">
                    One plan.{" "}
                  </h3>
                  <p className="text-sm text-gray-600">
                    All features unlocked.
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-2xl font-bold leading-none">
                    {" "}
                    {process.env.NEXT_PUBLIC_PRICE}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    0% booking fee*
                  </div>
                </div>
              </header>

              <p className="mt-4 text-gray-800">
                Think of this as your all-in-one{" "}
                <strong>property management system (PMS)</strong> +
                <strong> channel manager</strong> +{" "}
                <strong>direct booking engine</strong>. It’s designed for hosts,
                operators, and property managers who want clean workflows,
                higher <strong>direct bookings</strong>, and less busywork.
                Connect your <strong>Airbnb</strong>,{" "}
                <strong>Booking.com</strong>, and
                <strong> Expedia</strong> listings, sync calendars, take
                payments, and keep guests happy — without juggling five
                different tools.
              </p>

              <ul className="mt-6 grid list-disc gap-2 pl-5 md:grid-cols-2">
                <li>
                  Direct booking site (SEO-friendly, mobile-first) with promo
                  codes & upsells
                </li>
                <li>
                  Channel manager & calendar sync (Airbnb, Booking.com, Expedia,
                  iCal)
                </li>
                <li>
                  Unified inbox & automated messaging (templates, triggers,
                  saved replies)
                </li>
                <li>
                  Payments & invoices (secure processing, tax invoices, refunds,
                  deposits)
                </li>
                <li>
                  Revenue management (dynamic pricing rules, minimum stays, rate
                  plans)
                </li>
                <li>
                  Analytics & reporting (ADR, RevPAR, occupancy, payouts, owner
                  statements)
                </li>
                <li>
                  Housekeeping & tasks (checklists, schedules, cleaner access
                  links)
                </li>
                <li>
                  Guest portal & self-check-in (smart instructions, digital
                  guidebook)
                </li>
                <li>
                  Team roles & permissions (granular access for multi-property
                  portfolios)
                </li>
                <li>
                  Integrations & exports (accounting exports, webhooks,
                  API-ready)
                </li>
                <li>
                  Compliance & security (GDPR-ready, audit logs, activity
                  tracking)
                </li>
                <li>Friendly human support when you need it</li>
              </ul>

              <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                <strong>*</strong> Pricing shown is based on one property;
                additional units are discounted automatically. As you scale, the
                plan scales with you — same features, just more room to grow.
              </div>
            </div>
          </div>

          <PlanIncludesBanner title="* Pricing based on one property; additional units discounted." />
        </section>

        <section>
          <div className="title">
            <h2>Built for Every Type of Stay</h2>
          </div>

          <FeatureCardWrapper className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FeatureCard paragraphs={["Vacation apartments & holiday homes"]} />
            <FeatureCard paragraphs={["Boutique hotels & B&Bs"]} />
            <FeatureCard paragraphs={["Guest houses & farm stays"]} />
            <FeatureCard paragraphs={["Camping & glamping sites"]} />
          </FeatureCardWrapper>
        </section>

        <section>
          <FAQ content={faqContent} />
        </section>

        <UnifiedCTA />
      </main>
    </>
  );
}
