Persistent context for any agent session working in this repo. Keep this short — detail lives in `specs.md` (what to build) and `tasks.md` (how it's sequenced). Read both before writing code.

## What this is

**Plushelter** — a satirical, dead-serious shelter-management app for stuffed animals, built to demo modern Angular signal patterns (`resource()`, `httpResource()`, `rxResource()`, `linkedSignal()`, Signal Forms) driving Gemini API calls, for a live 60-minute conference talk on **July 22, 2026**. It gets presented on stage, live, by the repo owner. Every line of generated code has to be something she can explain in front of a room — that bar matters more than usual for a side project.

## Non-negotiable constraints

- **Zero dollar cost.** Every feature runs on Gemini's free tier (`gemini-3.5-flash`, fallback `gemini-3-flash-preview` / `gemini-2.5-flash`). No image or video generation model is used anywhere — see `specs.md` NFR-1 for why.
- **No Tailwind. No installed component library (ZardUI, Angular Material, etc.).** Styling is a small, hand-built design system in plain CSS. See `specs.md` §6.
- **Netlify only**, split across regular Functions (single request/response) and Edge Functions (the one streaming endpoint). Never introduce Express, a separate Node server, or another hosting target.
- **`GEMINI_API_KEY` is never committed, never referenced client-side.** It's read only via `Netlify.env.get(...)` inside `netlify/functions/*` and `netlify/edge-functions/*`.
- **Call the Angular MCP server's `get_best_practices` before writing or modifying any Angular code, every session.** This is the single highest-leverage guardrail against confidently-wrong outdated Angular patterns (constructor injection, `*ngIf`, unneeded `CommonModule` imports).
- **Use the `gemini-interactions-api` skill for anything touching the Gemini API.** It encodes current model names and the Interactions API's request/event shapes — don't rely on general training-data knowledge of "the Gemini SDK," which is very likely stale.
- **Don't invoke Impeccable commands automatically.** `/impeccable audit`, `critique`, and `polish` are run manually by the repo owner once `DEMO_MODE` has real content — see `tasks.md` Phase 4. Agents shouldn't call these mid-feature-work.
## Tech stack

| Layer | Choice |
|---|---|
| Framework | Angular 22 (confirm with `ng version` — package.json pins `^22.0.5`), standalone components, zoneless, OnPush default |
| Styling | Plain CSS custom properties against the palette/type system in `specs.md` §6 — no Tailwind |
| Hosting/backend | Netlify: `netlify/functions/*.mts` (Node) + `netlify/edge-functions/*.mts` (Deno) |
| AI | `gemini-3.5-flash` via plain `fetch()` against the Interactions API REST endpoint — no `@google/genai` SDK dependency |
| Testing | **Vitest only.** `angular.json`'s `test` target uses the `@angular/build:unit-test` builder; Karma/Jasmine packages have been removed. Don't write or generate tests against Karma. |

## Repo map

```
.Codex/           Codex config (MCP servers, skills) — already configured
.gemini/           Gemini CLI/skills config — already configured
public/            static assets
src/               Angular app
netlify/           NOT YET CREATED — functions/, edge-functions/, and netlify.toml go here (Phase 0)
specs.md           canonical spec — what gets built, with acceptance criteria
tasks.md           phased, agent-executable task breakdown
```

Note: `README.md` currently says "generated using Angular CLI version 20.3.1" — that's stale boilerplate; `package.json` confirms `^22.0.5`. Fix the README text as a small Phase 0 cleanup task.

## Commands

```bash
ng serve              # Angular dev server alone (no backend)
netlify dev           # Angular + Functions + Edge Functions together — use this for real feature work
ng test               # unit tests — confirm runner first (see Testing row above)
ng build              # production build, confirms nothing's broken before a deploy
```

## Where the rest of the context lives

- `specs.md` — the full functional/non-functional spec, design system, data model, and API contracts.
- `tasks.md` — the phased build plan mapped to specific sub-agent roles and tool calls.
- The original talk outline and longer-form requirements narrative exist outside this repo, in the conversation history that produced these docs — `specs.md` is the distilled, implementation-ready version of that material and should be treated as current over anything that conflicts with it.
---

## General coding conventions

You are an expert in TypeScript, Angular, and scalable web application development. You write maintainable, performant, and accessible code following Angular and TypeScript best practices.

### TypeScript

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain
### Angular

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.
### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones — **on this project specifically, "reactive" means Signal Forms (`form()` + `FormField()` + `linkedSignal()`), not the older `ReactiveFormsModule`/`FormGroup`/`FormControl` API. The only form in this app (Intake Triage's case-file form, FR-1) is a Signal Form — don't import `ReactiveFormsModule` out of habit.**
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
### State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead
### Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
### Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator (from `@angular/core`) over `@Injectable({providedIn: 'root'})` for new singleton services — this is a real Angular v22+ addition (root-providable shorthand), not a typo or hallucination. Confirmed via `get_best_practices` and `node_modules/@angular/core` type defs directly; don't "fix" it back to `@Injectable` if you see it in the codebase (e.g. `ConciergeChatService`).
- Use the `inject()` function instead of constructor injection
 
