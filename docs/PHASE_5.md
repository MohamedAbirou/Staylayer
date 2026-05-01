## Phase 5 — Content Migration (Hardcoded → Puck CMS)

**Guiding principle: Zero downtime. Zero content loss. One page at a time.**

The existing marketing site stays live throughout. Pages are migrated
individually — a hardcoded `.js` file is only deleted after its CMS
version is published and verified.

---

## PREREQUISITES (Phases 1–4 must be complete before Phase 5)

- Phase 1: NestJS API running, all `/pages` endpoints tested
- Phase 2: `@myallocator/puck-components` built with all 49 components across 10 categories
- Phase 3: Dashboard deployed, login/editor/preview working
- Phase 4: `[...slug].js` catch-all live on staging, `lib/cmsClient.js` in place

---

## PUCK DATA STRUCTURE

A Puck page data blob has exactly this shape (no `zones` field):

```json
{
  "content": [
    {
      "type": "Hero",
      "props": {
        "heading": "Your heading here",
        "subheading": "Your subheading text",
        "alignment": "center",
        "minHeight": "md",
        "backgroundColor": "#0f172a",
        "textColor": "#ffffff"
      }
    },
    {
      "type": "FAQ",
      "props": {
        "heading": "Frequently Asked Questions",
        "subheading": "",
        "items": [{ "question": "Q1?", "answer": "A1." }],
        "columns": "1"
      }
    }
  ],
  "root": {
    "title": "Page Title"
  }
}
```

`content` is a flat ordered array of component objects — one per section on
the page. `root` holds page-level metadata (title only; SEO fields are stored
as separate columns on the Page row, not inside puckData).

---

## COMPONENT PROP SHAPES

These are the **exact** prop names registered in `puckConfig`
(from `@myallocator/puck-components`). Components are organized across
10 categories. Use prop names precisely — they are case-sensitive.

### LAYOUT (10 components)

```
Container:
  maxWidth: "sm" | "md" | "lg" | "xl" | "2xl" | "full"   — default "xl"
  paddingX: "none" | "sm" | "md" | "lg"                   — default "md"
  paddingY: "none" | "sm" | "md" | "lg"                   — default "none"
  rounded: "none" | "sm" | "md" | "lg" | "xl"             — default "none"
  backgroundColor: string                                  — hex color, default ""
  gradient: boolean                                        — default false
  gradientFrom: string                                     — default "#3b82f6"
  gradientTo: string                                       — default "#8b5cf6"
  gradientDirection: "to-r" | "to-br" | "to-b" | "to-bl" | "to-l" | "to-t" | "to-tr"

Section:
  paddingX: "none" | "sm" | "md" | "lg" | "xl"            — default "lg"
  paddingY: "none" | "sm" | "md" | "lg" | "xl"            — default "lg"
  fullWidth: boolean                                       — default false
  maxWidth: "sm" | "md" | "lg" | "xl" | "2xl" | "full"    — default "xl"
  borderTop: boolean                                       — default false
  borderBottom: boolean                                    — default false
  backgroundColor: string                                  — hex color
  gradient: boolean                                        — default false
  gradientFrom: string
  gradientTo: string
  gradientDirection: string
  backgroundImage: string                                  — URL
  overlayOpacity: number                                   — 0–100, default 50
  animation: string                                        — default "none"
  animationDuration: string                                — default "normal"
  animationDelay: string                                   — default "none"

Columns:
  layout: "50-50" | "33-67" | "67-33" | "25-75" | "75-25" | "40-60" | "60-40"
          — default "50-50"
  gap: "none" | "sm" | "md" | "lg" | "xl"                 — default "md"
  alignItems: "top" | "center" | "bottom" | "stretch"     — default "stretch"
  stackOnMobile: boolean                                   — default true
  NOTE: content goes in "left" and "right" slots (Puck zones), not props

Grid:
  columns: "2" | "3" | "4"                                — default "3"
  gap: "none" | "sm" | "md" | "lg" | "xl"                 — default "md"
  NOTE: content goes in "content" slot

FlexBox:
  direction: "row" | "column" | "row-reverse" | "column-reverse"  — default "row"
  wrap: "wrap" | "nowrap" | "wrap-reverse"                 — default "wrap"
  justifyContent: "flex-start" | "center" | "flex-end" | "space-between" | "space-around" | "space-evenly"
  alignItems: "stretch" | "flex-start" | "center" | "flex-end" | "baseline"
  gap: number                                              — px, default 16
  rowGap: number                                           — px, 0=same as gap
  paddingY: "none" | "sm" | "md" | "lg" | "xl"
  paddingX: "none" | "sm" | "md" | "lg"
  fullWidth: boolean                                       — default true
  backgroundColor: string
  textColor: string
  animation: string

BentoGrid:
  layout: "2x2" | "hero-left" | "hero-right" | "1-2" | "2-1" | "featured" | "mosaic"
          — default "2x2"
  gap: "none" | "sm" | "md" | "lg" | "xl"                 — default "md"
  NOTE: content goes in "cell1"–"cell6" slots

Spacer:
  size: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" — default "md"

Divider:
  style: "solid" | "dashed" | "dotted"                    — default "solid"
  color: string                                            — hex, default "#e5e7eb"
  thickness: number                                        — 1–8 px, default 1
  width: "full" | "wide" | "medium" | "narrow"            — default "full"

Separator:
  orientation: "horizontal" | "vertical"                  — default "horizontal"
  variant: "solid" | "dashed" | "dotted"                  — default "solid"
  color: string                                            — default "#e5e7eb"
  spacing: "none" | "sm" | "md" | "lg" | "xl"             — default "md"
  label: string                                            — optional text label
  labelPosition: "left" | "center" | "right"              — default "center"

Card:
  imageUrl: string                                         — optional image URL
  imageAlt: string
  imagePosition: "top" | "none"                            — default "top"
  contentSpacing: number                                   — px gap, default 16
  contentAlignment: "left" | "center" | "right"           — default "left"
  padding: "none" | "sm" | "md" | "lg"                    — default "md"
  rounded: "none" | "sm" | "md" | "lg" | "xl"             — default "lg"
  shadow: "none" | "sm" | "md" | "lg"                     — default "sm"
  bordered: boolean                                        — default true
  backgroundColor: string
  NOTE: content goes in "content" slot
```

