import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRunnerService } from './agent-runner.service';
import { ModelContextClient } from '../../webmcp/model-context-client';
import { EventType, type BaseEvent } from '@ag-ui/core';
import { Observable } from 'rxjs';

describe('AgentRunnerService (AG-UI Client Transport)', () => {
  let service: AgentRunnerService;
  let mockMcp: {
    listTools: ReturnType<typeof vi.fn>;
    toGeminiTool: ReturnType<typeof vi.fn>;
    callTool: ReturnType<typeof vi.fn>;
    isWebMcpAvailable: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockMcp = {
      listTools: vi.fn().mockResolvedValue([{ name: 'search_available_animals', description: 'Search roster' }]),
      toGeminiTool: vi.fn().mockReturnValue({
        type: 'function',
        name: 'search_available_animals',
        description: 'Search roster',
        parameters: {},
      }),
      callTool: vi.fn().mockResolvedValue(JSON.stringify([{ id: '001', name: 'Horace' }])),
      isWebMcpAvailable: vi.fn().mockReturnValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        AgentRunnerService,
        { provide: ModelContextClient, useValue: mockMcp },
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

  it('tracks AG-UI stream lifecycle events and updates signals reactively', async () => {
    // Mock the internal agent.run to emit standard AG-UI events
    const mockEvents: BaseEvent[] = [
      {
        type: EventType.RUN_STARTED,
        runId: 'run-test-1',
        threadId: 'thread-test-1',
      } as any,
      {
        type: EventType.TEXT_MESSAGE_START,
        messageId: 'msg-1',
        role: 'assistant',
      } as any,
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: 'msg-1',
        delta: 'Checking the roster... ',
      } as any,
      {
        type: EventType.TEXT_MESSAGE_END,
        messageId: 'msg-1',
      } as any,
      {
        type: EventType.ACTIVITY_SNAPSHOT,
        messageId: 'act-1',
        activityType: 'a2ui-surface',
        content: {
          messages: [{ version: 'v0.9', createSurface: { surfaceId: 'srf-test', catalogId: 'basic' } }],
        },
      } as any,
      {
        type: EventType.RUN_FINISHED,
        runId: 'run-test-1',
        threadId: 'thread-test-1',
      } as any,
    ];

    // Spy on getAgent to return mock agent
    vi.spyOn(service as any, 'getAgent').mockResolvedValue({
      run: vi.fn().mockReturnValue(new Observable((sub) => {
        for (const e of mockEvents) {
          sub.next(e);
        }
        sub.complete();
      })),
      abortRun: vi.fn(),
    });

    await service.send('Find a calm companion');

    expect(service.status()).toBe('idle');
    expect(service.isRunning()).toBe(false);
    expect(service.currentRun()).toEqual({ runId: 'run-test-1', threadId: 'thread-test-1' });

    // Messages signal updated
    expect(service.messages()).toHaveLength(2); // user + assistant
    expect(service.messages()[0].role).toBe('user');
    expect(service.messages()[0].content).toBe('Find a calm companion');
    expect(service.messages()[1].role).toBe('assistant');
    expect(service.messages()[1].content).toBe('Checking the roster... ');

    // Transcript signal maintained
    expect(service.transcript()).toHaveLength(2);

    // Activities signal populated
    expect(service.activities()).toHaveLength(1);
    expect(service.activities()[0].activityType).toBe('a2ui-surface');
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

  it('marks tool calls executed upon TOOL_CALL_END and tool execution', async () => {
    let turnCount = 0;
    vi.spyOn(service as any, 'getAgent').mockResolvedValue({
      run: vi.fn().mockImplementation(() => {
        turnCount++;
        if (turnCount === 1) {
          return new Observable((sub) => {
            sub.next({
              type: EventType.RUN_STARTED,
              runId: 'run-1',
              threadId: 'thread-1',
            } as any);
            sub.next({
              type: EventType.TOOL_CALL_START,
              toolCallId: 'call-stats',
              toolCallName: 'getShelterStats',
            } as any);
            sub.next({
              type: EventType.TOOL_CALL_ARGS,
              toolCallId: 'call-stats',
              delta: '{}',
            } as any);
            sub.next({
              type: EventType.TOOL_CALL_END,
              toolCallId: 'call-stats',
            } as any);
            sub.next({
              type: EventType.RUN_FINISHED,
              runId: 'run-1',
              threadId: 'thread-1',
            } as any);
            sub.complete();
          });
        }
        // Turn 2: model answers after receiving tool result
        return new Observable((sub) => {
          sub.next({
            type: EventType.RUN_STARTED,
            runId: 'run-2',
            threadId: 'thread-1',
          } as any);
          sub.next({
            type: EventType.TEXT_MESSAGE_START,
            messageId: 'msg-final',
            role: 'assistant',
          } as any);
          sub.next({
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId: 'msg-final',
            delta: '10 animals on file.',
          } as any);
          sub.next({
            type: EventType.TEXT_MESSAGE_END,
            messageId: 'msg-final',
          } as any);
          sub.next({
            type: EventType.RUN_FINISHED,
            runId: 'run-2',
            threadId: 'thread-1',
          } as any);
          sub.complete();
        });
      }),
      abortRun: vi.fn(),
    });

    await service.send('How many animals?');

    expect(service.status()).toBe('idle');
    expect(mockMcp.callTool).toHaveBeenCalledWith('getShelterStats', {});
    // Tool call status must be 'executed', NOT 'pending'
    expect(service.toolCalls()).toHaveLength(1);
    expect(service.toolCalls()[0].name).toBe('getShelterStats');
    expect(service.toolCalls()[0].status).toBe('executed');
    // Ensure no pending calls remain
    const pending = service.toolCalls().filter((c) => c.status === 'pending');
    expect(pending).toHaveLength(0);
  });

  it('continues multi-turn conversation across messages and propagates previousInteractionId', async () => {
    const runCalls: any[] = [];
    vi.spyOn(service as any, 'getAgent').mockResolvedValue({
      run: vi.fn().mockImplementation((input: any) => {
        runCalls.push(input);
        return new Observable((sub) => {
          sub.next({
            type: EventType.RUN_STARTED,
            runId: `run-${runCalls.length}`,
            threadId: 'thread-1',
          } as any);
          sub.next({
            type: EventType.TEXT_MESSAGE_START,
            messageId: `msg-${runCalls.length}`,
            role: 'assistant',
          } as any);
          sub.next({
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId: `msg-${runCalls.length}`,
            delta: `Reply ${runCalls.length}`,
          } as any);
          sub.next({
            type: EventType.TEXT_MESSAGE_END,
            messageId: `msg-${runCalls.length}`,
          } as any);
          sub.next({
            type: EventType.RUN_FINISHED,
            runId: `run-${runCalls.length}`,
            threadId: 'thread-1',
            result: { interactionId: `interaction-${runCalls.length}` },
          } as any);
          sub.complete();
        });
      }),
      abortRun: vi.fn(),
    });

    // First user message
    await service.send('First question');
    expect(service.status()).toBe('idle');
    expect(service.error()).toBeNull();
    expect(runCalls[0].previousInteractionId).toBeUndefined();

    // Second user message - should continue with previousInteractionId without aborting
    await service.send('Second question');
    expect(service.status()).toBe('idle');
    expect(service.error()).toBeNull();
    expect(runCalls[1].previousInteractionId).toBe('interaction-1');
  });

  it('recovers after user cancellation and allows subsequent sends with fresh controller', async () => {
    const mockAbort = vi.fn();
    const mockRun = vi.fn().mockReturnValue(
      new Observable((sub) => {
        sub.next({
          type: EventType.RUN_STARTED,
          runId: 'run-post-cancel',
          threadId: 'thread-1',
        } as any);
        sub.next({
          type: EventType.TEXT_MESSAGE_START,
          messageId: 'msg-post-cancel',
          role: 'assistant',
        } as any);
        sub.next({
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId: 'msg-post-cancel',
          delta: 'Recovered',
        } as any);
        sub.next({
          type: EventType.TEXT_MESSAGE_END,
          messageId: 'msg-post-cancel',
        } as any);
        sub.next({
          type: EventType.RUN_FINISHED,
          runId: 'run-post-cancel',
          threadId: 'thread-1',
        } as any);
        sub.complete();
      }),
    );

    vi.spyOn(service as any, 'getAgent').mockResolvedValue({
      run: mockRun,
      abortRun: mockAbort,
    });

    (service as any)._status.set('running');
    service.cancel();
    expect(service.status()).toBe('idle');
    expect(service.error()).toContain('cancelled');

    // Subsequent message should succeed and clear the cancelled error
    await service.send('Hello again');
    expect(service.status()).toBe('idle');
    expect(service.error()).toBeNull();
    expect(mockRun).toHaveBeenCalled();
  });

  it('ensures getAgent returns an unaborted agent with a fresh AbortController', async () => {
    const agent1 = await (service as any).getAgent();
    expect(agent1.abortController.signal.aborted).toBe(false);

    // If the controller was somehow aborted
    agent1.abortController.abort();
    expect(agent1.abortController.signal.aborted).toBe(true);

    const agent2 = await (service as any).getAgent();
    expect(agent2.abortController.signal.aborted).toBe(false);
  });
});
