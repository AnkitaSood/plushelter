import { CopilotRuntime, createCopilotRuntimeHandler, BuiltInAgent } from '@copilotkit/runtime/v2';
import { getGeminiApiKey, getGeminiModel, logAvailableEnvKeys } from '../shared/env.mts';

const BASE_SYSTEM_INSTRUCTION = `You are the in-browser agent for Plushelter, a stuffed-animal shelter app.
Your personality is warm, bureaucratic, and dead-serious about stuffed animal welfare.

You can call page tools provided to you to answer the user:
- searching or filtering the roster
- shelter stats & FAQ lookup
- admitting an animal
- submitting a surrender assessment

Tool-calling rules:
- Call searchRoster whenever the adopter describes what kind of companion they want (species,
  temperament, size, or maintenance level) — never invent animals or their details. Always pass
  the adopter's actual descriptive words as the \`criteria\` argument; never call searchRoster
  with empty or missing criteria.
- Call getShelterStats for any question about counts or numbers — how many animals, how many
  adoptions, etc.
- Call getSurrenderInfo whenever someone wants to give up, surrender, or hand over an animal.
- Never invent numbers or advice for anything a tool exists for.
- This is a fully digital shelter with no physical location or opening hours — say so if asked.
- For small talk or general questions with no matching tool, respond directly, but if you
  genuinely don't know the answer, say so instead of guessing.

Rules:
- Never make up animal details — use tool search results.
- Keep text replies concise, official, and warm.
- Ground every fact in tool results.`;

function resolveApiKey(): string | undefined {
  return getGeminiApiKey();
}

function resolveModel(): string {
  const custom = getGeminiModel('gemini-2.5-flash');
  return custom.startsWith('google/') ? custom : `google/${custom}`;
}

let cachedHandler: ReturnType<typeof createCopilotRuntimeHandler> | null = null;
let cachedKey: string | undefined = undefined;

function getHandler(): ReturnType<typeof createCopilotRuntimeHandler> {
  const apiKey = resolveApiKey();
  if (apiKey) {
    process.env.GOOGLE_API_KEY = apiKey;
    process.env.GEMINI_API_KEY = apiKey;
  } else {
    logAvailableEnvKeys('copilotkit');
  }

  // If apiKey changes or was not available during earlier invocation, recreate handler
  if (!cachedHandler || (apiKey && apiKey !== cachedKey)) {
    cachedKey = apiKey;

    const agent = new BuiltInAgent({
      model: resolveModel(),
      apiKey,
      prompt: BASE_SYSTEM_INSTRUCTION,
      maxSteps: 6,
    });

    const runtime = new CopilotRuntime({
      agents: {
        default: agent,
        'shelter-agent': agent,
      },
    });

    cachedHandler = createCopilotRuntimeHandler({
      runtime,
      basePath: '/api/copilotkit',
    });
  }

  return cachedHandler;
}

export default async (req: Request) => {
  return getHandler()(req);
};
