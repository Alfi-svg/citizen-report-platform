# UI Design System Specification — Bangladesh Citizen Report Platform
**Version:** 1.0.0  
**Design Philosophy:** Clean, Modern, Professional, Trustworthy, Minimal, Mobile-First.

---

## 1. Brand & Color Tokens

The Bangladesh Citizen Report design system balances civic authority and trust with calm, modern digital product aesthetics.

### 1.1 Primary & Accent Palette
- **Primary (Bangladesh Forest Green):**
  - `primary`: `#006a4e` (Hex) / `rgb(0, 106, 78)`
  - `primary-hover`: `#00523d`
  - `primary-dark`: `#003d2d`
  - `primary-subtle`: `#ecfdf5` (Dark mode: `rgba(0, 106, 78, 0.15)`)
  - *Usage:* Primary CTAs, verified trust badges, active navigation indicators, key positive states.
- **Accent Danger / Emergency (Bangladesh Crimson):**
  - `accent-red`: `#dc2626` / `#f42a41`
  - `accent-red-hover`: `#b91c1c`
  - `accent-red-subtle`: `#fef2f2` (Dark mode: `rgba(220, 38, 38, 0.15)`)
  - *Usage:* Strictly reserved for 999 Emergency SOS, critical missing person alerts, destructive modal confirmations, and high-risk safety alerts.
- **Warning / Attention (Civic Amber):**
  - `warning`: `#d97706`
  - `warning-subtle`: `#fffbeb` (Dark mode: `rgba(217, 119, 6, 0.15)`)
  - *Usage:* Under-verification states, hazard alerts, duplicate sighting warnings.
- **Information / Review (Civic Blue):**
  - `info`: `#2563eb`
  - `info-subtle`: `#eff6ff` (Dark mode: `rgba(37, 99, 235, 0.15)`)
  - *Usage:* Moderator review notices, general civic notifications, informational guides.

### 1.2 Neutral & Surface Scale (Light & Dark)
| Token | Light Value | Dark Value | Purpose |
| :--- | :--- | :--- | :--- |
| `background` | `#f8fafc` (slate-50) | `#09090b` (zinc-950) | Page body background |
| `surface` | `#ffffff` | `#18181b` (zinc-900) | Card and container background |
| `surface-muted` | `#f1f5f9` (slate-100) | `#27272a` (zinc-800) | Input fields, subtle tabs, table headers |
| `border` | `#e2e8f0` (slate-200) | `#27272a` (zinc-800) | Hairline borders for cards and dividers |
| `border-subtle` | `#f1f5f9` (slate-100) | `#1f1f23` | Inner card dividers |
| `text-primary` | `#0f172a` (slate-900) | `#f8fafc` (zinc-50) | Primary headings and body text |
| `text-secondary`| `#475569` (slate-600) | `#a1a1aa` (zinc-400) | Subheadings and descriptive text |
| `text-muted` | `#94a3b8` (slate-400) | `#71717a` (zinc-500) | Timestamps, placeholders, metadata |

---

## 2. Typography Scale (Bilingual: English & Bengali)

Both English and Bengali text share font configurations optimized for digital readability and optical balance across mobile and desktop displays.

### 2.1 Font Family
```css
font-sans: "Hind Siliguri", "Noto Sans Bengali", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

### 2.2 Typographic Hierarchy
| Role | Size | Line Height | Weight | Tailwind Equivalent |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | 32px / 36px | 1.2 | 800 (Extrabold) | `text-3xl font-extrabold tracking-tight` |
| **H1 (Page Title)** | 24px / 28px | 1.25 | 700 (Bold) | `text-2xl sm:text-3xl font-bold tracking-tight` |
| **H2 (Section)** | 18px / 20px | 1.3 | 700 (Bold) | `text-lg sm:text-xl font-bold` |
| **H3 (Card Title)** | 15px / 16px | 1.4 | 600 (Semibold) | `text-sm sm:text-base font-semibold` |
| **Body (Default)** | 14px | 1.6 | 400 (Regular) | `text-sm leading-relaxed` |
| **Small / Helper** | 12px | 1.5 | 500 (Medium) | `text-xs leading-normal` |
| **Caption / Meta** | 11px | 1.4 | 500 (Medium) | `text-[11px] leading-tight` |
| **Badge / Tag** | 11px | 1.0 | 700 (Bold) | `text-[11px] font-bold tracking-wide` |

---

## 3. Spacing, Radius & Elevation Tokens

### 3.1 Spacing Scale (4px Base Grid)
- `space-1`: `4px` (`gap-1`, `p-1`)
- `space-2`: `8px` (`gap-2`, `p-2`)
- `space-3`: `12px` (`gap-3`, `p-3`)
- `space-4`: `16px` (`gap-4`, `p-4`) — Standard mobile card padding
- `space-6`: `24px` (`gap-6`, `p-6`) — Standard desktop card padding
- `space-8`: `32px` (`gap-8`, `p-8`) — Standard section spacing
- `space-12`: `48px` (`py-12`) — Standard hero/page block padding

### 3.2 Border Radius System
- `radius-sm`: `6px` (`rounded-md`) — Form inputs, badges, select menus.
- `radius-md`: `10px` (`rounded-lg`) — Standard buttons, dropdowns, tooltips.
- `radius-lg`: `14px` (`rounded-xl`) — Cards, modal dialogs, map containers.
- `radius-full`: `9999px` (`rounded-full`) — Pill badges, avatar icons, floating action buttons.

### 3.3 Minimal Elevation & Shadows
No dramatic blurs, heavy drops, or excessive glow:
- `shadow-2xs`: `0 1px 2px 0 rgba(0, 0, 0, 0.05)` — Subtle card elevation.
- `shadow-xs`: `0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)` — Primary buttons, active cards.
- `shadow-md`: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)` — Modals, popovers, mobile bottom nav.

