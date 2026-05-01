import HeroSection from "@/components/heroSection";
import OrderList from "@/components/orderList";
import PlanIncludesBanner from "@/components/planIncludesBanner";
import SEOHead from "@/components/seoHead";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import { getPageData } from "@/lib/cmsClient";
import PuckRenderer from "@/lib/puckRenderer";

const coreValuesList = [
  {
    title: "Support Each Other",
    description:
      "Success is shared. We offer candid feedback, lend a hand, and celebrate milestones together.",
  },
  {
    title: "Stay Authentic",
    description:
      "Your unique background enriches our product and community; bring your whole self to work.",
  },
  {
    title: "Be Reliable",
    description:
      "We honor commitments, deliver quality on time, and build trust with colleagues and customers.",
  },
  {
    title: "Embrace Experimentation",
    description:
      "Curiosity drives innovation. We test bold ideas, analyze results, and iterate fast.",
  },
  {
    title: "Get Things Done",
    description:
      "Action beats perfection. We align, execute, and ship features that move the needle for hosts.",
  },
];

const howWeHireSteps = [
  {
    title: "30-minute intro call",
    description: `with a ${BRAND_NAME} recruiter`,
  },
  {
    title: "45- to 60-minute conversation",
    description: "with your future manager",
  },
  {
    title: "Role-specific assessment ",
    description: "(case study or technical deep dive) with a peer",
  },
  {
    title: "30-minute meet-and-greet ",
    description: "with future teammates",
  },
  {
    title: "Reference check & offer",
  },
];

const pageDetails = {
  pageTitle: `Careers - Join the Vacation Rental Tech Champion`,
  pageDescription: `Grow your career with ${BRAND_NAME}, the leading vacation rental technology company. Discover our mission-driven culture, core values, and global impact. Join a team that empowers hosts worldwide with innovative property management, dynamic pricing, and automation tools.`,
  pageKeywords: `${BRAND_NAME} careers, vacation rental jobs, property management software jobs, SaaS careers, hospitality tech jobs, remote work, Berlin tech jobs, dynamic pricing, channel manager, guest messaging, join ${BRAND_NAME}, work at ${BRAND_NAME}, travel tech careers`,
};

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData("careers", locale || "en");

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function careers({ cmsPage }) {
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
        <main id="careers">
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
          h1="Careers – Grow With the Vacation-Rental Tech Champion"
          p={`Unlock More Revenue With ${BRAND_NAME} Dynamic Pricing`}
        >
          <p className="max-w-2xl mx-auto">
            {" "}
            <span className="font-bold!">
              Property managers and hosts who switch to {BRAND_NAME} report an
              average revenue increase of 20 percent
            </span>{" "}
            thanks to our AI-powered pricing engine and all-in-one
            property-management software. Ready to capture higher nightly rates
            and occupancy? Try {BRAND_NAME} Dynamic Pricing today.
          </p>
        </HeroSection>

        <section>
          <div className="title max-w-3xl mx-auto">
            <h2>Who We Are – The {BRAND_NAME} Story</h2>
            <p>
              Founded in 2014, {BRAND_NAME} began as a bold idea: make
              vacation-rental management effortless for every host on the
              planet. Our founders, hosts themselves, couldn’t find a single
              platform that combined channel management, booking automation,
              guest communication, and analytics in one intuitive dashboard. So
              they built it.
            </p>

            <p className="mt-4">
              Today, thousands of property owners, boutique hoteliers, and
              professional managers rely on {BRAND_NAME}’s cloud-based toolkit
              to streamline operations, boost revenue, and deliver five-star
              guest experiences.
            </p>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Our Mission</h2>

            <h3>
              Empower hosts everywhere to run profitable, stress-free holiday
              rentals.
            </h3>

            <p>
              Empower hosts everywhere to run profitable, stress-free holiday
              rentals.
            </p>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>
              Empower hosts everywhere to run profitable, stress-free holiday
              rentals.
            </h2>

            <p>
              A world where anyone, regardless of location or experience, can
              turn a spare room, apartment, or villa into a thriving
              short-term-rental business with {BRAND_NAME}.
            </p>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Life at {BRAND_NAME}</h2>
            <h3>Love Your Work, Love Where You Work</h3>
            <p>
              Our culture thrives on collaboration, laughter, and a shared
              passion for travel tech innovation. Whether you’re coding a new
              channel-manager feature, producing host tutorials, or optimizing
              dynamic pricing algorithms, you’ll see your impact every day.
            </p>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Why You’ll Thrive With Us</h2>
          </div>

          <div className="table-wrapper max-w-3xl mx-auto">
            <div>
              <table>
                <colgroup>
                  <col className="w-1/3" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-center!">What You Get</th>
                    <th className="text-center!">
                      How It Benefits You & Our Hosts
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="table-cell-category text-center!">
                      Growth Mindset
                    </td>
                    <td>
                      Mentorship, clear career paths, and continuous training to
                      sharpen your SaaS and hospitality skills.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category text-center!">
                      Global Impact
                    </td>
                    <td>
                      {BRAND_NAME} is active in 150+ countries, so your work
                      influences hosts, and travelers, worldwide.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category text-center!">
                      Flexible Work Options
                    </td>
                    <td>
                      Choose between our vibrant Berlin HQ, remote-first setups,
                      or work from anywhere in the EU for up to 63 days per
                      year.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category text-center!">
                      Empowering Culture
                    </td>
                    <td>
                      We celebrate wins, encourage fresh ideas, and keep
                      meetings lean so you can focus on meaningful work.
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-category text-center!">
                      Team Spirit
                    </td>
                    <td>
                      Join a diverse crew of “{BRAND_NAME}s” who collaborate in
                      English and support one another like family.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="title">
            <h2>Our Core Values</h2>
          </div>

          <div>
            <OrderList list={coreValuesList} />
          </div>
        </section>

        <section>
          <div className="title">
            <h2>How We Hire</h2>
            <p>
              Our streamlined recruitment process respects your time while
              ensuring a great fit on both sides:
            </p>
          </div>

          <div>
            <OrderList list={howWeHireSteps} />

            <PlanIncludesBanner
              title={"Timelines may vary by position and seniority."}
            />
          </div>
        </section>
      </main>
    </>
  );
}
