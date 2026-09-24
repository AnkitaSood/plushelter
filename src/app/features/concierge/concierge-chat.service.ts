import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  EventType,
  type BaseEvent,
  type RunAgentInput,
  type RunErrorEvent,
  type RunFinishedEvent,
  type TextMessageContentEvent,
  type ToolCallArgsEvent,
  type ToolCallEndEvent,
  type ToolCallStartEvent,
} from '@ag-ui/core';
import type { HttpAgent } from '@ag-ui/client';
export type { Animal } from '../../data/roster';
import type { Animal } from '../../data/roster';
import { AdmittedAnimalsStore } from '../../data/admitted-animals-store';
import { AdoptedAnimalsStore } from '../../data/adopted-animals-store';
import { ModelContextClient } from '../../webmcp/model-context-client';
import { clearedRoster, extractCriteria, matchRosterByCriteria } from '../../webmcp/shelter-tools';

export interface ChatTokenEvent {
  type: 'token';
  token: string;
}

export interface ChatToolResultEvent {
  type: 'tool_result';
  toolName: string;
  animals: Animal[];
}

export interface ChatDoneEvent {
  type: 'done';
}

export interface ChatErrorEvent {
  type: 'error';
  code: string;
  message: string;
}

export type ChatSseEvent = ChatTokenEvent | ChatToolResultEvent | ChatDoneEvent | ChatErrorEvent;

const MAX_STEPS = 6;

/**
 * Streams one concierge turn over the AG-UI protocol (`/api/agent?protocol=ag-ui`), executing any
 * WebMCP tool calls the model requests in the browser via `ModelContextClient` — the same
 * client-executed-tool pattern `AgentRunnerService` uses for the floating agent panel, but as its
 * own instance so concierge's transcript never collides with that panel's.
 *
 * Exposes the same `ChatSseEvent` union the old hand-rolled SSE client did, so `Concierge`'s
 * consumption code barely changes even though the transport underneath is a different protocol.
 */
@Service()
export class ConciergeChatService {
  private readonly mcp = inject(ModelContextClient);
  private readonly admittedAnimalsStore = inject(AdmittedAnimalsStore);
  private readonly adoptedAnimalsStore = inject(AdoptedAnimalsStore);

  private agent: HttpAgent | null = null;
  private lastInteractionId?: string;
  private threadId = `thread-${crypto.randomUUID()}`;

  private async getAgent(): Promise<HttpAgent> {
    if (!this.agent || (this.agent as any).abortController?.signal?.aborted) {
      const { HttpAgent } = await import('@ag-ui/client');
      this.agent = new HttpAgent({
        url: '/api/agent?protocol=ag-ui',
        headers: { 'x-ag-ui-protocol': 'true' },
      });
    } else {
      (this.agent as any).abortController = new AbortController();
    }
    return this.agent;
  }

  /** Recomputes the exact matched animals for a `searchRoster` tool call, client-side and deterministically —
   * no more guessing which animals Gemini's narration named (see the retired animal-match-filter.ts). */
  private searchRosterAnimals(args: unknown, fallbackMessage?: string): Animal[] {
    const criteria = extractCriteria(args) || fallbackMessage || '';
    const adoptedIds = new Set(this.adoptedAnimalsStore.adoptions().map((r) => r.animalId));
    const all = clearedRoster(this.admittedAnimalsStore.admitted(), adoptedIds);
    return matchRosterByCriteria(criteria, all);
  }

