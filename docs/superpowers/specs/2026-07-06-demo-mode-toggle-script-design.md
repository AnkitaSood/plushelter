# DEMO_MODE toggle script — design

## Purpose

Give local development an ergonomic way to flip `DEMO_MODE` for testing (notably `tasks.md` T2.3: running real photos through the non-`DEMO_MODE` intake-triage pipeline), without hand-editing `.env.local` every time.

## Context

`netlify/shared/demo-mode.mts`'s `isDemoMode()` reads `DEMO_MODE` from the environment at process start. Per the gotcha already documented in `tasks.md`, both the Node Function (`intake-triage.mts`) and the Deno Edge Function (`chat.mts`) only reliably agree on the value when it's set in `.env.local` and `netlify dev` is restarted — a shell-exported override is ignored by the Edge Function. A runtime override (URL query param, HTTP header, per-request gate) was considered and rejected: it would add a new backend code path, a security gate (`CONTEXT === 'dev'`), and a frontend interceptor, all to save a restart that's still required for the Edge Function regardless. Since the restart is unavoidable, the simplest fix is to make editing `.env.local` fast and correct, not to bypass it.

## Design

- **`scripts/set-demo-mode.mjs`** — a Node script taking one argv (`true` or `false`):
  - Reads `.env.local` (creates it if missing, seeded with `DEMO_MODE=true` per NFR-6's default-safe requirement, then applies the requested value).
  - Replaces the `DEMO_MODE=` line if present; appends it if the file exists but lacks the key.
  - Prints a reminder: `DEMO_MODE set to <value> — restart netlify dev (Ctrl+C, then netlify dev) to apply it.`
- **`package.json` scripts**: `demo:on` → `node scripts/set-demo-mode.mjs true`, `demo:off` → `node scripts/set-demo-mode.mjs false`.
- No changes to any Netlify Function, Edge Function, or Angular code. This is local dev tooling only — it does not add a new runtime code path.

## Usage (T2.3)

1. `npm run demo:off`
2. Restart `netlify dev` (`Ctrl+C`, then `netlify dev`)
3. Upload a real photo through the Intake Triage UI; review the case file against AC-1.4's spirit
4. `npm run demo:on` when done, restart again, to leave the repo in its default free/offline-safe state
