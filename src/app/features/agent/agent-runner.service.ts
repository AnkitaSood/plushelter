import { Service, computed, inject, signal } from '@angular/core';
import type { HttpAgent } from '@ag-ui/client';
import {
  EventType,
  type ActivitySnapshotEvent,
  type BaseEvent,
  type RunErrorEvent,
  type RunStartedEvent,
  type StepFinishedEvent,
  type StepStartedEvent,
  type TextMessageContentEvent,
  type TextMessageStartEvent,
  type ToolCallArgsEvent,
  type ToolCallEndEvent,
  type ToolCallStartEvent,
} from '@ag-ui/core';
import { GeminiToolDecl, ModelContextClient } from '../../webmcp/model-context-client';

export type AgentEntry =
  | { kind: 'user'; id: number; text: string }
  | { kind: 'assistant'; id: number; text: string }
  | { kind: 'tool_call'; id: number; name: string; args: unknown }
  | { kind: 'tool_result'; id: number; name: string; text: string };

export type AgentStatus = 'idle' | 'running' | 'error';

export interface AgUiMessage {
  id: string;
  role: string;
  content: string;
}

export interface AgUiToolCall {
  id: string;
  name: string;
  args: string;
  status: 'pending' | 'executed';
}

export interface AgUiStep {
  name: string;
  status: 'running' | 'completed';
}

const MAX_STEPS = 6;

@Service()
export class AgentRunnerService {
  private readonly mcp = inject(ModelContextClient);
  private agent: HttpAgent | null = null;
  private lastInteractionId?: string;

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

  // State signals exposed to UI
  private readonly _transcript = signal<AgentEntry[]>([]);
  private readonly _status = signal<AgentStatus>('idle');
  private readonly _error = signal<string | null>(null);
  private readonly _currentRun = signal<{ runId: string; threadId: string } | null>(null);
  private readonly _messages = signal<AgUiMessage[]>([]);
  private readonly _activities = signal<ActivitySnapshotEvent[]>([]);
  private readonly _sharedState = signal<Record<string, unknown>>({});
  private readonly _reasoning = signal<string>('');
  private readonly _steps = signal<AgUiStep[]>([]);
  private readonly _toolCalls = signal<AgUiToolCall[]>([]);

  readonly transcript = this._transcript.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isRunning = computed(() => this._status() === 'running');
  readonly currentRun = this._currentRun.asReadonly();
  readonly messages = this._messages.asReadonly();
  readonly activities = this._activities.asReadonly();
  readonly sharedState = this._sharedState.asReadonly();
  readonly reasoning = this._reasoning.asReadonly();
  readonly steps = this._steps.asReadonly();
  readonly toolCalls = this._toolCalls.asReadonly();

  private nextId = 0;

  webMcpAvailable(): boolean {
    return this.mcp.isWebMcpAvailable();
  }

  private markToolCallExecuted(id: string): void {
    this._toolCalls.update((calls) =>
      calls.map((c) => (c.id === id ? { ...c, status: 'executed' } : c)),
    );
  }

  cancel(): void {
    this.agent?.abortRun();
    this.agent = null;
    this._toolCalls.update((calls) =>
      calls.map((c) => (c.status === 'pending' ? { ...c, status: 'executed' } : c)),
    );
    if (this._status() === 'running') {
      this._status.set('idle');
      this._error.set('Run was cancelled by user.');
    }
  }

  reset(): void {
    this.cancel();
    this.lastInteractionId = undefined;
    this._transcript.set([]);
    this._error.set(null);
    this._status.set('idle');
    this._currentRun.set(null);
    this._messages.set([]);
    this._activities.set([]);
    this._sharedState.set({});
    this._reasoning.set('');
    this._steps.set([]);
    this._toolCalls.set([]);
  }

  async send(prompt: string): Promise<void> {
    const text = prompt.trim();
    if (!text || this._status() === 'running') return;

    this._error.set(null);
    this._status.set('running');
    this.appendTranscript({ kind: 'user', id: this.nextId++, text });
    this._messages.update((msgs) => [...msgs, { id: `msg-${Date.now()}`, role: 'user', content: text }]);

    try {
      const tools = (await this.mcp.listTools()).map((t) => this.mcp.toGeminiTool(t));
      let turnInput: Record<string, unknown> = {
        message: text,
        tools,
        protocol: 'ag-ui',
        ...(this.lastInteractionId ? { previousInteractionId: this.lastInteractionId } : {}),
      };

      for (let step = 0; step < MAX_STEPS; step++) {
        const turnResult = await this.runTurn(turnInput);
        if (this._status() !== 'running') return;

        if (turnResult.error) {
          this._error.set(turnResult.error);
          this._status.set('error');
          return;
        }

        if (turnResult.interactionId) {
          this.lastInteractionId = turnResult.interactionId;
        }

        if (!turnResult.pendingToolCall) {
          this._status.set('idle');
          return;
        }

        // Execute browser tool
        const { id, name, args, interactionId } = turnResult.pendingToolCall;
        this.markToolCallExecuted(id);
        this.appendTranscript({ kind: 'tool_call', id: this.nextId++, name, args });
        let result: string;
        try {
          result = await this.mcp.callTool(name, args);
        } catch (err) {
          result = `Tool "${name}" failed: ${err instanceof Error ? err.message : 'unknown error'}`;
        }
        this.appendTranscript({ kind: 'tool_result', id: this.nextId++, name, text: result });

        turnInput = {
          toolResult: { call_id: id, name, result },
          previousInteractionId: interactionId || this.lastInteractionId,
          tools,
          protocol: 'ag-ui',
        };
      }

      this._toolCalls.update((calls) =>
        calls.map((c) => (c.status === 'pending' ? { ...c, status: 'executed' } : c)),
      );
      this._error.set('The agent reached the maximum tool execution steps.');
      this._status.set('error');
    } catch (err) {
      this._toolCalls.update((calls) =>
        calls.map((c) => (c.status === 'pending' ? { ...c, status: 'executed' } : c)),
      );
      this._error.set(err instanceof Error ? err.message : 'An unexpected error occurred.');
      this._status.set('error');
    }
  }

