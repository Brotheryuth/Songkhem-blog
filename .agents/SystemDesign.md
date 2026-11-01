# Architecture Spec: songKHEM Editorial & Landing System

## 1. System File Structure (Astro + Three.js)

```text
src/
├── assets/
│   └── brand/               # Logos, icons, social share graphics
├── components/
│   ├── layout/              # HeaderNav.astro, Footer.astro, LangToggle.astro
│   ├── sections/            # HeroSection.astro, FeaturesSection.astro, AboutSection.astro, ContactSection.astro
│   ├── 3d/                  # HeroScene.astro (Three.js canvas island)
│   ├── blog/                # ArticleCard.astro, TableOfContents.astro, AuthorMeta.astro
│   └── ui/                  # Button.astro, PillBadge.astro, SurfaceCard.astro
├── content/
│   └── blog/                # Raw .md / .mdx articles & frontmatter schemas
├── pages/
│   ├── index.astro          # Single-page scrollable landing (#hero, #features, #about, #contact)
│   └── blog/
│       ├── index.astro      # Full blog archive
│       └── [...slug].astro  # Dynamic reader-first article route
└── styles/
    ├── design-system.css    # Spacing, containers, breakpoints, M3 surfaces
    └── reset.css            # Modern normalize & smooth scroll rules
```

---

## 2. Single-Page Navigation & Anchor Architecture

| Nav Item | Anchor Target | Content |
| :--- | :--- | :--- |
| **Home** | `#hero` | 3D Interactive Canvas + Value Proposition + Primary CTA |
| **Features** | `#features` | Scroll-triggered showcase: Khmer OCR, Speech, TalkBack |
| **About** | `#about` | Mission, accessibility values, impact story |
| **Blog** | `#blog` | Latest 3 articles feed with link to full `/blog` |
| **Contact** | `#contact` | Feedback, developer contact, community links |
| **Action** | `https://app.songkhem.com` | Persistent `Open App ↗` external link |

```css
/* Smooth Scroll & Sticky Header Offset */
html {
  scroll-behavior: smooth;
  scroll-padding-top: 80px; /* 64px header + 16px buffer */
}
```

---

## 3. Spacing & Container Tokens

| Token | Value | Purpose |
| :--- | :--- | :--- |
| `--space-1` | `4px` | Micro gaps & pill paddings |
| `--space-2` | `8px` | Icon-to-label spacing |
| `--space-3` | `12px` | Compact component padding |
| `--space-4` | `16px` | Mobile gutters & card padding |
| `--space-5` | `24px` | Desktop grid gaps |
| `--space-6` | `32px` | Sub-section spacing |
| `--space-7` | `48px` | Section vertical rhythm |
| `--space-8` | `64px` | Major landmark margins |
| `--container-editorial` | `720px` | Longform article reading column |
| `--container-max` | `1200px` | Global page shell & section limit |

---

## 4. Google Material 3 Surface & Color Tokens

```css
:root {
  /* Google Standard Light Mode */
  --md-sys-color-on-surface: #1F1F1F;
  --md-sys-color-on-surface-variant: #444746;
  --md-sys-color-outline: #747775;
  --md-sys-color-surface: #FFFFFF;
  --md-sys-color-surface-container: #F0F4F9;
  --md-sys-color-surface-container-high: #E9EEF6;
  --md-sys-color-primary: #005AC1;
  --md-sys-color-secondary-container: #C2E7FF;
  --md-sys-color-on-secondary-container: #041E49;

  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 9999px;
}

[data-theme="dark"] {
  /* Official Google Charcoal Dark Mode */
  --md-sys-color-on-surface: #E3E3E3;
  --md-sys-color-on-surface-variant: #C4C7C5;
  --md-sys-color-outline: #8E918F;
  --md-sys-color-surface: #121316;
  --md-sys-color-surface-container: #1E1F22;
  --md-sys-color-surface-container-high: #282A2D;
  --md-sys-color-primary: #A8C7FA;
  --md-sys-color-secondary-container: #004A77;
  --md-sys-color-on-secondary-container: #C2E7FF;
}

[data-theme="contrast"] {
  /* High Contrast (WCAG AAA) */
  --md-sys-color-on-surface: #FFFFFF;
  --md-sys-color-on-surface-variant: #FFFF00;
  --md-sys-color-outline: #FFFF00;
  --md-sys-color-surface: #000000;
  --md-sys-color-surface-container: #121212;
  --md-sys-color-primary: #FFFF00;
  --md-sys-color-secondary-container: #FFFF00;
  --md-sys-color-on-secondary-container: #000000;
}
```

---

## 5. Responsive & 3D Performance Rules

1. **Three.js Performance Guard**: Three.js runs only on `#hero` using `requestAnimationFrame`. If the hero scrolls out of viewport, stop rendering to conserve battery and CPU.
2. **Mobile Layout (< 768px)**: Single column flow, edge-to-edge section cards, compact 60px header with collapsed anchor menu.
3. **Desktop Layout (1024px+)**: `1200px` max page shell, sticky header with active section spy indicator (`IntersectionObserver`).
4. **Article Route Isolation**: Landing page is a single scroll; individual articles render on dedicated static routes (`/blog/[slug]`) for SEO indexing.