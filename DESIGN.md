---
name: Plushelter
description: A satirical municipal shelter-management system for stuffed animals — bureaucratic sincerity with a candy palette.
colors:
  form-white: "#fffffc"
  warm-stamp-brown: "#4a3f35"
  intake-periwinkle: "#a0c4ff"
  treatment-lavender: "#bdb2ff"
  cleared-mint: "#caffbf"
  alert-salmon: "#ffadad"
  pending-peach: "#ffd6a5"
  case-tag-yellow: "#fdffb6"
  roster-cyan: "#9bf6ff"
  adoption-pink: "#ffc6ff"
typography:
  display:
    fontFamily: "'Fredoka', sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "'Fredoka', sans-serif"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1.2
  title:
    fontFamily: "'Fredoka', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.2
  body:
    fontFamily: "'Karla', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Space Mono', monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  md: "8px"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.5rem"
  6: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.intake-periwinkle}"
    textColor: "{colors.warm-stamp-brown}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-primary-active:
    backgroundColor: "{colors.intake-periwinkle}"
    textColor: "{colors.warm-stamp-brown}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-secondary:
    backgroundColor: "{colors.treatment-lavender}"
    textColor: "{colors.warm-stamp-brown}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  badge-available:
    backgroundColor: "{colors.cleared-mint}"
    textColor: "{colors.warm-stamp-brown}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.5rem"
  badge-critical:
    backgroundColor: "{colors.alert-salmon}"
    textColor: "{colors.warm-stamp-brown}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.5rem"
  badge-pending:
    backgroundColor: "{colors.pending-peach}"
    textColor: "{colors.warm-stamp-brown}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.5rem"
  badge-info:
    backgroundColor: "{colors.roster-cyan}"
    textColor: "{colors.warm-stamp-brown}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.5rem"
  badge-celebration:
    backgroundColor: "{colors.adoption-pink}"
    textColor: "{colors.warm-stamp-brown}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.5rem"
  badge-tag:
    backgroundColor: "{colors.case-tag-yellow}"
    textColor: "{colors.warm-stamp-brown}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.5rem"
---

# Design System: Plushelter

## 1. Overview

**Creative North Star: "The Candy-Colored Clerk"**

A filing-office worker with a surprisingly cheerful desk. The metaphor resolves every design question: the clerk half answers "should this feel official?" (yes, always); the candy-colored half answers "is this too cold or sterile?" (never). The design system is a municipal bureaucracy that happens to be outfitted in periwinkle and mint — not a playful app that happens to have a serious subject.

Every surface is flat and form-like. Borders are inked, not blurred. Status is stamped, not implied by subtle shade. The display font (Fredoka, rounded and friendly) gives the clerk a warm personality; the monospace stamps (Space Mono) give the paperwork its official register. The two never cross into each other's territory.

This system explicitly rejects the SaaS-cream aesthetic (off-white, Inter, soft drop-shadows, muted grays that read as "polished") and the playful-startup aesthetic (pastel gradients, gamified microinteractions, Duolingo-style exuberance). The candy colors here are *status indicators drawn from official government color codes for stuffed-animal case management* — not decoration, and never ironic.

**Key Characteristics:**
- Flat fills only — no gradients between any two palette colors, ever
- Stacked-paper shadow (2px solid offset, no blur) as the only depth signal
- Corner radius never exceeds 8px — gently curved, not bubbly
- 2px solid ink borders on every interactive element
- Projector-legible: all body and interactive text ≥16px, high contrast on the near-white ground

## 2. Colors: The Case File Palette

Ten named colors, each with a defined role. No color is decorative; every fill carries information. Status colors are reserved for their designated states — using Cleared Mint outside of an "available" context is an error, not a creative choice.

### Primary
- **Intake Periwinkle** (`#a0c4ff`): The primary interactive color. Buttons, focus rings, primary highlights. The case worker's preferred ink — official enough to feel like a designation, warm enough not to feel clinical.

