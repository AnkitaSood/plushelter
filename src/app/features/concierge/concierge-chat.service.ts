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

function createProtocolError(message: string): ChatErrorEvent {
  return { type: 'error', code: 'INVALID_SSE_EVENT', message };
}

/** Parses one `event:`/`data:` record from the backend's SSE contract (specs.md §5) into our event union. */
function parseSseRecord(raw: string): ChatSseEvent {
  let eventType = 'message';
  let dataLine = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) eventType = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
  }

  if (eventType === 'done') {
    return { type: 'done' };
  }

  if (!dataLine) {
    return createProtocolError(`Received "${eventType}" SSE event without a data payload.`);
  }

  let data: unknown;
  try {
    data = JSON.parse(dataLine);
  } catch {
    return createProtocolError(`Received malformed JSON for "${eventType}" SSE event.`);
  }

  if (!data || typeof data !== 'object') {
    return createProtocolError(`Received non-object payload for "${eventType}" SSE event.`);
  }

  const payload = data as Record<string, unknown>;

  switch (eventType) {
    case 'token':
      if (typeof payload['token'] !== 'string') {
        return createProtocolError('Token SSE event is missing a string "token" field.');
      }
      return { type: 'token', token: payload['token'] };
    case 'tool_result':
      if (typeof payload['toolName'] !== 'string' || !Array.isArray(payload['animals'])) {
        return createProtocolError('Tool result SSE event is missing required fields.');
      }
      return { type: 'tool_result', toolName: payload['toolName'], animals: payload['animals'] as Animal[] };
    case 'error':
      if (typeof payload['code'] !== 'string' || typeof payload['message'] !== 'string') {
        return createProtocolError('Error SSE event is missing required string fields.');
      }
      return { type: 'error', code: payload['code'], message: payload['message'] };
    default:
      return createProtocolError(`Received unsupported SSE event type "${eventType}".`);
  }
}

@Service()
export class ConciergeChatService {
  /**
   * Streams one /api/chat turn as our own event union. Every failure mode — including a
   * cancellation-driven abort — resolves through `complete()`, never `error()`, so callers
   * have exactly one place (the `error` event) to handle anything going wrong.
   */
  streamChat(message: string, sessionCounts: { admittedCount: number; adoptedCount: number }): Observable<ChatSseEvent> {
    return new Observable<ChatSseEvent>((subscriber) => {
      const controller = new AbortController();

      (async () => {
        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, ...sessionCounts }),
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

          /** Emits a parsed record; returns true if the stream should stop (an error event ends it). */
          const emitRecord = (raw: string): boolean => {
            const parsed = parseSseRecord(raw);
            subscriber.next(parsed);
            return parsed.type === 'error';
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let separatorIndex: number;
            while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
              const rawEvent = buffer.slice(0, separatorIndex);
              buffer = buffer.slice(separatorIndex + 2);
              if (emitRecord(rawEvent)) {
                subscriber.complete();
                return;
              }
            }
          }

          if (buffer.trim() && emitRecord(buffer)) {
            subscriber.complete();
            return;
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
