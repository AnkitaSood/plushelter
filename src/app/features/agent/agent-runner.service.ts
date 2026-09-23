import { Service, computed, inject, signal } from '@angular/core';
import { CopilotKit, injectAgentStore } from '@copilotkit/angular';
import { ShelterCopilotToolsService } from '../../copilotkit/copilotkit-tools';
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
  type ToolCallResultEvent,
  type ToolCallStartEvent,
} from '@ag-ui/core';

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

@Service()
export class AgentRunnerService {
  private readonly copilotKit = inject(CopilotKit);
  private readonly agentStore = injectAgentStore('shelter-agent');
  // Injecting ShelterCopilotToolsService registers frontend tools with CopilotKit and WebMCP
  private readonly toolsService = inject(ShelterCopilotToolsService);

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
  private activeAssistantId: number | null = null;
  private activeMessageId: string | null = null;
  private toolNamesById = new Map<string, string>();

  constructor() {
    // Subscribe to the CopilotKit/AG-UI agent to reflect events in the transcript and panel signals
    try {
      const agent = this.agentStore().agent;
      if (agent) {
        agent.subscribe({
          onEvent: ({ event }) => {
            this.handleAgUiEvent(event);
          },
          onRunFailed: ({ error }) => {
            this._error.set(error?.message ?? 'Agent execution error.');
            this._status.set('error');
          },
          onRunFinalized: () => {
            if (this._status() === 'running') {
              this._status.set('idle');
            }
          },
        });
      }
    } catch (err) {
      console.warn('Could not subscribe to agent on initialization:', err);
    }
  }

  webMcpAvailable(): boolean {
    return typeof document !== 'undefined' && 'modelContext' in document;
  }

  private markToolCallExecuted(id: string): void {
    this._toolCalls.update((calls) =>
      calls.map((c) => (c.id === id ? { ...c, status: 'executed' } : c)),
    );
  }

  cancel(): void {
    try {
      this.agentStore().agent?.abortRun();
    } catch {
      /* ignore */
    }
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
    this.activeAssistantId = null;
    this.activeMessageId = null;
    this.toolNamesById.clear();
  }

  async send(prompt: string): Promise<void> {
    const text = prompt.trim();
    if (!text || this._status() === 'running') return;

    this._error.set(null);
    this._status.set('running');
    this.appendTranscript({ kind: 'user', id: this.nextId++, text });
    this._messages.update((msgs) => [
      ...msgs,
      { id: `msg-${Date.now()}`, role: 'user', content: text },
    ]);

    try {
      const agent = this.agentStore().agent;
      if (!agent) {
        throw new Error('CopilotKit agent is not available.');
      }

      agent.addMessage({
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
      });

      await this.copilotKit.core.runAgent({ agent });
      this._status.set('idle');
    } catch (err) {
      this._toolCalls.update((calls) =>
        calls.map((c) => (c.status === 'pending' ? { ...c, status: 'executed' } : c)),
      );
      this._error.set(err instanceof Error ? err.message : 'An unexpected error occurred.');
      this._status.set('error');
    }
  }

  private handleAgUiEvent(event: BaseEvent): void {
    switch (event.type) {
      case EventType.RUN_STARTED: {
        const e = event as RunStartedEvent;
        this._currentRun.set({ runId: e.runId, threadId: e.threadId });
        this._status.set('running');
        break;
      }
      case EventType.TEXT_MESSAGE_START: {
        const e = event as TextMessageStartEvent;
        this.activeMessageId = e.messageId;
        this.activeAssistantId = this.nextId++;
        this.appendTranscript({ kind: 'assistant', id: this.activeAssistantId, text: '' });
        this._messages.update((msgs) => [
          ...msgs,
          { id: e.messageId, role: 'assistant', content: '' },
        ]);
        break;
      }
      case EventType.TEXT_MESSAGE_CONTENT: {
        const e = event as TextMessageContentEvent;
        if (this.activeAssistantId !== null) {
          this.appendToken(this.activeAssistantId, e.delta);
        }
        if (this.activeMessageId !== null) {
          this._messages.update((msgs) =>
            msgs.map((m) => (m.id === this.activeMessageId ? { ...m, content: m.content + e.delta } : m)),
          );
        }
        break;
      }
      case EventType.TOOL_CALL_START: {
        const e = event as ToolCallStartEvent;
        this.toolNamesById.set(e.toolCallId, e.toolCallName);
        this._toolCalls.update((calls) => [
          ...calls,
          { id: e.toolCallId, name: e.toolCallName, args: '', status: 'pending' },
        ]);
        this.appendTranscript({
          kind: 'tool_call',
          id: this.nextId++,
          name: e.toolCallName,
          args: {},
        });
        break;
      }
      case EventType.TOOL_CALL_ARGS: {
        const e = event as ToolCallArgsEvent;
        this._toolCalls.update((calls) =>
          calls.map((c) => (c.id === e.toolCallId ? { ...c, args: c.args + e.delta } : c)),
        );
        break;
      }
      case EventType.TOOL_CALL_END: {
        const e = event as ToolCallEndEvent;
        this.markToolCallExecuted(e.toolCallId);
        break;
      }
      case EventType.TOOL_CALL_RESULT: {
        const e = event as ToolCallResultEvent;
        this.markToolCallExecuted(e.toolCallId);
        const toolName = this.toolNamesById.get(e.toolCallId) ?? 'tool';
        this.appendTranscript({
          kind: 'tool_result',
          id: this.nextId++,
          name: toolName,
          text: typeof e.content === 'string' ? e.content : JSON.stringify(e.content),
        });
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
        this._status.set('idle');
        break;
      }
      case EventType.RUN_ERROR: {
        const e = event as RunErrorEvent;
        this._error.set(e.message);
        this._status.set('error');
        break;
      }
    }
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
