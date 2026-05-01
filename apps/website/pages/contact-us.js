import SEOHead from "@/components/seoHead";
import Image from "next/image";
import React from "react";
import { BRAND_NAME, EMAIL_CONTACT } from "@/lib/brand";
import ContactForm from "@/components/contactForm";
import PuckRenderer from "@/lib/puckRenderer";
import { getPageData } from "@/lib/cmsClient";

const pageSeo = {
  pageTitle: `Contact ${BRAND_NAME}, Vacation Rental Software & Dynamic Pricing`,
  pageDescription: `Ready to earn more from every booking? ${BRAND_NAME} hosts report up to 20% higher revenue after switching to our all-in-one vacation-rental platform and AI-powered dynamic pricing engine. If you have questions, we'd love to talk.`,
  pageKeywords: `contact, ${BRAND_NAME}, vacation rental, software, dynamic pricing`,
};

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData("contact-us", locale || "en");

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function ContactUs({ cmsPage }) {
  // ── CMS page is ready: render it via Puck (ContactSection override active) ──
  if (cmsPage?.puckData) {
    const rootProps = cmsPage.puckData?.root?.props || {};
    return (
      <>
        <SEOHead
          pageTitle={
            cmsPage.seoTitle ||
            rootProps.seoTitle ||
            cmsPage.title ||
            pageSeo.pageTitle
          }
          pageDescription={
            cmsPage.seoDescription ||
            rootProps.seoDescription ||
            pageSeo.pageDescription
          }
          pageKeywords={
            cmsPage.seoKeywords || rootProps.seoKeywords || pageSeo.pageKeywords
          }
        />
        <main id="contact-us">
          <PuckRenderer data={cmsPage.puckData} />
        </main>
      </>
    );
  }

  // ── Fallback: original hardcoded page ──────────────────────────────────
  return (
    <>
      <SEOHead {...pageSeo} />
      <main id="contact-us">
        <div className="hero bg-blue-700 relative flex items-center justify-center breakout-section">
          <Image
            loading="lazy"
            width={2347}
            height={1244}
            className="absolute -z-[1] top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 selection:bg-transparent"
            src="/background-call-to-action.6a5a5672.jpg"
          />
          <h1 className="text-white! font-bold text-2xl! sm:text-3xl! md:text-4xl! lg:text-5xl! leading-tight md:leading-tight text-center relative z-[2] text-balance drop-shadow-lg px-4 py-8 max-w-3xl mx-auto">
            Contact {BRAND_NAME},
          </h1>

          <p className="text-white/90 raw text-base sm:text-lg md:text-xl font-medium text-center max-w-2xl mx-auto mt-2 px-4 drop-shadow">
            Ready to earn more from every booking?{" "}
            <span className="font-bold text-lg! text-white raw">
              {BRAND_NAME} hosts report up to 20% higher revenue
            </span>{" "}
            after switching to our all-in-one vacation-rental platform and
            AI-powered dynamic pricing engine. If you have questions, we'd love
            to talk.
          </p>
        </div>
        <section className="py-12 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
              {/* Left/Top Text */}
              <div className="md:col-span-1 flex flex-col justify-center">
                <h3 className="text-xl font-bold mb-4 text-blue-700">
                  Let's Connect
                </h3>
                <p className="text-slate-700 mb-2">
                  Have a question about {BRAND_NAME} or need help with your
                  account? Fill out the form and our team will get back to you
                  quickly.
                </p>
                <ul className="list-disc pl-5 text-slate-600 space-y-1 mb-4">
                  <li>Onboarding & setup guidance</li>
                  <li>Feature walkthroughs</li>
                  <li>Partnership opportunities</li>
                  <li>General support</li>
                </ul>
                <div className="mt-4">
                  <span className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium text-sm">
                    Fast, friendly replies
                  </span>
                </div>
              </div>
              <div className="md:col-span-2">
                <ContactForm />
              </div>
            </div>
            <div className="mt-8 text-center text-slate-600">
              <p>
                Prefer email? Reach us at{" "}
                <a
                  href={`mailto:${EMAIL_CONTACT}`}
                  className="text-blue-700 underline font-medium"
                >
                  {" "}
                  {EMAIL_CONTACT}
                </a>
              </p>
              <p className="mt-2 text-xs text-slate-400">
                We aim to respond within one business day.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
