## Phase 2 — Puck Component Library

### Package: `@myallocator/puck-components`

A full Puck drag-and-drop component library built with React, TypeScript, and Tailwind CSS. Registered via a single `puckConfig` object and consumed by both the dashboard editor and the website renderer.

---

### 2.1 Package Structure

```
packages/puck-components/
├── src/
│   ├── index.ts                          # Main entry: re-exports puckConfig + all component types/configs
│   ├── puck-config.tsx                   # puckConfig: full component registry, categories, root config
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Container.tsx             # Centered max-width wrapper with responsive padding
│   │   │   ├── Section.tsx               # Full-width section with bg, padding, border, scroll animations
│   │   │   ├── Columns.tsx               # Responsive 2–6 column flex layout with slot support
│   │   │   ├── Grid.tsx                  # CSS grid layout with configurable columns and gap
│   │   │   ├── BentoGrid.tsx             # Bento-style asymmetric feature grid
│   │   │   ├── Spacer.tsx                # Vertical whitespace block
│   │   │   ├── Divider.tsx               # Horizontal rule with style/color/width options
│   │   │   └── Separator.tsx             # Semantic separator with optional label
│   │   ├── typography/
│   │   │   ├── Heading.tsx               # H1–H6 with size, weight, color, alignment, animation
│   │   │   ├── Paragraph.tsx             # Body text with size, color, alignment, max-width
│   │   │   ├── RichText.tsx              # Textarea-based HTML prose block
│   │   │   ├── Badge.tsx                 # Pill/tag badge with color and size variants
│   │   │   └── Avatar.tsx                # Avatar image + name + subtitle
│   │   ├── hero/
│   │   │   ├── Hero.tsx                  # Full-width hero: heading, subheading, bg image/color, actions slot
│   │   │   └── HeroSplit.tsx             # Split hero: text left/right + image, actions slot
│   │   ├── content/
│   │   │   ├── TextWithImage.tsx         # Text + image two-column section (reversible)
│   │   │   ├── FeatureCard.tsx           # Icon + title + description card
│   │   │   ├── StatsBar.tsx              # Row of stat items (number + label)
│   │   │   ├── Card.tsx                  # Generic content card with image, title, body, CTA
│   │   │   ├── Alert.tsx                 # Dismissible alert/banner with severity variants
│   │   │   └── IconBlock.tsx             # SVG icon + label + optional description
│   │   ├── media/
│   │   │   ├── ImageBlock.tsx            # Image with alt, caption, rounded, shadow, max-width
│   │   │   └── VideoEmbed.tsx            # YouTube/Vimeo embed with aspect ratio
│   │   ├── cta/
│   │   │   ├── Button.tsx                # Standalone button: 10 variants, sizes, icon, fullWidth
│   │   │   ├── ButtonGroup.tsx           # Horizontal group of Button slots with alignment/gap
│   │   │   └── CTABanner.tsx             # Full-width CTA banner with heading, description, actions slot
│   │   ├── social/
│   │   │   ├── Testimonial.tsx           # Single quote block with author, role, avatar, rating
│   │   │   ├── TestimonialCarousel.tsx   # Auto-scrolling carousel of testimonials
│   │   │   ├── LogoCloud.tsx             # Static grid of brand/partner logos
│   │   │   └── Marquee.tsx               # Infinite-scroll logo ticker
│   │   ├── pricing/
│   │   │   ├── PricingCard.tsx           # Single plan card with features list, CTA, highlight
│   │   │   ├── PricingTable.tsx          # Side-by-side multi-plan pricing table
│   │   │   └── ComparisonTable.tsx       # Feature comparison matrix (plans × features)
│   │   ├── interactive/
│   │   │   ├── FAQ.tsx                   # Accordion FAQ section (1 or 2 columns)
│   │   │   ├── Accordion.tsx             # Single collapsible accordion item
│   │   │   ├── List.tsx                  # Ordered or unordered styled list
│   │   │   ├── Tabs.tsx                  # Tabbed content panels
│   │   │   ├── Progress.tsx              # Labeled progress bar(s)
│   │   │   └── Countdown.tsx             # Countdown timer to a target date
│   │   └── navigation/
│   │       ├── Navbar.tsx                # Full-featured navbar (logo, links, CTA, mobile menu)
│   │       ├── Footer.tsx                # Multi-column footer (links, social, logo, bottom bar)
│   │       ├── Banner.tsx                # Top-of-page announcement banner
│   │       └── Breadcrumb.tsx            # Breadcrumb navigation trail
│   ├── lib/
│   │   ├── fields.ts                     # Shared field definitions + padding/color utilities
│   │   ├── cn.ts                         # clsx/twMerge utility
│   │   ├── animations.ts                 # Animation maps, field definitions, keyframe CSS string
│   │   ├── use-animation.tsx             # useScrollAnimation hook (IntersectionObserver)
│   │   ├── use-animation-styles.ts       # Injects animation keyframe <style> into Puck iframe
│   │   ├── InlineField.tsx               # Custom Puck field for inline content editing
│   │   └── use-inline-edit.ts            # Hook for inline edit state management
│   └── types/
│       └── index.ts                      # Shared TypeScript types
│
├── tailwind.config.ts                    # Tailwind content: ["./src/**/*.{ts,tsx}"]
├── tsconfig.json                         # Extends ../../packages/typescript-config/base.json
├── tsup.config.ts                        # ESM + CJS dual output, external peer deps
└── package.json
```