### Secondary
- **Treatment Lavender** (`#bdb2ff`): Secondary interactive. Secondary buttons, secondary accents. Used when a second action exists alongside the primary, never to compete with it.

### Tertiary
- **Roster Cyan** (`#9bf6ff`): Informational fills. Informational status badges, gauge fill for the surrender-risk score (FR-3). Cool and factual — the color of a data readout.

### Neutral
- **Form White** (`#fffffc`): Page background. The blank intake form. Not pure white — warm enough to feel like paper, not a screen.
- **Warm Stamp Brown** (`#4a3f35`): Primary text and borders. The color of an official ink stamp — not pure black, which would feel digital rather than bureaucratic.

### Status (reserved — do not use outside their designated states)
- **Cleared Mint** (`#caffbf`): Status: available / healthy / adoption-ready. A green that reads as "cleared for placement."
- **Alert Salmon** (`#ffadad`): Status: needs attention / critical case. Serious without being alarming — this is a stuffed-animal triage system, not an emergency room.
- **Pending Peach** (`#ffd6a5`): Status: in treatment / pending review. The warm middle ground between cleared and critical.
- **Case Tag Yellow** (`#fdffb6`): Small badges and tags only. Too low-contrast for large fills — prohibited on any surface larger than a badge. The color of a sticky note attached to a case file.
- **Adoption Pink** (`#ffc6ff`): Reserved exclusively for successful adoption moments. Never used in other states. Its rarity is what makes it land.

**The Status Lock Rule.** Each status color belongs to exactly one state. Cleared Mint means "available." Alert Salmon means "critical." Pending Peach means "in treatment." Roster Cyan means "informational." Adoption Pink means "adopted." None of these may be used decoratively, in hero sections, or as brand accent colors. Violations make the system illegible on the projector.

**The No-Gradient Rule.** No gradient between any two palette colors. Not between Intake Periwinkle and Treatment Lavender. Not between Cleared Mint and Form White. Flat fills only. A gradient in this system is not a design choice — it is an error.

## 3. Typography

**Display Font:** Fredoka (400 / 600, with `sans-serif` fallback)
**Body Font:** Karla (400 / 700, with `sans-serif` fallback)
**Label / Stamp Font:** Space Mono (400 / 700, with `monospace` fallback)

**Character:** Fredoka's rounded geometry gives the headings a warm, approachable personality without tipping into child-product territory. Karla's humanist neutrality keeps body copy readable and invisible — it does not compete with the display font. Space Mono anchors every badge, stamp, and label in official register: this is a case number, a species classification, a status code.

### Hierarchy
- **Display** (Fredoka 600, 2.25rem, 1.2 leading): Page-level and section headings. Used sparingly — one per major region.
- **Headline** (Fredoka 400, 1.75rem, 1.2 leading): Sub-section headings. Lighter weight than Display to create hierarchy within a region.
- **Title** (Fredoka 400, 1.25rem, 1.2 leading): Card titles, form section labels, dialog headings.
- **Body** (Karla 400, 1rem, 1.5 leading): All body copy, form hints, descriptive text. Maximum 70ch line length. Never smaller than 1rem on a projector-facing screen.
- **Label / Stamp** (Space Mono 400, 0.75rem, uppercase, 0.05em tracking): Status badges, case tags, monospace identifiers. Never used for body copy or headings.

**The Font-Crossing Rule.** Fredoka is for display and headings. Karla is for body. Space Mono is for badges and labels. They do not cross. A badge in Fredoka is wrong. Body copy in Space Mono is unreadable at projector scale. Headings in Karla lose the warm–official contrast.

**The Scale Floor Rule.** On this projector-facing demo, 1rem is the minimum for any text the audience is expected to read. Badge text (0.75rem in Space Mono) is an exception — it carries a status label, not prose. Do not introduce a text-xs class and use it for running text.

## 4. Elevation

This is a **flat system with a single structural shadow**. There is no ambient drop-shadow vocabulary, no blur radius, no layered tonal elevation. Surfaces are flat at rest.