### TYPOGRAPHY (6 components)

```
Heading:
  text: string                                             — heading text
  level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"        — default "h2"
  size: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl"  — default "xl"
  weight: "light" | "normal" | "medium" | "semibold" | "bold" | "extrabold" | "black"
          — default "bold"
  alignment: "left" | "center" | "right"                  — default "left"
  letterSpacing: "tighter" | "tight" | "normal" | "wide" | "wider"  — default "tight"
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize"  — default "none"
  maxWidth: "none" | "sm" | "md" | "lg" | "xl"            — default "none"
  color: string                                            — hex color
  animation: string

Paragraph:
  text: string                                             — paragraph text
  size: "xs" | "sm" | "md" | "lg" | "xl" | "2xl"         — default "md"
  weight: "light" | "normal" | "medium" | "semibold"      — default "normal"
  alignment: "left" | "center" | "right"                  — default "left"
  color: string
  maxWidth: "none" | "xs" | "sm" | "md" | "lg" | "xl"    — default "none"
  lineHeight: "tight" | "normal" | "loose"                — default "normal"
  opacity: "100" | "90" | "80" | "70" | "60"              — default "100"

RichText:
  content: string                                          — raw HTML string
  alignment: "left" | "center" | "right"                  — default "left"
  color: string

Badge:
  text: string
  variant: "primary" | "secondary" | "success" | "warning" | "danger" | "purple"
           — default "primary"
  size: "sm" | "md" | "lg"                                — default "md"

Avatar:
  src: string                                              — image URL
  alt: string                                              — default "Avatar"
  fallback: string                                         — initials, default "AB"
  size: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" — default "md"
  shape: "circle" | "rounded" | "square"                  — default "circle"
  bordered: boolean                                        — default false
  borderColor: string                                      — default "#ffffff"
  status: "none" | "online" | "offline" | "busy" | "away" — default "none"

List:
  items: Array<{ text: string, icon?: string }>            — icon overrides global
  variant: "unordered" | "numbered" | "check"             — default "unordered"
  globalIcon: string                                       — emoji applied to all items
  fontSize: number                                         — px, default 16
  itemSpacing: number                                      — px, default 10
  color: string
  accentColor: string                                      — bullet/icon color, default "#2563eb"
```

### HERO (2 components)

```
Hero:
  heading: string                                          — main H1 text
  subheading: string                                       — paragraph below heading
  alignment: "left" | "center" | "right"                  — default "center"
  minHeight: "auto" | "sm" | "md" | "lg" | "full"         — default "md"
  backgroundColor: string                                  — default "#0f172a"
  backgroundImage: string                                  — URL
  overlayOpacity: number                                   — 0–100, default 60
  textColor: string                                        — default "#ffffff"
  showActions: "show" | "hide"                             — default "show"
  headingPrefix: string                                    — text before highlighted word
  headingHighlight: string                                 — highlighted word/phrase
  headingSuffix: string                                    — text after highlighted word
  highlightAnimation: "none" | "colorCycle"               — default "none"
  showHighlightUnderline: boolean                          — default false
  highlightColors: string                                  — comma-separated hex values
  NOTE: CTA buttons go in "actions" slot (accepts Button/ButtonGroup components)

HeroSplit:
  heading: string
  subheading: string
  textAlignment: "left" | "center" | "right"              — default "left"
  imageUrl: string                                         — hero image URL
  imageAlt: string                                         — default "Hero image"
  imagePosition: "right" | "left"                         — default "right"
  imageRounded: "none" | "sm" | "md" | "lg" | "xl" | "2xl"  — default "xl"
  imageShadow: boolean                                     — default true
  columnSpacing: number                                    — px gap between columns, default 24
  paddingY: "none" | "sm" | "md" | "lg" | "xl"            — default "md"
  paddingX: "none" | "sm" | "md" | "lg" | "xl"            — default "md"
  backgroundColor: string                                  — default "#ffffff"
  textColor: string                                        — default "#0f172a"
  NOTE: CTA buttons go in "actions" slot (accepts Button/ButtonGroup components)
```

### CONTENT (8 components)

