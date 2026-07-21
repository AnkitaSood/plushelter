import { Service, inject, signal } from '@angular/core';
import { GeminiToolDecl, ModelContextClient } from '../../webmcp/model-context-client';

/**
 * Drives the in-browser WebMCP agent loop:
 *   prompt → /api/agent (Gemini decides) → tool_call → run tool in the browser via WebMCP
 *          → result → /api/agent (Gemini narrates) → repeat until no more tool calls.
 *
 * The LLM turn is server-side (key stays safe); tool EXECUTION is client-side through
 * `ModelContextClient`, which is what makes this a real WebMCP demo (calls hit the DevTools panel).
 * State is exposed as signals so the panel can render a live, streaming transcript.
 */

export type AgentEntry =
  | { kind: 'user'; id: number; text: string }
  | { kind: 'assistant'; id: number; text: string }
  | { kind: 'tool_call'; id: number; name: string; args: unknown }
  | { kind: 'tool_result'; id: number; name: string; text: string };

export type AgentStatus = 'idle' | 'running' | 'error';

/** One parsed event from the /api/agent SSE stream. */
type AgentServerEvent =
  | { type: 'token'; token: string }
  | { type: 'tool_call'; id: string; name: string; arguments: Record<string, unknown>; interactionId?: string }
  | { type: 'done' }
  | { type: 'error'; code: string; message: string };

/** Ceiling on tool round-trips per prompt, so a misbehaving model can't loop forever. */
const MAX_STEPS = 6;

function parseAgentSseRecord(raw: string): AgentServerEvent {
  let eventType = 'message';
  let dataLine = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) eventType = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
  }

  if (eventType === 'done') return { type: 'done' };

  let data: Record<string, unknown> = {};
  if (dataLine) {
    try {
      data = JSON.parse(dataLine) as Record<string, unknown>;
    } catch {
      return { type: 'error', code: 'INVALID_SSE_EVENT', message: 'Malformed JSON in agent stream.' };
    }
  }

  switch (eventType) {
    case 'token':
      return { type: 'token', token: String(data['token'] ?? '') };
    case 'tool_call':
      return {
        type: 'tool_call',
        id: String(data['id'] ?? ''),
        name: String(data['name'] ?? ''),
        arguments: (data['arguments'] as Record<string, unknown>) ?? {},
        interactionId: data['interactionId'] as string | undefined,
      };
    case 'error':
      return {
        type: 'error',
        code: String(data['code'] ?? 'UPSTREAM_ERROR'),
        message: String(data['message'] ?? 'The agent hit an error.'),
      };
    default:
      return { type: 'error', code: 'INVALID_SSE_EVENT', message: `Unsupported event "${eventType}".` };
  }
}

interface AgentRequestBody {
  message?: string;
  toolResult?: { call_id: string; name: string; result: string };
  previousInteractionId?: string;
  tools: GeminiToolDecl[];
}

@Service()
export class AgentRunnerService {
  private readonly mcp = inject(ModelContextClient);

  private readonly _transcript = signal<AgentEntry[]>([]);
  private readonly _status = signal<AgentStatus>('idle');
  private readonly _error = signal<string | null>(null);

  readonly transcript = this._transcript.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();

  private nextId = 0;
  private controller: AbortController | null = null;

  /** Whether the page actually exposes a WebMCP surface (drives the panel's "live vs fallback" hint). */
  webMcpAvailable(): boolean {
    return this.mcp.isWebMcpAvailable();
  }

  /** Cancel any in-flight run (NFR-7: a new prompt must abort the stale stream). */
  cancel(): void {
    this.controller?.abort();
    this.controller = null;
    if (this._status() === 'running') this._status.set('idle');
  }

  reset(): void {
    this.cancel();
    this._transcript.set([]);
    this._error.set(null);
    this._status.set('idle');
  }

  /** Run the full agent loop for one user prompt. */
  async send(prompt: string): Promise<void> {
    const text = prompt.trim();
    if (!text || this._status() === 'running') return;

    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    this._error.set(null);
    this._status.set('running');
    this.append({ kind: 'user', id: this.nextId++, text });

    try {
      const tools = (await this.mcp.listTools()).map((t) => this.mcp.toGeminiTool(t));
      let body: AgentRequestBody = { message: text, tools };

      for (let step = 0; step < MAX_STEPS; step++) {
        const outcome = await this.streamTurn(body, controller.signal);
        if (controller.signal.aborted) return;

        if (outcome.error) {
          this._error.set(outcome.error);
          this._status.set('error');
          return;
        }

        if (!outcome.toolCall) {
          this._status.set('idle'); // turn ended with no tool request — we're done
          return;
        }

        // Execute the requested tool IN THE BROWSER (logged by the WebMCP DevTools panel).
        const { id, name, arguments: args, interactionId } = outcome.toolCall;
        this.append({ kind: 'tool_call', id: this.nextId++, name, args });
        let result: string;
        try {
          result = await this.mcp.callTool(name, args);
        } catch (err) {
          result = `Tool "${name}" failed: ${err instanceof Error ? err.message : 'unknown error'}`;
        }
        this.append({ kind: 'tool_result', id: this.nextId++, name, text: result });

        body = { toolResult: { call_id: id, name, result }, previousInteractionId: interactionId, tools };
      }

      // Hit the step ceiling.
      this._error.set('The agent took too many tool steps and stopped.');
      this._status.set('error');
    } catch (err) {
      if (controller.signal.aborted) return;
      this._error.set(err instanceof Error ? err.message : 'The agent hit an unexpected error.');
      this._status.set('error');
    }
  }

  /**
   * Stream one /api/agent turn: appends streamed tokens to a live assistant entry and returns the
   * turn's outcome (a pending tool call, or an error).
   */
  private async streamTurn(
    body: AgentRequestBody,
    signal: AbortSignal,
  ): Promise<{ toolCall?: Extract<AgentServerEvent, { type: 'tool_call' }>; error?: string }> {
    const response = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok || !response.body) {
      return { error: `Agent request failed with status ${response.status}` };
    }

    const assistantId = this.nextId++;
    let assistantStarted = false;
    let toolCall: Extract<AgentServerEvent, { type: 'tool_call' }> | undefined;

    const handle = (raw: string): { error?: string } | undefined => {
      const event = parseAgentSseRecord(raw);
      switch (event.type) {
        case 'token':
          if (!assistantStarted) {
            this.append({ kind: 'assistant', id: assistantId, text: '' });
            assistantStarted = true;
          }
          this.appendToken(assistantId, event.token);
          return undefined;
        case 'tool_call':
          toolCall = event;
          return undefined;
        case 'error':
          return { error: event.message };
        case 'done':
          return undefined;
      }
    };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const res = handle(rawEvent);
        if (res?.error) return { error: res.error };
      }
    }
    if (buffer.trim()) {
      const res = handle(buffer);
      if (res?.error) return { error: res.error };
    }

    return { toolCall };
  }

  private append(entry: AgentEntry): void {
    this._transcript.update((list) => [...list, entry]);
  }

  private appendToken(id: number, token: string): void {
    this._transcript.update((list) =>
      list.map((e) => (e.id === id && e.kind === 'assistant' ? { ...e, text: e.text + token } : e)),
    );
  }
}
