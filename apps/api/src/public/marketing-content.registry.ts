export const MARKETING_CONTENT = {
  generatedAt: new Date().toISOString(),
  brand: {
    name: "StayLayer",
    eyebrow: "Hospitality website operations",
    tagline:
      "Direct websites and calm inquiry operations for hospitality brands.",
  },
  navigation: [
    { label: "Platform", href: "/platform" },
    { label: "Pricing", href: "/pricing" },
    { label: "Solutions", href: "/solutions" },
    { label: "Showcase", href: "/showcase" },
    { label: "Security", href: "/security" },
    { label: "Legal", href: "/legal" },
  ],
  footer: {
    productLinks: [
      { label: "Platform", href: "/platform" },
      { label: "Pricing", href: "/pricing" },
      { label: "Showcase", href: "/showcase" },
      { label: "Contact", href: "/contact" },
    ],
    legalLinks: [
      { label: "Terms", href: "/legal/terms-of-service" },
      { label: "Privacy", href: "/legal/privacy-policy" },
      { label: "Cookies", href: "/legal/cookie-policy" },
      { label: "Security", href: "/legal/security-data-handling" },
    ],
  },
  home: {
    hero: {
      heading:
        "Launch a direct hospitality website without adding operational chaos.",
      body: "StayLayer gives you a polished brand site, a private team workspace, and a live guest website that stay aligned as you publish pages, collect inquiries, and grow direct demand.",
      primaryCta: { label: "Start free", href: "/register" },
      secondaryCta: { label: "See pricing", href: "/pricing" },
    },
    pillars: [
      {
        title: "Inquiry-first by design",
        body: "Pages, CTAs, and forms are built around direct guest inquiries instead of forcing every stay through an instant-booking funnel.",
      },
      {
        title: "Brand-first guest experience",
        body: "Custom domains, multilingual pages, and clean templates keep the guest experience fully your own from first visit to first inquiry.",
      },
      {
        title: "One calm workspace for the team",
        body: "Publishing, forms, domains, translations, and billing live in one place so your team can move quickly without tool sprawl.",
      },
    ],
    bands: [
      {
        title: "Launch with hospitality-native structure",
        body: "Templates, page layouts, and site settings are shaped for villas, boutique stays, B&Bs, guest houses, and glamping brands.",
      },
      {
        title: "Keep every guest request clear",
        body: "Inquiry forms, response routing, and follow-up ownership stay visible so no lead disappears into a messy inbox chain.",
      },
      {
        title: "Move from signup to go-live cleanly",
        body: "Create your workspace, shape your site, and step into launch without bouncing between disconnected tools or fake demos.",
      },
    ],
    faqs: [
      {
        question: "Can I start free and upgrade later?",
        answer:
          "Yes. The free workspace is designed for setup, early content work, and initial validation. You can move to a paid plan when you are ready to launch with more capacity.",
      },
      {
        question: "Do I need a developer to launch?",
        answer:
          "No. StayLayer is built for operators and small teams who want to publish, manage inquiries, and run a direct website without engineering overhead.",
      },
      {
        question: "Can I run multiple languages and custom domains?",
        answer:
          "Yes. Paid plans expand language coverage, domains, seats, and analytics so the guest experience can grow with the business.",
      },
    ],
  },
  platform: {
    intro:
      "StayLayer keeps the public brand site, the private team workspace, and the live guest website clearly separated so each part stays simple for guests and for your team.",
    capabilities: [
      "A private workspace for content, forms, domains, translations, SEO, and billing",
      "A guest-facing website that stays focused on your brand and your inquiry flow",
      "A clear public journey for pricing, trust, login, signup, and plan selection",
      "Structured access so owners, editors, billing contacts, and support teams stay in the right lanes",
    ],
  },
  solutions: [
    {
      slug: "villa",
      title: "Villas",
      body: "Support private-stay discovery, direct guest questions, and multilingual storytelling without forcing a resort-style booking funnel.",
    },
    {
      slug: "boutique-hotel",
      title: "Boutique Hotels",
      body: "Coordinate richer page structures, stronger operational roles, and higher inquiry volume without splitting the site stack across tools.",
    },
    {
      slug: "bnb",
      title: "B&Bs",
      body: "Keep the guest journey personal with lean publishing, direct contact flows, and simple owner-managed setup.",
    },
    {
      slug: "guest-house",
      title: "Guest Houses",
      body: "Run a branded site that communicates availability, policies, and location context clearly for shorter sales cycles.",
    },
    {
      slug: "glamping",
      title: "Glamping",
      body: "Show cabin, tent, and retreat inventory with an inquiry-first structure that works for add-ons, group stays, and seasonal demand.",
    },
  ],
  showcase: [
    {
      id: "private-villa-brand",
      title: "Private villa brand",
      category: "Vacation rental",
      localeFootprint: ["en", "es"],
      summary:
        "A direct villa website with multilingual guest pages, active domain setup, and a clear inquiry journey.",
      highlights: [
        "8 published pages",
        "2 guest languages",
        "Active custom domain",
      ],
      proof:
        "Published pages, live deployment, and guest-ready domain setup confirmed on the platform.",
      privacy: "Brand identity and domain are hidden by design.",
    },
    {
      id: "glamping-retreat-brand",
      title: "Glamping retreat brand",
      category: "Glamping",
      localeFootprint: ["en", "de"],
      summary:
        "A slower-decision guest journey for cabins and retreat stays with multilingual content and direct planning inquiries.",
      highlights: [
        "6 published pages",
        "2 guest languages",
        "Group inquiry flow",
      ],
      proof:
        "Published guest pages and live site structure confirmed while protecting the client identity.",
      privacy:
        "Identifying brand details are intentionally removed from this public story.",
    },
  ],
  security: {
    heading: "Trust the operating model, not the slogan.",
    body: "StayLayer keeps the public site, team workspace, and live guest website intentionally separated so customer operations stay private and the guest journey stays clean.",
    highlights: [
      "Role-based separation for owners, editors, billing contacts, and support teams",
      "Rate-limited public login, signup, and contact entry points",
      "Audit trails for important workspace and site changes",
      "Published legal documents and clear data-handling policies",
    ],
  },
  contact: {
    heading: "Tell us about your brand and launch goals.",
    body: "Use the form below if you want help choosing a plan, planning a migration, or preparing a multi-property rollout.",
    contactEmail: null,
    contactEmailConfigured: false,
  },
} as const;
