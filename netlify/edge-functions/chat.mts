import { isDemoMode, simulateTokenDelay, DEMO_RESPONSES } from '../shared/demo-mode.mts';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_API_REVISION = '2026-05-20';

/** Demo model is gemini-3.5-flash (specs.md §5). Override via GEMINI_TEST_MODEL in .env.local
 * to point real-API test calls at a cheaper model (e.g. gemini-3.1-flash-lite) without touching this file. */
function resolveModel(): string {
  return Netlify.env.get('GEMINI_TEST_MODEL') || 'gemini-3.1-flash-lite';
}

class RateLimitedError extends Error {}

const encoder = new TextEncoder();

/** Encodes a backend SSE event as bytes — controller.enqueue() on a Deno ReadableStream requires Uint8Array, not a string. */
function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const SEARCH_ANIMALS_TOOL = {
  type: 'function',
  name: 'searchAvailableAnimals',
  description:
    'Search the shelter roster for available stuffed animals matching an adopter\'s criteria (species, condition, temperament, or maintenance level mentioned in free text).',
  parameters: {
    type: 'object',
    properties: {
      criteria: {
        type: 'string',
        description: 'Natural-language description of what the adopter is looking for, e.g. "low-maintenance, good with kids"'
      }
    },
    required: ['criteria']
  }
};

/** No params — the model should call this whenever the adopter asks about shelter-wide counts. */
const GET_SHELTER_STATS_TOOL = {
  type: 'function',
  name: 'getShelterStats',
  description:
    'Report current shelter counts: total animals on file, cleared for placement, admitted this session, and adopted this session.',
  parameters: { type: 'object', properties: {} }
};

const GET_SURRENDER_INFO_TOOL = {
  type: 'function',
  name: 'getSurrenderInfo',
  description:
    "Look up how an adopter surrenders a stuffed animal to the shelter. Call this whenever someone says they want to give up, " +
    'surrender, or hand over an animal — do not answer from general knowledge about donating toys.',
  parameters: {
    type: 'object',
    properties: {
      animalName: { type: 'string', description: 'Name of the animal being surrendered, if mentioned.' }
    }
  }
};

function searchRoster(criteria: string) {
  const roster = DEMO_RESPONSES.animals.filter((animal) => animal.available);
  const needle = criteria.toLowerCase();
  const matches = roster.filter(
    (animal) =>
      needle.includes(animal.species.toLowerCase()) ||
      needle.includes(animal.name.toLowerCase()) ||
      animal.backstory.toLowerCase().includes(needle)
  );
  return matches.length > 0 ? matches : roster;
}

/** Mirrors the WebMCP `getShelterStats` tool's formula (shelter-tools.ts) — the browser sends the
 * session counts its signal stores hold, since this edge function has no server-side state of its own. */
function getShelterStats(admittedCount: number, adoptedCount: number) {
  const totalOnFile = DEMO_RESPONSES.animals.length + admittedCount;
  const cleared = DEMO_RESPONSES.animals.filter((animal) => animal.available).length;
  return {
    totalOnFile,
    clearedForPlacement: cleared,
    admittedThisSession: admittedCount,
    adoptedThisSession: adoptedCount
  };
}

function getSurrenderInfo(animalName?: string) {
  return {
    instructions:
      "To surrender a stuffed animal, use the shelter's Intake Triage page — it walks through the animal's " +
      'condition and assigns a huggability score before admitting it to the roster as an under-repair case.',
    route: '/',
    animalName: animalName ?? null
  };
}

interface SseEvent {
  event: string;
  data: any;
}

/** Parses a Gemini Interactions API SSE body into discrete {event, data} records. */
async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex: number;
    while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      let eventType = 'message';
      let dataLine = '';
      for (const line of rawEvent.split('\n')) {
        if (line.startsWith('event:')) eventType = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
      }
      if (!dataLine || dataLine === '[DONE]') continue;
      yield { event: eventType, data: JSON.parse(dataLine) };
    }
  }
}

interface PendingFunctionCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Streams one Gemini turn, forwarding text deltas as our own `token` events.
 * Returns the interaction id (for chaining) and every function call the model requested this
 * turn — the Interactions API supports parallel function calling, so this is an array, not a
 * single optional value.
 */