  streamChat(message: string): Observable<ChatSseEvent> {
    return new Observable<ChatSseEvent>((subscriber) => {
      let cancelled = false;
      let completed = false;

      (async () => {
        try {
          const rawTools = await this.mcp.listTools();
          const conciergeTools = rawTools.filter(
            (t) =>
              t.name !== 'performCriticalMedicalProcedure' &&
              t.name !== 'admitAnimal' &&
              t.name !== 'submitSurrenderRequest',
          );
          const tools = conciergeTools.map((t) => this.mcp.toGeminiTool(t));
          let turnInput: RunAgentInput = {
            threadId: this.threadId,
            runId: `run-${crypto.randomUUID()}`,
            messages: [
              {
                id: `msg-${crypto.randomUUID()}`,
                role: 'user',
                content: message,
              },
            ],
            tools,
            context: [],
            // Concierge composes its own deterministic AnimalCard/CustomChart surface from
            // searchRoster's real results — opt out of Gemini also self-composing A2UI blocks,
            // which would otherwise stream a raw ```a2ui fence into the visible chat bubble.
            forwardedProps: {
              composeA2ui: false,
              ...(this.lastInteractionId ? { previousInteractionId: this.lastInteractionId } : {}),
            },
          };

          for (let step = 0; step < MAX_STEPS && !cancelled; step++) {
            const result = await this.runTurn(turnInput, subscriber);
            if (cancelled) return;

            if (result.error) {
              completed = true;
              subscriber.next({ type: 'error', code: 'UPSTREAM_ERROR', message: result.error });
              subscriber.complete();
              return;
            }
            if (result.interactionId) {
              this.lastInteractionId = result.interactionId;
            }
            if (!result.pendingToolCall) {
              completed = true;
              subscriber.next({ type: 'done' });
              subscriber.complete();
              return;
            }

            const { id, name, args, interactionId } = result.pendingToolCall;

            if (name === 'searchRoster') {
              subscriber.next({
                type: 'tool_result',
                toolName: name,
                animals: this.searchRosterAnimals(args, message),
              });
            }

            // Fallback to user message if tool arguments did not include criteria
            let callArgs = args;
            if (name === 'searchRoster' && !extractCriteria(args)) {
              callArgs = { criteria: message };
            }

            let toolResultText: string;
            try {
              toolResultText = await this.mcp.callTool(name, callArgs);
            } catch (err) {
              toolResultText = `Tool "${name}" failed: ${err instanceof Error ? err.message : 'unknown error'}`;
            }

            turnInput = {
              threadId: this.threadId,
              runId: `run-${crypto.randomUUID()}`,
              messages: [
                {
                  id: `msg-${crypto.randomUUID()}`,
                  role: 'tool',
                  toolCallId: id,
                  content: toolResultText,
                },
              ],
              tools,
              context: [],
              forwardedProps: {
                composeA2ui: false,
                previousInteractionId: interactionId || this.lastInteractionId,
                toolResult: { call_id: id, name, result: toolResultText },
              },
            };
          }

          if (!cancelled) {
            completed = true;
            subscriber.next({
              type: 'error',
              code: 'MAX_STEPS_EXCEEDED',
              message: 'The concierge reached the maximum tool execution steps.',
            });
            subscriber.complete();
          }
        } catch (error) {
          if (cancelled) return;
          completed = true;
          subscriber.next({
            type: 'error',
            code: 'NETWORK_ERROR',
            message: error instanceof Error ? error.message : 'Lost connection to the concierge.',
          });
          subscriber.complete();
        }
      })();

      return () => {
        cancelled = true;
        if (!completed) {
          this.agent?.abortRun();
        }
      };
    });
  }

  /** Runs one AG-UI turn, translating its event stream into our union and resolving with
   * whatever the caller needs to decide the next step (another tool round, or done/error). */
  private async runTurn(
    input: RunAgentInput,
    subscriber: { next: (e: ChatSseEvent) => void },
  ): Promise<{
    pendingToolCall?: { id: string; name: string; args: Record<string, unknown>; interactionId?: string };
    error?: string;
    interactionId?: string;
  }> {
    const agent = await this.getAgent();
    return new Promise((resolve) => {
      let pendingToolCall: { id: string; name: string; args: Record<string, unknown>; interactionId?: string } | undefined;
      let toolArgsBuffer = '';
      let turnError: string | undefined;
      let turnInteractionId: string | undefined;

      const subscription = agent.run(input).subscribe({
        next: (event: BaseEvent) => {
          switch (event.type) {
            case EventType.TEXT_MESSAGE_CONTENT: {
              const e = event as TextMessageContentEvent;
              subscriber.next({ type: 'token', token: e.delta });
              break;
            }
            case EventType.TOOL_CALL_START: {
              const e = event as ToolCallStartEvent;
              toolArgsBuffer = '';
              const iid = (e as any).interactionId || (e as any).metadata?.interactionId;
              if (iid) turnInteractionId = iid;
              pendingToolCall = { id: e.toolCallId, name: e.toolCallName, args: {}, interactionId: iid };
              break;
            }
            case EventType.TOOL_CALL_ARGS: {
              const e = event as ToolCallArgsEvent;
              toolArgsBuffer += e.delta;
              break;
            }
            case EventType.TOOL_CALL_END: {
              const e = event as ToolCallEndEvent;
              if (pendingToolCall) {
                try {
                  pendingToolCall.args = JSON.parse(toolArgsBuffer || '{}');
                } catch {
                  pendingToolCall.args = {};
                }
              }
              const iid = (e as any).interactionId || (e as any).metadata?.interactionId;
              if (iid) turnInteractionId = iid;
              break;
            }
            case EventType.RUN_FINISHED: {
              // `interactionId` rides in as non-standard metadata (see agent.mts); RunFinishedEvent's
              // typed `result`/`metadata` fields don't model it, so read it structurally.
              const e = event as RunFinishedEvent & { metadata?: { interactionId?: string } };
              const result = e.result as { interactionId?: string } | undefined;
              const iid = result?.interactionId ?? e.metadata?.interactionId;
              if (iid) turnInteractionId = iid;
              break;
            }
            case EventType.RUN_ERROR: {
              const e = event as RunErrorEvent;
              turnError = e.message ?? 'Unknown agent error.';
              break;
            }
          }
        },
        error: (err: unknown) => {
          resolve({ error: err instanceof Error ? err.message : 'Agent stream failed.' });
        },
        complete: () => {
          resolve({ pendingToolCall, error: turnError, interactionId: turnInteractionId });
        },
      });

      // No external cancellation hook needed here: the outer Observable's teardown calls
      // agent.abortRun(), which completes this inner subscription on its own.
      void subscription;
    });
  }
}