```
TextWithImage:
  heading: string                                          — section heading
  sectionTitle: string                                     — label above the heading
  headingSize: "sm" | "md" | "lg" | "xl"                  — default "lg"
  imageUrl: string                                         — image URL
  imageAlt: string                                         — default "Feature illustration"
  imagePosition: "left" | "right"                         — default "right"
  imageBrowserFrame: boolean                               — show browser chrome, default false
  imageOverflow: boolean                                   — oversized image, default true
  panelStyle: "none" | "translucent" | "opaque"           — default "translucent"
  backgroundColor: string                                  — default "#2563eb"
  textColor: string                                        — default "#ffffff"
  backgroundImage: string
  backgroundImageOpacity: number                           — 0–100, default 80
  gradient: boolean
  gradientFrom: string
  gradientTo: string
  gradientDirection: string
  paddingY: "none" | "sm" | "md" | "lg" | "xl"            — default "lg"
  NOTE: body content goes in "richContent" slot (accepts List, Button, etc.)

FeatureCard:
  icon: "star" | "check" | "rocket" | "shield" | "chart" | "globe" | "heart" |
        "lightning" | "target" | "clock" | "users" | "lock" | "sparkle" | "tools" |
        "cloud" | "mobile"                                 — default "star"
  showIcon: boolean                                        — default true
  title: string
  description: string
  alignment: "left" | "center" | "right"                  — default "left"
  bordered: boolean                                        — default true
  shadow: "none" | "sm" | "md" | "lg"                     — default "sm"
  backgroundColor: string                                  — default "#ffffff"
  textColor: string
  gradient: boolean
  gradientFrom: string
  gradientTo: string

FeatureShowcase:
  heading: string
  subheading: string
  tabs: Array<{
    label: string,
    description: string,
    imageUrl: string,
    imageAlt: string,
    browserUrl: string
  }>
  showBrowserChrome: boolean                               — default true
  tabPosition: "left" | "right"                           — default "left"
  tabsWidth: "narrow" | "medium" | "wide" | "x-wide"     — default "medium"
  paddingY: "none" | "sm" | "md" | "lg" | "xl" | "2xl"   — default "lg"
  paddingX: "none" | "sm" | "md" | "lg"                   — default "md"
  maxWidth: "4xl" | "5xl" | "6xl" | "7xl" | "full"        — default "7xl"
  headingSize: "sm" | "md" | "lg" | "xl"                  — default "lg"
  backgroundColor: string                                  — default "#2563eb"
  textColor: string                                        — default "#ffffff"
  gradient: boolean

StatsBar:
  stats: Array<{ value: string, label: string, description: string }>
  columns: "2" | "3" | "4"                                — default "3"
  alignment: "left" | "center" | "right"                  — default "center"
  valueColor: string                                       — default "#2563eb"
  backgroundColor: string
  textColor: string

Alert:
  variant: "info" | "success" | "warning" | "error" | "neutral"  — default "info"
  title: string
  description: string
  icon: "auto" | "info" | "success" | "warning" | "error" | "none"  — default "auto"
  bordered: boolean                                        — default true
  rounded: "none" | "sm" | "md" | "lg" | "xl"             — default "lg"

IconBlock:
  icon: "star" | "shield" | "lightning" | "globe" | "chart" | "heart" | "users" |
        "rocket" | "clock" | "lock" | "code" | "sparkle"  — default "star"
  title: string
  description: string
  layout: "stacked" | "inline"                            — default "stacked"
  alignment: "left" | "center"                            — default "left"
  iconSize: "sm" | "md" | "lg" | "xl"                     — default "md"
  iconColor: string                                        — default "#2563eb"
  iconBackground: string                                   — default "#eff6ff"
  iconShape: "circle" | "rounded" | "square"              — default "rounded"

FeatureTable:
  heading: string
  subheading: string
  features: Array<{ name: string, description: string }>
  col1Label: string                                        — default "Feature"
  col2Label: string                                        — default "What you get"
  showCheckIcon: boolean                                   — default true
  checkIconColor: string                                   — default "#059669"
  headerBgColor: string                                    — default "#f9fafb"
  rowOddBgColor: string                                    — default "#ffffff"
  rowEvenBgColor: string                                   — default "#f9fafb"
  bodyTextColor: string                                    — default "#1f2937"
  footerText: string                                       — optional footer note
  rounded: boolean                                         — default true
  shadow: boolean                                          — default true
  bordered: boolean                                        — default true

DataTable:
  columns: Array<{
    header: string,
    width: string,    — e.g. "30%"
    align: "left" | "center" | "right",
    bold: boolean
  }>
  rows: Array<{
    cells: Array<{ value: string }>,
    isHighlighted: boolean
  }>
  maxWidth: "sm" | "md" | "lg" | "xl" | "2xl" | "full"   — default "xl"
  headerBgColor: string
  rowOddBgColor: string
  rowEvenBgColor: string
  highlightBgColor: string
  bodyTextColor: string
  rounded: boolean                                         — default true
  shadow: boolean                                          — default true
  bordered: boolean                                        — default true
```

### MEDIA (2 components)

```
Image:
  url: string                                              — image URL
  alt: string                                              — default "Image"
  caption: string                                          — optional caption
  rounded: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full"  — default "lg"
  shadow: "none" | "sm" | "md" | "lg" | "xl"             — default "md"
  aspectRatio: "auto" | "square" | "video" | "4/3" | "3/2"  — default "auto"
  objectFit: "cover" | "contain" | "fill"                 — default "cover"
  maxWidth: "sm" | "md" | "lg" | "xl" | "2xl" | "full"    — default "full"

Video:
  url: string                                              — YouTube or Vimeo URL
  aspectRatio: "16/9" | "4/3" | "1/1" | "21/9"           — default "16/9"
  rounded: "none" | "sm" | "md" | "lg" | "xl"             — default "lg"
```

### CTA (3 components)

```
Button:
  label: string                                            — button text
  url: string                                              — href
  variant: "primary" | "secondary" | "outline" | "ghost" | "white" | "dark" |
           "gradient" | "danger" | "success" | "link"     — default "primary"
  size: "xs" | "sm" | "md" | "lg" | "xl"                  — default "md"
  rounded: "none" | "sm" | "md" | "lg" | "xl" | "full"   — default "lg"
  fullWidth: boolean                                       — default false
  openInNewTab: boolean                                    — default false
  icon: "none" | "arrow_right" | "arrow_left" | "external" | "download" |
        "play" | "sparkle" | "check" | "mail" | "phone"   — default "none"
  iconPosition: "left" | "right"                          — default "right"
  shadow: "none" | "sm" | "md" | "lg"                     — default "none"
  backgroundColor: string                                  — overrides variant
  textColor: string                                        — overrides variant

ButtonGroup:
  alignment: "left" | "center" | "right"                  — default "left"
  gap: "sm" | "md" | "lg"                                 — default "md"
  NOTE: buttons go in "buttons" slot (accepts Button components)

CTABanner:
  heading: string
  description: string
  alignment: "left" | "center" | "right"                  — default "center"
  paddingY: "none" | "sm" | "md" | "lg" | "xl"            — default "xl"
  rounded: "none" | "sm" | "md" | "lg" | "xl" | "2xl"    — default "none"
  showActions: "show" | "hide"                             — default "show"
  backgroundColor: string                                  — default "#2563eb"
  textColor: string                                        — default "#ffffff"
  backgroundImage: string
  backgroundImageOpacity: number                           — 0–100, default 80
  NOTE: CTA buttons go in "actions" slot (accepts Button/ButtonGroup)
```

### SOCIAL PROOF (5 components)

