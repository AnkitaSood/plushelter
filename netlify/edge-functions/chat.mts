import { isDemoMode, simulateTokenDelay, DEMO_RESPONSES } from '../shared/demo-mode.mts';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_API_REVISION = '2026-05-20';

/** Demo model is gemini-3.5-flash (specs.md §5). Override via GEMINI_TEST_MODEL in .env.local
 * to point real-API test calls at a cheaper model (e.g. gemini-3.1-flash-lite) without touching this file. */
function resolveModel(): string {
  return Netlify.env.get('GEMINI_TEST_MODEL') || 'gemini-3.5-flash';
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
 * Returns the interaction id (for chaining) and any function call the model requested.
 */
async function streamGeminiTurn(
  controller: ReadableStreamDefaultController,
  apiKey: string,
  payload: Record<string, unknown>
): Promise<{ interactionId: string | undefined; functionCall: PendingFunctionCall | undefined }> {
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
  let functionCall: PendingFunctionCall | undefined;

  for await (const { event, data } of parseSseStream(response.body)) {
    if (event === 'step.start' && data.step?.type === 'function_call') {
      functionCall = {
        id: data.step.id,
        name: data.step.name,
        arguments: data.step.arguments ?? {}
      };
    } else if (event === 'step.delta' && data.delta?.type === 'text') {
      controller.enqueue(sseEvent('token', { token: data.delta.text }));
    } else if (event === 'interaction.completed') {
      interactionId = data.interaction?.id;
    }
  }

  return { interactionId, functionCall };
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' }
    }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json() as { message?: string; previousInteractionId?: string };

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
            const { interactionId, functionCall } = await streamGeminiTurn(controller, apiKey, {
              model,
              input: body.message,
              previous_interaction_id: body.previousInteractionId,
              tools: [SEARCH_ANIMALS_TOOL],
              system_instruction:
                'You are the adoption concierge for a stuffed-animal shelter. Only call searchAvailableAnimals ' +
                'when the adopter describes what kind of companion they want (species, temperament, size, or ' +
                'maintenance level). For anything else — hours, policies, small talk, or general questions — ' +
                'respond directly in plain text and do not call the tool.'
            });

            if (functionCall) {
              const matchedAnimals = searchRoster((functionCall.arguments.criteria as string) ?? body.message);

              await streamGeminiTurn(controller, apiKey, {
                model,
                previous_interaction_id: interactionId,
                tools: [SEARCH_ANIMALS_TOOL],
                input: [{
                  type: 'function_result',
                  name: functionCall.name,
                  call_id: functionCall.id,
                  result: [{ type: 'text', text: JSON.stringify(matchedAnimals) }]
                }]
              });

              controller.enqueue(sseEvent('tool_result', {
                toolName: 'searchAvailableAnimals',
                animals: matchedAnimals
              }));
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
