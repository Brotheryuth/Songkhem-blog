## 1. Font Family Stacks
```css
:root {
  /* Latin: Authentic Google Sans / Roboto */
  --font-sans: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  /* Khmer: Modern legible high-contrast glyphs */
  --font-khmer: 'Kantumruy Pro', 'Suwannaphum', 'Noto Sans Khmer', sans-serif;
  /* Monospace: Code blocks & technical metadata */
  --font-mono: 'Google Sans Mono', 'Fira Code', 'Courier New', monospace;
}
```
---
## 2. Google Material 3 Type Scale
| Role | Font Size | Line Height | Tracking | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Large** | `2.5rem` (40px) | `1.2` | `-0.25px` | `700` | Landing hero title |
| **Headline (H1)** | `2.0rem` (32px) | `1.25`| `0px` | `600` | Article main title |
| **Heading (H2)**  | `1.5rem` (24px) | `1.3` | `0px` | `600` | Major content sections |
| **Subhead (H3)**  | `1.25rem` (20px)| `1.4` | `+0.15px`| `600` | Subsection headers |
| **Body Longform** | `1.125rem` (18px)| `1.75`| `+0.25px`| `400` | Article body paragraphs |
| **Body Medium**   | `1.0rem` (16px) | `1.6` | `+0.25px`| `400` | Card & snippet descriptions |
| **Caption / Meta**| `0.8125rem` (13px)| `1.4`| `+0.4px` | `500` | Timestamps, tags, author info |
---
## 3. Official Google Material 3 Theme Tokens
```css
/* Light Mode (Google Standard) */
:root {
  /* Typography Roles */
  --md-sys-color-on-surface: #1F1F1F;
  --md-sys-color-on-surface-variant: #444746;
  --md-sys-color-outline: #747775;
  --md-sys-color-outline-variant: #E2E8F0;
  /* Surface Roles */
  --md-sys-color-surface: #FFFFFF;
  --md-sys-color-surface-dim: #F8FAFD;
  --md-sys-color-surface-container: #F0F4F9;
  --md-sys-color-surface-container-high: #E9EEF6;
  /* Brand Accents */
  --md-sys-color-primary: #005AC1;
  --md-sys-color-on-primary: #FFFFFF;
  --md-sys-color-secondary-container: #C2E7FF;
  --md-sys-color-on-secondary-container: #041E49;
}
/* Dark Mode (Google Charcoal Standard) */
[data-theme="dark"] {
  /* Typography Roles */
  --md-sys-color-on-surface: #E3E3E3;
  --md-sys-color-on-surface-variant: #C4C7C5;
  --md-sys-color-outline: #8E918F;
  --md-sys-color-outline-variant: #444746;
  /* Surface Roles (Neutral Charcoal) */
  --md-sys-color-surface: #121316;
  --md-sys-color-surface-dim: #0E0F12;
  --md-sys-color-surface-container: #1E1F22;
  --md-sys-color-surface-container-high: #282A2D;
  /* Brand Accents */
  --md-sys-color-primary: #A8C7FA;
  --md-sys-color-on-primary: #002D6C;
  --md-sys-color-secondary-container: #004A77;
  --md-sys-color-on-secondary-container: #C2E7FF;
}
/* Contrast Mode (WCAG AAA) */
[data-theme="contrast"] {
  --md-sys-color-on-surface: #FFFFFF;
  --md-sys-color-on-surface-variant: #FFFF00;
  --md-sys-color-outline: #FFFF00;
  --md-sys-color-outline-variant: #FFFF00;
  --md-sys-color-surface: #000000;
  --md-sys-color-surface-dim: #000000;
  --md-sys-color-surface-container: #121212;
  --md-sys-color-surface-container-high: #1E1E1E;
  --md-sys-color-primary: #FFFF00;
  --md-sys-color-on-primary: #000000;
  --md-sys-color-secondary-container: #FFFF00;
  --md-sys-color-on-secondary-container: #000000;
}
```
---
## 4. Typography Implementation Rules
1. **Khmer Diacritic Clearance**: Automatically apply `line-height: 1.8` to any element using `--font-khmer` to prevent stacked subscript collision.
2. **Reading Column Width**: Restrict article longform containers to a strict maximum width of `68ch` (`720px`).
3. **Dark Mode Optical Tuning**: In dark mode, text elements apply `letter-spacing: 0.02em` and subpixel antialiasing to prevent text bleed.
4. **Fluid Heading Scaling**: Major headlines scale responsively using `clamp(1.75rem, 4vw, 2.5rem)` across breakpoints.