import type { Config } from "@puckeditor/core";
import type { ReactNode } from "react";

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
import { contactSectionConfig } from "./components/content/ContactSection";
import { annualReportSectionConfig } from "./components/content/AnnualReportSection";

// ─── Media ──────────────────────────────────────────────────────────────────
import { imageBlockConfig } from "./components/media/ImageBlock";
import { videoEmbedConfig } from "./components/media/VideoEmbed";

// ─── CTA ────────────────────────────────────────────────────────────────────
import { buttonConfig } from "./components/cta/Button";
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

// ─── Navigation ─────────────────────────────────────────────────────────────
import { navbarConfig } from "./components/navigation/Navbar";
import { footerConfig } from "./components/navigation/Footer";
import { bannerConfig } from "./components/navigation/Banner";
import { breadcrumbConfig } from "./components/navigation/Breadcrumb";

// ─── Custom Fields for Root ─────────────────────────────────────────────────
import { colorFieldRender } from "./lib/fields";

// ─── Animation Styles ──────────────────────────────────────────────────────
import { animationStyles } from "./lib/animations";

// ─── Puck Config ────────────────────────────────────────────────────────────
export const puckConfig: Config = {
  root: {
    fields: {
      title: {
        type: "text",
        label: "Page Title",
      },
      seoTitle: {
        type: "text",
        label: "SEO Title",
      },
      seoDescription: {
        type: "textarea",
        label: "SEO Description",
      },
      seoKeywords: {
        type: "text",
        label: "SEO Keywords (comma-separated)",
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
        options: [
          { label: "System Default", value: "system" },
          { label: "Inter", value: "Inter" },
          { label: "Plus Jakarta Sans", value: "'Plus Jakarta Sans'" },
          { label: "DM Sans", value: "'DM Sans'" },
        ],
      },
    },
    defaultProps: {
      title: "",
      seoTitle: "",
      seoDescription: "",
      seoKeywords: "",
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
    }) => (
      <div
        className="min-h-full bg-(--bg) [font-family:var(--font)]"
        style={
          {
            "--bg": backgroundColor || "#ffffff",
            "--font":
              fontFamily === "system"
                ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                : `${fontFamily || "system-ui"}, sans-serif`,
          } as React.CSSProperties
        }
      >
        <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
        {children}
      </div>
    ),
  },

  categories: {
    navigation: {
      title: "Navigation",
      components: ["Navbar", "Footer", "Banner", "Breadcrumb"],
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
        "ContactSection",
        "AnnualReportSection",
      ],
    },
    media: {
      title: "Media",
      components: ["Image", "Video"],
    },
    cta: {
      title: "Calls to Action",
      components: ["Button", "ButtonGroup", "CTABanner"],
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

  components: {
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
    ContactSection: contactSectionConfig,
    AnnualReportSection: annualReportSectionConfig,

    // Media
    Image: imageBlockConfig,
    Video: videoEmbedConfig,

    // CTA
    Button: buttonConfig,
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
    Footer: footerConfig,
    Banner: bannerConfig,
    Breadcrumb: breadcrumbConfig,
  },
};