---

## 4. Core UI Component Specifications

### 4.1 Button System
- **Primary:** Background `bg-emerald-700 hover:bg-emerald-800`, text `text-white font-semibold`, shadow `shadow-xs`.
- **Secondary:** Background `bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700`, text `text-zinc-800 dark:text-zinc-200`.
- **Outline:** Background `transparent`, border `border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800`, text `text-zinc-700 dark:text-zinc-300`.
- **Danger:** Background `bg-red-600 hover:bg-red-700`, text `text-white font-semibold`, shadow `shadow-xs`.
- **Ghost:** Background `transparent hover:bg-zinc-100 dark:hover:bg-zinc-800`, text `text-zinc-600 dark:text-zinc-400`.
- **Sizes:**
  - `sm`: Height `32px`, padding `px-3 py-1`, text `text-xs`.
  - `md`: Height `40px`, padding `px-4 py-2`, text `text-sm`.
  - `lg`: Height `48px`, padding `px-6 py-3`, text `text-base`.
- **Touch Target:** Minimum `44x44px` on mobile screens.

### 4.2 Form Controls
- Standard height `40px` (matches `md` button).
- Background `bg-white dark:bg-zinc-900`, border `border border-zinc-200 dark:border-zinc-700`.
- Focus state: `focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700`.
- Helper text in `text-xs text-zinc-500`.
- Error text in `text-xs text-red-600 font-medium` with `border-red-400` on input.

### 4.3 Card Language
- Base container: `bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs`.
- Padding: `p-4 sm:p-6`.
- Separators: `border-b border-zinc-100 dark:border-zinc-800`.

### 4.4 Status Badges
- **Approved / Verified:** Green pill badge (`bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800`).
- **Active Alert:** Crimson pulse badge (`bg-red-600 text-white font-bold animate-pulse`).
- **Under Review / Submitted:** Amber pill badge (`bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800`).
- **Found / Safe:** Teal pill badge (`bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800`).

---

## 5. Navigation Architecture

### 5.1 Desktop Navigation (Top Bar)
- Height: `64px` (`h-16`).
- Max-width: `1280px` (`max-w-7xl`).
- Left: Official Brand Emblem + Title.
- Center: Core Navigation Links:
  1. `Feed (হোম ফিড)` → `/`
  2. `Safety Map (নিরাপত্তা মানচিত্র)` → `/safety-map`
  3. `Missing Persons (নিখোঁজ ব্যক্তি)` → `/missing-person`
  4. `Find Help (জরুরি সেবা)` → `/safety`
  5. `Transparency (স্বচ্ছতা)` → `/transparency`
- Right: Emergency SOS Shortcut (`999`) + Incident Report CTA (`+ Report`) + Language Switcher + Auth Profile.

### 5.2 Mobile Bottom Navigation
- Fixed at bottom with safe-area padding: `pb-safe`.
- Height: `56px` (`h-14`) + safe area inset.
- 5 Primary Slots (minimum 44x44px touch targets):
  1. Feed (`/`)
  2. Map (`/safety-map`)
  3. + Report (`/reports/create`) — Centered elevated action button.
  4. Missing (`/missing-person`)
  5. SOS 999 (`/safety`) — Emergency access.

---

## 6. Responsive Breakpoints & Accessibility (WCAG 2.1 AA)

- **Breakpoints:**
  - `sm`: `640px`
  - `md`: `768px` (Navigation shifts from mobile bottom bar to desktop top bar)
  - `lg`: `1024px`
  - `xl`: `1280px`
  - `2xl`: `1536px`
- **Accessibility Safeguards:**
  - Standard focus-visible ring on all interactive elements.
  - Semantic HTML (`<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<footer>`).
  - Screen reader announcements (`aria-live="polite"` for real-time alerts).
  - High contrast ratio (minimum 4.5:1 for all textual content).
  - Respects `prefers-reduced-motion: reduce`.
