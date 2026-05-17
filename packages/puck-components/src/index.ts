// ─── Main Puck Configuration ────────────────────────────────────────────────
export { puckConfig } from "./puck-config";

// ─── Page Templates ─────────────────────────────────────────────────────────
export {
  pageTemplates,
  hospitalityTemplates,
  BLANK_TEMPLATE,
  getPageTemplate,
} from "./templates";
export type {
  PuckTemplate,
  PuckTemplateData,
  PuckTemplateNode,
} from "./templates";

// ─── Layout Components ─────────────────────────────────────────────────────
export { Container, containerConfig } from "./components/layout/Container";
export { Section, sectionConfig } from "./components/layout/Section";
export { Columns, columnsConfig } from "./components/layout/Columns";
export { Grid, gridConfig } from "./components/layout/Grid";
export { Spacer, spacerConfig } from "./components/layout/Spacer";
export { Divider, dividerConfig } from "./components/layout/Divider";
export { Separator, separatorConfig } from "./components/layout/Separator";
export { BentoGrid, bentoGridConfig } from "./components/layout/BentoGrid";
export { FlexBox, flexBoxConfig } from "./components/layout/FlexBox";

// ─── Typography Components ─────────────────────────────────────────────────
export { Heading, headingConfig } from "./components/typography/Heading";
export { Paragraph, paragraphConfig } from "./components/typography/Paragraph";
export { RichText, richTextConfig } from "./components/typography/RichText";
export { Badge, badgeConfig } from "./components/typography/Badge";
export { Avatar, avatarConfig } from "./components/typography/Avatar";

// ─── Hero Components ───────────────────────────────────────────────────────
export { Hero, heroConfig } from "./components/hero/Hero";
export { HeroSplit, heroSplitConfig } from "./components/hero/HeroSplit";

// ─── Content Components ────────────────────────────────────────────────────
export {
  TextWithImage,
  textWithImageConfig,
} from "./components/content/TextWithImage";
export {
  FeatureShowcase,
  featureShowcaseConfig,
} from "./components/content/FeatureShowcase";
export {
  FeatureCard,
  featureCardConfig,
} from "./components/content/FeatureCard";
export { StatsBar, statsBarConfig } from "./components/content/StatsBar";
export { Card, cardConfig } from "./components/content/Card";
export { Alert, alertConfig } from "./components/content/Alert";
export { IconBlock, iconBlockConfig } from "./components/content/IconBlock";
export {
  FeatureTable,
  featureTableConfig,
} from "./components/content/FeatureTable";
export { DataTable, dataTableConfig } from "./components/content/DataTable";
export {
  ContactForm,
  contactFormConfig,
  ContactSection,
  contactSectionConfig,
} from "./components/content/ContactSection";
export type {
  ContactFormProps,
  ContactSectionProps,
} from "./components/content/ContactSection";
export {
  ContactSectionRuntimeProvider,
  useContactSectionRuntime,
} from "./forms/contact-section-runtime";
export type {
  ContactRuntimeFormOption,
  ContactRuntimeNotification,
  ContactRuntimeResolvedForm,
  ContactRuntimeResolveParams,
  ContactRuntimeSubmitPayload,
  ContactSectionRuntimeValue,
} from "./forms/contact-section-runtime";

// ─── Media Components ──────────────────────────────────────────────────────
export { ImageBlock, imageBlockConfig } from "./components/media/ImageBlock";
export { VideoEmbed, videoEmbedConfig } from "./components/media/VideoEmbed";

// ─── CTA Components ────────────────────────────────────────────────────────
export { Button, buttonConfig } from "./components/cta/Button";
export { Link, linkConfig } from "./components/cta/Link";
export { ButtonGroup, buttonGroupConfig } from "./components/cta/ButtonGroup";
export { CTABanner, ctaBannerConfig } from "./components/cta/CTABanner";

// ─── Social Proof Components ───────────────────────────────────────────────
export {
  Testimonial,
  testimonialConfig,
} from "./components/social/Testimonial";
export { LogoCloud, logoCloudConfig } from "./components/social/LogoCloud";
export { Marquee, marqueeConfig } from "./components/social/Marquee";
export {
  TestimonialCarousel,
  testimonialCarouselConfig,
} from "./components/social/TestimonialCarousel";
export { QuoteCard, quoteCardConfig } from "./components/social/QuoteCard";

// ─── Pricing Components ────────────────────────────────────────────────────
export {
  PricingCard,
  pricingCardConfig,
} from "./components/pricing/PricingCard";
export {
  PricingTable,
  pricingTableConfig,
} from "./components/pricing/PricingTable";
export {
  ComparisonTable,
  comparisonTableConfig,
} from "./components/pricing/ComparisonTable";
export {
  PricingOnePlan,
  pricingOnePlanConfig,
} from "./components/pricing/PricingOnePlan";

// ─── Interactive Components ────────────────────────────────────────────────
export { FAQ, faqConfig } from "./components/interactive/FAQ";
export { Accordion, accordionConfig } from "./components/interactive/Accordion";
export { List, listConfig } from "./components/interactive/List";
export { StepList, stepListConfig } from "./components/interactive/StepList";
export { Tabs, tabsConfig } from "./components/interactive/Tabs";
export { Progress, progressConfig } from "./components/interactive/Progress";
export { Countdown, countdownConfig } from "./components/interactive/Countdown";

