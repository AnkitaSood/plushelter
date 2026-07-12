import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { scan, tap } from 'rxjs';
import { Button } from '../../ui/button/button';
import { CaseFileCard } from '../../ui/case-file-card/case-file-card';
import { ChatBubble } from '../../ui/chat-bubble/chat-bubble';
import { CritterLoader } from '../../ui/critter-loader/critter-loader';
import { FormField } from '../../ui/form-field/form-field';
import { StatusBadge } from '../../ui/status-badge/status-badge';
import { Animal, ChatSseEvent, ConciergeChatService } from './concierge-chat.service';

interface ChatTurn {
  role: 'user' | 'concierge';
  content: string;
}

interface ChatStreamState {
  text: string;
  done: boolean;
  error?: { code: string; message: string };
}

interface PendingChatRequest {
  message: string;
  previousInteractionId?: string;
  requestId: number;
}

let nextRequestId = 0;

@Component({
  selector: 'app-concierge',
  imports: [Button, CaseFileCard, ChatBubble, CritterLoader, FormField, StatusBadge],
  template: `
    <section class="concierge">
      <h1>Adoption Concierge</h1>

      <div class="concierge__transcript">
        @for (turn of history(); track $index) {
          <app-chat-bubble [role]="turn.role" [content]="turn.content" />
        }
        @if (isStreaming()) {
          @if (streamingText(); as text) {
            <app-chat-bubble role="concierge" [content]="text" />
          } @else {
            <app-critter-loader />
          }
        }
      </div>

      @if (lastError(); as error) {
        <app-status-badge status="critical">{{ error.message }}</app-status-badge>
      }

      @if (matchedAnimals().length > 0) {
        <div class="concierge__matches">
          @for (animal of matchedAnimals(); track animal.id) {
            <app-case-file-card
              [title]="animal.name"
              [subtitle]="animal.species + ' · ' + animal.condition"
              [description]="animal.backstory"
              [imageUrl]="animal.photoUrl"
            />
          }
        </div>
      }

      <form class="concierge__composer" (submit)="onSubmit($event)">
        <app-form-field label="Message the concierge" [(value)]="draft" hint="Try: something low-maintenance for two kids" />
        <app-button type="submit" [disabled]="!canSend()">Send</app-button>
      </form>
    </section>
  `,
  styles: `
    .concierge {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      max-width: 40rem;
      margin-inline: auto;
      padding: var(--space-5);
      font-family: var(--font-body);
      color: var(--color-ink);
    }

    .concierge__transcript {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      min-height: 8rem;
    }

    .concierge__matches {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
    }

    .concierge__composer {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .concierge__composer app-form-field {
      flex: 1;
    }
  `,
})
export class Concierge {
  private readonly chatService = inject(ConciergeChatService);
  private lastFinalizedRequestId = -1;

  protected draft = signal('');
  protected history = signal<ChatTurn[]>([]);
  protected matchedAnimals = signal<Animal[]>([]);
  protected lastError = signal<{ code: string; message: string } | undefined>(undefined);

  private pendingRequest = signal<PendingChatRequest | undefined>(undefined);

  protected readonly chatStream = rxResource({
    params: () => this.pendingRequest(),
    stream: ({ params }) =>
      this.chatService.streamChat(params.message, params.previousInteractionId).pipe(
        tap((event) => {
          if (event.type === 'tool_result') {
            this.matchedAnimals.set(event.animals);
          }
        }),
        scan(
          (state: ChatStreamState, event: ChatSseEvent): ChatStreamState => {
            switch (event.type) {
              case 'token':
                return { ...state, text: state.text + event.token };
              case 'done':
                return { ...state, done: true };
              case 'error':
                return { ...state, done: true, error: { code: event.code, message: event.message } };
              default:
                return state;
            }
          },
          { text: '', done: false },
        ),
      ),
  });

  protected readonly streamingText = computed(() => this.chatStream.value()?.text ?? '');
  protected readonly isStreaming = computed(() => this.pendingRequest() !== undefined);
  protected readonly canSend = computed(() => this.draft().trim().length > 0);

  constructor() {
    // Moves a finished stream's result into permanent history exactly once, whether it
    // ended cleanly or via an in-band error event — see ConciergeChatService for why
    // failures always surface as a `done` state rather than throwing.
    effect(() => {
      const request = this.pendingRequest();
      const state = this.chatStream.value();
      if (!request || !state?.done || request.requestId === this.lastFinalizedRequestId) return;

      this.lastFinalizedRequestId = request.requestId;
      if (state.text) {
        this.history.update((turns) => [...turns, { role: 'concierge', content: state.text }]);
      }
      this.lastError.set(state.error);
      this.pendingRequest.set(undefined);
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();

    const message = this.draft().trim();
    if (!message) return;

    this.history.update((turns) => [...turns, { role: 'user', content: message }]);
    this.matchedAnimals.set([]);
    this.lastError.set(undefined);
    this.draft.set('');
    this.pendingRequest.set({ message, requestId: nextRequestId++ });
  }
}
