/**
 * AG-UI protocol event definitions and serialization helpers.
 * Aligned with @ag-ui/core@1.0.0 (AG-UI Protocol 1.0).
 */

export enum AgUiEventType {
  RUN_STARTED = 'RUN_STARTED',
  RUN_FINISHED = 'RUN_FINISHED',
  RUN_ERROR = 'RUN_ERROR',
  STEP_STARTED = 'STEP_STARTED',
  STEP_FINISHED = 'STEP_FINISHED',
  TEXT_MESSAGE_START = 'TEXT_MESSAGE_START',
  TEXT_MESSAGE_CONTENT = 'TEXT_MESSAGE_CONTENT',
  TEXT_MESSAGE_END = 'TEXT_MESSAGE_END',
  TEXT_MESSAGE_CHUNK = 'TEXT_MESSAGE_CHUNK',
  TOOL_CALL_START = 'TOOL_CALL_START',
  TOOL_CALL_ARGS = 'TOOL_CALL_ARGS',
  TOOL_CALL_END = 'TOOL_CALL_END',
  TOOL_CALL_CHUNK = 'TOOL_CALL_CHUNK',
  TOOL_CALL_RESULT = 'TOOL_CALL_RESULT',
  STATE_SNAPSHOT = 'STATE_SNAPSHOT',
  STATE_DELTA = 'STATE_DELTA',
  MESSAGES_SNAPSHOT = 'MESSAGES_SNAPSHOT',
  ACTIVITY_SNAPSHOT = 'ACTIVITY_SNAPSHOT',
  ACTIVITY_DELTA = 'ACTIVITY_DELTA',
  THINKING_START = 'THINKING_START',
  THINKING_END = 'THINKING_END',
  REASONING_START = 'REASONING_START',
  REASONING_END = 'REASONING_END',
  REASONING_MESSAGE_START = 'REASONING_MESSAGE_START',
  REASONING_MESSAGE_CONTENT = 'REASONING_MESSAGE_CONTENT',
  REASONING_MESSAGE_END = 'REASONING_MESSAGE_END',
  REASONING_MESSAGE_CHUNK = 'REASONING_MESSAGE_CHUNK',
  REASONING_ENCRYPTED_VALUE = 'REASONING_ENCRYPTED_VALUE',
  SUBAGENT_STARTED = 'SUBAGENT_STARTED',
  SUBAGENT_FINISHED = 'SUBAGENT_FINISHED',
  SUBAGENT_ERROR = 'SUBAGENT_ERROR',
  RAW = 'RAW',
  CUSTOM = 'CUSTOM',
}

export interface AgUiBaseEvent {
  type: AgUiEventType | string;
  timestamp?: number;
  rawEvent?: unknown;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RunStartedEvent extends AgUiBaseEvent {
  type: AgUiEventType.RUN_STARTED;
  runId: string;
  threadId: string;
  parentRunId?: string;
  protocolVersion?: string;
  input?: unknown;
}

export interface RunFinishedEvent extends AgUiBaseEvent {
  type: AgUiEventType.RUN_FINISHED;
  runId: string;
  threadId: string;
  result?: unknown;
  outcome?: {
    type: 'success' | 'cancelled' | 'interrupt';
    pendingToolCallIds?: string[];
  };
}

export interface RunErrorEvent extends AgUiBaseEvent {
  type: AgUiEventType.RUN_ERROR;
  message: string;
  code?: string;
}

export interface StepStartedEvent extends AgUiBaseEvent {
  type: AgUiEventType.STEP_STARTED;
  stepName: string;
  stepIndex?: number;
}

export interface StepFinishedEvent extends AgUiBaseEvent {
  type: AgUiEventType.STEP_FINISHED;
  stepName: string;
  stepIndex?: number;
}

export interface TextMessageStartEvent extends AgUiBaseEvent {
  type: AgUiEventType.TEXT_MESSAGE_START;
  messageId: string;
  role: 'developer' | 'system' | 'assistant' | 'user';
  name?: string;
}

export interface TextMessageContentEvent extends AgUiBaseEvent {
  type: AgUiEventType.TEXT_MESSAGE_CONTENT;
  messageId: string;
  delta: string;
}

export interface TextMessageEndEvent extends AgUiBaseEvent {
  type: AgUiEventType.TEXT_MESSAGE_END;
  messageId: string;
}

export interface ToolCallStartEvent extends AgUiBaseEvent {
  type: AgUiEventType.TOOL_CALL_START;
  toolCallId: string;
  toolCallName: string;
  parentMessageId?: string;
  interactionId?: string; // Gemini Interactions continuation ID
}

export interface ToolCallArgsEvent extends AgUiBaseEvent {
  type: AgUiEventType.TOOL_CALL_ARGS;
  toolCallId: string;
  delta: string;
}

export interface ToolCallEndEvent extends AgUiBaseEvent {
  type: AgUiEventType.TOOL_CALL_END;
  toolCallId: string;
  interactionId?: string;
}

export interface ToolCallResultEvent extends AgUiBaseEvent {
  type: AgUiEventType.TOOL_CALL_RESULT;
  messageId: string;
  toolCallId: string;
  content: string;
  role?: 'tool';
}

export interface ActivitySnapshotEvent extends AgUiBaseEvent {
  type: AgUiEventType.ACTIVITY_SNAPSHOT;
  messageId: string;
  activityType: string;
  content: Record<string, unknown>;
  replace?: boolean;
}

export interface ActivityDeltaEvent extends AgUiBaseEvent {
  type: AgUiEventType.ACTIVITY_DELTA;
  messageId: string;
  activityType: string;
  patch: unknown[];
}

export interface StateSnapshotEvent extends AgUiBaseEvent {
  type: AgUiEventType.STATE_SNAPSHOT;
  snapshot: Record<string, unknown>;
}

export interface StateDeltaEvent extends AgUiBaseEvent {
  type: AgUiEventType.STATE_DELTA;
  delta: Array<{
    op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
    path: string;
    value?: unknown;
    from?: string;
  }>;
}

const encoder = new TextEncoder();

/**
 * Formats an AG-UI event as an SSE chunk: `data: <json>\n\n`.
 */
export function formatAgUiSse(event: AgUiBaseEvent): Uint8Array {
  const payload = {
    timestamp: Date.now(),
    ...event,
  };
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Legacy Plushelter SSE event encoder: `event: <name>\ndata: <json>\n\n`.
 */
export function formatLegacySse(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
