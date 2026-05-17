/**
 * Hospitality page templates.
 *
 * Each template is a ready-to-use Puck `Data` snapshot a new page can be
 * seeded with. Components are referenced by their Puck registry keys
 * (see `puck-config.tsx`). We only override what makes the template feel
 * distinct — every other prop falls back to the component's hospitality
 * defaults so customers get tasteful copy out of the box.
 *
 * Stable per-node ids are filled in server-side by `ensurePuckNodeIds`
 * (in `apps/dashboard/src/api/pages.ts`), so templates can omit them.
 */

export type PuckTemplateNode = {
  type: string;
  props: Record<string, unknown>;
};

export type PuckTemplateData = {
  content: PuckTemplateNode[];
  root: { props: Record<string, unknown> };
  zones?: Record<string, PuckTemplateNode[]>;
};

export type PuckTemplate = {
  id: string;
  label: string;
  description: string;
  suggestedSlug: string;
  suggestedTitle: string;
  puckData: PuckTemplateData;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const primaryButton = (label: string, url: string) => ({
  type: "Button",
  props: {
    label,
    url,
    variant: "primary",
    size: "lg",
    rounded: "full",
    icon: "none",
    iconPosition: "right",
    fullWidth: false,
    shadow: "none",
    openInNewTab: false,
  },
});

// ─── 1. Boutique lodge — Homepage ───────────────────────────────────────────

const boutiqueLodgeHome: PuckTemplate = {
  id: "boutique-lodge-home",
  label: "Boutique lodge — Homepage",
  description:
    "Hero photo, rooms, amenities, gallery, host story, offers, inquiry. Built for a multi-room lodge.",
  suggestedSlug: "home",
  suggestedTitle: "Home",
  puckData: {
    content: [
      { type: "Navbar", props: {} },
      {
        type: "Hero",
        props: {
          preset: "lifestyle-photo",
          heading: "Pine Hollow Lodge — a quiet escape, framed by forest",
          subheading:
            "Six light-filled rooms, two cabins, and breakfast on the porch. Hosted in person by Anna and Theo.",
          actions: [primaryButton("Check availability", "#inquiry")],
        },
      },
      {
        type: "AccommodationGrid",
        props: {
          eyebrow: "Stay with us",
          heading: "Choose your room or cabin",
          description:
            "Each room is hand-finished, with linen sheets, slow coffee on arrival, and views of either the garden or the pine ridge.",
        },
      },
      { type: "AmenitiesGrid", props: {} },
      {
        type: "GallerySection",
        props: {
          eyebrow: "The property",
          heading: "Mornings, afternoons, evenings",
        },
      },
      { type: "HostStory", props: {} },
      {
        type: "OfferCards",
        props: {
          eyebrow: "Direct stay perks",
          heading: "Better when you book with us",
        },
      },
      {
        type: "DestinationGuide",
        props: {
          eyebrow: "The area",
          heading: "Five minutes from our door",
        },
      },
      {
        type: "InquiryBand",
        props: {
          preset: undefined,
          heading: "Plan your stay with a real person",
          description:
            "Tell us your dates and what kind of stay you have in mind. We usually reply within a couple of hours.",
        },
      },
      { type: "Footer", props: {} },
    ],
    root: { props: { title: "Pine Hollow Lodge — Home" } },
  },
};

// ─── 2. Villa / single-property rental — Homepage ───────────────────────────

const villaRentalHome: PuckTemplate = {
  id: "villa-rental-home",
  label: "Villa rental — Single-property homepage",
  description:
    "Story-led hero split, single accommodation card, gallery, local guide, inquiry. Built for one property.",
  suggestedSlug: "home",
  suggestedTitle: "Home",
  puckData: {
    content: [
      { type: "Navbar", props: {} },
      {
        type: "HeroSplit",
        props: {
          preset: "minimal-editorial",
          heading: "Casa dei Pini — your own villa above the bay",
          subheading:
            "A four-bedroom stone house with a private garden, sea breeze, and a host who picks you up at the station.",
          actions: [primaryButton("Request the villa", "#inquiry")],
        },
      },
      {
        type: "AccommodationCard",
        props: {
          variant: "image-first",
          eyebrow: "The villa",
          title: "Casa dei Pini",
          pricePrefix: "From",
          priceAmount: "€420",
          priceSuffix: "/ night",
          ctaLabel: "Send inquiry",
          ctaUrl: "#inquiry",
        },
      },
      { type: "AmenitiesGrid", props: { variant: "tinted" } },
      {
        type: "GallerySection",
        props: {
          variant: "feature",
          eyebrow: "Inside Casa dei Pini",
          heading: "Spaces designed for slow days",
        },
      },
      {
        type: "DestinationGuide",
        props: {
          variant: "cards",
          eyebrow: "The coast",
          heading: "Where the locals go",
        },
      },
      {
        type: "InquiryBand",
        props: {
          heading: "Tell us about your stay",
          description:
            "Dates, group size, anything special — we'll get back to you personally.",
        },
      },
      { type: "Footer", props: {} },
    ],
    root: { props: { title: "Casa dei Pini" } },
  },
};

// ─── 3. Accommodation detail page ───────────────────────────────────────────

const accommodationDetail: PuckTemplate = {
  id: "accommodation-detail",
  label: "Accommodation — Room or suite detail",
  description:
    "Hero split with the room photo, amenities, room gallery, room-specific offers, inquiry.",
  suggestedSlug: "/rooms/garden-suite",
  suggestedTitle: "Garden Suite",
  puckData: {
    content: [
      { type: "Navbar", props: {} },
      { type: "Breadcrumb", props: {} },
      {
        type: "HeroSplit",
        props: {
          preset: "lifestyle-photo",
          heading: "Garden Suite — private terrace, slow mornings",
          subheading:
            "Our largest room, looking onto the walled garden. King bed, deep tub, breakfast outside when the weather is kind.",
          actions: [primaryButton("Reserve this room", "#inquiry")],
        },
      },
      {
        type: "AmenitiesGrid",
        props: {
          variant: "minimal",
          eyebrow: "In this room",
          heading: "What's included",
        },
      },
      {
        type: "GallerySection",
        props: {
          variant: "grid",
          eyebrow: "Inside the Garden Suite",
          heading: "A closer look",
        },
      },
      {
        type: "OfferCards",
        props: {
          eyebrow: "Stay longer",
          heading: "Direct booking perks for this room",
        },
      },
      {
        type: "InquiryBand",
        props: {
          variant: "compact",
          heading: "Reserve the Garden Suite",
          description:
            "Send us your dates and we'll confirm availability and total in the same email.",
        },
      },
      { type: "Footer", props: {} },
    ],
    root: { props: { title: "Garden Suite" } },
  },
};

// ─── 4. Contact / Inquiry page ──────────────────────────────────────────────

const contactInquiry: PuckTemplate = {
  id: "contact-inquiry",
  label: "Contact & inquiry page",
  description:
    "Inquiry band on top, full contact form below. The page guests land on from your nav.",
  suggestedSlug: "/contact",
  suggestedTitle: "Contact",
  puckData: {
    content: [
      { type: "Navbar", props: {} },
      {
        type: "InquiryBand",
        props: {
          variant: "split",
          heading: "Plan your stay with us directly",
          description:
            "We answer every inquiry personally, usually within a couple of hours.",
        },
      },
      { type: "ContactSection", props: {} },
      { type: "Footer", props: {} },
    ],
    root: { props: { title: "Contact" } },
  },
};

// ─── 5. Local guide page ────────────────────────────────────────────────────

const localGuide: PuckTemplate = {
  id: "local-guide",
  label: "Local guide page",
  description:
    "Editorial hero, destination guide cards, inquiry band. Helps guests fall in love with the area.",
  suggestedSlug: "/guide",
  suggestedTitle: "The area",
  puckData: {
    content: [
      { type: "Navbar", props: {} },
      {
        type: "Hero",
        props: {
          preset: "minimal-editorial",
          heading: "Where to go, what to eat, when to visit",
          subheading:
            "A hand-picked guide from your hosts — the trails, tables, and quiet hours we'd send our own friends to.",
          minHeight: "md",
        },
      },
      {
        type: "DestinationGuide",
        props: {
          variant: "with-image",
          eyebrow: "Eat & drink",
          heading: "Tables we love",
        },
      },
      {
        type: "DestinationGuide",
        props: {
          variant: "list",
          eyebrow: "Outdoors",
          heading: "Trails, beaches, ridges",
        },
      },
      {
        type: "InquiryBand",
        props: {
          variant: "calm",
          heading: "Coming to stay? We'll help plan the rest.",
          description:
            "Tell us your dates and what you'd love to do — we'll put together a small itinerary with your booking.",
        },
      },
      { type: "Footer", props: {} },
    ],
    root: { props: { title: "Local guide" } },
  },
};

// ─── Blank ─────────────────────────────────────────────────────────────────

export const BLANK_TEMPLATE: PuckTemplate = {
  id: "blank",
  label: "Blank page",
  description: "Start from an empty page and drag sections in yourself.",
  suggestedSlug: "",
  suggestedTitle: "",
  puckData: {
    content: [],
    root: { props: { title: "" } },
  },
};

// ─── Exported list ─────────────────────────────────────────────────────────

export const hospitalityTemplates: PuckTemplate[] = [
  boutiqueLodgeHome,
  villaRentalHome,
  accommodationDetail,
  contactInquiry,
  localGuide,
];

export const pageTemplates: PuckTemplate[] = [
  BLANK_TEMPLATE,
  ...hospitalityTemplates,
];

export function getPageTemplate(id: string): PuckTemplate | undefined {
  return pageTemplates.find((t) => t.id === id);
}
