import { isDemoMode, simulateTokenDelay, DEMO_RESPONSES } from '../shared/demo-mode.mts';
import { AgUiEventType, formatAgUiSse, formatLegacySse } from '../shared/ag-ui.ts';
import { validateA2uiMessages } from '../shared/a2ui-validator.ts';
import { getGeminiApiKey, getGeminiModel, logAvailableEnvKeys } from '../shared/env.mts';

/**
 * /api/agent — the streaming agent planner for Plushelter.
 *
 * Supports both:
 * 1. Standard AG-UI Protocol (v0.0.59) when requested via `x-ag-ui-protocol` header,
 *    `?protocol=ag-ui` parameter, or `{ protocol: 'ag-ui' }` in body.
 * 2. Legacy 4-event contract for backward compatibility during phased transition.
 *
 * AG-UI Events emitted:
 *   RUN_STARTED          — immediately on connection with runId & threadId
 *   TEXT_MESSAGE_START   — when text generation begins
 *   TEXT_MESSAGE_CONTENT — streamed text deltas
 *   TEXT_MESSAGE_END     — when text turn completes
 *   TOOL_CALL_START      — browser WebMCP tool call requested
 *   TOOL_CALL_ARGS       — tool call arguments
 *   TOOL_CALL_END        — tool call arguments complete (browser executes & calls back)
 *   ACTIVITY_SNAPSHOT    — agent-composed A2UI v0.9 surfaces (validated server-side)
 *   RUN_FINISHED         — turn execution successfully finished
 *   RUN_ERROR            — rate-limit or upstream error
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_API_REVISION = '2026-05-20';

function resolveEnv(name: string): string | undefined {
  try {
    if (typeof Netlify !== 'undefined' && Netlify.env) {
      const val = Netlify.env.get(name);
      if (val) return val;
    }
  } catch { /* ignore */ }
  try {
    if (typeof Deno !== 'undefined' && Deno.env) {
      const val = Deno.env.get(name);
      if (val) return val;
    }
  } catch { /* ignore */ }
  try {
    if (typeof process !== 'undefined' && process.env) {
      const val = process.env[name];
      if (val) return val;
    }
  } catch { /* ignore */ }
  return undefined;
}

function resolveApiKey(): string | undefined {
  return getGeminiApiKey();
}

function resolveModel(): string {
  return getGeminiModel('gemini-3.1-flash-lite');
}

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

/** Only appended for callers that want the model to compose its own generative surfaces
 * (the agent panel, agent console). Callers who compose their own deterministic A2UI surfaces
 * from tool results (e.g. concierge) opt out via `composeA2ui: false` — otherwise Gemini streams
 * a raw ```a2ui fenced block as visible chat text before the server-side extraction step ever
 * gets a chance to pull it out of the transcript. */
const A2UI_COMPOSITION_INSTRUCTION = `

When answering questions about animals or comparisons, you may compose generative A2UI v0.9 surfaces.
To compose an A2UI surface, enclose a JSON array of A2uiMessages inside an \`\`\`a2ui ... \`\`\` code block.

A2UI v0.9 Basic Catalog components include:
- "Text": properties: { "text": string | { "path": string }, "variant": "h1"|"h2"|"h3"|"body"|"caption" }
- "Row" & "Column": properties: { "children": string[] } (array of child component IDs)
- "Card": properties: { "children": string[] }
- "Button": properties: { "child": string, "action"?: { "event": { "name": string, "context"?: object } } }
- "TextField": properties: { "label": string, "value": { "path": string } }
- "CheckBox": properties: { "label": string, "checked": { "path": string } }

Example A2UI block for a matched resident:
\`\`\`a2ui
[
  {
    "version": "v0.9",
    "createSurface": {
      "surfaceId": "srf-match",
      "catalogId": "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"
    }
  },
  {
    "version": "v0.9",
    "updateComponents": {
      "surfaceId": "srf-match",
      "components": [
        { "id": "root", "component": "Card", "children": ["title", "desc", "adopt-btn"] },
        { "id": "title", "component": "Text", "variant": "h2", "text": { "path": "/name" } },
        { "id": "desc", "component": "Text", "variant": "body", "text": { "path": "/bio" } },
        { "id": "adopt-btn", "component": "Button", "child": "adopt-btn-text", "action": { "event": { "name": "start_adoption", "context": { "animalId": "001" } } } },
        { "id": "adopt-btn-text", "component": "Text", "text": "Apply to Adopt" }
      ]
    }
  },
  {
    "version": "v0.9",
    "updateDataModel": {
      "surfaceId": "srf-match",
      "path": "/",
      "value": { "name": "Horace the Bear", "bio": "Rehabilitated companion. Low-maintenance and calm." }
    }
  }
]
\`\`\``;

class RateLimitedError extends Error {}

