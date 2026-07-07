import { Service } from '@angular/core';
import { Observable } from 'rxjs';
export type { Animal } from '../../data/roster';
import type { Animal } from '../../data/roster';

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

/** Parses one `event:`/`data:` record from the backend's SSE contract (specs.md §5) into our event union. */
function parseSseRecord(raw: string): ChatSseEvent | null {
  let eventType = 'message';
  let dataLine = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) eventType = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return null;

  const data = JSON.parse(dataLine);
  switch (eventType) {
    case 'token':
      return { type: 'token', token: data.token };
    case 'tool_result':
      return { type: 'tool_result', toolName: data.toolName, animals: data.animals };
    case 'done':
      return { type: 'done' };
    case 'error':
      return { type: 'error', code: data.code, message: data.message };
    default:
      return null;
  }
}

@Service()
export class ConciergeChatService {
  /**
   * Streams one /api/chat turn as our own event union. Every failure mode — including a
   * cancellation-driven abort — resolves through `complete()`, never `error()`, so callers
   * have exactly one place (the `error` event) to handle anything going wrong.
   */
  streamChat(message: string, previousInteractionId: string | undefined): Observable<ChatSseEvent> {
    return new Observable<ChatSseEvent>((subscriber) => {
      const controller = new AbortController();

      (async () => {
        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, previousInteractionId }),
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            subscriber.next({
              type: 'error',
              code: 'UPSTREAM_ERROR',
              message: `Chat request failed with status ${response.status}`,
            });
            subscriber.complete();
            return;
          }

          const reader = response.body.getReader();
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
              const parsed = parseSseRecord(rawEvent);
              if (parsed) subscriber.next(parsed);
            }
          }

          subscriber.complete();
        } catch (error) {
          if (controller.signal.aborted) {
            subscriber.complete();
            return;
          }
          subscriber.next({
            type: 'error',
            code: 'NETWORK_ERROR',
            message: error instanceof Error ? error.message : 'Lost connection to the concierge.',
          });
          subscriber.complete();
        }
      })();

      return () => controller.abort();
    });
  }
}
