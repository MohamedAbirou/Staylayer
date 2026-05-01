import FAQ from "@/components/faq";
import OrderList from "@/components/orderList";
import SEOHead from "@/components/seoHead";
import { TextImageSection } from "@/components/textImageSection";
import React from "react";
import { BRAND_NAME, EMAIL_CONTACT } from "@/lib/brand";
import PuckRenderer from "@/lib/puckRenderer";
import { getPageData } from "@/lib/cmsClient";

const pageDetails = {
  pageTitle: `Become an Ambassador ,  Join the ${BRAND_NAME} Team`,
  pageDescription: `Join the ${BRAND_NAME} Ambassador Program and help us spread the word about our vacation rental software. Earn rewards while sharing your passion for travel and hospitality.`,
  pageKeywords:
    "ambassador, vacation rental, software, dynamic pricing, join us, rewards",
};

const faqContent = [
  {
    q: "Who can join?",
    a: {
      paragraphs: [
        "Anyone with an engaged audience of vacation-rental owners, coaches, influencers, agencies, bloggers, podcasters, or community groups.",
      ],
    },
  },
  {
    q: "How are referrals tracked?",
    a: {
      paragraphs: [
        "Your personalised link uses first-party cookies and last-click attribution. You can monitor clicks, trials, and conversions in real time.",
      ],
    },
  },
  {
    q: "Is there a limit to my earnings?",
    a: {
      paragraphs: [
        "No. Refer one host or one thousand, your commission scales with your success.",
      ],
    },
  },
  {
    q: "What counts as a qualified referral?",
    a: {
      paragraphs: [
        `A host who clicks your link and becomes a paying ${BRAND_NAME} customer within the 60-day cookie window.`,
      ],
    },
  },
];

const list = [
  {
    title: "Apply & Get Approved",
    description: "Fill out the short form, no fees, no hassle.",
  },
  {
    title: "Receive Your Unique Link",
    description:
      "We generate a personal tracking link plus access to live stats and promo materials.",
  },
  {
    title: `Share ${BRAND_NAME}`,
    description:
      "Post tutorials, host webinars, or simply recommend the software to peers.",
  },
  {
    title: "Earn Commission",
    description:
      "Every paying customer who joins via your link unlocks up to $1,000 for you.",
  },
];

const whyPartnerList = [
  {
    title: "Drive Real Results for Hosts",
    description: `${BRAND_NAME} users see an average 20% increase in booking revenue thanks to built-in dynamic pricing, a powerful channel manager, and automated guest messaging, features every short-term-rental owner needs to stay competitive.`,
  },
  {
    title: "Build Passive, Recurring Income",
    description:
      "Your unique referral link tracks every sign-up. Each paying customer generates commission for you month after month, creating a reliable revenue stream.",
  },
  {
    title: "Represent a Trusted Brand",
    description: `Thousands of hosts in 120+ countries rely on ${BRAND_NAME} to simplify operations, reduce double-bookings, and delight guests. Promote a solution you can stand behind.`,
  },
];

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData("ambassador", locale || "en");

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function ambassador({ cmsPage }) {
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
        <main id="ambassador">
          <PuckRenderer data={cmsPage.puckData} />
        </main>
      </>
    );
  }

  // ── Fallback: original hardcoded page ──────────────────────────────────
  return (
    <>
      <SEOHead {...pageDetails} />
      <main id="ambassador" className="relative -mt-10">
        <div className="hero h-screen  breakout-section bg-gradient-to-b from-blue-50 via-white to-white px-4">
          <div className="title  mx-auto text-center space-y-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold">
              Become a{" "}
              <span className="relative whitespace-nowrap text-blue-600!">
                <span className="text-3xl! sm:text-4xl! md:text-5xl! lg:text-6xl! font-bold! !mb-6 text-blue-600! relative">
                  {BRAND_NAME} <br /> Ambassador
                </span>
              </span>
            </h1>
            <p className="raw text-lg sm:text-xl text-slate-700 font-medium">
              Earn up to <span className="text-blue-700 font-bold">$1,000</span>{" "}
              for every host you introduce to our vacation-rental management
              platform.
            </p>
          </div>
        </div>

        <section className="breakout-section">
          <TextImageSection
            title={`What Is the ${BRAND_NAME} Ambassador Program?`}
            description={`${BRAND_NAME}’s Ambassador Program rewards content creators, coaches, consultants, agencies, and referral pros who share our all-in-one vacation-rental software with their audience. When your contacts subscribe to any paid ${BRAND_NAME} plan, you collect generous, recurring commissions, no caps, no complicated tiers.`}
            src="/images/ambassador.jpg"
            alt={`${BRAND_NAME} Ambassador Program`}
            fullWidth={true}
          />
        </section>

        <section>
          <div className="title">
            <h2>Why Partner With {BRAND_NAME}?</h2>
          </div>

          <div>
            <OrderList list={whyPartnerList} />
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Who Should Apply?</h2>
          </div>

          <div className="table-wrapper max-w-4xl mx-auto ">
            <div>
              <table>
                <colgroup>
                  <col className="w-1/3" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Ideal Partners</th>
                    <th>How You’ll Add Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="table-cell-category">
                      Coaches & Consultants
                    </td>
                    <td>
                      Help clients optimise listings, pricing, and workflows.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">
                      Influencers & Creators
                    </td>
                    <td>
                      Share real hosting tips and success stories with your
                      followers.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">
                      Bloggers & Podcasters
                    </td>
                    <td>
                      Publish in-depth reviews and how-to guides about
                      vacation-rental tech.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">
                      Journalists & Industry Writers
                    </td>
                    <td>Recommend proven tools in explainer articles.</td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">Agencies</td>
                    <td>
                      Onboard clients to {BRAND_NAME} and manage their accounts
                      at scale.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category">
                      Referral Experts & Community Leaders
                    </td>
                    <td>
                      Offer an exclusive deal to your network of property
                      owners.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>How the Program Works</h2>
          </div>

          <OrderList list={list} />
        </section>

        <section className="max-w-4xl mx-auto">
          <FAQ content={faqContent} />
        </section>

        <section>
          <div className="title">
            <p className="mt-8 mb-2 text-lg font-semibold">
              Have questions about payout schedules, marketing assets, or
              integration support?
            </p>
            <p className="mt-0 text-base font-medium">
              Email{" "}
              <a
                href={`mailto:${EMAIL_CONTACT}`}
                className="font-semibold underline underline-offset-2"
              >
                {EMAIL_CONTACT}
              </a>{" "}
              and our team will respond within one business day.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