interface GeminiToolDecl {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ToolResultInput {
  call_id: string;
  name: string;
  result: string;
}

interface AgentRequestBody {
  message?: string;
  toolResult?: ToolResultInput;
  previousInteractionId?: string;
  tools?: GeminiToolDecl[];
  protocol?: 'ag-ui' | 'legacy';
  threadId?: string;
  runId?: string;
  /** Defaults to true (the agent panel/console rely on Gemini composing its own A2UI surfaces).
   * Callers that compose their own deterministic surfaces from tool results — concierge — pass
   * `false` so Gemini never streams a raw ```a2ui fence into visible chat text. */
  composeA2ui?: boolean;
}

interface SseRecord {
  event: string;
  data: any;
}

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

async function streamGeminiTurn(
  apiKey: string,
  payload: Record<string, unknown>,
  onToken: (token: string) => void,
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
  let rawArguments = '';

  for await (const { event, data } of parseSseStream(response.body)) {
    if (event === 'step.start' && data.step?.type === 'function_call') {
      functionCall = {
        id: data.step.id,
        name: data.step.name,
        arguments: typeof data.step.arguments === 'object' && data.step.arguments !== null ? data.step.arguments : {},
      };
      if (data.step.arguments) {
        if (typeof data.step.arguments === 'object') {
          rawArguments = JSON.stringify(data.step.arguments);
        } else {
          rawArguments = String(data.step.arguments);
        }
      }
    } else if (event === 'step.delta') {
      if (data.delta?.type === 'text') {
        onToken(data.delta.text);
      } else if (data.delta?.type === 'arguments') {
        rawArguments += data.delta.partial_arguments ?? data.delta.arguments ?? '';
      }
    } else if (event === 'step.stop' && functionCall) {
      if (data.step?.arguments) {
        if (typeof data.step.arguments === 'object') {
          functionCall.arguments = data.step.arguments;
        } else {
          try {
            functionCall.arguments = JSON.parse(data.step.arguments);
          } catch {
            functionCall.arguments = { criteria: data.step.arguments };
          }
        }
      } else if (rawArguments) {
        try {
          functionCall.arguments = JSON.parse(rawArguments);
        } catch {
          functionCall.arguments = { criteria: rawArguments };
        }
      }
    } else if (event === 'interaction.completed') {
      interactionId = data.interaction?.id;
      if (functionCall && rawArguments && Object.keys(functionCall.arguments).length === 0) {
        try {
          functionCall.arguments = JSON.parse(rawArguments);
        } catch {
          functionCall.arguments = { criteria: rawArguments };
        }
      }
    }
  }

  return { interactionId, functionCall };
}

/** Demo stream for AG-UI format */
async function streamAgUiDemo(
  controller: ReadableStreamDefaultController,
  isToolResultTurn: boolean,
  threadId: string,
  runId: string,
  userPrompt: string,
): Promise<void> {
  controller.enqueue(
    formatAgUiSse({
      type: AgUiEventType.RUN_STARTED,
      runId,
      threadId,
    }),
  );

  const isA2UiQuery =
    /card|adopt|horace|match|compare|surface/i.test(userPrompt) && !isToolResultTurn;

  if (isA2UiQuery) {
    const fixture = DEMO_RESPONSES.agUiFixtures.a2uiSurfaceFlow;
    const msgId = fixture.messageId;

    controller.enqueue(
      formatAgUiSse({
        type: AgUiEventType.TEXT_MESSAGE_START,
        messageId: msgId,
        role: 'assistant',
      }),
    );

    const words = fixture.introText.split(' ');
    for (const w of words) {
      controller.enqueue(
        formatAgUiSse({
          type: AgUiEventType.TEXT_MESSAGE_CONTENT,
          messageId: msgId,
          delta: w + ' ',
        }),
      );
      await simulateTokenDelay(30);
    }

    controller.enqueue(
      formatAgUiSse({
        type: AgUiEventType.TEXT_MESSAGE_END,
        messageId: msgId,
      }),
    );

    // Validate and emit A2UI surface activity
    const validation = validateA2uiMessages(fixture.a2uiMessages);
    if (validation.valid) {
      controller.enqueue(
        formatAgUiSse({
          type: AgUiEventType.ACTIVITY_SNAPSHOT,
          messageId: `act-${msgId}`,
          activityType: 'a2ui-surface',
          content: {
            messages: fixture.a2uiMessages,
          },
        }),
      );
    }

    controller.enqueue(
      formatAgUiSse({
        type: AgUiEventType.RUN_FINISHED,
        runId,
        threadId,
        result: { interactionId: 'demo-interaction-a2ui' },
        metadata: { interactionId: 'demo-interaction-a2ui' },
      }),
    );
    return;
  }

  const fixture = DEMO_RESPONSES.agUiFixtures.toolCallFlow;
  const msgId = `msg-${Date.now()}`;

  if (isToolResultTurn) {
    controller.enqueue(
      formatAgUiSse({
        type: AgUiEventType.TEXT_MESSAGE_START,
        messageId: msgId,
        role: 'assistant',
      }),
    );

    const words = fixture.narrationText.split(' ');
    for (const w of words) {
      controller.enqueue(
        formatAgUiSse({
          type: AgUiEventType.TEXT_MESSAGE_CONTENT,
          messageId: msgId,
          delta: w + ' ',
        }),
      );
      await simulateTokenDelay(40);
    }

    controller.enqueue(
      formatAgUiSse({
        type: AgUiEventType.TEXT_MESSAGE_END,
        messageId: msgId,
      }),
    );

    controller.enqueue(
      formatAgUiSse({
        type: AgUiEventType.RUN_FINISHED,
        runId,
        threadId,
        result: { interactionId: 'demo-interaction-narration' },
        metadata: { interactionId: 'demo-interaction-narration' },
      }),
    );
    return;
  }

  // Tool plan phase
  controller.enqueue(
    formatAgUiSse({
      type: AgUiEventType.TEXT_MESSAGE_START,
      messageId: msgId,
      role: 'assistant',
    }),
  );

  controller.enqueue(
    formatAgUiSse({
      type: AgUiEventType.TEXT_MESSAGE_CONTENT,
      messageId: msgId,
      delta: fixture.planText,
    }),
  );

  controller.enqueue(
    formatAgUiSse({
      type: AgUiEventType.TEXT_MESSAGE_END,
      messageId: msgId,
    }),
  );

  const tc = fixture.toolCall;
  controller.enqueue(
    formatAgUiSse({
      type: AgUiEventType.TOOL_CALL_START,
      toolCallId: tc.id,
      toolCallName: tc.name,
      interactionId: tc.interactionId,
    }),
  );

  controller.enqueue(
    formatAgUiSse({
      type: AgUiEventType.TOOL_CALL_ARGS,
      toolCallId: tc.id,
      delta: JSON.stringify(tc.args),
    }),
  );

  controller.enqueue(
    formatAgUiSse({
      type: AgUiEventType.TOOL_CALL_END,
      toolCallId: tc.id,
      interactionId: tc.interactionId,
    }),
  );

  controller.enqueue(
    formatAgUiSse({
      type: AgUiEventType.RUN_FINISHED,
      runId,
      threadId,
      result: { interactionId: tc.interactionId },
      metadata: { interactionId: tc.interactionId },
    }),
  );
}

/** Demo stream for legacy 4-event format */
async function streamLegacyDemo(
  controller: ReadableStreamDefaultController,
  isToolResultTurn: boolean,
): Promise<void> {
  const demo = DEMO_RESPONSES.webmcpAgent;
  if (isToolResultTurn) {
    for (const token of demo.narrationTokens) {
      controller.enqueue(formatLegacySse('token', { token }));
      await simulateTokenDelay(50);
    }
    controller.enqueue(formatLegacySse('done', {}));
    return;
  }

  for (const token of demo.planTokens) {
    controller.enqueue(formatLegacySse('token', { token }));
    await simulateTokenDelay(50);
  }
  controller.enqueue(
    formatLegacySse('tool_call', {
      id: demo.toolCall.id,
      name: demo.toolCall.name,
      arguments: demo.toolCall.arguments,
      interactionId: demo.interactionId,
    }),
  );
  controller.enqueue(formatLegacySse('done', {}));
}

/** Extracts embedded A2UI code fences from assistant response text */
function extractA2uiBlocks(text: string): { cleanText: string; a2uiBlocks: unknown[][] } {
  const a2uiRegex = /```a2ui\s*([\s\S]*?)\s*```/g;
  const a2uiBlocks: unknown[][] = [];
  let match: RegExpExecArray | null;

  while ((match = a2uiRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        a2uiBlocks.push(parsed);
      }
    } catch {
      console.warn('[agent] Failed to parse A2UI block as JSON');
    }
  }

