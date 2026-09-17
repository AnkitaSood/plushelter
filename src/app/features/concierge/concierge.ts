import {
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { scan, tap } from 'rxjs';
import { SurfaceComponent, A2uiRendererService } from '@a2ui/angular/v0_9';
import type { A2uiMessage } from '@a2ui/web_core/v0_9';
import { Button } from '../../ui/button/button';
import { ChatBubble } from '../../ui/chat-bubble/chat-bubble';
import { CritterLoader } from '../../ui/critter-loader/critter-loader';
import { FormField } from '../../ui/form-field/form-field';
import { StatusBadge } from '../../ui/status-badge/status-badge';
import { Animal, ChatSseEvent, ConciergeChatService } from './concierge-chat.service';
import { SHELTER_CATALOG_ID } from '../../a2ui/shelter-catalog';

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
  requestId: number;
}

let nextRequestId = 0;
const CANVAS_SURFACE_ID = 'concierge-canvas';

@Component({
  imports: [
    Button,
    ChatBubble,
    CritterLoader,
    FormField,
    StatusBadge,
    SurfaceComponent,
  ],
  template: `
    <header class="concierge-view__header">
      <h1>Adoption Concierge</h1>
      <p class="concierge-view__sub">
        Describe what you're looking for — the concierge will recommend matched companions
        with interactive adoption cards below.
      </p>
    </header>

    <section class="concierge__panel" role="region" aria-label="Concierge conversation">
      <!-- Scrollable content: chat bubbles + inline A2UI surface -->
      <div class="concierge__transcript" role="log" aria-live="polite">
        @if (history().length === 0 && !isStreaming()) {
          <div class="concierge__empty">
            <div class="empty-icon" aria-hidden="true">🧸</div>
            <h2 class="empty-title">No Recommendations Yet</h2>
            <p class="empty-text">
              Start a conversation to see the concierge compose custom interactive cards,
              compatibility gauges, and adoption buttons here.
            </p>
            <div class="empty-presets">
              <span>Quick prompts:</span>
              <button type="button" class="preset-pill" (click)="sendPreset('Low maintenance bears')">
                "Low maintenance bears."
              </button>
              <button type="button" class="preset-pill" (click)="sendPreset('Outdoorsy and active. High energy')">
                "Outdoorsy and active. High energy."
              </button>
            </div>
          </div>
        }

        @for (turn of history(); track $index) {
          <app-chat-bubble [role]="turn.role" [content]="turn.content"/>
        }

        @if (isStreaming()) {
          @if (streamingText(); as text) {
            <app-chat-bubble role="concierge" [content]="text"/>
          } @else {
            <app-critter-loader/>
          }
        }

        <!-- A2UI surface renders inline, directly after the reply -->
        @if (hasActiveCanvas()) {
          <div class="concierge__surface-block">
            <div class="concierge__surface-bar">
              <span class="concierge__surface-label">Matched companions</span>
              <button
                type="button"
                class="concierge__surface-clear"
                (click)="clearCanvas()"
                aria-label="Clear matched companions"
              >
                Clear
              </button>
            </div>
            <a2ui-v09-surface [surfaceId]="canvasSurfaceId"/>
          </div>
        }
      </div>

      @if (lastError(); as error) {
        <app-status-badge status="critical">{{ error.message }}</app-status-badge>
      }

      <!-- Composer pinned at the bottom of the single panel -->
      <form class="concierge__composer" (submit)="onSubmit($event)">
        <app-form-field
          label="Message the concierge"
          [(value)]="draft"
          hint="Try: something low-maintenance for two kids"
        />
        <app-button type="submit" [disabled]="!canSend()">Send</app-button>
      </form>
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      max-width: 52rem;
      margin-inline: auto;
      padding: var(--space-5);
      font-family: var(--font-body);
      color: var(--color-ink);
    }

    .concierge-view__header {
      margin-bottom: var(--space-2);
    }

    .concierge-view__header h1 {
      margin: 0 0 var(--space-1);
      font-family: var(--font-display);
      font-size: var(--text-2xl);
    }

    .concierge-view__sub {
      margin: 0;
      color: var(--color-ink-muted, #555);
      max-width: 60ch;
    }

    /* ── Single panel ── */
    .concierge__panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
      padding: var(--space-4);
    }

    /* Transcript: bubbles + inline surface */
    .concierge__transcript {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      min-height: 22rem;
      max-height: 42rem;
      overflow-y: auto;
    }

    /* Empty state — centred inside the transcript area */
    .concierge__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      flex: 1;
      padding: var(--space-6) var(--space-4);
      gap: var(--space-2);
      color: var(--color-ink-muted, #666);
    }

    .empty-icon {
      font-size: 3rem;
      line-height: 1;
    }

    .empty-title {
      margin: var(--space-2) 0 0;
      font-family: var(--font-display);
      font-size: var(--text-lg);
      color: var(--color-ink);
    }

    .empty-text {
      margin: 0;
      font-size: var(--text-sm);
      max-width: 42ch;
    }

    .empty-presets {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-4);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    .preset-pill {
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      cursor: pointer;
      box-shadow: var(--shadow-flat);
    }

    .preset-pill:hover {
      background: var(--color-status-available);
      /* Sits on the mint fill on hover — fixed ink and border. */
      color: var(--color-ink-on-accent);
      border-color: var(--color-ink-on-accent);
    }

    /* A2UI surface block — inline after the last reply bubble */
    .concierge__surface-block {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      border-top: var(--border-width) solid var(--border-color);
      padding-top: var(--space-3);
      margin-top: var(--space-1);
    }

    .concierge__surface-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .concierge__surface-label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-ink-muted, #666);
    }

    .concierge__surface-clear {
      background: transparent;
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      padding: var(--space-1) var(--space-2);
      cursor: pointer;
      color: var(--color-ink);
    }

    .concierge__surface-clear:hover {
      background: var(--color-bg-subtle, #eee);
    }

    /* Composer pinned at the panel bottom */
    .concierge__composer {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      border-top: var(--border-width) solid var(--border-color);
      padding-top: var(--space-3);
    }

    .concierge__composer app-form-field {
      flex: 1;
    }
  `,
})
export class Concierge implements OnDestroy {
  private readonly chatService = inject(ConciergeChatService);
  private readonly a2ui = inject(A2uiRendererService);

