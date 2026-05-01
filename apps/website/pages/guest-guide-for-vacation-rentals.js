import FAQ from "@/components/faq";
import UnifiedCTA from "@/components/unifiedCTA";
import HeroSection from "@/components/heroSection";
import Quote from "@/components/quote";
import SEOHead from "@/components/seoHead";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import PuckRenderer from "@/lib/puckRenderer";
import { getPageData } from "@/lib/cmsClient";

const pageDetails = {
  pageTitle: `${BRAND_NAME} Digital Guest Guide & Dynamic Pricing | Vacation Rental Software 2025`,
  pageDescription: `Boost direct bookings and guest satisfaction with ${BRAND_NAME}’s customizable digital guest guide and AI-powered dynamic pricing. Vacation-rental hosts report up to 20 % more revenue and smoother operations.`,
};

const FaqContent = [
  {
    q: "Why create a digital guest guide?",
    a: {
      paragraphs: [
        "A single, interactive guide lowers guest anxiety, cuts repetitive messages, and drives better reviews, which in turn boosts search visibility and direct bookings.",
      ],
    },
  },
  {
    q: "What should I include?",
    a: {
      paragraphs: [
        "Essential arrival details, house rules, Wi-Fi, appliance tutorials, local emergency numbers, restaurant & activity recommendations, plus any upsell offers you provide.",
      ],
    },
  },
  {
    q: "How do I build one?",
    a: {
      paragraphs: [
        "Sign up, choose a template, drag-and-drop content, and set visibility rules (before stay, during stay, after checkout). Publish instantly via share-link or QR code.",
      ],
    },
  },
  {
    q: "How do guests access it?",
    a: {
      paragraphs: [
        "Guests receive the URL automatically in confirmation emails and can scan the QR code displayed in-room, no app download required.",
      ],
    },
  },
];

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData(
    "guest-guide-for-vacation-rentals",
    locale || "en",
  );

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function GuestGuideForVacationRentals({ cmsPage }) {
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
        <main id="guest-guide-for-vacation-rentals">
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
          h1={`${BRAND_NAME} Multi-Purpose Digital Guest Guide`}
          p="Turn every stay into a five-star memory"
        >
          <p className="mx-auto max-w-2xl">
            {BRAND_NAME} gives short-term rental owners a human, helpful way to
            answer guest questions, share local tips, and unlock new revenue,
            before, during, and after each reservation. Operators who add a
            digital guest guide paired with dynamic, data-driven pricing see
            average revenue gains of roughly 20 %.
          </p>
        </HeroSection>

        <section>
          <div className="title">
            <h2>Why hosts choose {BRAND_NAME}</h2>
          </div>

          <div className="table-wrapper max-w-5xl mx-auto">
            <div>
              <table>
                <thead>
                  <tr>
                    <th className="w-[20%]">Benefit</th>
                    <th>What it means for you</th>
                    <th>SEO-rich highlights</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="table-cell-category">
                      Your signature welcome
                    </td>
                    <td>
                      Embed personal stories, insider maps, and house quirks so
                      guests feel at home the moment they book.
                    </td>
                    <td>
                      vacation rental guest guide, personalized guest experience
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">Key info in one tap</td>
                    <td>
                      Wi-Fi, check-in codes, parking, house rules, and emergency
                      contacts, always up to date, mobile-friendly, and
                      available offline.
                    </td>
                    <td>digital welcome book, self check-in instructions</td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">
                      Unlimited custom content
                    </td>
                    <td>
                      Drop in photos, how-to videos, embeds, or custom HTML. No
                      design constraints and no extra fees.
                    </td>
                    <td>customizable guest app, branded digital guide</td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">
                      Automated guest messaging
                    </td>
                    <td>
                      Schedule pre-arrival tips and post-checkout reminders to
                      boost reviews with less work.
                    </td>
                    <td>
                      automated guest communication, property management
                      workflow
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">Built-in upsells</td>
                    <td>
                      Promote mid-stay cleans, late check-outs, tour packages,
                      and local partners to open fresh income streams.
                    </td>
                    <td>
                      short-term rental upselling, increase ancillary revenue
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">
                      AI-driven dynamic pricing
                    </td>
                    <td>
                      {BRAND_NAME} analyses seasonal demand, events, and
                      competitor rates so you maximise nightly revenue
                      hands-free.
                    </td>
                    <td>
                      dynamic pricing software, data-driven ADR optimisation
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Tailored to every type of stay</h2>

            <p>
              Holiday apartments • Boutique hotels • B&Bs • Guest houses •
              Camping & glamping • Farm stays
            </p>

            <p>
              From single condos to national portfolios, {BRAND_NAME}’s central
              dashboard syncs calendars, channels, and guest communications so
              you spend less time on admin and more time delighting travellers.
              Rising occupancy rates projected for 2025 mean prepared hosts will
              capture the upside.
            </p>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>What hosts are saying</h2>
          </div>

          <div className="mx-auto max-w-2xl lg:max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Quote
              quote={`“${BRAND_NAME} replaced three different tools for me. Revenue is up, and guests rave about the local tips.”`}
              author={"– Hasan, 11 listings"}
            />
            <Quote
              quote={
                "“Set-up took an afternoon. Now I get fewer repetitive questions and more five-star reviews.” "
              }
              author={"– Rebecca, 6 listings"}
            />
            <Quote
              quote={
                " “Automation finally feels human. I earn more and work less.”"
              }
              author={"– Stefano, 14 listings"}
            />
          </div>
        </section>

        <section className="mx-auto max-w-5xl">
          <FAQ content={FaqContent} />
        </section>

        <UnifiedCTA />
      </main>
    </>
  );
}