```
Testimonial:
  quote: string
  author: string                                           — default "Sarah Johnson"
  role: string                                             — job title, default "CEO"
  company: string                                          — default "Hospitality Inc."
  avatarUrl: string                                        — optional image URL
  variant: "card" | "minimal"                             — default "card"
  accentColor: string                                      — default "#2563eb"
  backgroundColor: string                                  — default "#ffffff"
  textColor: string

TestimonialCarousel:
  heading: string
  subheading: string
  testimonials: Array<{
    quote: string,
    author: string,
    role: string,
    company: string,
    avatarUrl: string,
    rating: number    — 0–5
  }>
  showDots: boolean                                        — default true
  showArrows: boolean                                      — default true
  accentColor: string                                      — default "#2563eb"
  backgroundColor: string
  textColor: string

QuoteCard:
  quote: string
  author: string                                           — default "Jane Smith"
  withBorder: boolean                                      — show footer divider, default true
  shadow: "none" | "sm" | "md" | "lg" | "xl"             — default "xl"
  rounded: "none" | "sm" | "md" | "lg" | "xl"             — default "xl"
  backgroundColor: string                                  — default "#ffffff"
  textColor: string
  accentColor: string                                      — quote mark color, default "#e2e8f0"

LogoCloud:
  title: string
  logos: Array<{ url: string, alt: string, link?: string }>
  columns: "3" | "4" | "5" | "6"                          — default "5"
  grayscale: boolean                                       — default true
  logoHeight: "sm" | "md" | "lg" | "xl"                   — default "md"

Marquee:
  title: string                                            — optional heading
  items: Array<{ imageUrl: string, alt: string, link?: string }>
  speed: "slow" | "normal" | "fast"                       — default "normal"
  direction: "left" | "right"                             — default "left"
  pauseOnHover: boolean                                    — default true
  dragToScroll: boolean                                    — default true
  itemHeight: "sm" | "md" | "lg" | "xl"                   — default "md"
  grayscale: boolean                                       — default true
  gap: "sm" | "md" | "lg" | "xl"                          — default "lg"
```

### PRICING (3 components)

```
PricingCard:
  planName: string                                         — default "Pro"
  price: string                                            — e.g. "$49"
  period: string                                           — e.g. "/month"
  description: string
  features: Array<{ text: string, included: boolean }>
  ctaLabel: string                                         — button text, default "Get Started"
  ctaUrl: string                                           — button href
  highlighted: boolean                                     — default false
  badge: string                                            — optional badge text
  accentColor: string                                      — default "#2563eb"
  backgroundColor: string                                  — default "#ffffff"

PricingTable:
  heading: string
  subheading: string
  plans: Array<{
    planName: string,
    price: string,
    period: string,
    description: string,
    features: Array<{ text: string, included: boolean }>,
    ctaLabel: string,
    ctaUrl: string,
    highlighted: boolean,
    badge: string
  }>
  accentColor: string                                      — default "#2563eb"
  backgroundColor: string
  animation: string

ComparisonTable:
  heading: string
  subheading: string
  columns: Array<{ heading: string, highlighted: boolean }>
  rows: Array<{
    feature: string,
    values: Array<{ value: string }>  — "yes"/"no" auto-renders ✓/✗
  }>
  striped: boolean                                         — default true
  accentColor: string                                      — default "#2563eb"
  backgroundColor: string
  animation: string
```

### INTERACTIVE (6 components)

```
FAQ:
  heading: string
  subheading: string
  items: Array<{ question: string, answer: string }>
  columns: "1" | "2"                                       — default "1"
  accentColor: string                                      — default "#2563eb"
  backgroundColor: string
  textColor: string

Accordion:
  title: string
  content: string                                          — body text
  defaultOpen: boolean                                     — default false
  bordered: boolean                                        — default true
  accentColor: string                                      — default "#2563eb"

StepList:
  items: Array<{ title: string, description?: string }>
  layout: "vertical" | "horizontal"                       — default "vertical"
  spacing: number                                          — px between steps, default 32
  numberSize: number                                       — px circle size, default 44
  titleSize: number                                        — px, default 18
  descriptionSize: number                                  — px, default 15
  showConnector: boolean                                   — default false
  connectorColor: string                                   — default "#e5e7eb"
  numberBgColor: string                                    — default "#dbeafe"
  numberTextColor: string                                  — default "#1d4ed8"
  titleColor: string
  descriptionColor: string

Tabs:
  tabs: Array<{ label: string }>                           — up to 5 tabs
  activeTab: number                                        — 0-based default, default 0
  variant: "underline" | "pills" | "boxed" | "bordered"   — default "underline"
  alignment: "left" | "center" | "right" | "full"         — default "left"
  activeTabTextColor: string                               — default "#2563eb"
  activeIndicatorColor: string                             — default "#2563eb"
  inactiveTabTextColor: string                             — default "#6b7280"
  contentPadding: "none" | "sm" | "md" | "lg" | "xl"      — default "md"
  NOTE: tab content goes in "slot1"–"slot5" slots (one per tab)

Progress:
  value: number                                            — current value
  max: number                                              — default 100
  label: string                                            — optional label
  showValue: boolean                                       — default true
  valueFormat: "percent" | "fraction" | "number"          — default "percent"
  size: "xs" | "sm" | "md" | "lg" | "xl"                  — default "md"
  color: string                                            — bar color, default "#2563eb"
  trackColor: string                                       — default "#e5e7eb"
  rounded: "none" | "sm" | "md" | "lg" | "full"           — default "full"
  striped: boolean                                         — default false
  animated: boolean                                        — animate stripes, default false

Countdown:
  targetDate: string                                       — YYYY-MM-DD format
  heading: string                                          — default "Launching Soon"
  description: string
  completedText: string                                    — default "🎉 We're live!"
  size: "sm" | "md" | "lg"                                — default "md"
  alignment: "left" | "center" | "right"                  — default "center"
  showLabels: boolean                                      — default true
  labelStyle: "full" | "short"                            — default "full"
  separator: "colon" | "dot" | "none"                     — default "colon"
  accentColor: string                                      — number color, default "#2563eb"
  backgroundColor: string
  textColor: string
```