The one shadow is the stacked-paper shadow: `2px 2px 0 0 #4a3f35` — a 2px solid offset in Warm Stamp Brown, no blur, no spread. It reads as a physical card sitting slightly offset from the surface below it, like a document placed on a desk.

### Shadow Vocabulary
- **Stacked Paper** (`box-shadow: 2px 2px 0 0 #4a3f35`): Applied to interactive elements at rest — buttons, clickable case-file cards. Collapses to `none` on `:active` as the element "presses down" by `translate(2px, 2px)`. This is the only animation in the interaction model, and it is the most important: it makes the button feel like a physical stamp.

### Named Rules
**The One Shadow Rule.** One shadow, one role, one behavior. Never add blur. Never vary the offset per component. Never use `box-shadow` as a decorative accent (colored glow, soft diffusion, multiple layers). If an element needs depth, it gets the stacked-paper shadow. If it does not, it gets no shadow at all.

**The Press Rule.** On `:active`, interactive elements translate `(2px, 2px)` and their shadow collapses. This must be consistent across every button and clickable card. Inconsistency in this single interaction breaks the tactile metaphor.

## 5. Components

The component philosophy is **tactile and official.** Every click feels like a form submission. Every card feels like a stamped document. The stacked-paper shadow and the 2px solid border are not optional embellishments — they are what makes a button feel like a button in this system.

### Buttons
- **Shape:** Gently curved corners (8px radius — the maximum allowed in this system)
- **Primary:** Intake Periwinkle background, Warm Stamp Brown text, Fredoka 600 at 1rem. 0.5rem / 1rem padding. 2px solid Warm Stamp Brown border. Stacked-paper shadow at rest.
- **Active state:** Translates `(2px, 2px)`, shadow collapses to none. The press is the feedback.
- **Disabled:** 50% opacity, no shadow, `cursor: not-allowed`. No color change — opacity alone signals the state.
- **Secondary:** Treatment Lavender background, otherwise identical to primary. Used when a second action accompanies the primary — never alone as the only CTA.

### Status Badges / Stamps
- **Shape:** 4px radius — slightly less rounded than a button, reading as a tag or stamp rather than an action
- **Style:** Space Mono 400, 0.75rem, uppercase, 0.05em letter-spacing. 2px solid Warm Stamp Brown border. Color-filled background per status (see Colors section).
- **Sizes:** Badges are always small. If a badge text exceeds ~20 characters, it is a label error, not a size problem — rewrite the label.
- **Role attribute:** `role="status"` when the badge updates while visible (streaming AI response progress, roster updates). Static badges need no ARIA role.

### Case-File Cards
- **Shape:** 8px radius (same as button — they are actionable surfaces)
- **Background:** Form White (same as page background — the card is a document on the desk)
- **Border:** 2px solid Warm Stamp Brown — the card's edge is its frame, not a shadow
- **Shadow:** Stacked-paper shadow when `clickable` — the card "sits above" the surface. Flat (no shadow) when static.
- **Internal padding:** 1rem (--space-4)
- **Signature pattern:** When `clickable`, the card uses a real `<button>` element or correct `role="button"` — never a `<div>` with a click handler. Keyboard navigation is not optional.

### Form Fields
- **Style:** Native `<input>` styled with 2px solid Warm Stamp Brown border, 8px radius, Form White background
- **Focus:** 3px solid Intake Periwinkle outline, `outline-offset: 2px` — meets WCAG 2.1 AA focus visibility
- **Error:** Error text below the field, linked via `aria-describedby`. Error text in Alert Salmon (text, not fill — contrast requirement)
- **Hint:** Hint text below the label, linked via `aria-describedby`. Warm Stamp Brown at reduced opacity or a slightly lighter shade — never Case Tag Yellow as hint text (insufficient contrast)
- **Labels:** Native `<label for="...">` — never a placeholder as the only label

