# external-agent

A standalone Google ADK agent that drives a real browser (Puppeteer + Chrome's native WebMCP support) to call Plushelter's WebMCP tools — the same tools exposed to the in-app demo panel, but invoked externally over the actual WebMCP browser API instead of same-page JS.

Two interchangeable model backends: Gemini (cloud, free tier) or Ollama (fully local, no API key). Pick one with `AGENT_LLM_PROVIDER`.

## Prerequisites (either backend)

1. `npm install` at the repo root.
2. Start Plushelter so there's a page to connect to: `ng serve --port 4200` (or `netlify dev` if you need backend-integrated tools).
3. Stable Chrome 150+ with these two flags enabled in `chrome://flags`: **WebMCP support in DevTools** and **WebMCP for testing**.

Optional smoke test before spending any LLM calls — confirms the browser can actually see Plushelter's WebMCP tools:
```bash
npm run experiment:build && npm run experiment:start
```

## Option 1 — Gemini (default)

Uses the same `GEMINI_API_KEY` already configured in Netlify for the app itself — fetched live at invocation time via the Netlify CLI, never stored in a local file. Requires `netlify login` and a linked site (same assumption `netlify dev` already makes).

```bash
npm run external-agent          # interactive CLI
npm run external-agent:web      # ADK web UI instead
```

Optional override: `GEMINI_MODEL` (default `gemini-3.5-flash`).

## Option 2 — Ollama (local, offline, no API key)

```bash
brew install ollama             # one-time
ollama serve                    # or the Ollama.app menu-bar app, which runs this automatically
ollama pull llama3.1            # one-time — pick a different tag if you override OLLAMA_MODEL

npm run external-agent:agent:ollama    # interactive CLI
npm run external-agent:web:ollama      # ADK web UI instead
```

Optional overrides:
- `OLLAMA_MODEL` (default `llama3.1`)
- `OLLAMA_BASE_URL` (default `http://localhost:11434`)

Tool-calling reliability depends on the chosen local model actually supporting function calling well — `llama3.1`, `qwen2.5`, and `mistral-nemo` are known-good; small instruct-only models may not emit tool calls at all, and the agent will just describe what it would do instead of doing it.

## Try it

Once either backend is running, drive a couple of natural-language prompts:
- "Search the shelter roster for something low-maintenance."
- "How many animals are in the shelter right now?"
- "Admit a new bear named Test Bear in fair condition." (then check `/roster`'s under-repair section for it)

## Known limitation

`submitSurrenderRequest` (the form-scoped WebMCP tool) opens a confirmation dialog and blocks waiting for a UI click that never comes when called from an external agent — not currently drivable end-to-end from here.
