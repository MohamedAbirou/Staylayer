export type PublicLegalDocumentKey =
  | "terms-of-service"
  | "privacy-policy"
  | "cookie-policy"
  | "gdpr-data-rights"
  | "data-processing-addendum"
  | "security-data-handling"
  | "subprocessors"
  | "data-retention";

export interface PublicLegalDocumentSection {
  title: string;
  paragraphs: string[];
}

export interface PublicLegalDocumentSummary {
  key: PublicLegalDocumentKey;
  slug: string;
  title: string;
  version: string;
  effectiveAt: string;
  summary: string;
  requiresAcceptanceAtSignup: boolean;
}

export interface PublicLegalDocument extends PublicLegalDocumentSummary {
  sections: PublicLegalDocumentSection[];
}

export const PUBLIC_LEGAL_DOCUMENTS: PublicLegalDocument[] = [
  {
    key: "terms-of-service",
    slug: "terms-of-service",
    title: "Terms of Service",
    version: "2026-05-11",
    effectiveAt: "2026-05-11T00:00:00.000Z",
    summary:
      "Commercial terms for using StayLayer to publish inquiry-first hospitality websites and manage workspace operations.",
    requiresAcceptanceAtSignup: true,
    sections: [
      {
        title: "Service scope",
        paragraphs: [
          "StayLayer provides customer workspaces for hospitality website publishing, direct inquiry collection, deployments, domains, and related operational tooling.",
          "Customer workspaces remain responsible for the property information, imagery, rates, policies, and inquiry responses published through the platform.",
        ],
      },
      {
        title: "Customer responsibilities",
        paragraphs: [
          "Customers must keep account credentials secure, maintain accurate guest-facing content, and ensure that inquiry routing destinations are monitored by an authorized team.",
          "Customers may not use the platform to publish unlawful, misleading, or infringing material or to collect guest information without a disclosed operational purpose.",
        ],
      },
      {
        title: "Commercial terms and suspension",
        paragraphs: [
          "Paid packaging, limits, and upgrade paths follow the public plan descriptions and billing terms in effect at the time of purchase or change.",
          "StayLayer may suspend workspace access for abuse, security incidents, or material non-payment, while following the documented billing and enforcement policy for subscription status changes.",
        ],
      },
      {
        title: "Termination and data handling",
        paragraphs: [
          "Customers may request workspace closure. Hosted data handling after closure follows the current retention and deletion policy published in the legal hub.",
          "These terms should receive legal review before production launch; version history is maintained so changes remain traceable.",
        ],
      },
    ],
  },
  {
    key: "privacy-policy",
    slug: "privacy-policy",
    title: "Privacy Policy",
    version: "2026-05-11",
    effectiveAt: "2026-05-11T00:00:00.000Z",
    summary:
      "How StayLayer processes customer-account data, workspace activity, and direct inquiry submissions routed through customer sites.",
    requiresAcceptanceAtSignup: true,
    sections: [
      {
        title: "Data categories",
        paragraphs: [
          "StayLayer processes account identifiers such as work email, authentication records, workspace membership data, site configuration, deployment metadata, and inquiry submissions routed by customer sites.",
          "Inquiry payloads are controlled by each customer workspace and may contain guest contact details, stay preferences, dates, and free-form messages.",
        ],
      },
      {
        title: "Why StayLayer processes data",
        paragraphs: [
          "Data is processed to provide workspace authentication, publish customer-controlled sites, route inquiries, monitor service health, and enforce plan limits and security controls.",
          "StayLayer does not need invented marketing metrics or testimonial data to operate the service and omits unsupported claims from the public funnel.",
        ],
      },
      {
        title: "Sharing and subprocessors",
        paragraphs: [
          "StayLayer may use infrastructure subprocessors for hosting, email delivery, observability, or payments. Current categories are listed in the Subprocessors document.",
          "Customer inquiry submissions are shared only with configured routing destinations, service providers required to deliver the platform, or legal authorities when required by law.",
        ],
      },
      {
        title: "Rights and review",
        paragraphs: [
          "Data-access, correction, deletion, and portability requests follow the GDPR and Data Rights process documented in the legal hub.",
          "This policy keeps a version history and should receive legal review before production launch.",
        ],
      },
    ],
  },
  {
    key: "cookie-policy",
    slug: "cookie-policy",
    title: "Cookie Policy",
    version: "2026-05-11",
    effectiveAt: "2026-05-11T00:00:00.000Z",
    summary:
      "Cookie and local-storage usage for authentication, product security, and consent-aware analytics in the marketing app and customer workspace.",
    requiresAcceptanceAtSignup: false,
    sections: [
      {
        title: "Essential platform storage",
        paragraphs: [
          "StayLayer uses security-sensitive cookies for refresh-token handling and may use browser storage for short-lived access tokens and workspace session state.",
          "These storage mechanisms are required for authentication continuity and workspace routing.",
        ],
      },
      {
        title: "Analytics and consent",
        paragraphs: [
          "The marketing app may collect privacy-aware funnel events only after the applicable cookie and consent rules have been satisfied.",
          "If analytics tooling is not configured, the marketing app should omit that collection rather than simulate it.",
        ],
      },
    ],
  },
  {
    key: "gdpr-data-rights",
    slug: "gdpr-data-rights",
    title: "GDPR and Data Rights",
    version: "2026-05-11",
    effectiveAt: "2026-05-11T00:00:00.000Z",
    summary:
      "How StayLayer handles access, correction, deletion, portability, and objection requests for customer-account and guest-inquiry data.",
    requiresAcceptanceAtSignup: false,
    sections: [
      {
        title: "Rights handling",
        paragraphs: [
          "StayLayer supports requests to access, correct, export, or delete personal data where required by applicable law.",
          "Requests involving guest inquiry data may require coordination with the customer workspace that controls the underlying site and routing rules.",
        ],
      },
      {
        title: "Verification and timing",
        paragraphs: [
          "StayLayer may verify requestor identity before releasing or deleting protected data.",
          "Response timing depends on the scope of the request, the systems involved, and any legal retention obligations that still apply.",
        ],
      },
    ],
  },
  {
    key: "data-processing-addendum",
    slug: "data-processing-addendum",
    title: "Data Processing Addendum",
    version: "2026-05-11",
    effectiveAt: "2026-05-11T00:00:00.000Z",
    summary:
      "Controller-processor allocation for customer workspaces using StayLayer to host content and route direct guest inquiries.",
    requiresAcceptanceAtSignup: false,
    sections: [
      {
        title: "Roles",
        paragraphs: [
          "For customer workspace and inquiry-routing operations, the customer is typically the controller for guest-submitted content and StayLayer acts as a processor for the hosted service components.",
          "StayLayer remains an independent controller for limited account, billing, fraud-prevention, and security records necessary to operate the platform.",
        ],
      },
      {
        title: "Security and subprocessors",
        paragraphs: [
          "StayLayer applies technical and organizational measures described in the Security and Data Handling document and may rely on vetted subprocessors listed in the Subprocessors document.",
          "Customers should review this addendum with counsel before live deployment if their organization requires a signed processor addendum.",
        ],
      },
    ],
  },
  {
    key: "security-data-handling",
    slug: "security-data-handling",
    title: "Security and Data Handling",
    version: "2026-05-11",
    effectiveAt: "2026-05-11T00:00:00.000Z",
    summary:
      "Operational security posture for authentication, hosting, deployment, and inquiry-data handling inside StayLayer.",
    requiresAcceptanceAtSignup: false,
    sections: [
      {
        title: "Access and authentication",
        paragraphs: [
          "Workspace access is protected through authentication controls, session security, membership roles, and separate support access paths.",
          "The customer-facing site is kept separate from internal support access so the public journey does not become the entry point for platform administration.",
        ],
      },
      {
        title: "Operational controls",
        paragraphs: [
          "StayLayer uses rate limiting, audit logging, deployment tracking, and domain-status monitoring to reduce abuse and improve operational traceability.",
          "A formal breach-notification SLA is still being finalized and will be published in the legal hub when approved.",
        ],
      },
      {
        title: "Data minimization",
        paragraphs: [
          "Public marketing surfaces omit unsupported customer claims, fake testimonials, and unverified metrics.",
          "Only customer-facing pricing, legal, and marketing information is published in the public site.",
        ],
      },
    ],
  },
  {
    key: "subprocessors",
    slug: "subprocessors",
    title: "Subprocessors",
    version: "2026-05-11",
    effectiveAt: "2026-05-11T00:00:00.000Z",
    summary:
      "Current infrastructure subprocessor categories used to operate StayLayer.",
    requiresAcceptanceAtSignup: false,
    sections: [
      {
        title: "Current categories",
        paragraphs: [
          "Hosting and edge delivery providers for StayLayer applications and customer websites.",
          "Transactional email providers for notifications and any future verification or password-reset delivery.",
          "Payment providers for subscription checkout and billing-portal operations.",
        ],
      },
      {
        title: "Change management",
        paragraphs: [
          "This registry keeps a version history so additions or removals can be published cleanly over time.",
          "Provider-specific names and regions still require human review before production publication.",
        ],
      },
    ],
  },
  {
    key: "data-retention",
    slug: "data-retention",
    title: "Data Retention and Deletion",
    version: "2026-05-11",
    effectiveAt: "2026-05-11T00:00:00.000Z",
    summary:
      "Retention expectations for active workspaces, inquiry submissions, audit history, and deleted tenant data.",
    requiresAcceptanceAtSignup: false,
    sections: [
      {
        title: "Active workspace data",
        paragraphs: [
          "Workspace content, settings, inquiry submissions, and operational metadata are retained while the customer actively uses the service and until deletion is requested or required.",
          "Audit logs may be retained longer than editable site content where necessary for security review, billing evidence, or abuse investigation.",
        ],
      },
      {
        title: "Deletion lifecycle",
        paragraphs: [
          "Tenant closure and data deletion require operational review because downstream providers and backups may involve staged deletion rather than immediate erasure.",
          "The precise operational retention window remains a human review item and should be finalized before production launch.",
        ],
      },
    ],
  },
];

export function listPublicLegalDocuments(): PublicLegalDocumentSummary[] {
  return PUBLIC_LEGAL_DOCUMENTS.map(({ sections: _sections, ...summary }) => ({
    ...summary,
  }));
}

export function getPublicLegalDocument(
  slug: string,
): PublicLegalDocument | undefined {
  return PUBLIC_LEGAL_DOCUMENTS.find((document) => document.slug === slug);
}

export function getRequiredSignupLegalDocuments(): PublicLegalDocumentSummary[] {
  return listPublicLegalDocuments().filter(
    (document) => document.requiresAcceptanceAtSignup,
  );
}