---

### 2.2 Package Configuration

**package.json** — peer deps are `@puckeditor/core ^0.21.0`, `react ^19`, `react-dom ^19`. `clsx` is a direct dependency. Dual ESM/CJS exports:

```json
{
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

**Why `external: ['react', 'react-dom', '@measured/puck']`:** These are peer dependencies — the consuming apps (dashboard and website) provide them. Bundling them would cause duplicate React instances and break hooks.

**Why ESM + CJS dual output:**

- The website (Next.js Pages Router) may import via CommonJS in `getStaticProps` (server-side Node.js)
- The dashboard (Vite) imports via ESM
- Dual output covers both consumption patterns

**tsup.config.ts** — single bundle, no splitting, external peer deps:

```typescript
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "@puckeditor/core"],
  splitting: false,
  treeshake: true,
});
```

> **Why external?** The consuming apps (dashboard via Vite, website via Next.js) provide React and Puck. Bundling them would create duplicate React instances and break hooks.

---

### 2.3 puckConfig Structure (`src/puck-config.tsx`)

The config is exported from `puck-config.tsx` (not `config.ts`) and re-exported from `index.ts`.

#### Root Fields

Every page in the CMS has these root-level settings:

| Field             | Type                    | Description                                          |
| ----------------- | ----------------------- | ---------------------------------------------------- |
| `title`           | `text`                  | Internal page title                                  |
| `seoTitle`        | `text`                  | `<title>` tag override                               |
| `seoDescription`  | `textarea`              | Meta description                                     |
| `seoKeywords`     | `text`                  | Comma-separated meta keywords                        |
| `backgroundColor` | `custom` (color picker) | Page background color                                |
| `fontFamily`      | `select`                | System Default / Inter / Plus Jakarta Sans / DM Sans |

The root `render` wraps children in a `<div>` with `backgroundColor` and `fontFamily` inline styles, and injects two `<style>` blocks via `dangerouslySetInnerHTML`: **animation keyframes** and **responsive padding CSS variables**.

#### Responsive Padding System (`data-responsive-padding`)

Components that support padding use CSS custom properties instead of Tailwind arbitrary classes and instead of reacting incorrectly when switching to "None". Any element with `data-responsive-padding` gets its padding driven by these variables:

```
--py-base, --py-sm, --py-md, --py-lg, --py-xl   (vertical)
--px-base, --px-sm, --px-md, --px-lg, --px-xl   (horizontal)
```

The root injects a `<style>` block with 5 breakpoint-cascading media query rules. Components set these variables via inline `style` using `resolvePaddingVars(paddingY, paddingX)` from `lib/fields.ts`.

**`resolvePaddingVars`** always resolves all 5 breakpoints to concrete string values (never `undefined`), so React always writes every CSS custom property to the DOM and stale values never persist when switching to "None".

#### Component Categories (sidebar grouping)

| Category key  | Display Title   | Components                                                                     |
| ------------- | --------------- | ------------------------------------------------------------------------------ |
| `navigation`  | Navigation      | Navbar, Footer, Banner, Breadcrumb                                             |
| `layout`      | Layout          | Container, Section, Columns, Grid, BentoGrid, Spacer, Divider, Separator, Card |
| `typography`  | Typography      | Heading, Paragraph, RichText, Badge, Avatar, List                              |
| `hero`        | Hero Sections   | Hero, HeroSplit                                                                |
| `content`     | Content         | TextWithImage, FeatureCard, StatsBar, Alert, IconBlock                         |
| `media`       | Media           | Image, Video                                                                   |
| `cta`         | Calls to Action | Button, ButtonGroup, CTABanner                                                 |
| `social`      | Social Proof    | Testimonial, TestimonialCarousel, LogoCloud, Marquee                           |
| `pricing`     | Pricing         | PricingCard, PricingTable, ComparisonTable                                     |
| `interactive` | Interactive     | FAQ, Accordion, Tabs, Progress, Countdown                                      |

---

### 2.4 Shared Utilities (`src/lib/`)

#### `fields.ts`

Central source for all reusable Puck field definitions and style maps:

- **Custom field renderers**: `colorFieldRender` (color swatch + hex input), `imageFieldRender` (file picker + preview thumbnail)
- **Reusable field configs**: `backgroundColorField`, `textColorField`, `imageField`, `paddingYField`, `paddingXField`, `textAlignField`, `maxWidthField`
- **Style maps**: `paddingYMap`, `paddingXMap`, `maxWidthMap`, `textAlignMap` — keyed by the option value strings, resolved to CSS pixel/rem values
- **`resolvePaddingVars(paddingY?, paddingX?)`** — resolves the full 5-breakpoint inheritance chain to concrete strings, avoids stale CSS variable bug in React

#### `animations.ts`

- `animationMap` — 12 named animations (`fade-in`, `fade-up`, `zoom-in`, `bounce`, `float`, etc.) mapped to `puck-animate-*` CSS class names
- `animationDurationMap` — `fast/normal/slow/very-slow`
- `animationDelayMap` — `none/short/medium/long`
- `animationStyles` — CSS string with all `@keyframes` and `.puck-animate-*` class definitions, injected by the root render
- `animationField`, `animationDurationField`, `animationDelayField` — reusable Puck `select` field configs

#### `use-animation.tsx`

`useScrollAnimation(animation, duration, delay)` — uses `IntersectionObserver` to trigger animations when a component scrolls into view. Returns `{ ref, animationClassName, style }` to spread onto the animated element.

---

### 2.5 Slot-Based Action System

Hero and CTA components accept child components (buttons) via Puck's **slot** field type. This allows editors to drop any number of `Button` or `ButtonGroup` components into a parent's action area.

- `Hero` has an `actions` slot (allows `Button`, `ButtonGroup`)
- `HeroSplit` has an `actions` slot (allows `Button`, `ButtonGroup`)
- `CTABanner` has an `actions` slot (allows `Button`, `ButtonGroup`)
- `ButtonGroup` has a `buttons` slot (allows `Button`)

The slot is rendered by casting the `ReactNode` prop to `React.FC<{ className?: string }>` and calling it with layout classes. `Button` has `inline: true` in its config so Puck does not wrap it in its own `<div>`, making it a direct flex child of the slot container.

`Button` uses inline `style` for all dynamic values (`backgroundColor`, `color`, `width`) rather than Tailwind dynamic classes, because Tailwind cannot scan runtime-conditional class names.

---

### 2.6 Known Implementation Patterns

**Tailwind dynamic classes**: Arbitrary-value classes like `grid-rows-[1fr]` built via ternary are never written verbatim in source, so Tailwind never generates them. Interactive components (`FAQ`, `Accordion`, `Tabs`) use inline `style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}` for collapse/expand animation instead.

**`defaultOpen` sync in Accordion**: `useState(defaultOpen)` only captures the initial value. A `useEffect(() => setIsOpen(defaultOpen), [defaultOpen])` synchronises the state when the editor panel prop changes.

**Puck editor vs. live site**: Components check `puck?.isEditing` to swap `<a>` for `<button>`, disable navigation, and show all viewport states (e.g. Navbar always shows desktop links in the editor regardless of screen width).

**`inline: true` on Button config**: Puck normally wraps each slot item in a `<div>`. Setting `inline: true` suppresses that wrapper, letting `Button` be a direct flex child in action slots.

### 2.7 IMPLEMENTATION RULES

- Strict TypeScript — every props interface explicitly typed, no any
- The render function must be a proper React component (hooks allowed)
- Do NOT rewrite the component's internal logic — only wrap it
- All array fields must have proper arrayFields definitions, defaultProps must produce a component that visually renders (not blank)
- The package must work as both a CJS and ESM module (configure in package.json exports field)
- Each component folder gets its own types.ts — no barrel type re-exports that break tree-shaking
- Write every file completely.
