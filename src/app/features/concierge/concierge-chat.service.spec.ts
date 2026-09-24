import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConciergeChatService } from './concierge-chat.service';
import { ModelContextClient } from '../../webmcp/model-context-client';
import { AdmittedAnimalsStore } from '../../data/admitted-animals-store';
import { AdoptedAnimalsStore } from '../../data/adopted-animals-store';
import { EventType, type BaseEvent } from '@ag-ui/core';
import { enforceOutgoingInput } from '@ag-ui/client';
import { Observable } from 'rxjs';

describe('ConciergeChatService (AG-UI 1.0 Client Transport)', () => {
  let service: ConciergeChatService;
  let mockMcp: {
    listTools: ReturnType<typeof vi.fn>;
    toGeminiTool: ReturnType<typeof vi.fn>;
    callTool: ReturnType<typeof vi.fn>;
    isWebMcpAvailable: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockMcp = {
      listTools: vi.fn().mockResolvedValue([
        {
          name: 'searchRoster',
          description: 'Search roster by criteria',
          inputSchema: { type: 'object', properties: { criteria: { type: 'string' } } },
        },
      ]),
      toGeminiTool: vi.fn().mockReturnValue({
        type: 'function',
        name: 'searchRoster',
        description: 'Search roster by criteria',
        parameters: {},
      }),
      callTool: vi.fn().mockResolvedValue(JSON.stringify([{ id: '001', name: 'Horace', species: 'Bear' }])),
      isWebMcpAvailable: vi.fn().mockReturnValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        ConciergeChatService,
        { provide: ModelContextClient, useValue: mockMcp },
        AdmittedAnimalsStore,
        AdoptedAnimalsStore,
      ],
    });

    service = TestBed.inject(ConciergeChatService);
  });

  it('sends valid AG-UI 1.0 RunAgentInput that passes enforceOutgoingInput without errors', async () => {
    const runCalls: any[] = [];
    vi.spyOn(service as any, 'getAgent').mockResolvedValue({
      run: vi.fn().mockImplementation((input: any) => {
        // Must validate cleanly under AG-UI 1.0 schema
        const validated = enforceOutgoingInput(input);
        runCalls.push(validated);

        return new Observable((sub) => {
          sub.next({
            type: EventType.RUN_STARTED,
            runId: input.runId,
            threadId: input.threadId,
          } as any);
          sub.next({
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId: 'msg-reply-1',
            delta: 'Hello! I can help you find a companion.',
          } as any);
          sub.next({
            type: EventType.RUN_FINISHED,
            runId: input.runId,
            threadId: input.threadId,
            outcome: { type: 'success' },
          } as any);
          sub.complete();
        });
      }),
      abortRun: vi.fn(),
    });

    const events: any[] = [];
    await new Promise<void>((resolve, reject) => {
      service.streamChat('Friendly with kids').subscribe({
        next: (e) => events.push(e),
        error: (err) => reject(err),
        complete: () => resolve(),
      });
    });

    expect(runCalls).toHaveLength(1);
    expect(runCalls[0].threadId).toBeDefined();
    expect(runCalls[0].runId).toBeDefined();
    expect(runCalls[0].messages).toHaveLength(1);
    expect(runCalls[0].messages[0].role).toBe('user');
    expect(runCalls[0].messages[0].content).toBe('Friendly with kids');
    expect(runCalls[0].forwardedProps?.composeA2ui).toBe(false);

    // Verify emitted ChatSseEvents
    expect(events).toEqual([
      { type: 'token', token: 'Hello! I can help you find a companion.' },
      { type: 'done' },
    ]);
  });

  it('handles tool execution and sends AG-UI 1.0 tool message in subsequent turn', async () => {
    const runCalls: any[] = [];
    let turn = 0;
    vi.spyOn(service as any, 'getAgent').mockResolvedValue({
      run: vi.fn().mockImplementation((input: any) => {
        const validated = enforceOutgoingInput(input);
        runCalls.push(validated);
        turn++;

        if (turn === 1) {
          return new Observable((sub) => {
            sub.next({
              type: EventType.RUN_STARTED,
              runId: input.runId,
              threadId: input.threadId,
            } as any);
            sub.next({
              type: EventType.TOOL_CALL_START,
              toolCallId: 'call-1',
              toolCallName: 'searchRoster',
              metadata: { interactionId: 'interaction-1' },
            } as any);
            sub.next({
              type: EventType.TOOL_CALL_ARGS,
              toolCallId: 'call-1',
              delta: JSON.stringify({ criteria: 'Friendly with kids' }),
            } as any);
            sub.next({
              type: EventType.TOOL_CALL_END,
              toolCallId: 'call-1',
              metadata: { interactionId: 'interaction-1' },
            } as any);
            sub.next({
              type: EventType.RUN_FINISHED,
              runId: input.runId,
              threadId: input.threadId,
              result: { interactionId: 'interaction-1' },
              outcome: { type: 'success', pendingToolCallIds: ['call-1'] },
            } as any);
            sub.complete();
          });
        }

        return new Observable((sub) => {
          sub.next({
            type: EventType.RUN_STARTED,
            runId: input.runId,
            threadId: input.threadId,
          } as any);
          sub.next({
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId: 'msg-reply-2',
            delta: 'I found Horace for you!',
          } as any);
          sub.next({
            type: EventType.RUN_FINISHED,
            runId: input.runId,
            threadId: input.threadId,
            result: { interactionId: 'interaction-2' },
            outcome: { type: 'success' },
          } as any);
          sub.complete();
        });
      }),
      abortRun: vi.fn(),
    });

    const events: any[] = [];
    await new Promise<void>((resolve, reject) => {
      service.streamChat('Friendly with kids').subscribe({
        next: (e) => events.push(e),
        error: (err) => reject(err),
        complete: () => resolve(),
      });
    });

    expect(runCalls).toHaveLength(2);
    // Turn 2 must carry the tool message and forwarded toolResult
    expect(runCalls[1].messages).toHaveLength(1);
    expect(runCalls[1].messages[0].role).toBe('tool');
    expect(runCalls[1].messages[0].toolCallId).toBe('call-1');
    expect(runCalls[1].forwardedProps?.previousInteractionId).toBe('interaction-1');
    expect(runCalls[1].forwardedProps?.toolResult).toEqual({
      call_id: 'call-1',
      name: 'searchRoster',
      result: JSON.stringify([{ id: '001', name: 'Horace', species: 'Bear' }]),
    });

    // Emitted tool_result event with matched animals
    const toolResultEvent = events.find((e) => e.type === 'tool_result');
    expect(toolResultEvent).toBeDefined();
    expect(toolResultEvent?.toolName).toBe('searchRoster');
  });

  it('filters out clinical surgery and intake tools from the tool list forwarded to agent', async () => {
    mockMcp.toGeminiTool.mockImplementation((t: any) => ({
      type: 'function',
      name: t.name,
      description: t.description,
      parameters: {},
    }));
    mockMcp.listTools.mockResolvedValue([
      { name: 'searchRoster', description: 'Search', inputSchema: {} },
      { name: 'performCriticalMedicalProcedure', description: 'Surgery', inputSchema: {} },
      { name: 'admitAnimal', description: 'Admit', inputSchema: {} },
      { name: 'submitSurrenderRequest', description: 'Surrender', inputSchema: {} },
      { name: 'shelterStats', description: 'Stats', inputSchema: {} },
    ]);

    const runCalls: any[] = [];
    vi.spyOn(service as any, 'getAgent').mockResolvedValue({
      run: vi.fn().mockImplementation((input: any) => {
        runCalls.push(input);
        return new Observable((sub) => {
          sub.next({
            type: EventType.RUN_FINISHED,
            runId: input.runId,
            threadId: input.threadId,
            outcome: { type: 'success' },
          } as any);
          sub.complete();
        });
      }),
      abortRun: vi.fn(),
    });

    await new Promise<void>((resolve, reject) => {
      service.streamChat('hello').subscribe({
        error: (err) => reject(err),
        complete: () => resolve(),
      });
    });

    expect(runCalls).toHaveLength(1);
    const forwardedToolNames = runCalls[0].tools.map((t: any) => t.name);
    expect(forwardedToolNames).toContain('searchRoster');
    expect(forwardedToolNames).toContain('shelterStats');
    expect(forwardedToolNames).not.toContain('performCriticalMedicalProcedure');
    expect(forwardedToolNames).not.toContain('admitAnimal');
    expect(forwardedToolNames).not.toContain('submitSurrenderRequest');
  });
});
