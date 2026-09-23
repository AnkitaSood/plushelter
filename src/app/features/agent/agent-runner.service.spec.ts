import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRunnerService } from './agent-runner.service';
import { provideHttpClient } from '@angular/common/http';
import { provideCopilotKit } from '@copilotkit/angular';
import { EventType } from '@ag-ui/core';

describe('AgentRunnerService (CopilotKit & AG-UI Integration)', () => {
  let service: AgentRunnerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideCopilotKit({ runtimeUrl: '/api/copilotkit' }),
        AgentRunnerService,
      ],
    });

    service = TestBed.inject(AgentRunnerService);
  });

  it('initializes with idle status and empty signals', () => {
    expect(service.status()).toBe('idle');
    expect(service.isRunning()).toBe(false);
    expect(service.transcript()).toHaveLength(0);
    expect(service.messages()).toHaveLength(0);
    expect(service.toolCalls()).toHaveLength(0);
    expect(service.activities()).toHaveLength(0);
    expect(service.currentRun()).toBeNull();
  });

  it('tracks AG-UI stream lifecycle events and updates signals reactively', () => {
    // 1. RUN_STARTED
    (service as any).handleAgUiEvent({
      type: EventType.RUN_STARTED,
      runId: 'run-test-1',
      threadId: 'thread-test-1',
    });

    expect(service.status()).toBe('running');
    expect(service.isRunning()).toBe(true);
    expect(service.currentRun()).toEqual({ runId: 'run-test-1', threadId: 'thread-test-1' });

    // 2. TEXT_MESSAGE_START
    (service as any).handleAgUiEvent({
      type: EventType.TEXT_MESSAGE_START,
      messageId: 'msg-1',
      role: 'assistant',
    });

    expect(service.messages()).toHaveLength(1);
    expect(service.messages()[0].role).toBe('assistant');
    expect(service.transcript()).toHaveLength(1);

    // 3. TEXT_MESSAGE_CONTENT
    (service as any).handleAgUiEvent({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: 'msg-1',
      delta: 'Checking the roster... ',
    });

    expect(service.messages()[0].content).toBe('Checking the roster... ');

    // 4. ACTIVITY_SNAPSHOT (A2UI surface)
    (service as any).handleAgUiEvent({
      type: EventType.ACTIVITY_SNAPSHOT,
      messageId: 'act-1',
      activityType: 'a2ui-surface',
      content: {
        messages: [{ version: 'v0.9', createSurface: { surfaceId: 'srf-test', catalogId: 'basic' } }],
      },
    });

    expect(service.activities()).toHaveLength(1);
    expect(service.activities()[0].activityType).toBe('a2ui-surface');

    // 5. TOOL_CALL_START & TOOL_CALL_ARGS & TOOL_CALL_RESULT
    (service as any).handleAgUiEvent({
      type: EventType.TOOL_CALL_START,
      toolCallId: 'call-1',
      toolCallName: 'searchRoster',
    });

    expect(service.toolCalls()).toHaveLength(1);
    expect(service.toolCalls()[0].name).toBe('searchRoster');
    expect(service.toolCalls()[0].status).toBe('pending');

    (service as any).handleAgUiEvent({
      type: EventType.TOOL_CALL_RESULT,
      toolCallId: 'call-1',
      content: 'Found 2 matching animals.',
    });

    expect(service.toolCalls()[0].status).toBe('executed');
  });

  it('handles user cancellation via cancel()', () => {
    (service as any)._status.set('running');
    (service as any)._toolCalls.set([
      { id: 'call-1', name: 'searchRoster', args: '{}', status: 'pending' },
    ]);

    service.cancel();

    expect(service.status()).toBe('idle');
    expect(service.error()).toContain('cancelled');
    expect(service.toolCalls()[0].status).toBe('executed');
  });

  it('clears all state on reset()', () => {
    (service as any)._status.set('error');
    (service as any)._error.set('Test error');
    (service as any)._transcript.set([{ kind: 'user', id: 1, text: 'Hello' }]);

    service.reset();

    expect(service.status()).toBe('idle');
    expect(service.error()).toBeNull();
    expect(service.transcript()).toHaveLength(0);
    expect(service.messages()).toHaveLength(0);
    expect(service.toolCalls()).toHaveLength(0);
    expect(service.activities()).toHaveLength(0);
  });
});