  const cleanText = text.replace(a2uiRegex, '').trim();
  return { cleanText, a2uiBlocks };
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

  const url = new URL(req.url);
  const isAgUi =
    req.headers.get('x-ag-ui-protocol') === 'true' ||
    url.searchParams.get('protocol') === 'ag-ui' ||
    body.protocol === 'ag-ui';

  const threadId = body.threadId || `thread-${crypto.randomUUID()}`;
  const runId = body.runId || `run-${crypto.randomUUID()}`;

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
          if (isAgUi) {
            await streamAgUiDemo(controller, isToolResultTurn, threadId, runId, body.message || '');
          } else {
            await streamLegacyDemo(controller, isToolResultTurn);
          }
          controller.close();
          return;
        }

        const apiKey = resolveApiKey();
        if (!apiKey) {
          logAvailableEnvKeys('agent');
          throw new Error(
            'GEMINI_API_KEY is not configured in Netlify environment variables. ' +
            'If running locally with "netlify dev", run "npx netlify link" to link this repo to your Netlify site, ' +
            'or add GEMINI_API_KEY=your_key to your local .env.local file.'
          );
        }

        const model = resolveModel();
        const tools = body.tools ?? [];
        const systemInstruction =
          body.composeA2ui === false
            ? BASE_SYSTEM_INSTRUCTION
            : BASE_SYSTEM_INSTRUCTION + A2UI_COMPOSITION_INSTRUCTION;

        if (isAgUi) {
          controller.enqueue(
            formatAgUiSse({
              type: AgUiEventType.RUN_STARTED,
              runId,
              threadId,
            }),
          );
        }

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

        const messageId = `msg-${crypto.randomUUID()}`;
        let textStarted = false;
        let accumulatedText = '';

        const { interactionId, functionCall } = await streamGeminiTurn(
          apiKey,
          {
            model,
            input,
            previous_interaction_id: body.previousInteractionId,
            tools,
            system_instruction: systemInstruction,
          },
          (delta) => {
            accumulatedText += delta;

            if (isAgUi) {
              if (!textStarted) {
                controller.enqueue(
                  formatAgUiSse({
                    type: AgUiEventType.TEXT_MESSAGE_START,
                    messageId,
                    role: 'assistant',
                  }),
                );
                textStarted = true;
              }
              controller.enqueue(
                formatAgUiSse({
                  type: AgUiEventType.TEXT_MESSAGE_CONTENT,
                  messageId,
                  delta,
                }),
              );
            } else {
              controller.enqueue(formatLegacySse('token', { token: delta }));
            }
          },
        );

        if (isAgUi && textStarted) {
          controller.enqueue(
            formatAgUiSse({
              type: AgUiEventType.TEXT_MESSAGE_END,
              messageId,
            }),
          );

          // Check if response contains embedded A2UI blocks
          const { a2uiBlocks } = extractA2uiBlocks(accumulatedText);
          for (let i = 0; i < a2uiBlocks.length; i++) {
            const validation = validateA2uiMessages(a2uiBlocks[i]);
            if (validation.valid) {
              controller.enqueue(
                formatAgUiSse({
                  type: AgUiEventType.ACTIVITY_SNAPSHOT,
                  messageId: `act-${messageId}-${i}`,
                  activityType: 'a2ui-surface',
                  content: {
                    messages: a2uiBlocks[i],
                  },
                }),
              );
            } else {
              console.warn('[agent] Dropping invalid A2UI block:', validation.errors);
            }
          }
        }

        if (functionCall) {
          if (isAgUi) {
            controller.enqueue(
              formatAgUiSse({
                type: AgUiEventType.TOOL_CALL_START,
                toolCallId: functionCall.id,
                toolCallName: functionCall.name,
                interactionId,
              }),
            );

            controller.enqueue(
              formatAgUiSse({
                type: AgUiEventType.TOOL_CALL_ARGS,
                toolCallId: functionCall.id,
                delta: JSON.stringify(functionCall.arguments),
              }),
            );

            controller.enqueue(
              formatAgUiSse({
                type: AgUiEventType.TOOL_CALL_END,
                toolCallId: functionCall.id,
                interactionId,
              }),
            );
          } else {
            controller.enqueue(
              formatLegacySse('tool_call', {
                id: functionCall.id,
                name: functionCall.name,
                arguments: functionCall.arguments,
                interactionId,
              }),
            );
          }
        }

        if (isAgUi) {
          controller.enqueue(
            formatAgUiSse({
              type: AgUiEventType.RUN_FINISHED,
              runId,
              threadId,
              result: interactionId ? { interactionId } : undefined,
              metadata: interactionId ? { interactionId } : undefined,
            }),
          );
        } else {
          controller.enqueue(formatLegacySse('done', { interactionId }));
        }

        controller.close();
      } catch (error) {
        if (isAgUi) {
          controller.enqueue(
            formatAgUiSse({
              type: AgUiEventType.RUN_ERROR,
              code: error instanceof RateLimitedError ? 'RATE_LIMITED' : 'UPSTREAM_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error',
            }),
          );
        } else {
          if (error instanceof RateLimitedError) {
            controller.enqueue(
              formatLegacySse('error', {
                code: 'RATE_LIMITED',
                message: "We've hit the shelter's request limit for now. Please try again in a minute.",
              }),
            );
          } else {
            controller.enqueue(
              formatLegacySse('error', {
                code: 'UPSTREAM_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
              }),
            );
          }
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
