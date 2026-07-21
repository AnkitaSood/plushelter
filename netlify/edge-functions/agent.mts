import { isDemoMode, simulateTokenDelay, DEMO_RESPONSES } from '../shared/demo-mode.mts';

/**
 * /api/agent — the streaming "planner" for the in-browser WebMCP agent.
 *
 * Unlike /api/chat (which declares ONE fixed tool and RUNS it server-side), this endpoint is a pure
 * planner for tools that live in the browser. The browser sends the tool declarations it read from
 * `navigator.modelContext` for the current route; we run one Gemini turn; and when the model asks to
 * call a tool we emit a `tool_call` event and STOP — the browser executes the tool (so the WebMCP
 * DevTools "Tool Activity" panel logs it) and calls us back with the result to continue the loop.
 *
 * SSE contract (stable regardless of Gemini's own event shape — specs.md §5 / AC-2.3):
 *   event: token      data: { token }                              — assistant text delta
 *   event: tool_call  data: { id, name, arguments, interactionId } — browser must run this tool
 *   event: done       data: {}                                     — turn finished, no tool wanted
 *   event: error      data: { code, message }
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_API_REVISION = '2026-05-20';

/** Default demo model is gemini-3.1-flash-lite (matches every other function). Override via
 * GEMINI_TEST_MODEL in .env.local without touching this file. */
function resolveModel(): string {
  return Netlify.env.get('GEMINI_TEST_MODEL') || 'gemini-3.1-flash-lite';
}

const SYSTEM_INSTRUCTION =
  'You are the in-browser agent for Plushelter, a stuffed-animal shelter app. You can call the ' +
  'page tools provided to you to answer the user. When the user asks something a tool can answer ' +
  '(searching or filtering the roster, shelter stats, admitting an animal, submitting a surrender), ' +
  'call the most appropriate tool, then summarise its result in a short, friendly reply. Only call ' +
  'tools that are provided this turn. For small talk or anything no tool covers, just reply in text.';

class RateLimitedError extends Error {}

const encoder = new TextEncoder();

/** Encodes a backend SSE event as bytes — controller.enqueue() requires Uint8Array, not a string. */
function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** A Gemini function-tool declaration, as translated by the browser from a WebMCP descriptor. */
interface GeminiToolDecl {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ToolResultInput {
  call_id: string;
  name: string;
  /** The MCP text content the browser's tool returned. */
  result: string;
}

interface AgentRequestBody {
  message?: string;
  toolResult?: ToolResultInput;
  previousInteractionId?: string;
  tools?: GeminiToolDecl[];
}

interface SseRecord {
  event: string;
  data: any;
}

/** Parses a Gemini Interactions API SSE body into discrete {event, data} records. */
async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<SseRecord> {
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
 * Returns the interaction id (for chaining the next turn) and any function call the model requested.
 */
async function streamGeminiTurn(
  controller: ReadableStreamDefaultController,
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<{ interactionId: string | undefined; functionCall: PendingFunctionCall | undefined }> {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
      'Api-Revision': GEMINI_API_REVISION,
    },
    body: JSON.stringify({ ...payload, stream: true }),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => '');
    console.error('[agent] Gemini API error', response.status, errText);
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
        arguments: data.step.arguments ?? {},
      };
    } else if (event === 'step.delta' && data.delta?.type === 'text') {
      controller.enqueue(sseEvent('token', { token: data.delta.text }));
    } else if (event === 'interaction.completed') {
      interactionId = data.interaction?.id;
    }
  }

  return { interactionId, functionCall };
}

/** Canned two-phase loop for DEMO_MODE: first call asks for a tool, the callback narrates. */
async function streamDemoTurn(
  controller: ReadableStreamDefaultController,
  isToolResultTurn: boolean,
): Promise<void> {
  const demo = DEMO_RESPONSES.webmcpAgent;
  if (isToolResultTurn) {
    for (const token of demo.narrationTokens) {
      controller.enqueue(sseEvent('token', { token }));
      await simulateTokenDelay(50);
    }
    controller.enqueue(sseEvent('done', {}));
    return;
  }

  for (const token of demo.planTokens) {
    controller.enqueue(sseEvent('token', { token }));
    await simulateTokenDelay(50);
  }
  controller.enqueue(
    sseEvent('tool_call', {
      id: demo.toolCall.id,
      name: demo.toolCall.name,
      arguments: demo.toolCall.arguments,
      interactionId: demo.interactionId,
    }),
  );
  controller.enqueue(sseEvent('done', {}));
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' } }),
      { status: 405, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let body: AgentRequestBody;
  try {
    body = (await req.json()) as AgentRequestBody;
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Body must be JSON' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const isToolResultTurn = Boolean(body.toolResult);
  if (!body.message && !isToolResultTurn) {
    return new Response(
      JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'message or toolResult required' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (isDemoMode()) {
          await streamDemoTurn(controller, isToolResultTurn);
          controller.close();
          return;
        }

        const apiKey = Netlify.env.get('GEMINI_API_KEY');
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY is not configured');
        }

        const model = resolveModel();
        // Tools are interaction-scoped in the Interactions API, so re-send them every turn.
        const tools = body.tools ?? [];

        // Build this turn's `input`: either the user's message, or the browser's tool result chained
        // onto the previous interaction via previous_interaction_id.
        const input = isToolResultTurn
          ? [
              {
                type: 'function_result',
                name: body.toolResult!.name,
                call_id: body.toolResult!.call_id,
                result: [{ type: 'text', text: body.toolResult!.result }],
              },
            ]
          : body.message;

        const { interactionId, functionCall } = await streamGeminiTurn(controller, apiKey, {
          model,
          input,
          previous_interaction_id: body.previousInteractionId,
          tools,
          system_instruction: SYSTEM_INSTRUCTION,
        });

        if (functionCall) {
          // Hand the call back to the browser — WE DO NOT EXECUTE IT. The browser runs it via
          // navigator.modelContext (logged in DevTools) and calls back with the result.
          controller.enqueue(
            sseEvent('tool_call', {
              id: functionCall.id,
              name: functionCall.name,
              arguments: functionCall.arguments,
              interactionId,
            }),
          );
        }

        controller.enqueue(sseEvent('done', {}));
        controller.close();
      } catch (error) {
        if (error instanceof RateLimitedError) {
          controller.enqueue(
            sseEvent('error', {
              code: 'RATE_LIMITED',
              message: "We've hit the shelter's request limit for now. Please try again in a minute.",
            }),
          );
        } else {
          controller.enqueue(
            sseEvent('error', {
              code: 'UPSTREAM_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error',
            }),
          );
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

export const config = {
  path: '/api/agent',
};
