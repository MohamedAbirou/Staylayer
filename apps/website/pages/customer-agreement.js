import Link from "next/link";
import React, { useEffect, useState } from "react";
import SEOHead from "@/components/seoHead";
import { BRAND_NAME, DOMAIN_NAME, EMAIL_CONTACT } from "@/lib/brand";
import { getPageData } from "@/lib/cmsClient";
import PuckRenderer from "@/lib/puckRenderer";

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
    console.log("window.scrollY");
    console.log(window.scrollY);
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
  const cmsPage = await getPageData("customer-agreement", locale || "en");

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function CustomerAgreement({ cmsPage }) {
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
        <main id="customer-agreement">
          <PuckRenderer data={cmsPage.puckData} />
        </main>
      </>
    );
  }

  // ── Fallback: original hardcoded page ──────────────────────────────────
  const pageDetails = {
    pageTitle: "Customer Agreement",
    pageDescription: `${BRAND_NAME} is committed to protecting your rights. This Agreement outlines the terms of our services and our relationship with you.`,
  };
  return (
    <>
      <SEOHead {...pageDetails} />
      <header className="border-b pt-20 breakout-section border-slate-200 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto max-w-3xl px-6 py-12">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {BRAND_NAME} Customer Agreement
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                <strong>Effective Date:</strong> February 28, 2024
              </p>
            </div>
          </div>
          {/* Quick links / TOC */}
          <nav aria-label="Table of contents" className="mt-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                On this page
              </p>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {[
                  ["1. Introduction", "introduction"],
                  ["2. Definitions", "definitions"],
                  ["3. Account Registration", "account-registration"],
                  ["4. Subscription and Fees", "subscription-fees"],
                  ["5. Customer Data and Privacy", "customer-data"],
                  ["6. Acceptable Use", "acceptable-use"],
                  ["7. Third-Party Services", "third-party"],
                  ["8. Intellectual Property", "ip-rights"],
                  ["9. Confidentiality", "confidentiality"],
                  ["10. Warranties", "warranties"],
                  ["11. Limitation of Liability", "limitation"],
                  ["12. Indemnification", "indemnification"],
                  ["13. Term & Termination", "term-termination"],
                  ["14. Changes", "changes"],
                  ["15. Governing Law", "governing-law"],
                  ["16. Miscellaneous", "misc"],
                  ["17. Contact", "contact"],
                  ["18. Security & Privacy Practices", "security-privacy"],
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
      <main className="min-h-screen bg-white ">
        {/* Content */}
        <div className="container mx-auto max-w-3xl px-6 py-12">
          {/* 1 */}
          <PageSection id="introduction" title="1. Introduction">
            <p>
              Welcome to <strong>{DOMAIN_NAME}</strong>, a property management
              software service owned and operated by <em>Alphatel FZ LLC</em>{" "}
              ("we", "our", or "us"). This company operates under the trade
              license of <em>Alphatel FZ LLC</em>. This Customer Agreement
              ("Agreement") governs your use of our service and outlines the
              terms and conditions of your relationship with us. By using{" "}
              <strong>{DOMAIN_NAME}</strong>, you ("you", "your," or "Customer")
              agree to these terms in full. This Agreement, together with our{" "}
              {""}
              <Link
                href="/privacy-policy"
                className="underline text-slate-700 hover:text-slate-900"
              >
                Privacy Policy
              </Link>{" "}
              and any other agreements or documents incorporated herein by
              reference, constitutes the entire agreement between you and{" "}
              <strong>{DOMAIN_NAME}</strong>.
            </p>
          </PageSection>

          {/* 2 */}
          <PageSection id="definitions" title="2. Definitions">
            <p>
              For the purposes of this Agreement, the following definitions
              apply:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>"Service"</strong>: Refers to the SaaS service provided
                by <strong>{DOMAIN_NAME}</strong> and any associated mobile
                applications, websites, or services.
              </li>
              <li>
                <strong>"Software"</strong>: Refers to the web-based application
                hosted at <strong>{DOMAIN_NAME}</strong> and its related mobile
                application(s).
              </li>
              <li>
                <strong>"User"</strong>: Refers to any individual or entity that
                accesses the Service, whether directly or indirectly, authorized
                or unauthorized.
              </li>
              <li>
                <strong>"Customer Data"</strong>: Refers to any information,
                content, or data uploaded, stored, transmitted, or otherwise
                made available through the Service by the Customer or on their
                behalf.
              </li>
              <li>
                <strong>"Subscription Plan"</strong>: Refers to the pricing
                structure and features associated with a customer’s account.
              </li>
              <li>
                <strong>"Third-Party Services"</strong>: Refers to services,
                software, applications, or other resources provided by third
                parties that may be integrated with or accessed through{" "}
                <strong>{DOMAIN_NAME}</strong>.
              </li>
            </ul>
          </PageSection>

          {/* 3 */}
          <PageSection
            id="account-registration"
            title="3. Account Registration"
          >
            <p>
              To use our Service, you must create an account. By creating an
              account, you agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Provide accurate, complete, and updated registration information
                as required by us.
              </li>
              <li>
                Maintain the confidentiality of your account credentials,
                including your username and password.
              </li>
              <li>
                Accept responsibility for all activities that occur under your
                account.
              </li>
              <li>
                Notify us immediately of any unauthorized use of your account or
                any other breach of security.
              </li>
            </ul>
            <p>
              If you are registering on behalf of a company or other legal
              entity, you represent that you have the authority to bind such
              entity to this Agreement. Failure to comply with these obligations
              may result in the suspension or termination of your account.
            </p>
          </PageSection>

          {/* 4 */}
          <PageSection id="subscription-fees" title="4. Subscription and Fees">
            <SubSection title="4.1. Subscription Plans">
              <p>
                We offer several Subscription Plans to cater to various customer
                needs. Each plan may have different features and pricing. You
                agree to pay all applicable fees in accordance with the
                Subscription Plan selected at the time of registration. You can
                find detailed information about our Subscription Plans on our{" "}
                {""}
                <Link
                  href="/pricing"
                  className="underline text-slate-700 hover:text-slate-900"
                >
                  Pricing Page
                </Link>
                .
              </p>
            </SubSection>
            <SubSection title="4.2. Billing and Payment Terms">
              <p>
                All fees are billed monthly or annually, depending on the
                Subscription Plan chosen. You authorize us to charge your
                selected payment method for all charges incurred under your
                account. If your payment method fails or your account is past
                due, we may take actions such as disabling your access to the
                Service, suspending or terminating your account, or pursuing
                other legal remedies.
              </p>
            </SubSection>
            <SubSection title="4.3. Taxes and Duties">
              <p>
                All fees are exclusive of taxes, and you are responsible for
                paying any applicable taxes, duties, levies, or similar
                governmental charges imposed by any jurisdiction. If we are
                required to collect taxes on your behalf, such taxes will be
                added to your account’s billing and invoiced to you.
              </p>
            </SubSection>
            <SubSection title="4.4. Fee Adjustments">
              <p>
                We may modify the fees for the Subscription Plans at any time by
                providing notice to you. Any changes to fees will be effective
                at the beginning of your next billing cycle. Your continued use
                of the Service after such changes indicates your acceptance of
                the new fees.
              </p>
            </SubSection>
          </PageSection>

          {/* 5 */}
          <PageSection id="customer-data" title="5. Customer Data and Privacy">
            <SubSection title="5.1. Ownership of Customer Data">
              <p>
                You retain ownership of all Customer Data that you submit to the
                Service. However, by submitting Customer Data to the Service,
                you grant us a non-exclusive, worldwide, royalty-free license to
                use, copy, store, transmit, and display such Customer Data
                solely to the extent necessary to provide the Service to you.
              </p>
            </SubSection>
            <SubSection title="5.2. Data Security">
              <p>
                We are committed to protecting your data and will implement
                commercially reasonable measures to safeguard the
                confidentiality, integrity, and availability of Customer Data.
              </p>
            </SubSection>
            <SubSection title="5.3. Privacy">
              <p>
                Your use of the Service is subject to our Privacy Policy, which
                outlines how we collect, use, and protect your personal
                information. By using the Service, you consent to our collection
                and use of your information in accordance with our Privacy
                Policy.
              </p>
            </SubSection>
          </PageSection>

          {/* 6 */}
          <PageSection
            id="acceptable-use"
            title="6. User Obligations and Acceptable Use"
          >
            <SubSection title="6.1. Compliance with Laws">
              <p>
                You agree to use the Service in compliance with all applicable
                local, national, and international laws and regulations,
                including but not limited to data protection laws, intellectual
                property laws, and privacy laws.
              </p>
            </SubSection>
            <SubSection title="6.2. Prohibited Conduct">
              <p>
                In addition to other restrictions set forth in this Agreement,
                you agree not to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Misrepresent your identity or affiliations.</li>
                <li>
                  Access or attempt to access unauthorized areas of the Service.
                </li>
                <li>
                  Use the Service to transmit any viruses, malware, or harmful
                  content.
                </li>
                <li>
                  Interfere with or disrupt the Service or the networks or
                  systems connected to the Service.
                </li>
                <li>
                  Engage in any activity that is fraudulent, illegal, or harmful
                  to us or any third party.
                </li>
              </ul>
            </SubSection>
          </PageSection>

          {/* 7 */}
          <PageSection
            id="third-party"
            title="7. Third-Party Services and Integrations"
          >
            <p>
              The Service may contain links to or be integrated with Third-Party
              Services. Your use of Third-Party Services is subject to their
              respective terms and conditions, and we are not responsible for
              any third-party content, products, or services. We do not endorse
              or assume any responsibility for any third-party content or
              practices.
            </p>
          </PageSection>

          {/* 8 */}
          <PageSection id="ip-rights" title="8. Intellectual Property Rights">
            <SubSection title="8.1. Ownership">
              <p>
                All intellectual property rights in the Service and Software,
                including but not limited to all source code, databases,
                designs, graphics, user interfaces, and trademarks, are owned by
                or licensed to <strong>{DOMAIN_NAME}</strong>. You acknowledge
                that these rights are protected by intellectual property laws
                and other laws.
              </p>
            </SubSection>
            <SubSection title="8.2. License Grant">
              <p>
                Subject to your compliance with this Agreement, we grant you a
                limited, non-exclusive, non-transferable, and revocable license
                to access and use the Service solely for your internal business
                purposes. All rights not expressly granted to you under this
                Agreement are reserved by <strong>{DOMAIN_NAME}</strong>.
              </p>
            </SubSection>
            <SubSection title="8.3. Feedback">
              <p>
                If you provide us with any feedback or suggestions regarding the
                Service, you grant us a worldwide, perpetual, irrevocable,
                royalty-free license to use and incorporate such feedback into
                our products and services.
              </p>
            </SubSection>
          </PageSection>

          {/* 9 */}
          <PageSection id="confidentiality" title="9. Confidentiality">
            <p>
              Each party agrees to maintain the confidentiality of any
              proprietary or confidential information disclosed by the other
              party in connection with this Agreement. This obligation of
              confidentiality does not apply to information that is publicly
              available, independently developed, or disclosed pursuant to legal
              requirements.
            </p>
          </PageSection>

          {/* 10 */}
          <PageSection id="warranties" title="10. Warranties and Disclaimers">
            <p>
              The Service is provided "as is" and "as available," without any
              warranties of any kind. We do not warrant that the Service will be
              uninterrupted, error-free, secure, or free of viruses. We disclaim
              all warranties, express or implied, including but not limited to
              implied warranties of merchantability, fitness for a particular
              purpose, and non-infringement.
            </p>
          </PageSection>

          {/* 11 */}
          <PageSection id="limitation" title="11. Limitation of Liability">
            <p>
              To the maximum extent permitted by law,{" "}
              <strong>{DOMAIN_NAME}</strong> shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages
              arising out of or in connection with this Agreement or your use of
              the Service. Our total liability to you for any claims arising
              from or related to this Agreement shall not exceed the amount paid
              by you to us during the six months preceding the claim.
            </p>
          </PageSection>

          {/* 12 */}
          <PageSection id="indemnification" title="12. Indemnification">
            <p>
              You agree to indemnify, defend, and hold harmless{" "}
              <strong>{DOMAIN_NAME}</strong>, its affiliates, and their
              respective officers, directors, employees, and agents from and
              against any claims, liabilities, damages, losses, or expenses,
              including legal fees, arising out of or in connection with your
              use of the Service or your breach of this Agreement.
            </p>
          </PageSection>

          {/* 13 */}
          <PageSection id="term-termination" title="13. Term and Termination">
            <SubSection title="13.1. Term">
              <p>
                This Agreement will remain in effect until terminated by either
                party. Either party may terminate this Agreement at any time for
                any reason by providing written notice to the other party.
              </p>
            </SubSection>
            <SubSection title="13.2. Termination for Cause">
              <p>
                We may terminate or suspend your access to the Service
                immediately, without notice, for any violation of this Agreement
                or if we believe that your actions may cause harm or legal
                liability to us or any third party.
              </p>
            </SubSection>
            <SubSection title="13.3. Effect of Termination">
              <p>
                Upon termination of this Agreement, all rights and licenses
                granted to you will immediately cease, and you must discontinue
                all use of the Service. Any provisions of this Agreement that by
                their nature should survive termination will survive, including
                but not limited to confidentiality, indemnification, and
                limitation of liability.
              </p>
            </SubSection>
          </PageSection>

          {/* 14 */}
          <PageSection id="changes" title="14. Changes to this Agreement">
            <p>
              We reserve the right to update or modify this Agreement at any
              time. Any changes will be posted on our website and will be
              effective immediately upon posting. Your continued use of the
              Service after such changes indicates your acceptance of the new
              terms.
            </p>
          </PageSection>

          {/* 15 */}
          <PageSection
            id="governing-law"
            title="15. Governing Law and Jurisdiction"
          >
            <p>
              This Agreement shall be governed by and construed in accordance
              with the laws of <em>Your Jurisdiction</em>. Any disputes arising
              out of or relating to this Agreement shall be subject to the
              exclusive jurisdiction of the courts located in{" "}
              <em>Your Jurisdiction</em>. You agree to submit to the personal
              jurisdiction of such courts.
            </p>
          </PageSection>

          {/* 16 */}
          <PageSection id="misc" title="16. Miscellaneous">
            <ul className="list-disc pl-6 space-y-2">
              <li>
                This Agreement constitutes the entire understanding between you
                and <strong>{DOMAIN_NAME}</strong> regarding the Service and
                supersedes all prior agreements and understandings.
              </li>
              <li>
                If any provision of this Agreement is found to be invalid or
                unenforceable, the remaining provisions will remain in full
                force and effect.
              </li>
              <li>
                The failure to enforce any provision of this Agreement shall not
                be deemed a waiver of future enforcement of that provision.
              </li>
              <li>
                You may not assign this Agreement without our prior written
                consent. We may assign this Agreement without your consent in
                connection with a merger, acquisition, or sale of substantially
                all of our assets.
              </li>
            </ul>
          </PageSection>

          {/* 17 */}
          <PageSection id="contact" title="17. Contact Information">
            <p>
              If you have any questions about this Agreement, please contact us
              at {""}
              <a
                href={`mailto:${EMAIL_CONTACT}`}
                className="underline hover:text-slate-900"
              >
                {EMAIL_CONTACT}
              </a>
              .
            </p>
          </PageSection>

          {/* 18 */}
          <PageSection
            id="security-privacy"
            title="18. Data Security and Privacy Practices"
          >
            <SubSection title="18.1. What Data Do We Store?">
              <p>
                {BRAND_NAME} only stores metadata about your organization and
                your organization's properties and users.
              </p>
              <p>
                We store the following data for the purpose of authentication:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Usernames and/or email addresses</li>
              </ul>
              <p>
                We store the following data for the purpose of channel
                management:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Property Details (Name, Address, Email, Facilities, Images,
                  Room Types, Rate Plans, Availability, Prices, and Restriction
                  Data)
                </li>
                <li>
                  Booking Metadata (including, if present: Customer name, guest
                  names, customer address, customer card details)
                </li>
              </ul>
            </SubSection>
            <SubSection title="18.2. Defense in Depth">
              <p>
                As you'll see from any best-in-class SaaS provider, there is no
                single layer that protects customer data, but rather a
                well-architected solution that considers every layer from the
                physical security measures at the data center, all the way
                through the access privileges that determine what data an
                individual user can access. {BRAND_NAME}, as a connectivity
                provider, uses this approach to protect customer data.
              </p>
            </SubSection>
            <SubSection title="18.3. Process & Policy">
              <p>
                The first layer of defense is having a well-defined and
                comprehensive set of security processes and policies to ensure
                the security of our customers' data and users. {BRAND_NAME}{" "}
                employs several process and policy measures that instill
                security as a key priority at our most core layer… our people.
              </p>
            </SubSection>
            <SubSection title="18.4. Change Control">
              <p>
                A formal change control process minimizes the risk associated
                with system changes. The process enables tracking of changes
                made to the systems and verifies that risks have been assessed,
                inter-dependencies are explored, and necessary policies and
                procedures have been considered and applied before any change is
                authorized.
              </p>
            </SubSection>
            <SubSection title="18.5. Training">
              <p>
                {BRAND_NAME} employees authorized to access the {BRAND_NAME}{" "}
                platform undergo periodic training to focus employee attention
                on compliance with corporate security policies. For example,{" "}
                {BRAND_NAME} DevOps and Professional Services personnel who may
                handle sensitive customer data and information will regularly
                undergo security, auditing, access, and compliance training
                (e.g., for GDPR).
              </p>
            </SubSection>
            <SubSection title="18.6. Authorized Access">
              <p>
                In addition to restricted personnel entering the production
                area, operational access is limited to only a restricted set of{" "}
                {BRAND_NAME} operations employees. Access is controlled via a
                physically separate network that is isolated from the{" "}
                {BRAND_NAME} corporate network that serves its general employee
                population, ensuring that only personnel authorized to access
                the data center may do so. All {BRAND_NAME} personnel with
                physical or operational access to production environments are
                subject to training, and all activities are logged for
                auditability.
              </p>
            </SubSection>
            <SubSection title="18.7. Physical Security">
              <p>
                All {BRAND_NAME} data centers are certified to major InfoSec
                standards, including ISO 27001 and PCI DSS. These data centers
                also feature N+1 redundant HVAC and UPS. The physical security
                adheres to the best practices in the industry and includes:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Keycard protocols, biometric scanning protocols, and
                  around-the-clock interior and exterior surveillance
                </li>
                <li>
                  Access limited to authorized data center personnel, no one can
                  enter the production area without prior clearance and
                  appropriate escort
                </li>
                <li>
                  Every data center employee undergoes thorough background
                  security checks
                </li>
              </ul>
            </SubSection>
            <SubSection title="18.8. Infrastructure Security">
              <p>
                Between the physical data center layer and the {BRAND_NAME}{" "}
                Enterprise Connectivity Platform application layer is the
                infrastructure that supports our solution. Throughout the
                infrastructure, security is implemented in a comprehensive and
                coordinated fashion to enhance the safety and security of
                customer data.
              </p>
            </SubSection>
            <SubSection title="18.9. Firewalls">
              <p>
                All network access to the virtual hosts is protected by a
                multi-layered firewall operating in a deny-all mode. Internet
                access is only permitted on explicitly opened ports for only a
                subset of specified virtual hosts. For an additional layer of
                security, all database servers reside behind an additional
                firewall.
              </p>
            </SubSection>
            <SubSection title="18.10. Networking">
              <p>
                {BRAND_NAME} platform servers are allocated to the respective
                security groups, characterized by specific security settings
                (TCP/IP level), supplemented by individual instance-level
                stateful firewalls. Separate VLANs are used to split production,
                testing, and development environments as well as to segregate
                end-user and administrative traffic.
              </p>
              <p>{BRAND_NAME} employs a three-tier security model:</p>
            </SubSection>
            <SubSection title="18.11. Systems Hardening">
              <p>
                Just like any SaaS offering, the {BRAND_NAME} Enterprise
                Connectivity Platform utilizes many well-coordinated
                technologies to deliver our service, yet there may be many
                capabilities that are not required. Consistent with industry
                best practices, {BRAND_NAME} DevOps closely inspects the entire
                solution to identify unnecessary services and remove and/or
                disable these capabilities to reduce vulnerabilities to security
                threats.
              </p>
            </SubSection>
            <SubSection title="18.12. No Root Access">
              <p>
                All customer access to the {BRAND_NAME} Enterprise Connectivity
                Platform is controlled through user interfaces (UI), APIs,
                and/or dedicated tools. Use of any of these methods of access
                requires a username and password with privileges appropriate for
                the requested access.
              </p>
              <p>
                Customers do not have root or administrative access to any
                portion of the Enterprise Insights Platform technology stack,
                and access is permitted only via the Enterprise Insights
                Platform application layer (UI or API).
              </p>
            </SubSection>
            <SubSection title="18.13. Shutdown All Unnecessary Ports">
              <p>
                As previously mentioned in the Firewalls section, any ports on
                any server and/or virtual host not required for the operation of
                the {BRAND_NAME} Enterprise Connectivity Platform are disabled,
                eliminating additional opportunities for external intrusion.
              </p>
            </SubSection>
            <SubSection title="18.14. Security Patches">
              <p>
                {BRAND_NAME} has rigorous policies and procedures in place to
                update all components of the {BRAND_NAME} Enterprise
                Connectivity Platform, including operating systems, VM
                hypervisors, middleware, databases, etc., with their vendors'
                security patches.
              </p>
            </SubSection>
            <SubSection title="18.15. Data Retention">
              <p>
                Customer data is not stored for longer than it is needed. We
                require data about properties, bookings, and users to deliver
                accurate data visualizations and remove this data either upon
                request or after a period [30 days max] after the account is
                terminated.
              </p>
              <p>
                Data is also removed if deemed out of date or no longer valid.
                This can happen from removal of connected services, termination
                of accounts, or other events originating from connected service
                providers.
              </p>
              <p>
                Account data (Username, password, properties, channels &
                bookings) will be deleted within 30 days of account cancellation
                or on request.
              </p>
            </SubSection>
            <SubSection title="18.16. Conclusion">
              <p>
                Here at {BRAND_NAME}, we pride ourselves on the vigilance we
                employ to protect our customers' data assets, and we continually
                stress that a mature security organization requires coordinated
                dedication across technology, policy, procedures, and people.
                This dedication is underscored by the risk-based approach laid
                out in this document to demonstrate strength at every layer of
                security, minimizing any potential vulnerability or weakness.
              </p>
              <p>
                We want our customers to know their data is sufficiently
                protected by this approach and welcome the opportunity to
                discuss these practices and approaches further.
              </p>
            </SubSection>
          </PageSection>
        </div>
      </main>
      <BackToTop />
    </>
  );
}