// ─── Navigation Components ─────────────────────────────────────────────────
export { Navbar, navbarConfig } from "./components/navigation/Navbar";
export type { NavbarProps } from "./components/navigation/Navbar";
export {
  LanguageSwitcher,
  languageSwitcherConfig,
} from "./components/navigation/LanguageSwitcher";
export type { LanguageSwitcherProps } from "./components/navigation/LanguageSwitcher";
export {
  LanguageSwitcherRuntimeProvider,
  useLanguageSwitcherRuntime,
} from "./i18n/language-switcher-runtime";
export type { LanguageSwitcherRuntimeValue } from "./i18n/language-switcher-runtime";
export { Footer, footerConfig } from "./components/navigation/Footer";
export type { FooterProps } from "./components/navigation/Footer";
export { Banner, bannerConfig } from "./components/navigation/Banner";
export {
  Breadcrumb,
  breadcrumbConfig,
} from "./components/navigation/Breadcrumb";

// ─── Hospitality Components ────────────────────────────────────────────────
export {
  AccommodationCard,
  accommodationCardConfig,
} from "./components/hospitality/AccommodationCard";
export type { AccommodationCardProps } from "./components/hospitality/AccommodationCard";
export {
  AccommodationGrid,
  accommodationGridConfig,
} from "./components/hospitality/AccommodationGrid";
export type { AccommodationGridProps } from "./components/hospitality/AccommodationGrid";
export {
  AmenitiesGrid,
  amenitiesGridConfig,
} from "./components/hospitality/AmenitiesGrid";
export type {
  AmenitiesGridProps,
  AmenityItem,
} from "./components/hospitality/AmenitiesGrid";
export {
  GallerySection,
  gallerySectionConfig,
} from "./components/hospitality/GallerySection";
export type {
  GallerySectionProps,
  GalleryImage,
} from "./components/hospitality/GallerySection";
export {
  DestinationGuide,
  destinationGuideConfig,
} from "./components/hospitality/DestinationGuide";
export type {
  DestinationGuideProps,
  GuideItem,
} from "./components/hospitality/DestinationGuide";
export {
  OfferCards,
  offerCardsConfig,
} from "./components/hospitality/OfferCards";
export type {
  OfferCardsProps,
  OfferItem,
  OfferInclusion,
} from "./components/hospitality/OfferCards";
export { HostStory, hostStoryConfig } from "./components/hospitality/HostStory";
export type { HostStoryProps } from "./components/hospitality/HostStory";
export {
  InquiryBand,
  inquiryBandConfig,
} from "./components/hospitality/InquiryBand";
export type { InquiryBandProps } from "./components/hospitality/InquiryBand";

// ─── Type Exports ──────────────────────────────────────────────────────────
export type { ContainerProps } from "./components/layout/Container";
export type { SectionProps } from "./components/layout/Section";
export type { ColumnsProps } from "./components/layout/Columns";
export type { GridProps } from "./components/layout/Grid";
export type { SpacerProps } from "./components/layout/Spacer";
export type { DividerProps } from "./components/layout/Divider";
export type { SeparatorProps } from "./components/layout/Separator";
export type { BentoGridProps } from "./components/layout/BentoGrid";
export type { HeadingProps } from "./components/typography/Heading";
export type { ParagraphProps } from "./components/typography/Paragraph";
export type { RichTextProps } from "./components/typography/RichText";
export type { BadgeProps } from "./components/typography/Badge";
export type { AvatarProps } from "./components/typography/Avatar";
export type { HeroProps } from "./components/hero/Hero";
export type { HeroSplitProps } from "./components/hero/HeroSplit";
export type { TextWithImageProps } from "./components/content/TextWithImage";
export type { FeatureCardProps } from "./components/content/FeatureCard";
export type { StatsBarProps } from "./components/content/StatsBar";
export type { CardProps } from "./components/content/Card";
export type { AlertProps } from "./components/content/Alert";
export type { IconBlockProps } from "./components/content/IconBlock";
export type { FeatureTableProps } from "./components/content/FeatureTable";
export type { DataTableProps } from "./components/content/DataTable";
export type { ImageBlockProps } from "./components/media/ImageBlock";
export type { VideoEmbedProps } from "./components/media/VideoEmbed";
export type { ButtonProps } from "./components/cta/Button";
export type { ButtonGroupProps } from "./components/cta/ButtonGroup";
export type { CTABannerProps } from "./components/cta/CTABanner";
export type { TestimonialProps } from "./components/social/Testimonial";
export type { LogoCloudProps } from "./components/social/LogoCloud";
export type { MarqueeProps } from "./components/social/Marquee";
export type { TestimonialCarouselProps } from "./components/social/TestimonialCarousel";
export type { QuoteCardProps } from "./components/social/QuoteCard";
export type { PricingCardProps } from "./components/pricing/PricingCard";
export type { PricingTableProps } from "./components/pricing/PricingTable";
export type { ComparisonTableProps } from "./components/pricing/ComparisonTable";
export type { PricingOnePlanProps } from "./components/pricing/PricingOnePlan";
export type { FAQProps } from "./components/interactive/FAQ";
export type { AccordionProps } from "./components/interactive/Accordion";
export type { ListProps } from "./components/interactive/List";
export type { StepListProps } from "./components/interactive/StepList";
export type { TabsProps } from "./components/interactive/Tabs";
export type { ProgressProps } from "./components/interactive/Progress";
export type { CountdownProps } from "./components/interactive/Countdown";
export type { BannerProps } from "./components/navigation/Banner";
export type { BreadcrumbProps } from "./components/navigation/Breadcrumb";

// ─── Emoji Picker ─────────────────────────────────────────────────────────
export { EmojiPickerField, emojiField, EMOJI_LIST } from "./lib/emoji-picker";
export { ImageAssetField, IMAGE_ASSET_PRESETS } from "./lib/image-asset-field";
export type { ImageAssetPreset } from "./lib/image-asset-field";

// ─── Utility Exports ──────────────────────────────────────────────────────
export { useScrollAnimation, AnimationWrapper } from "./lib/use-animation";
export * from "./lib/icons";
export { animationStyles } from "./lib/animations";