async function streamGeminiTurn(
  controller: ReadableStreamDefaultController,
  apiKey: string,
  payload: Record<string, unknown>
): Promise<{ interactionId: string | undefined; functionCalls: PendingFunctionCall[] }> {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
      'Api-Revision': GEMINI_API_REVISION
    },
    body: JSON.stringify({ ...payload, stream: true })
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => '');
    console.error('[chat] Gemini API error', response.status, errText);
    if (response.status === 429) {
      throw new RateLimitedError(`Gemini API rate limit hit: ${errText}`);
    }
    throw new Error(`Gemini API request failed with status ${response.status}`);
  }

  let interactionId: string | undefined;
  const functionCalls: PendingFunctionCall[] = [];

  for await (const { event, data } of parseSseStream(response.body)) {
    if (event === 'step.start' && data.step?.type === 'function_call') {
      functionCalls.push({
        id: data.step.id,
        name: data.step.name,
        arguments: data.step.arguments ?? {}
      });
    } else if (event === 'step.delta' && data.delta?.type === 'text') {
      controller.enqueue(sseEvent('token', { token: data.delta.text }));
    } else if (event === 'interaction.completed') {
      interactionId = data.interaction?.id;
    }
  }

  return { interactionId, functionCalls };
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' }
    }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json() as {
      message?: string;
      previousInteractionId?: string;
      admittedCount?: number;
      adoptedCount?: number;
    };

    if (!body.message) {
      return new Response(JSON.stringify({
        error: { code: 'INVALID_REQUEST', message: 'message required' }
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Return SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (isDemoMode()) {
            // Send canned tokens one by one with simulated delay
            for (const token of DEMO_RESPONSES.conciergeChat.tokens) {
              controller.enqueue(sseEvent('token', { token }));
              await simulateTokenDelay(50);
            }

            // Send tool result with matched animals
            controller.enqueue(sseEvent('tool_result', {
              toolName: 'searchAvailableAnimals',
              animals: DEMO_RESPONSES.conciergeChat.animals
            }));

            // Send completion event
            controller.enqueue(sseEvent('done', {}));
          } else {
            const apiKey = Netlify.env.get('GEMINI_API_KEY');
            if (!apiKey) {
              throw new Error('GEMINI_API_KEY is not configured');
            }

            const model = resolveModel();
            const tools = [SEARCH_ANIMALS_TOOL, GET_SHELTER_STATS_TOOL, GET_SURRENDER_INFO_TOOL];
            const { interactionId, functionCalls } = await streamGeminiTurn(controller, apiKey, {
              model,
              input: body.message,
              previous_interaction_id: body.previousInteractionId,
              tools,
              system_instruction:
                'You are the adoption concierge for a stuffed-animal shelter. Call searchAvailableAnimals when the ' +
                'adopter describes what kind of companion they want (species, temperament, size, or maintenance ' +
                'level). Call getShelterStats for any question about counts or numbers — how many animals, how ' +
                'many adoptions, etc. Call getSurrenderInfo whenever someone wants to give up, surrender, or hand ' +
                'over an animal. Never invent numbers or advice for anything a tool exists for. This is a fully ' +
                'digital shelter with no physical location or opening hours — say so if asked. For small talk or ' +
                'general questions with no matching tool, respond directly, but if you genuinely don\'t know the ' +
                'answer, say so instead of guessing.'
            });

            if (functionCalls.length > 0) {
              const results = functionCalls.map((call) => {
                if (call.name === 'searchAvailableAnimals') {
                  return { call, data: searchRoster((call.arguments.criteria as string) ?? body.message) };
                }
                if (call.name === 'getShelterStats') {
                  return { call, data: getShelterStats(body.admittedCount ?? 0, body.adoptedCount ?? 0) };
                }
                return { call, data: getSurrenderInfo(call.arguments.animalName as string | undefined) };
              });

              await streamGeminiTurn(controller, apiKey, {
                model,
                previous_interaction_id: interactionId,
                tools,
                input: results.map(({ call, data }) => ({
                  type: 'function_result',
                  name: call.name,
                  call_id: call.id,
                  result: [{ type: 'text', text: JSON.stringify(data) }]
                }))
              });

              // Only the search tool has a frontend-visible result (see AnimalMatchFilter, which
              // narrows the candidate pool to the animals named in the reply); stats/surrender
              // results just ground Gemini's own narration, so no SSE event needed for those.
              const searchResult = results.find(({ call }) => call.name === 'searchAvailableAnimals');
              if (searchResult) {
                controller.enqueue(sseEvent('tool_result', {
                  toolName: 'searchAvailableAnimals',
                  animals: searchResult.data
                }));
              }
            }

            controller.enqueue(sseEvent('done', {}));
          }

          controller.close();
        } catch (error) {
          if (error instanceof RateLimitedError) {
            controller.enqueue(sseEvent('error', {
              code: 'RATE_LIMITED',
              message: "We've hit the shelter's request limit for now. Please try again in a minute."
            }));
          } else {
            controller.enqueue(sseEvent('error', {
              code: 'UPSTREAM_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error'
            }));
          }
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: { code: 'UPSTREAM_ERROR', message: 'Failed to process request' }
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const config = {
  path: '/api/chat'
};