### NAVIGATION (4 components)

```
Navbar:
  logoType: "text" | "image" | "both"                     — default "text"
  logoText: string                                         — default "Your Brand"
  logoImageUrl: string
  logoImageAlt: string                                     — default "Logo"
  logoHref: string                                         — default "/"
  logoImageHeight: number                                  — px, default 40
  links: Array<{
    label: string,
    href: string,
    openInNewTab: boolean,
    hasDropdown: boolean,
    dropdownType: "simple" | "columns" | "mega",
    dropdownSections: Array<{
      title: string,
      links: Array<{ label, href, description, icon }>
    }>
  }>
  ctaLabel: string                                         — default "Get started"
  ctaHref: string                                          — default "/pricing"
  ctaVariant: "primary" | "outline" | "ghost" | "ring"    — default "primary"
  ctaOpenInNewTab: boolean                                 — default false
  style: "solid" | "transparent" | "blur"                 — default "solid"
  backgroundColor: string                                  — default "#ffffff"
  textColor: string                                        — default "#111827"
  shadow: "none" | "sm" | "md" | "lg" | "xl"              — default "sm"
  positionType: "relative" | "sticky" | "fixed"           — default "relative"
  maxWidth: "sm" | "md" | "lg" | "xl" | "2xl" | "full"    — default "xl"

Footer:
  logoType: "none" | "text" | "image" | "both"            — default "text"
  logoText: string                                         — default "Your Brand"
  logoImageUrl: string
  logoHref: string                                         — default "/"
  tagline: string
  columns: Array<{
    heading: string,
    links: Array<{ label: string, href: string, openInNewTab: boolean }>
  }>
  socialLinks: Array<{
    platform: "twitter" | "facebook" | "instagram" | "linkedin" |
              "youtube" | "github" | "tiktok",
    href: string,
    label: string
  }>
  showBottomBar: boolean                                   — default true
  copyrightText: string
  bottomLinks: Array<{ label: string, href: string, openInNewTab: boolean }>
  backgroundColor: string                                  — default "#111827"
  textColor: string                                        — default "#f9fafb"
  accentColor: string                                      — default "#6366f1"
  maxWidth: "sm" | "md" | "lg" | "xl" | "2xl" | "full"    — default "xl"

Banner:
  text: string
  linkText: string
  linkUrl: string
  icon: "none" | "megaphone" | "sparkle" | "rocket" | "gift"  — default "none"
  variant: "subtle" | "accent" | "gradient" | "warning" | "success" | "dark"
           — default "accent"
  size: "sm" | "md" | "lg"                                — default "md"
  dismissible: boolean                                     — default false
  backgroundColor: string
  textColor: string

Breadcrumb:
  items: Array<{ label: string, href: string }>
  separator: "chevron" | "slash" | "dot" | "arrow"        — default "chevron"
  size: "sm" | "md" | "lg"                                — default "md"
  color: string
```

---

## MIGRATION FILES TO GENERATE

### Directory Structure

```
scripts/
  extract-to-puck.js       # AST-based extractor — parse JSX → puckData JSON
  seed-pages.js            # Bulk seed via CMS API (POST /pages for each file)
  validate-migration.js    # Validate all seeded pages via GET /pages
migrations/
  en/                      # One JSON per page (English)
    index.json
    pricing.json
    about.json
    contact-us.json
    careers.json
    ambassador.json
    annual-report.json
    channel-manager-vacation-rental.json
    channel-manager-airbnb.json
    channel-manager-booking-com.json
    dynamic-pricing.json
    reservation-system-pms-vacation-rental.json
    statistics-kpis-vacation-rentals.json
    website-builder-vacation-rentals.json
    automatic-guest-communications-vacation-rentals.json
    booking-system-engine-vacation-rental.json
    guest-guide-for-vacation-rentals.json
    vacation-apartments-and-homes.json
    vacations-camping-glamping.json
    bedbreakfast.json
    boutique.json
    farm-stays.json
    guest-house.json
    account-access.json
    customer-agreement.json
    privacy-policy.json
  es/                      # Spanish — same filenames, Spanish content
    ...
  fr/                      # French — same filenames, French content
    ...
```

Each JSON file is a complete Page object ready to POST to the API:

```json
{
  "slug": "pricing",
  "locale": "en",
  "title": "Pricing",
  "seoTitle": "Simple, Transparent Pricing | MyAllocator",
  "seoDescription": "One plan. Everything included. No hidden fees.",
  "seoKeywords": "vacation rental pricing, channel manager cost, ...",
  "puckData": {
    "content": [ ... ],
    "root": { "title": "Pricing" }
  }
}
```

---

### scripts/extract-to-puck.js

One-time AST extraction script. Parses each page JSX file and produces
the migration JSON files. Must be perfect — produces a first
perfectly-ready and then manually verified and little adjusted in the Puck editor.

