import type { Config } from "@puckeditor/core";
import type { ReactNode } from "react";
import {
  fontFamilyOptions,
  googleFontsStylesheetUrl,
  resolveFontFamilyCss,
} from "./lib/fonts";

// ─── Layout ─────────────────────────────────────────────────────────────────
import { containerConfig } from "./components/layout/Container";
import { sectionConfig } from "./components/layout/Section";
import { columnsConfig } from "./components/layout/Columns";
import { gridConfig } from "./components/layout/Grid";
import { spacerConfig } from "./components/layout/Spacer";
import { dividerConfig } from "./components/layout/Divider";
import { separatorConfig } from "./components/layout/Separator";
import { bentoGridConfig } from "./components/layout/BentoGrid";
import { flexBoxConfig } from "./components/layout/FlexBox";

// ─── Typography ─────────────────────────────────────────────────────────────
import { headingConfig } from "./components/typography/Heading";
import { paragraphConfig } from "./components/typography/Paragraph";
import { richTextConfig } from "./components/typography/RichText";
import { badgeConfig } from "./components/typography/Badge";
import { avatarConfig } from "./components/typography/Avatar";

// ─── Hero ───────────────────────────────────────────────────────────────────
import { heroConfig } from "./components/hero/Hero";
import { heroSplitConfig } from "./components/hero/HeroSplit";

// ─── Content ────────────────────────────────────────────────────────────────
import { textWithImageConfig } from "./components/content/TextWithImage";
import { featureCardConfig } from "./components/content/FeatureCard";
import { featureShowcaseConfig } from "./components/content/FeatureShowcase";
import { statsBarConfig } from "./components/content/StatsBar";
import { cardConfig } from "./components/content/Card";
import { alertConfig } from "./components/content/Alert";
import { iconBlockConfig } from "./components/content/IconBlock";
import { featureTableConfig } from "./components/content/FeatureTable";
import { dataTableConfig } from "./components/content/DataTable";
import {
  contactFormConfig,
  contactSectionConfig,
} from "./components/content/ContactSection";

// ─── Media ──────────────────────────────────────────────────────────────────
import { imageBlockConfig } from "./components/media/ImageBlock";
import { videoEmbedConfig } from "./components/media/VideoEmbed";

// ─── CTA ────────────────────────────────────────────────────────────────────
import { buttonConfig } from "./components/cta/Button";
import { linkConfig } from "./components/cta/Link";
import { buttonGroupConfig } from "./components/cta/ButtonGroup";
import { ctaBannerConfig } from "./components/cta/CTABanner";

// ─── Social Proof ───────────────────────────────────────────────────────────
import { testimonialConfig } from "./components/social/Testimonial";
import { logoCloudConfig } from "./components/social/LogoCloud";
import { marqueeConfig } from "./components/social/Marquee";
import { testimonialCarouselConfig } from "./components/social/TestimonialCarousel";
import { quoteCardConfig } from "./components/social/QuoteCard";

// ─── Pricing ────────────────────────────────────────────────────────────────
import { pricingCardConfig } from "./components/pricing/PricingCard";
import { pricingTableConfig } from "./components/pricing/PricingTable";
import { comparisonTableConfig } from "./components/pricing/ComparisonTable";
import { pricingOnePlanConfig } from "./components/pricing/PricingOnePlan";

// ─── Interactive ────────────────────────────────────────────────────────────
import { faqConfig } from "./components/interactive/FAQ";
import { accordionConfig } from "./components/interactive/Accordion";
import { listConfig } from "./components/interactive/List";
import { stepListConfig } from "./components/interactive/StepList";
import { tabsConfig } from "./components/interactive/Tabs";
import { progressConfig } from "./components/interactive/Progress";
import { countdownConfig } from "./components/interactive/Countdown";

// ─── Hospitality ────────────────────────────────────────────────────────────
import { accommodationCardConfig } from "./components/hospitality/AccommodationCard";
import { accommodationGridConfig } from "./components/hospitality/AccommodationGrid";
import { amenitiesGridConfig } from "./components/hospitality/AmenitiesGrid";
import { gallerySectionConfig } from "./components/hospitality/GallerySection";
import { destinationGuideConfig } from "./components/hospitality/DestinationGuide";
import { offerCardsConfig } from "./components/hospitality/OfferCards";
import { hostStoryConfig } from "./components/hospitality/HostStory";
import { inquiryBandConfig } from "./components/hospitality/InquiryBand";

// ─── Navigation ─────────────────────────────────────────────────────────────
import { navbarConfig } from "./components/navigation/Navbar";
import { footerConfig } from "./components/navigation/Footer";
import { bannerConfig } from "./components/navigation/Banner";
import { breadcrumbConfig } from "./components/navigation/Breadcrumb";
import { languageSwitcherConfig } from "./components/navigation/LanguageSwitcher";

// ─── Custom Fields for Root ─────────────────────────────────────────────────
import { colorFieldRender, withMarkupHintsForComponents } from "./lib/fields";

// ─── Animation Styles ──────────────────────────────────────────────────────
import { animationStyles } from "./lib/animations";

