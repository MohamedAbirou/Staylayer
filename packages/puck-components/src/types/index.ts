// Types are now co-located with their components.
// Re-export them from the component files for convenience.

export type { ContainerProps } from "../components/layout/Container";
export type { SectionProps } from "../components/layout/Section";
export type { ColumnsProps } from "../components/layout/Columns";
export type { GridProps } from "../components/layout/Grid";
export type { SpacerProps } from "../components/layout/Spacer";
export type { DividerProps } from "../components/layout/Divider";
export type { HeadingProps } from "../components/typography/Heading";
export type { ParagraphProps } from "../components/typography/Paragraph";
export type { RichTextProps } from "../components/typography/RichText";
export type { BadgeProps } from "../components/typography/Badge";
export type { HeroProps } from "../components/hero/Hero";
export type { HeroSplitProps } from "../components/hero/HeroSplit";
export type { TextWithImageProps } from "../components/content/TextWithImage";
export type { FeatureCardProps } from "../components/content/FeatureCard";
export type { StatsBarProps } from "../components/content/StatsBar";
export type { CardProps } from "../components/content/Card";
export type { ImageBlockProps } from "../components/media/ImageBlock";
export type { VideoEmbedProps } from "../components/media/VideoEmbed";
export type { ButtonProps } from "../components/cta/Button";
export type { ButtonGroupProps } from "../components/cta/ButtonGroup";
export type { CTABannerProps } from "../components/cta/CTABanner";
export type { TestimonialProps } from "../components/social/Testimonial";
export type { LogoCloudProps } from "../components/social/LogoCloud";
export type { PricingCardProps } from "../components/pricing/PricingCard";
export type { FAQProps } from "../components/interactive/FAQ";
export type { AccordionProps } from "../components/interactive/Accordion";
export type { ListProps } from "../components/interactive/List";

export type { NavbarProps } from "../components/navigation/Navbar";
export type { LanguageSwitcherProps } from "../components/navigation/LanguageSwitcher";
export type { LanguageSwitcherRuntimeValue } from "../i18n/language-switcher-runtime";
export type { FooterProps } from "../components/navigation/Footer";

export interface RootData {
  title: string;
  backgroundColor: string;
  fontFamily: string;
}