  readonly canvasSurfaceId = CANVAS_SURFACE_ID;

  private surfaceCreated = false;

  protected draft = signal('');
  protected history = signal<ChatTurn[]>([]);
  protected candidateAnimals = signal<Animal[]>([]);
  protected lastError = signal<{ code: string; message: string } | undefined>(undefined);
  protected hasActiveCanvas = linkedSignal(() => this.candidateAnimals().length > 0);

  private pendingRequest = signal<PendingChatRequest | undefined>(undefined);

  protected readonly chatStream = rxResource({
    params: () => this.pendingRequest(),
    stream: ({ params }) => {
      let accumulatedText = '';
      return this.chatService
        .streamChat(params.message)
        .pipe(
          tap((event) => {
            if (event.type === 'token') {
              accumulatedText += event.token;
            } else if (event.type === 'tool_result') {
              // The exact matched Animal[] the searchRoster tool call produced client-side —
              // no more guessing which animals the reply's prose named (see the retired
              // animal-match-filter.ts) — so cards can render as soon as the tool resolves,
              // even while narration is still streaming.
              this.candidateAnimals.set(event.animals);
            } else if (event.type === 'done') {
              if (accumulatedText) {
                this.history.update((turns) => [...turns, { role: 'concierge', content: accumulatedText }]);
              }
            } else if (event.type === 'error') {
              this.lastError.set({ code: event.code, message: event.message });
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
        );
    },
  });

  protected readonly streamingText = computed(() => this.chatStream.value()?.text ?? '');
  protected readonly isStreaming = computed(() => {
    const request = this.pendingRequest();
    const state = this.chatStream.value();
    return request !== undefined && !state?.done;
  });
  protected readonly canSend = computed(() => this.draft().trim().length > 0);

  constructor() {
    // Reactive A2UI surface composition based on matched animals
    effect(() => {
      const animals = this.candidateAnimals();
      if (animals.length > 0) {
        this.renderOrUpdateCanvasSurface(animals);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearCanvas();
  }

  clearCanvas(): void {
    if (this.surfaceCreated) {
      this.a2ui.surfaceGroup.deleteSurface(this.canvasSurfaceId);
      this.surfaceCreated = false;
    }
    this.hasActiveCanvas.set(false);
  }

  protected sendPreset(text: string): void {
    this.draft.set(text);
    this.dispatchSend(text);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const message = this.draft().trim();
    if (!message) return;
    this.dispatchSend(message);
  }

  private dispatchSend(message: string): void {
    this.history.update((turns) => [...turns, { role: 'user', content: message }]);
    this.candidateAnimals.set([]);
    this.lastError.set(undefined);
    this.draft.set('');
    this.pendingRequest.set({ message, requestId: nextRequestId++ });
  }

  /**
   * Generates or updates the A2UI Canvas surface in place using custom shelter components.
   */
  private renderOrUpdateCanvasSurface(animals: Animal[]): void {
    const messages: A2uiMessage[] = [];

    if (!this.surfaceCreated) {
      messages.push({
        version: 'v0.9',
        createSurface: {
          surfaceId: this.canvasSurfaceId,
          catalogId: SHELTER_CATALOG_ID,
        },
      });
      this.surfaceCreated = true;
    }

    const componentIds: string[] = ['header', 'stats-chart'];
    const components: Array<Record<string, unknown>> = [
      {
        id: 'header',
        component: 'Text',
        variant: 'h2',
        text: `Matched Companions (${animals.length} found)`,
      },
      {
        id: 'stats-chart',
        component: 'CustomChart',
        title: 'Species Diversity',
        chartType: 'bar',
        data: this.buildSpeciesStats(animals),
      },
    ];

    animals.forEach((animal, index) => {
      const cardId = `card_${animal.id}`;
      const btnId = `btn_${animal.id}`;
      componentIds.push(cardId, btnId);

      components.push({
        id: cardId,
        component: 'AnimalCard',
        title: `${animal.name} (${animal.species})`,
        subtitle: `Condition: ${animal.condition}`,
        description: animal.backstory,
        imageUrl: animal.photoUrl,
        status: animal.available ? 'available' : 'pending',
      });

      const btnTextId = `btn_text_${animal.id}`;
      components.push({
        id: btnId,
        component: 'Button',
        child: btnTextId,
        action: {
          event: {
            name: 'start_adoption',
            context: { animalId: animal.id },
          },
        },
      });

      components.push({
        id: btnTextId,
        component: 'Text',
        text: `Apply for ${animal.name}`,
      });
    });

    // Root component ordering
    components.unshift({
      id: 'root',
      component: 'Column',
      children: componentIds,
    });

    messages.push({
      version: 'v0.9',
      updateComponents: {
        surfaceId: this.canvasSurfaceId,
        components: components as any,
      },
    });

    this.a2ui.processMessages(messages);
    this.hasActiveCanvas.set(true);
  }

  private buildSpeciesStats(animals: Animal[]): Array<{ label: string; value: number }> {
    const counts = new Map<string, number>();
    for (const a of animals) {
      counts.set(a.species, (counts.get(a.species) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([label, value]) => ({ label, value }));
  }
}