const components = withMarkupHintsForComponents({
  // Layout
  Container: containerConfig,
  Section: sectionConfig,
  Columns: columnsConfig,
  FlexBox: flexBoxConfig,
  Grid: gridConfig,
  BentoGrid: bentoGridConfig,
  Spacer: spacerConfig,
  Divider: dividerConfig,
  Separator: separatorConfig,
  Card: cardConfig,

  // Typography
  Heading: headingConfig,
  Paragraph: paragraphConfig,
  RichText: richTextConfig,
  Badge: badgeConfig,
  Avatar: avatarConfig,
  List: listConfig,

  // Hero
  Hero: heroConfig,
  HeroSplit: heroSplitConfig,

  // Content
  TextWithImage: textWithImageConfig,
  FeatureShowcase: featureShowcaseConfig,
  FeatureCard: featureCardConfig,
  StatsBar: statsBarConfig,
  FeatureTable: featureTableConfig,
  DataTable: dataTableConfig,
  Alert: alertConfig,
  IconBlock: iconBlockConfig,
  ContactForm: contactFormConfig,
  ContactSection: contactSectionConfig,

  // Media
  Image: imageBlockConfig,
  Video: videoEmbedConfig,

  // CTA
  Button: buttonConfig,
  Link: linkConfig,
  ButtonGroup: buttonGroupConfig,
  CTABanner: ctaBannerConfig,

  // Social Proof
  Testimonial: testimonialConfig,
  TestimonialCarousel: testimonialCarouselConfig,
  QuoteCard: quoteCardConfig,
  LogoCloud: logoCloudConfig,
  Marquee: marqueeConfig,

  // Pricing
  PricingCard: pricingCardConfig,
  PricingTable: pricingTableConfig,
  ComparisonTable: comparisonTableConfig,
  PricingOnePlan: pricingOnePlanConfig,

  // Interactive
  FAQ: faqConfig,
  Accordion: accordionConfig,
  StepList: stepListConfig,
  Tabs: tabsConfig,
  Progress: progressConfig,
  Countdown: countdownConfig,

  // Navigation
  Navbar: navbarConfig,
  LanguageSwitcher: languageSwitcherConfig,
  Footer: footerConfig,
  Banner: bannerConfig,
  Breadcrumb: breadcrumbConfig,

  // Hospitality
  AccommodationCard: accommodationCardConfig,
  AccommodationGrid: accommodationGridConfig,
  AmenitiesGrid: amenitiesGridConfig,
  GallerySection: gallerySectionConfig,
  DestinationGuide: destinationGuideConfig,
  OfferCards: offerCardsConfig,
  HostStory: hostStoryConfig,
  InquiryBand: inquiryBandConfig,
});

// ─── Puck Config ────────────────────────────────────────────────────────────
export const puckConfig: Config = {
  root: {
    fields: {
      title: {
        type: "text",
        label: "Page Title",
      },
      backgroundColor: {
        type: "custom",
        label: "Page Background",
        render: ({
          value,
          onChange,
        }: {
          value: any;
          onChange: (v: any) => void;
        }) => colorFieldRender(value, onChange),
      },
      fontFamily: {
        type: "select",
        label: "Font Family",
        options: fontFamilyOptions(),
      },
    },
    defaultProps: {
      title: "",
      backgroundColor: "#ffffff",
      fontFamily: "Inter",
    },
    render: ({
      children,
      backgroundColor,
      fontFamily,
    }: {
      children: ReactNode;
      backgroundColor?: string;
      fontFamily?: string;
      [key: string]: unknown;
    }) => {
      const stylesheetHref = googleFontsStylesheetUrl(fontFamily);
      return (
        <div
          className="min-h-full bg-(--bg) [font-family:var(--font)]"
          style={
            {
              "--bg": backgroundColor || "#ffffff",
              "--font": resolveFontFamilyCss(fontFamily),
            } as React.CSSProperties
          }
        >
          {stylesheetHref ? (
            <link rel="stylesheet" href={stylesheetHref} />
          ) : null}
          <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
          {children}
        </div>
      );
    },
  },

  categories: {
    hospitality: {
      title: "Hospitality Sections",
      components: [
        "AccommodationGrid",
        "AmenitiesGrid",
        "GallerySection",
        "DestinationGuide",
        "OfferCards",
        "HostStory",
        "InquiryBand",
        "AccommodationCard",
      ],
      defaultExpanded: true,
    },
    navigation: {
      title: "Navigation",
      components: [
        "Navbar",
        "LanguageSwitcher",
        "Footer",
        "Banner",
        "Breadcrumb",
      ],
      defaultExpanded: true,
    },
    layout: {
      title: "Layout",
      components: [
        "Container",
        "Section",
        "Columns",
        "FlexBox",
        "Grid",
        "BentoGrid",
        "Spacer",
        "Divider",
        "Separator",
        "Card",
      ],
      defaultExpanded: true,
    },
    typography: {
      title: "Typography",
      components: [
        "Heading",
        "Paragraph",
        "RichText",
        "Badge",
        "Avatar",
        "List",
      ],
    },
    hero: {
      title: "Hero Sections",
      components: ["Hero", "HeroSplit"],
    },
    content: {
      title: "Content",
      components: [
        "TextWithImage",
        "FeatureShowcase",
        "FeatureCard",
        "StatsBar",
        "FeatureTable",
        "DataTable",
        "Alert",
        "IconBlock",
        "ContactForm",
        "ContactSection",
      ],
    },
    media: {
      title: "Media",
      components: ["Image", "Video"],
    },
    cta: {
      title: "Calls to Action",
      components: ["Button", "Link", "ButtonGroup", "CTABanner"],
    },
    social: {
      title: "Social Proof",
      components: [
        "Testimonial",
        "TestimonialCarousel",
        "QuoteCard",
        "LogoCloud",
        "Marquee",
      ],
    },
    pricing: {
      title: "Pricing",
      components: [
        "PricingCard",
        "PricingTable",
        "ComparisonTable",
        "PricingOnePlan",
      ],
    },
    interactive: {
      title: "Interactive",
      components: [
        "FAQ",
        "Accordion",
        "StepList",
        "Tabs",
        "Progress",
        "Countdown",
      ],
    },
  },
  components,
};