  private async runTurn(input: Record<string, unknown>): Promise<{
    pendingToolCall?: { id: string; name: string; args: Record<string, unknown>; interactionId?: string };
    error?: string;
    interactionId?: string;
  }> {
    const agent = await this.getAgent();
    return new Promise((resolve) => {
      let activeAssistantId: number | null = null;
      let activeMessageId: string | null = null;
      let pendingToolCall: { id: string; name: string; args: Record<string, unknown>; interactionId?: string } | undefined;
      let toolArgsBuffer = '';
      let turnError: string | undefined;
      let turnInteractionId: string | undefined;

      const subscription = agent.run(input as any).subscribe({
        next: (event: BaseEvent) => {
          switch (event.type) {
            case EventType.RUN_STARTED: {
              const e = event as RunStartedEvent;
              this._currentRun.set({ runId: e.runId, threadId: e.threadId });
              break;
            }
            case EventType.TEXT_MESSAGE_START: {
              const e = event as TextMessageStartEvent;
              activeMessageId = e.messageId;
              activeAssistantId = this.nextId++;
              this.appendTranscript({ kind: 'assistant', id: activeAssistantId, text: '' });
              this._messages.update((msgs) => [...msgs, { id: e.messageId, role: 'assistant', content: '' }]);
              break;
            }
            case EventType.TEXT_MESSAGE_CONTENT: {
              const e = event as TextMessageContentEvent;
              if (activeAssistantId !== null) {
                this.appendToken(activeAssistantId, e.delta);
              }
              if (activeMessageId !== null) {
                this._messages.update((msgs) =>
                  msgs.map((m) => (m.id === activeMessageId ? { ...m, content: m.content + e.delta } : m)),
                );
              }
              break;
            }
            case EventType.TOOL_CALL_START: {
              const e = event as ToolCallStartEvent;
              toolArgsBuffer = '';
              const iid = (e as any).interactionId || (e as any).metadata?.interactionId;
              if (iid) {
                turnInteractionId = iid;
              }
              pendingToolCall = {
                id: e.toolCallId,
                name: e.toolCallName,
                args: {},
                interactionId: iid,
              };
              this._toolCalls.update((calls) => [
                ...calls,
                { id: e.toolCallId, name: e.toolCallName, args: '', status: 'pending' },
              ]);
              break;
            }
            case EventType.TOOL_CALL_ARGS: {
              const e = event as ToolCallArgsEvent;
              toolArgsBuffer += e.delta;
              this._toolCalls.update((calls) =>
                calls.map((c) => (c.id === e.toolCallId ? { ...c, args: c.args + e.delta } : c)),
              );
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
              const callId = e.toolCallId || pendingToolCall?.id;
              if (callId) {
                this.markToolCallExecuted(callId);
              }
              const iid = (e as any).interactionId || (e as any).metadata?.interactionId;
              if (iid) {
                turnInteractionId = iid;
              }
              break;
            }
            case EventType.ACTIVITY_SNAPSHOT: {
              const e = event as ActivitySnapshotEvent;
              this._activities.update((acts) => [...acts, e]);
              break;
            }
            case EventType.STEP_STARTED: {
              const e = event as StepStartedEvent;
              this._steps.update((s) => [...s, { name: e.stepName, status: 'running' }]);
              break;
            }
            case EventType.STEP_FINISHED: {
              const e = event as StepFinishedEvent;
              this._steps.update((s) =>
                s.map((step) => (step.name === e.stepName ? { ...step, status: 'completed' } : step)),
              );
              break;
            }
            case EventType.REASONING_MESSAGE_CONTENT:
            case EventType.THINKING_TEXT_MESSAGE_CONTENT: {
              const e = event as any;
              this._reasoning.update((r) => r + (e.delta ?? ''));
              break;
            }
            case EventType.RUN_FINISHED: {
              const e = event as any;
              const iid =
                e.result?.interactionId ||
                e.metadata?.interactionId ||
                e.interactionId;
              if (iid) {
                turnInteractionId = iid;
              }
              break;
            }
            case EventType.RUN_ERROR: {
              const e = event as RunErrorEvent;
              turnError = e.message;
              break;
            }
          }
        },
        error: (err: unknown) => {
          if (pendingToolCall) {
            this.markToolCallExecuted(pendingToolCall.id);
          }
          resolve({ error: err instanceof Error ? err.message : 'Transport stream error' });
        },
        complete: () => {
          if (pendingToolCall) {
            this.markToolCallExecuted(pendingToolCall.id);
          }
          resolve({
            pendingToolCall,
            error: turnError,
            interactionId: turnInteractionId || pendingToolCall?.interactionId,
          });
        },
      });
    });
  }

  private appendTranscript(entry: AgentEntry): void {
    this._transcript.update((list) => [...list, entry]);
  }

  private appendToken(id: number, token: string): void {
    this._transcript.update((list) =>
      list.map((e) => (e.id === id && e.kind === 'assistant' ? { ...e, text: e.text + token } : e)),
    );
  }
}