### Checklist Items
- **Structure:** Visually-hidden native `<input type="checkbox">` under a custom visual layer. Never a `<div>` with a click handler. The native input is the accessibility contract; the custom visual is a styling overlay only.
- **Disabled:** `opacity: 0.5`, pointer-events none. Pre-completed items (e.g., "Already completed at intake") are both checked and disabled.

### Chat Bubbles (Streaming)
- **User bubble:** Right-aligned. Intake Periwinkle background. Karla body text.
- **Concierge bubble:** Left-aligned. Form White background with 2px border. Karla body text.
- **Streaming container:** Must carry `aria-live="polite"` — this is not optional and not a post-hoc accessibility patch. It is the mechanism that makes the streaming response accessible to screen readers.

### Confirm Dialog
- **Implementation:** `@angular/cdk/dialog` — CDK Dialog, not a custom `<div>`. Focus trap, return-focus-on-close, `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
- **Backdrop:** `color-mix(in srgb, #4a3f35 40%, transparent)` — Warm Stamp Brown at 40% opacity. Reads as a filing-cabinet drawer being pulled in front of the page.

## 6. Do's and Don'ts

### Do:
- **Do** use flat fills. Every color is a flat fill. Gradients between palette colors are prohibited.
- **Do** keep corner radius at or below 8px (--radius-md). Anything rounder is the playful-startup aesthetic this system rejects.
- **Do** use the stacked-paper shadow (`2px 2px 0 0 #4a3f35`) for interactive elements at rest — and collapse it on `:active` with a `translate(2px, 2px)`.
- **Do** use Space Mono for badges, stamps, and case identifiers — uppercase, tracked. It is the official register of this system.
- **Do** use native semantic HTML: `<button>`, `<input type="checkbox">`, `<label for="...">`, `<dialog>`. The semantic structure is the accessibility contract.
- **Do** write every label, error message, and empty state in complete bureaucratic sincerity — as if this were real municipal software. No winking, no acknowledgment of the joke.
- **Do** keep all interactive and body text at or above 1rem (16px). This runs on a projector at 1280×720; small text is invisible to the back row.
- **Do** use `aria-live="polite"` on the streaming chat container. It is structural, not optional.

### Don't:
- **Don't** use gradients — between palette colors, between a palette color and transparent, or as a decorative background. The No-Gradient Rule is absolute.
- **Don't** use soft drop-shadows (blurred `box-shadow`). This is the SaaS-cream / Linear aesthetic this system explicitly rejects. One flat offset shadow, or none.
- **Don't** use border-radius above 8px on cards, inputs, or buttons. Over-rounded corners read as Duolingo, not municipal shelter.
- **Don't** use Adoption Pink (`#ffc6ff`) outside of a successful adoption moment. Its rarity is what makes it land. Using it as a brand accent destroys the effect.
- **Don't** use Case Tag Yellow (`#fdffb6`) for large fills. It fails contrast requirements at body-text scale. Badges only.
- **Don't** use Inter. The specs prohibit it by name. Inter is the SaaS-cream typeface this system is not.
- **Don't** use status colors as decorative fills. Cleared Mint is not a section background. Alert Salmon is not a highlight. Each color owns exactly one state.
- **Don't** use a `<div>` with a click handler for interactive elements. Not for cards, not for checklist items, not for any clickable surface. Real buttons, real checkboxes.
- **Don't** write copy that acknowledges the joke. The UI is deadpan. The absurdity is the user's to notice — the interface never winks.
- **Don't** introduce the SaaS-cream aesthetic: off-white (`#fafaf9` / `oklch(97% 0.005 95)`) body backgrounds, Inter as body font, soft-shadow cards with no borders. This is the primary anti-reference from PRODUCT.md.
- **Don't** introduce the playful-startup aesthetic: pastel gradient panels, consumer-app microinteractions, gamified progress indicators. This system is deadpan municipal software — the candy palette is the only concession to warmth, and it is structural, not decorative.