```js
// scripts/extract-to-puck.js
// Run: node scripts/extract-to-puck.js

const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const fs = require("fs");
const path = require("path");

const PAGES_DIR = path.join(__dirname, "../pages");
const LOCALES_DIR = path.join(__dirname, "../locales");
const OUTPUT_DIR = path.join(__dirname, "../migrations");

// Map from old JSX prop names → new Puck prop names (where they differ)
const PROP_REMAP = {
  // Hero components
  HeroSection: { h1: "heading", p: "subheading" },
  HeroTextImageSection: {
    imageSrc: "imageUrl",
    imageAlt: "imageAlt",
    browserUrl: "browserUrl",
  },
  // Content components
  TextImageSection: {
    sectionTitle: "sectionTitle",
    src: "imageUrl",
    alt: "imageAlt",
  },
  ImageTextSection: {
    sectionTitle: "sectionTitle",
    src: "imageUrl",
    alt: "imageAlt",
  },
  // CTA/Button components
  CTASection: {
    paragraph: "description",
    linkText: "heading",
    linkHref: "description",
  },
  UnifiedCTA: { buttonText: "label", buttonHref: "url" },
  LinkButton: { text: "label", href: "url" },
  // Pricing components
  PricingCard: { ctaText: "ctaLabel", ctaHref: "ctaUrl" },
  // List components
  OrderList: {},
  UnorderedList: {},
};

// Component name normalization (old JSX import → Puck registered name)
const COMPONENT_RENAME = {
  // Old custom components → new generic Puck components
  HeroSection: "Hero",
  HeroTextImageSection: "HeroSplit",
  TextImageSection: "TextWithImage",
  ImageTextSection: "TextWithImage",
  CTASection: "CTABanner",
  UnifiedCTA: "CTABanner",
  Quote: "QuoteCard",
  OTASlider: "Marquee",
  PricingCard: "PricingCard",
  PricingSectionOnePlan: "PricingCard",
  OnePlanFeaturesTable: "FeatureTable",
  PlanIncludesBanner: "CTABanner",
  OrderList: "List",
  UnorderedList: "List",
  FinancialToolsTabs: "Tabs",
  FeatureCardWrapper: "Grid",
  LinkButton: "Button",
};

const PAGE_SLUGS = [
  { file: "index.js", slug: "index" },
  { file: "pricing.js", slug: "pricing" },
  { file: "about.js", slug: "about" },
  // ... all 25 pages
];

function extractPageComponents(filePath) {
  const code = fs.readFileSync(filePath, "utf8");
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx"],
  });

  const components = [];

  traverse(ast, {
    JSXElement(nodePath) {
      const name = nodePath.node.openingElement.name.name;
      if (!name || name[0] !== name[0].toUpperCase()) return;
      // Skip layout wrappers
      if (["Layout", "SEOHead", "main", "Fragment"].includes(name)) return;

      const props = {};
      nodePath.node.openingElement.attributes.forEach((attr) => {
        if (attr.type !== "JSXAttribute") return;
        const key = attr.name.name;
        const val = attr.value;
        if (!val) {
          props[key] = true;
        } else if (val.type === "StringLiteral") {
          props[key] = val.value;
        } else if (val.type === "JSXExpressionContainer") {
          // For simple literals inside {}
          if (val.expression.type === "StringLiteral") {
            props[key] = val.expression.value;
          } else if (val.expression.type === "NumericLiteral") {
            props[key] = val.expression.value;
          } else if (val.expression.type === "BooleanLiteral") {
            props[key] = val.expression.value;
          }
          // Complex expressions (t() calls, arrays) → left as null for manual fill
        }
      });

      const puckName = COMPONENT_RENAME[name] || name;
      // Remap old prop names to new Puck prop names
      const remapped = {};
      const remap = PROP_REMAP[name] || {};
      Object.entries(props).forEach(([k, v]) => {
        remapped[remap[k] || k] = v;
      });

      components.push({ type: puckName, props: remapped });
    },
  });

  return components;
}

// Main
for (const { file, slug } of PAGE_SLUGS) {
  const filePath = path.join(PAGES_DIR, file);
  if (!fs.existsSync(filePath)) continue;

  const content = extractPageComponents(filePath);
  const puckData = { content, root: { title: slug } };

  for (const locale of ["en", "es", "fr"]) {
    const localeFile = path.join(LOCALES_DIR, locale, "index.json");
    const translations = fs.existsSync(localeFile)
      ? JSON.parse(fs.readFileSync(localeFile, "utf8"))
      : {};

    const seoKey = slug === "index" ? "home" : slug.replace(/-/g, "_");
    const seo = translations?.seo?.[seoKey] || {};

    const output = {
      slug,
      locale,
      title: seo.title || slug,
      seoTitle: seo.title || "",
      seoDescription: seo.description || "",
      seoKeywords: seo.keywords || "",
      puckData,
    };

    const outDir = path.join(OUTPUT_DIR, locale);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, `${slug}.json`),
      JSON.stringify(output, null, 2),
    );
    console.log(`✓ migrations/${locale}/${slug}.json`);
  }
}
```

