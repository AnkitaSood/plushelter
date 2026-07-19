# Product

## Register

product

## Users

Conference attendees watching a live, on-stage demo on July 22, 2026. The primary "user" during the show is the speaker, who must understand and explain every file in real time under conference conditions. Secondary users in rehearsal are the same person, with zero tolerance for slow or broken flows.

## Product Purpose

Plushelter is a satirical shelter-management app for stuffed animals — built as the live demo for a conference talk on Angular signal-based reactivity driving Gemini AI features. The subject is S.A.R.F. (thesarf.org), a real Austin nonprofit. The product has three beats: intake triage via vision AI (FR-1), a freetext adoption concierge with tool-calling and streaming (FR-2), and an optional surrender-risk scorer (FR-3). Success looks like: the demo runs to completion on stage with no visible AI latency surprises, and every signal pattern demonstrated is legible in code and in UI.

## Brand Personality

**Bureaucratic, warm, absurd.** Every string of user-facing text — labels, error messages, empty states, the Concierge's voice — is written with complete official sincerity, as if this were real municipal shelter software. The warmth lives in the candy palette and the rounded display font, not in the copy tone. The absurdity is in the subject matter, never in the UI's demeanor. Never wink; never acknowledge the joke.

## Anti-references

- **No SaaS-cream / Linear-style:** Not off-white backgrounds, Inter font, soft-shadow cards, and muted grays. That aesthetic looks like a product pitch, not a shelter intake system.
- **No playful-startup / Duolingo-style:** Not gamified, not consumer-cute, not pastel-gradient. The candy colors are official status indicators, not decoration. Too cute collapses the deadpan.

## Design Principles

1. **Bureaucratic sincerity.** Every label, error, and empty state is written as if this were real municipal software. The UI never acknowledges the joke — the absurdity is the user's to notice.
2. **Projector legibility first.** All interactive and body text ≥16px. High-contrast ink on background. Layout readable at 1280×720 projected resolution — don't rely on fine detail or subtle color differences to communicate state.
3. **Flat signals no budget.** No gradients, no glow, no blurred shadows. Flat fills and 2px offset stacked-paper shadows are the shelter's limited municipal budget made visible. This is a constraint that communicates.
4. **Patterns visible in the UI.** The code is part of the demo. UI states (loading, error, streaming, race-condition recovery) must be unambiguously legible on screen — not just correct in the component tree. If the signal pattern isn't visible in a projected browser, it didn't make it into the talk.
5. **Warmth within the frame.** The candy palette (mint, salmon, lavender, periwinkle) and Fredoka headings keep the UI alive despite the deadpan copy. Warmth is a visual property, not a tonal one.

## Accessibility & Inclusion

WCAG 2.1 AA by construction, not as a retrofit. Every interactive component uses real semantic HTML: native `<button>`, native `<input type="checkbox">` under any custom visual layer, `aria-describedby` on form errors, `aria-live="polite"` on the streaming chat region, CDK Dialog for the adoption confirmation (focus trap, return-focus-on-close, `role="dialog"`, `aria-modal="true"`, `aria-labelledby`). Reduced-motion alternatives required for any entrance animation. No reliance on color alone to communicate status — every badge carries a text label.
