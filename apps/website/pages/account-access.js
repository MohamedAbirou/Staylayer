import FAQ from "@/components/faq";
import LinkButton from "@/components/linkButton";
import Quote from "@/components/quote";
import SEOHead from "@/components/seoHead";
import UnifiedCTA from "@/components/unifiedCTA";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import PuckRenderer from "@/lib/puckRenderer";
import { getPageData } from "@/lib/cmsClient";

export const faqContent = [
  {
    q: `Can I add other users to ${BRAND_NAME}?`,
    a: {
      paragraphs: [
        "Absolutely! Add team members and give them view-only or editing access for specific features.",
      ],
    },
  },
  {
    q: "Who can I share access with?",
    a: {
      paragraphs: [
        "Partners, family, cleaning staff, tax consultants, anyone involved in running your rental.",
      ],
    },
  },
  {
    q: "Can I control what each person sees?",
    a: {
      paragraphs: [
        "Yes. Assign roles for general settings, prices, guest info, and more. Customize by property or portfolio-wide.",
      ],
    },
  },
  {
    q: "Can I adjust settings for each property?",
    a: {
      paragraphs: [
        "Definitely. Set permissions per property, ideal for property managers and multi-location operators.",
      ],
    },
  },
];

const pageDetails = {
  pageTitle: `Account Access ,  ${BRAND_NAME} Vacation Rental Software`,
  pageDescription: `Easily manage your vacation rental team with ${BRAND_NAME}. Add co-hosts, cleaners, and property managers with customizable access levels.`,
  pageKeywords: `account access, ${BRAND_NAME}, vacation rental, software, team management`,
};

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData("account-access", locale || "en");

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function AccountAccess({ cmsPage }) {
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
        <main id="account-access">
          <PuckRenderer data={cmsPage.puckData} />
        </main>
      </>
    );
  }

  // ── Fallback: original hardcoded page ──────────────────────────────────
  return (
    <>
      <SEOHead {...pageDetails} />
      <div id="account-access">
        <section className="hero h-screen! breakout-section bg-gradient-to-b from-blue-50 via-white to-white flex flex-col justify-center items-center text-center space-y-2 px-4 pb-0">
          <h1 className="mx-auto max-w-6xl tracking-tight leading-tight">
            Simplify Team Management & Vacation Rental Operations with{" "}
            <span className="text-blue-600 raw">{BRAND_NAME}</span>
          </h1>
          <h2 className="text-blue-600 text-2xl sm:text-3xl font-semibold mt-2">
            Maximize Your Vacation Rental Revenue
          </h2>
          <p className="mx-auto max-w-3xl text-lg sm:text-xl text-slate-700 mt-4">
            Join thousands of property owners and managers using{" "}
            <span className="font-semibold text-blue-700 raw">
              {BRAND_NAME}
            </span>{" "}
            to boost efficiency and grow bookings. Users see up to{" "}
            <span className="font-bold text-blue-700 raw">
              20% more revenue
            </span>{" "}
            with smart automation and team collaboration tools.
          </p>
        </section>

        <section className="relative z-10 !pt-0 flex flex-col items-center justify-center mt-0 ">
          <div className="bg-white/90 border border-blue-100 rounded-2xl shadow-lg px-8 py-6 max-w-xl mx-auto flex flex-col items-center gap-4 -mt-8">
            <h3 className="font-bold text-lg sm:text-xl text-blue-700 text-center">
              Try {BRAND_NAME} Dynamic Pricing – part of our powerful property
              management toolkit.
            </h3>
            <LinkButton
              className="text-base! font-semibold bg-blue-600 text-white shadow hover:bg-blue-700 transition"
              href="/pricing"
            >
              <span className="raw">Get started</span>
            </LinkButton>
          </div>
        </section>

        <section className="bg-gray-50 breakout-section">
          <div className="container mx-auto">
            <div className="text-center mb-12 ">
              <h2>Manage Your Vacation Rental Team with Confidence</h2>
              <p className="mt-4 text-xl text-gray-600 max-w-fit lg:max-w-2/3 text-center mx-auto">
                Whether you're running a boutique hotel, managing a guest house,
                or overseeing multiple vacation homes, {BRAND_NAME} helps you:
              </p>
            </div>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 ">
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Easy Team Onboarding
                </h3>
                <p className="text-gray-700">
                  Add and manage team members effortlessly with intuitive
                  controls and clear role assignments.
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Customizable Access
                </h3>
                <p className="text-gray-700">
                  Assign granular permissions and access rights, ensuring data
                  security and operational precision for every team member.
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Seamless Guest Communication
                </h3>
                <p className="text-gray-700">
                  Streamline all guest interactions through a centralized
                  platform, ensuring consistent and timely responses.
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Centralized Operations &amp; Tracking
                </h3>
                <p className="text-gray-700">
                  Monitor team performance, automate tasks, and manage all
                  aspects of your rental business from a single, integrated
                  dashboard.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Empower Your Team to Deliver Outstanding Guest Experiences</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            <div className="feature-card">
              <h3 className="feature-card-title">Add Team Members</h3>
              <ul className="feature-card-list">
                <li className="feature-card-list-item">
                  <span className="feature-card-list-marker">
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span>
                    Invite your co-hosts, cleaners, property managers, or
                    virtual assistants. Everyone gets access to exactly what
                    they need.
                  </span>
                </li>
              </ul>
            </div>

            <div className="feature-card">
              <h3 className="feature-card-title">Customize Permissions</h3>
              <ul className="feature-card-list">
                <li className="feature-card-list-item">
                  <span className="feature-card-list-marker">
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span>
                    Control who sees what. Define access levels for pricing,
                    messages, guest details, and more, across individual
                    properties or your entire portfolio.
                  </span>
                </li>
              </ul>
            </div>

            <div className="feature-card">
              <h3 className="feature-card-title">Collaborate Transparently</h3>
              <ul className="feature-card-list">
                <li className="feature-card-list-item">
                  <span className="feature-card-list-marker">
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span>
                    Keep stakeholders in the loop, owners, accountants,
                    partners, and staff, all with tailored access and real-time
                    updates.
                  </span>
                </li>
              </ul>
            </div>

            <div className="feature-card">
              <h3 className="feature-card-title">Retain Full Control</h3>
              <ul className="feature-card-list">
                <li className="feature-card-list-item">
                  <span className="feature-card-list-marker">
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span>
                    Oversee all properties from a single dashboard, ensuring
                    complete visibility and control at every step.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Trusted by Property Owners Around the World</h2>
            <p className="text-lg!">Real feedback from hosts just like you:</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 items-stretch">
            <Quote
              quote="“This is the best channel manager I’ve used. No hidden fees, all the tools I need, and it actually works.”"
              author={"Hassan"}
            />
            <Quote
              quote={`“I’ve relied on ${BRAND_NAME} for 4 years and 6 listings. It’s user-friendly and runs my booking engine flawlessly.”`}
              author={"Rebecca"}
            />
            <Quote
              quote="“It automated so many tasks I used to do manually, and it’s still affordable!”"
              author={"Stefano"}
            />
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Built for Every Type of Vacation Rental</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
            <div className="feature-card">
              <h3 className="feature-card-title">
                Vacation Homes &amp; Apartments
              </h3>
              <ul className="feature-card-list list-disc pl-6">
                <li>
                  Centralize bookings, automate communication, and boost
                  revenue.
                </li>
              </ul>
            </div>
            <div className="feature-card">
              <h3 className="feature-card-title">Boutique Hotels</h3>
              <ul className="feature-card-list list-disc pl-6">
                <li>Retain your personal touch while optimizing operations.</li>
              </ul>
            </div>
            <div className="feature-card">
              <h3 className="feature-card-title">Bed &amp; Breakfasts</h3>
              <ul className="feature-card-list list-disc pl-6">
                <li>Save time with seamless reservation and team tools.</li>
              </ul>
            </div>
            <div className="feature-card">
              <h3 className="feature-card-title">Guest Houses</h3>
              <ul className="feature-card-list list-disc pl-6">
                <li>
                  Balance warmth with efficiency through streamlined team
                  access.
                </li>
              </ul>
            </div>
            <div className="feature-card">
              <h3 className="feature-card-title">Campsites &amp; Glamping</h3>
              <ul className="feature-card-list list-disc pl-6">
                <li>
                  Keep everything organized with custom branding and guest
                  messaging.
                </li>
              </ul>
            </div>
            <div className="feature-card">
              <h3 className="feature-card-title">Farm Stays</h3>
              <ul className="feature-card-list list-disc pl-6">
                <li>
                  Deliver an authentic experience while managing multiple
                  properties effortlessly.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="max-w-3xl mx-auto">
          <FAQ content={faqContent} />
        </section>

        <UnifiedCTA />
      </div>
    </>
  );
}