**This script produces a first draft.** After running it, manually review
each JSON file and fill in any `null` values (complex expressions the AST
couldn't parse). Then verify in the Puck editor before seeding to the DB.

---

### scripts/seed-pages.js

Seeds all migration JSON files into the CMS via the API. Seeds via HTTP
(not direct Prisma) so validation, versioning, and auth all run normally.

```js
// scripts/seed-pages.js
// Run: CMS_API_URL=http://localhost:4000 CMS_SEED_TOKEN=<jwt> node scripts/seed-pages.js

const fs = require("fs");
const path = require("path");

const API_URL = process.env.CMS_API_URL || "http://localhost:4000";
const TOKEN = process.env.CMS_SEED_TOKEN; // ADMIN or SUPER_ADMIN JWT

if (!TOKEN) {
  console.error("CMS_SEED_TOKEN env var required (ADMIN role JWT)");
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(__dirname, "../migrations");
const LOCALES = ["en", "es", "fr"];

async function upsertPage(pageData) {
  // Try PUT first (update), fall back to POST (create)
  const { slug, locale, ...rest } = pageData;

  const putRes = await fetch(`${API_URL}/pages/${slug}?locale=${locale}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(rest),
  });

  if (putRes.status === 404) {
    // Page doesn't exist yet — create it
    const postRes = await fetch(`${API_URL}/pages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(pageData),
    });
    if (!postRes.ok) {
      const err = await postRes.json();
      throw new Error(
        `POST /pages failed for ${slug}/${locale}: ${JSON.stringify(err)}`,
      );
    }
    return { action: "created", slug, locale };
  }

  if (!putRes.ok) {
    const err = await putRes.json();
    throw new Error(
      `PUT /pages/${slug} failed for ${locale}: ${JSON.stringify(err)}`,
    );
  }
  return { action: "updated", slug, locale };
}

async function main() {
  let created = 0,
    updated = 0,
    failed = 0;

  for (const locale of LOCALES) {
    const dir = path.join(MIGRATIONS_DIR, locale);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const pageData = JSON.parse(
        fs.readFileSync(path.join(dir, file), "utf8"),
      );
      try {
        const result = await upsertPage(pageData);
        console.log(`✓ ${result.action}: ${result.slug}/${result.locale}`);
        result.action === "created" ? created++ : updated++;
      } catch (err) {
        console.error(`✗ ${err.message}`);
        failed++;
      }
    }
  }

  console.log(
    `\nDone: ${created} created, ${updated} updated, ${failed} failed`,
  );
  if (failed > 0) process.exit(1);
}

main();
```

---

### scripts/validate-migration.js

After seeding, validate every page is retrievable and has valid puckData.

```js
// scripts/validate-migration.js
// Run after seed-pages.js

const API_URL = process.env.CMS_API_URL || "http://localhost:4000";
const TOKEN = process.env.CMS_SEED_TOKEN;

const KNOWN_COMPONENTS = [
  // Layout
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
  // Typography
  "Heading",
  "Paragraph",
  "RichText",
  "Badge",
  "Avatar",
  "List",
  // Hero
  "Hero",
  "HeroSplit",
  // Content
  "TextWithImage",
  "FeatureShowcase",
  "FeatureCard",
  "StatsBar",
  "FeatureTable",
  "DataTable",
  "Alert",
  "IconBlock",
  // Media
  "Image",
  "Video",
  // CTA
  "Button",
  "ButtonGroup",
  "CTABanner",
  // Social Proof
  "Testimonial",
  "TestimonialCarousel",
  "QuoteCard",
  "LogoCloud",
  "Marquee",
  // Pricing
  "PricingCard",
  "PricingTable",
  "ComparisonTable",
  // Interactive
  "FAQ",
  "Accordion",
  "StepList",
  "Tabs",
  "Progress",
  "Countdown",
  // Navigation
  "Navbar",
  "Footer",
  "Banner",
  "Breadcrumb",
];

async function validatePage(slug, locale) {
  const res = await fetch(`${API_URL}/pages/${slug}?locale=${locale}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  if (res.status === 404) return { ok: false, issue: "NOT_FOUND" };
  if (!res.ok) return { ok: false, issue: `HTTP_${res.status}` };

  const page = await res.json();
  const pd = page.puckData;

  if (!pd || !Array.isArray(pd.content)) {
    return { ok: false, issue: "puckData.content is not an array" };
  }
  if (!pd.root || typeof pd.root !== "object") {
    return { ok: false, issue: "puckData.root missing" };
  }

  const unknownComponents = pd.content
    .map((c) => c.type)
    .filter((t) => !KNOWN_COMPONENTS.includes(t));

  if (unknownComponents.length > 0) {
    return {
      ok: false,
      issue: `Unknown components: ${unknownComponents.join(", ")}`,
    };
  }

  return { ok: true };
}

// Load all slugs from migration files and validate
const fs = require("fs");
const path = require("path");
const MIGRATIONS_DIR = path.join(__dirname, "../migrations");

async function main() {
  let passed = 0,
    failed = 0;
  const failures = [];

  for (const locale of ["en", "es", "fr"]) {
    const dir = path.join(MIGRATIONS_DIR, locale);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      const { slug } = JSON.parse(
        fs.readFileSync(path.join(dir, file), "utf8"),
      );
      const result = await validatePage(slug, locale);
      if (result.ok) {
        console.log(`✓ ${slug}/${locale}`);
        passed++;
      } else {
        console.error(`✗ ${slug}/${locale}: ${result.issue}`);
        failures.push({ slug, locale, issue: result.issue });
        failed++;
      }
    }
  }

  console.log(`\nValidation complete: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    failures.forEach((f) =>
      console.error(`  - ${f.slug}/${f.locale}: ${f.issue}`),
    );
    process.exit(1);
  }
}

main();
```

---

## PER-PAGE MIGRATION PROCESS

Repeat these 9 steps for every page being migrated:

```
STEP 1: Extract Content
  ├── Read pages/{slug}.js — document every component and its props
  ├── Read locales/en/index.json → extract {slug}.* translation keys
  ├── Read locales/es/index.json → extract {slug}.* keys
  ├── Read locales/fr/index.json → extract {slug}.* keys
  └── Note any special logic (forms, env vars, Framer Motion, etc.)

STEP 2: Create Puck JSON Blobs (migrations/{locale}/{slug}.json)
  ├── EN: construct puckData using English content from pages/{slug}.js
  ├── ES: same structure, Spanish text from locales/es/index.json
  ├── FR: same structure, French text from locales/fr/index.json
  └── Use scripts/extract-to-puck.js as starting point, then manually fix

STEP 3: Seed into CMS Database (via API)
  ├── node scripts/seed-pages.js (seeds all JSON files)
  │   OR manually: POST /pages for each locale
  └── Verify 3 DB rows exist: GET /pages?slug={slug}

STEP 4: Verify in Dashboard
  ├── Open /editor/{slug}?locale=en → visual check matches original
  ├── Open /editor/{slug}?locale=es → check
  ├── Open /editor/{slug}?locale=fr → check
  └── Fix any wrong props directly in the Puck editor, then re-save

STEP 5: Verify via Website (staging)
  ├── Visit staging /{slug} → compare side-by-side with production
  ├── Visit /es/{slug} and /fr/{slug} → check
  ├── Check: SEO tags (view-source), images load, links work,
  │   responsive layout (mobile + desktop), console errors = 0
  └── Run Lighthouse on staging URL — score must not regress vs production

STEP 6: Publish in CMS
  ├── POST /pages/{slug}/publish?locale=en
  ├── POST /pages/{slug}/publish?locale=es
  ├── POST /pages/{slug}/publish?locale=fr
  └── ISR revalidation fires automatically for all locale paths

STEP 7: Create Static Fallback
  ├── Copy migrations/en/{slug}.json → apps/website/lib/fallbacks/{slug}.json
  └── Commit to repo (used if CMS API is unreachable during build)

STEP 8: Delete Hardcoded Page
  ├── git rm pages/{slug}.js
  ├── Remove {slug}.* keys from locales/en/index.json
  ├── Remove {slug}.* keys from locales/es/index.json
  ├── Remove {slug}.* keys from locales/fr/index.json
  ├── Remove unused component imports (dead code)
  └── Deploy — [...slug].js catch-all now handles /{slug}

STEP 9: Verify Production
  ├── Visit /{slug} on live site → renders from CMS ✓
  ├── Visit /es/{slug}, /fr/{slug} → render correctly ✓
  ├── Check Google PageSpeed score — must not regress
  ├── Check Google Search Console for crawl errors (24h window)
  └── Monitor error logs for 24 hours before proceeding to next page
```

---

## MIGRATION ORDER (lowest risk first)

| Wave                        | Pages                                                                                                                                                                                                                                                                                                                                                           | Reason                                                                                                                                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wave 1: Simple static**   | `privacy-policy`, `customer-agreement`                                                                                                                                                                                                                                                                                                                          | Text-only, no interactive components. Ideal for proving the process.                                                                                                                                                                                                             |
| **Wave 2: Simple feature**  | `about`, `careers`, `ambassador`, `annual-report`                                                                                                                                                                                                                                                                                                               | Mostly text + images. `annual-report` has a form — keep it outside Puck (render below `<Render />`).                                                                                                                                                                             |
| **Wave 3: Property types**  | `bedbreakfast`, `boutique`, `farm-stays`, `guest-house`, `vacation-apartments-and-homes`, `vacations-camping-glamping`                                                                                                                                                                                                                                          | All share identical structure — migrate as a batch once one is proven.                                                                                                                                                                                                           |
| **Wave 4: Feature pages**   | `channel-manager-vacation-rental`, `channel-manager-airbnb`, `channel-manager-booking-com`, `dynamic-pricing`, `reservation-system-pms-vacation-rental`, `statistics-kpis-vacation-rentals`, `website-builder-vacation-rentals`, `automatic-guest-communications-vacation-rentals`, `booking-system-engine-vacation-rental`, `guest-guide-for-vacation-rentals` | More complex layouts. Migrate one, verify, then batch the rest.                                                                                                                                                                                                                  |
| **Wave 5: Forms & account** | `contact-us`, `account-access`                                                                                                                                                                                                                                                                                                                                  | Contact form uses Formspree — verify `lib/FormSubmitHandler.js` still works after migration (form stays outside Puck).                                                                                                                                                           |
| **Wave 6: High-traffic**    | `pricing`, `index` (homepage)                                                                                                                                                                                                                                                                                                                                   | Migrate last. `pricing` uses `process.env.NEXT_PUBLIC_PRICE` — seed the price string directly into `PricingCard.price` or `PricingTable` plans. Homepage has Framer Motion on hero — keep `<motion.div>` wrappers inside the `Hero` component, not configurable via Puck fields. |

**DO NOT migrate:** `_app.js`, `_document.js`, `404.js` — these are
infrastructure files, not content pages.

---

## SPECIAL CASES

### Pages with forms (`contact-us`, `annual-report`, `account-access`)

The form components (`contactForm.jsx`, `annual-report-form.jsx`) contain
client-side logic (Formspree, validation). They cannot be Puck components.
Pattern for these pages after migration:

```js
// pages/contact-us.js (after migration)
export default function ContactUsPage({ page }) {
  return (
    <>
      <SEOHead ... />
      <main id="contact-us">
        <Render config={puckConfig} data={page.puckData} />
        {/* Form intentionally outside Puck — contains Formspree logic */}
        <ContactForm />
      </main>
    </>
  );
}
```

### `pricing` page — env var price

The current `pages/pricing.js` reads `process.env.NEXT_PUBLIC_PRICE`.
In puckData, seed the actual price string (`"$9/mo"`) directly into the
`PricingCard.price` (or `PricingTable` `plans[].price`) prop. If the price
changes in future, the marketing team updates it in the Puck editor — the
env var is no longer the source of truth after migration.

### `index` page — Framer Motion

The homepage hero uses `framer-motion` for the entrance animation.
This stays inside the `Hero` (or `HeroSplit`) component implementation —
it is NOT a Puck field. The motion is automatic when `Hero` renders.
No changes needed to puckData.

---

## ROLLBACK PLAN

If a migrated page has issues in production:

1. **Immediate (< 1 min):** Static fallback at `lib/fallbacks/{slug}.json`
   ensures content is served even if the API is down — no action needed.
2. **Quick rollback (< 5 min):** Restore the deleted page file from git:
   `git checkout HEAD~1 -- pages/{slug}.js` — deploy, hardcoded page takes
   over again (Next.js exact-match priority over `[...slug].js`).
3. **Full rollback:** `git revert` the migration commit — restores page
   file and translation keys in one step.

No data is lost — hardcoded page content exists in git history forever.
The CMS database row remains and can be re-published once the issue is fixed.

---

## IMPLEMENTATION RULES

1. The extraction script is a one-time tool — it does NOT need to be perfect.
   Produce a working first draft; manual review fills the gaps.
2. All string content must exactly match the current website — no paraphrasing,
   no truncation. Copy exact text from pages and locale JSON files.
3. Migration JSON files must be committed to the repo — they serve as both
   the seed source and as documentation of what content was migrated.
4. Seed via the API (not direct Prisma) — auth, validation, and versioning
   run automatically. Each seed call also creates the first PageVersion.
5. `seed-pages.js` must be idempotent — running it twice produces no
   duplicates (PUT on existing, POST on new).
6. Validation script exits with code 1 on any failure — CI blocks if
   migration is incomplete.
7. Migrate one wave at a time — verify production is stable for 24 hours
   before starting the next wave. Do not rush.
8. Never delete a hardcoded page file without first confirming the CMS
   version is published and rendering correctly on the live site.
9. `lib/fallbacks/{slug}.json` must be committed before step 8 (deleting
   the hardcoded page). It is the last safety net.
10. Write every file completely — no placeholders, no truncation.

Write every file completely. Start with `scripts/extract-to-puck.js`,
then `scripts/seed-pages.js`, then `scripts/validate-migration.js`, then
generate `migrations/en/pricing.json` as a worked example of a fully
populated migration JSON.
