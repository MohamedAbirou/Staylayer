"use client";
import SEOHead from "@/components/seoHead";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { BRAND_NAME, DOMAIN_NAME } from "@/lib/brand";
import { getPageData } from "@/lib/cmsClient";
import PuckRenderer from "@/lib/puckRenderer";

const pageDetails = {
  pageTitle: "Privacy Policy ",
  pageDescription: `${BRAND_NAME} is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website.`,
};

// Layout helpers for consistent spacing & hierarchy
function PageSection({ id, title, children }) {
  return (
    <section id={id} className="border-t border-slate-200 pt-8 mt-12">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <div className="mt-4 space-y-6 text-slate-700 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function SubSection({ title, children }) {
  return (
    <div className="mt-6">
      <h3 className="text-xl font-medium text-slate-900">{title}</h3>
      <div className="mt-2 space-y-4">{children}</div>
    </div>
  );
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 rounded-full shadow-lg bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      ↑ Top
    </button>
  );
}

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData("privacy-policy", locale || "en");

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function PrivacyPolicyPage({ cmsPage }) {
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
        <main id="privacy-policy">
          <PuckRenderer data={cmsPage.puckData} />
        </main>
      </>
    );
  }

  // ── Fallback: original hardcoded page ──────────────────────────────────
  return (
    <>
      <SEOHead {...pageDetails} />

      <header className="border-b border-slate-200 pt-20 bg-gradient-to-b from-slate-50 to-white breakout-section">
        <div className="container mx-auto max-w-3xl px-6 py-12">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            <strong>Effective Date:</strong> February 23, 2024
          </p>

          <nav aria-label="Table of contents" className="mt-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                On this page
              </p>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {[
                  ["Overview", "overview"],
                  ["Collection of Your Information", "collection"],
                  ["Use of Your Information", "use"],
                  ["Disclosure of Your Information", "disclosure"],
                  ["Tracking Technologies", "tracking"],
                  ["Third-Party Websites", "third-party-websites"],
                  ["Security of Your Information", "security"],
                  ["Policy for Children", "children"],
                  ["Do-Not-Track", "dnt"],
                  ["Options Regarding Your Information", "options"],
                  ["Emails and Communications", "emails"],
                ].map(([label, href]) => (
                  <li key={href}>
                    <a
                      href={`#${href}`}
                      className="inline-block rounded px-2 py-1 text-slate-700 hover:text-slate-900 hover:underline"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto max-w-3xl px-6 py-12">
        {/* Overview */}
        <PageSection id="overview" title="Overview">
          <p>
            {BRAND_NAME} ("we," "our," "us") is committed to protecting your
            privacy. This Privacy Policy explains how we collect, use, disclose,
            and safeguard your information when you visit our website {""}
            <Link
              href={`https://${DOMAIN_NAME}`}
              className="underline text-slate-700 hover:text-slate-900"
            >
              https://{DOMAIN_NAME}
            </Link>
            , including any other media form, media channel, mobile website, or
            mobile application related or connected thereto (collectively, the
            "Site"). Please read this privacy policy carefully. If you do not
            agree with the terms of this privacy policy, please do not access
            the Site.
          </p>
          <p>
            We reserve the right to make changes to this Privacy Policy at any
            time and for any reason. We will alert you about any changes by
            updating the "Effective Date" of this Privacy Policy. You are
            encouraged to periodically review this Privacy Policy to stay
            informed of updates. You will be deemed to have accepted the changes
            in any revised Privacy Policy by your continued use of the Site
            after the date such revised Privacy Policy is posted.
          </p>
        </PageSection>

        {/* Collection */}
        <PageSection id="collection" title="Collection of Your Information">
          <p>
            We may collect information about you in a variety of ways. The
            information we may collect on the Site includes:
          </p>
          <SubSection title="Personal Data">
            <p>
              Personally identifiable information, such as your name, shipping
              address, email address, and telephone number, and demographic
              information, such as your age, gender, hometown, and interests,
              that you voluntarily give to us when you register with the Site or
              when you choose to participate in various activities related to
              the Site, such as online chat and message boards. You are under no
              obligation to provide us with personal information of any kind;
              however, your refusal to do so may prevent you from using certain
              features of the Site.
            </p>
          </SubSection>
          <SubSection title="Derivative Data">
            <p>
              Information our servers automatically collect when you access the
              Site, such as your IP address, browser type, operating system,
              access times, and the pages you have viewed directly before and
              after accessing the Site.
            </p>
          </SubSection>
          <SubSection title="Financial Data">
            <p>
              Financial information, such as data related to your payment method
              (e.g., valid credit card number, card brand, expiration date) that
              we may collect when you purchase, order, return, exchange, or
              request information about our services from the Site. We store
              only very limited, if any, financial information that we collect.
              Otherwise, all financial information is stored by our payment
              processor, and you are encouraged to review their privacy policy
              and contact them directly for responses to your questions.
            </p>
          </SubSection>
          <SubSection title="Mobile Device Data">
            <p>
              Device information, such as your mobile device ID, model, and
              manufacturer, and information about the location of your device,
              if you access the Site from a mobile device.
            </p>
          </SubSection>
          <SubSection title="Third-Party Data">
            <p>
              Information from third parties, such as personal information or
              network friends, if you connect your account to the third party
              and grant the Site permission to access this information.
            </p>
          </SubSection>
          <SubSection title="Data From Contests, Giveaways, and Surveys">
            <p>
              Personal and other information you may provide when entering
              contests or giveaways and/or responding to surveys.
            </p>
          </SubSection>
        </PageSection>

        {/* Use */}
        <PageSection id="use" title="Use of Your Information">
          <p>
            Having accurate information about you permits us to provide you with
            a smooth, efficient, and customized experience. Specifically, we may
            use information collected about you via the Site to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Create and manage your account.</li>
            <li>
              Process your transactions and send related information, including
              purchase confirmations and invoices.
            </li>
            <li>Manage and respond to your inquiries and requests.</li>
            <li>Administer sweepstakes, promotions, and contests.</li>
            <li>
              Deliver targeted advertising, newsletters, and other information
              regarding promotions and the Site to you.
            </li>
            <li>
              Monitor and analyze usage and trends to improve your experience
              with the Site.
            </li>
            <li>
              Personalize and improve the Site, including to provide or
              recommend features, content, social connections, referrals, and
              advertisements.
            </li>
            <li>Perform other business activities as needed.</li>
            <li>
              Prevent fraudulent transactions, monitor against theft, and
              protect against criminal activity.
            </li>
            <li>Enforce our terms, conditions, and policies.</li>
            <li>Comply with legal obligations.</li>
          </ul>
        </PageSection>

        {/* Disclosure */}
        <PageSection id="disclosure" title="Disclosure of Your Information">
          <p>
            We may share information we have collected about you in certain
            situations. Your information may be disclosed as follows:
          </p>
          <SubSection title="By Law or to Protect Rights">
            <p>
              If we believe the release of information about you is necessary to
              respond to legal process, to investigate or remedy potential
              violations of our policies, or to protect the rights, property,
              and safety of others, we may share your information as permitted
              or required by any applicable law, rule, or regulation. This
              includes exchanging information with other entities for fraud
              protection and credit risk reduction.
            </p>
          </SubSection>
          <SubSection title="Business Transfers">
            <p>
              We may share or transfer your information in connection with, or
              during negotiations of, any merger, sale of company assets,
              financing, or acquisition of all or a portion of our business to
              another company.
            </p>
          </SubSection>
          <SubSection title="Third-Party Service Providers">
            <p>
              We may share your information with third parties that perform
              services for us or on our behalf, including payment processing,
              data analysis, email delivery, hosting services, customer service,
              and marketing assistance.
            </p>
          </SubSection>
          <SubSection title="Marketing Communications">
            <p>
              With your consent, or with an opportunity for you to withdraw
              consent, we may share your information with third parties for
              marketing purposes, as permitted by law.
            </p>
          </SubSection>
          <SubSection title="Interactions with Other Users">
            <p>
              If you interact with other users of the Site, those users may see
              your name, profile photo, and descriptions of your activity,
              including sending invitations to other users, chatting with other
              users, liking posts, and following blogs.
            </p>
          </SubSection>
          <SubSection title="Online Postings">
            <p>
              When you post comments, contributions, or other content to the
              Site, your posts may be viewed by all users and may be publicly
              distributed outside the Site in perpetuity.
            </p>
          </SubSection>
          <SubSection title="Third-Party Advertisers">
            <p>
              We may use third-party advertising companies to serve ads when you
              visit the Site. These companies may use information about your
              visits to the Site and other websites that are contained in web
              cookies in order to provide advertisements about goods and
              services of interest to you.
            </p>
          </SubSection>
          <SubSection title="Affiliates">
            <p>
              We may share your information with our affiliates, in which case
              we will require those affiliates to honor this Privacy Policy.
              Affiliates include our parent company and any subsidiaries, joint
              venture partners, or other companies that we control or that are
              under common control with us.
            </p>
          </SubSection>
          <SubSection title="Business Partners">
            <p>
              We may share your information with our business partners to offer
              you certain products, services, or promotions.
            </p>
          </SubSection>
        </PageSection>

        {/* Tracking */}
        <PageSection id="tracking" title="Tracking Technologies">
          <SubSection title="Cookies and Web Beacons">
            <p>
              We may use cookies, web beacons, tracking pixels, and other
              tracking technologies on the Site to help customize the Site and
              improve your experience. When you access the Site, your personal
              information is not collected through the use of tracking
              technology. Most browsers are set to accept cookies by default.
              You can remove or reject cookies, but be aware that such action
              could affect the availability and functionality of the Site. You
              may not decline web beacons. However, they can be rendered
              ineffective by declining all cookies or by modifying your web
              browser's settings to notify you each time a cookie is tendered,
              permitting you to accept or decline cookies on an individual
              basis.
            </p>
          </SubSection>
          <SubSection title="Internet-Based Advertising">
            <p>
              Additionally, we may use third-party software to serve ads on the
              Site, implement email marketing campaigns, and manage other
              interactive marketing initiatives. This third-party software may
              use cookies or similar tracking technology to help manage and
              optimize your online experience with us. For more information
              about opting out of interest-based ads, visit the Network
              Advertising Initiative Opt-Out Tool or Digital Advertising
              Alliance Opt-Out Tool.
            </p>
          </SubSection>
          <SubSection title="Website Analytics">
            <p>
              We may also partner with selected third-party vendors such as
              [Google Analytics, etc.] to allow tracking technologies and
              remarketing services on the Site through the use of first-party
              cookies and third-party cookies, to, among other things, analyze
              and track users' use of the Site, determine the popularity of
              certain content, and better understand online activity. By
              accessing the Site, you consent to the collection and use of your
              information by these third-party vendors. You are encouraged to
              review their privacy policy and contact them directly for
              responses to your questions. We do not transfer personal
              information to these third-party vendors. However, if you do not
              want any information to be collected and used by tracking
              technologies, you can visit the third-party vendor or the Network
              Advertising Initiative Opt-Out Tool or Digital Advertising
              Alliance Opt-Out Tool.
            </p>
          </SubSection>
        </PageSection>

        {/* Third-Party Websites */}
        <PageSection id="third-party-websites" title="Third-Party Websites">
          <p>
            The Site may contain links to third-party websites and applications
            of interest, including advertisements and external services, that
            are not affiliated with us. Once you have used these links to leave
            the Site, any information you provide to these third parties is not
            covered by this Privacy Policy, and we cannot guarantee the safety
            and privacy of your information. Before visiting and providing any
            information to any third-party websites, you should inform yourself
            of the privacy policies and practices (if any) of the third party
            responsible for that website, and should take those steps necessary
            to, in your discretion, protect the privacy of your information. We
            are not responsible for the content or privacy and security
            practices and policies of any third parties, including other sites,
            services or applications that may be linked to or from the Site.
          </p>
        </PageSection>

        {/* Security */}
        <PageSection id="security" title="Security of Your Information">
          <p>
            We use administrative, technical, and physical security measures to
            help protect your personal information. While we have taken
            reasonable steps to secure the personal information you provide to
            us, please be aware that despite our efforts, no security measures
            are perfect or impenetrable, and no method of data transmission can
            be guaranteed against any interception or other type of misuse. Any
            information disclosed online is vulnerable to interception and
            misuse by unauthorized parties. Therefore, we cannot guarantee
            complete security if you provide personal information.
          </p>
        </PageSection>

        {/* Children */}
        <PageSection id="children" title="Policy for Children">
          <p>
            We do not knowingly solicit information from or market to children
            under the age of 13. If we learn that we have collected personal
            information from a child under age 13 without verification of
            parental consent, we will delete that information as quickly as
            possible. If you become aware of any data we have collected from
            children under age 13, please contact us using the contact
            information provided below.
          </p>
        </PageSection>

        {/* DNT */}
        <PageSection id="dnt" title="Controls for Do-Not-Track Features">
          <p>
            Most web browsers and some mobile operating systems include a
            Do-Not-Track ("DNT") feature or setting you can activate to signal
            your privacy preference not to have data about your online browsing
            activities monitored and collected. No uniform technology standard
            for recognizing and implementing DNT signals has been finalized. As
            such, we do not currently respond to DNT browser signals or any
            other mechanism that automatically communicates your choice not to
            be tracked online. If a standard for online tracking is adopted that
            we must follow in the future, we will inform you about that practice
            in a revised version of this Privacy Policy.
          </p>
        </PageSection>

        {/* Options */}
        <PageSection id="options" title="Options Regarding Your Information">
          <SubSection title="Account Information">
            <p>
              You may at any time review or change the information in your
              account or terminate your account by:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Logging into your account settings and updating your account.
              </li>
              <li>
                Contacting us using the contact information provided below.
              </li>
            </ul>
            <p>
              Upon your request to terminate your account, we will deactivate or
              delete your account and information from our active databases.
              However, some information may be retained in our files to prevent
              fraud, troubleshoot problems, assist with any investigations,
              enforce our Terms of Use and/or comply with legal requirements.
            </p>
          </SubSection>
        </PageSection>

        {/* Emails */}
        <PageSection id="emails" title="Emails and Communications">
          <p>
            If you no longer wish to receive correspondence, emails, or other
            communications from us, you may opt-out by:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Noting your preferences at the time you register your account with
              the Site.
            </li>
            <li>
              Logging into your account settings and updating your preferences.
            </li>
            <li>Contacting us using the contact information provided below.</li>
          </ul>
          <p>
            If you no longer wish to receive correspondence, emails, or other
            communications from third parties, you are responsible for
            contacting the third party directly.
          </p>
        </PageSection>
      </main>

      <BackToTop />
    </>
  );
}
