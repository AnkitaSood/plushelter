import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Button } from '../../ui/button/button';
import { AgentRunnerService } from './agent-runner.service';
import { HitlAuthorizationService, HITL_SURFACE_ID } from '../../webmcp/hitl-authorization.service';

/**
 * The global WebMCP agent panel. Mounted in the app shell so it is available on every route; because
 * it reads the tools from `document.modelContext` at send-time, its capabilities automatically track
 * whichever tools the current route has registered — no per-route wiring, no change to registration.
 */
@Component({
  selector: 'app-agent-panel',
  imports: [Button],
  template: `
    <div class="dock" [style.top.px]="dockTop()">
      @if (open()) {
        <section class="panel" role="region" aria-label="WebMCP agent">
          <header class="panel__head">
            <h2 class="panel__title">WebMCP Agent</h2>
            <span class="panel__hint">{{ liveHint }}</span>
            <button class="panel__icon" type="button" (click)="reset()" aria-label="Clear conversation">
              Clear
            </button>
            <button
              class="panel__icon"
              type="button"
              (click)="toggle()"
              [attr.aria-expanded]="true"
              aria-controls="agent-log"
              aria-label="Minimize agent panel"
            >
              &minus;
            </button>
          </header>

          <div
            id="agent-log"
            class="panel__log"
            role="log"
            aria-live="polite"
            [attr.aria-busy]="status() === 'running'"
          >
            @for (entry of transcript(); track entry.id) {
              @switch (entry.kind) {
                @case ('user') {
                  <p class="msg msg--user">{{ entry.text }}</p>
                }
                @case ('assistant') {
                  <p class="msg msg--assistant">{{ entry.text }}</p>
                }
                @case ('tool_call') {
                  <p class="msg msg--tool">
                    🔧 called <code>{{ entry.name }}</code
                    >@if (argsPreview(entry.args); as a) {<code class="msg__args">({{ a }})</code>}
                  </p>
                }
                @case ('tool_result') {
                  <pre class="msg msg--result">{{ entry.text }}</pre>
                }
              }
            } @empty {
              <p class="panel__empty">
                Ask me to search the roster, report shelter stats, or admit a case — I'll call the
                page's WebMCP tools to do it.
              </p>
            }
            @if (status() === 'running') {
              @if (activeStreamingToolCalls().length === 0) {
                <p class="msg msg--assistant msg--pending" aria-hidden="true">…</p>
              }
              @for (call of activeStreamingToolCalls(); track call.id) {
                <div class="msg msg--tool msg--tool-streaming">
                  🔧 streaming arguments for <code>{{ call.name }}</code>:
                  <code class="msg__args">{{ call.args || '...' }}</code>
                  <span class="streaming-dot" aria-hidden="true">▍</span>
                </div>
              }
            }
          </div>

          @if (reasoning(); as r) {
            <details class="panel__reasoning">
              <summary class="reasoning-summary">🧠 Agent Thought Process ({{ r.length }} chars)</summary>
              <pre class="reasoning-body">{{ r }}</pre>
            </details>
          }

          @if (error(); as err) {
            <p class="panel__error" role="alert">{{ err }}</p>
          }

          @if (hitl.pendingRequest(); as req) {
            <div class="panel__hitl">
              <div class="hitl-box">
                <div class="hitl-box__badge">AUTHORIZATION REQUIRED</div>
                <h3 class="hitl-box__title">{{ req.procedureName }}</h3>
                <p class="hitl-box__detail">Patient #{{ req.animalId }} &middot; {{ req.estimatedStuffingLoss }}</p>
                <div class="hitl-box__actions">
                  <app-button type="button" (click)="hitl.resolveDecision(true)">✓ Authorize</app-button>
                  <app-button type="button" variant="secondary" (click)="hitl.resolveDecision(false, 'Denied by staff')">✕ Reject</app-button>
                </div>
              </div>
            </div>
          }

          <form class="composer" (submit)="onSubmit($event)">
            <label class="composer__label" for="agent-input">Ask the agent</label>
            <input
              #inputEl
              id="agent-input"
              class="composer__input"
              name="prompt"
              autocomplete="off"
              [value]="draft()"
              (input)="onInput($event)"
              [disabled]="status() === 'running'"
              placeholder="find me a low-maintenance bear"
            />
            @if (status() === 'running') {
              <app-button type="button" variant="secondary" (click)="cancel()">Stop</app-button>
            } @else {
              <app-button type="submit" [disabled]="!draft().trim()">Send</app-button>
            }
          </form>
        </section>
      } @else {
        <button class="launcher" type="button" (click)="toggle()" [attr.aria-expanded]="false">
          🤖 Ask the agent
        </button>
      }
    </div>
  `,
  styles: `
    .dock {
      position: fixed;
      /* top is set inline via [style.top.px] -- see dockTop() below. It has to track how much
       * of .app-nav is still on screen (not a fixed length), so the panel starts right below
       * the header while it's visible and expands to full height once it's scrolled away. */
      right: 0;
      bottom: 0;
      z-index: 1000;
      display: flex;
      align-items: flex-end;
      font-family: var(--font-body);
      color: var(--color-ink);
      pointer-events: none;
    }

    .dock > * {
      pointer-events: auto;
    }

    .launcher {
      margin: var(--space-4);
      font-family: var(--font-display);
      font-size: var(--text-base);
      font-weight: 600;
      /* Sits on the periwinkle fill — fixed ink, like Button/StatusBadge. */
      color: var(--color-ink-on-accent);
      background: var(--color-primary);
      border: var(--border-width) solid var(--color-ink-on-accent);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
      padding: var(--space-2) var(--space-4);
      cursor: pointer;
    }

    .launcher:focus-visible,
    .panel__icon:focus-visible,
    .composer__input:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: 2px;
    }

    .panel {
      display: flex;
      flex-direction: column;
      width: min(24rem, 100vw);
      height: 100%;
      background: var(--color-bg);
      border-left: var(--border-width) solid var(--border-color);
      box-shadow: var(--shadow-stacked);
      overflow: hidden;
    }

    .panel__head {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-bottom: var(--border-width) solid var(--color-ink-on-accent);
      background: var(--color-primary);
      /* Sits on the periwinkle fill — fixed ink, overriding the .dock ancestor's
         theme-flipping ink. */
      color: var(--color-ink-on-accent);
    }

    .panel__title {
      margin: 0;
      font-family: var(--font-display);
      font-size: var(--text-base);
    }

    .panel__hint {
      margin-inline-start: auto;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      opacity: 0.75;
    }

    .panel__icon {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-ink);
      background: transparent;
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 0 var(--space-2);
      cursor: pointer;
    }

    .panel__log {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3);
      overflow-y: auto;
    }

    .panel__empty {
      margin: 0;
      font-size: var(--text-sm);
      opacity: 0.8;
    }

    .msg {
      margin: 0;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      max-width: 90%;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .msg--user {
      align-self: flex-end;
      background: var(--color-secondary);
      border: var(--border-width) solid var(--color-ink-on-accent);
      /* Sits on the lavender fill — fixed ink. */
      color: var(--color-ink-on-accent);
    }

    .msg--assistant {
      align-self: flex-start;
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
    }

    .msg--tool {
      align-self: flex-start;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      opacity: 0.85;
    }

    .msg--tool-streaming {
      background: var(--color-muted);
      border: 1px dashed var(--border-color);
      border-radius: var(--radius-sm);
      padding: var(--space-1) var(--space-2);
    }

    .streaming-dot {
      display: inline-block;
      animation: blink 0.8s infinite;
    }

    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

    .panel__reasoning {
      background: var(--color-bg-subtle, #f5f3ef);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    .reasoning-summary { cursor: pointer; font-weight: bold; }

    .reasoning-body {
      margin: var(--space-1) 0 0;
      white-space: pre-wrap;
      max-height: 8rem;
      overflow-y: auto;
      font-size: var(--text-xs);
      color: var(--color-ink-muted, #555);
    }

    .panel__hitl {
      margin: var(--space-2) 0;
      border: 2px solid var(--color-status-critical);
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    .hitl-box {
      padding: var(--space-3);
      background: var(--color-bg);
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .hitl-box__badge {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      color: var(--color-status-critical);
      letter-spacing: 0.05em;
    }

    .hitl-box__title {
      margin: 0;
      font-family: var(--font-display);
      font-size: var(--text-sm);
    }

    .hitl-box__detail {
      margin: 0;
      font-size: var(--text-xs);
      color: var(--color-ink-muted, #555);
    }

    .hitl-box__actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }

    .msg__args {
      opacity: 0.75;
    }

    .msg--result {
      align-self: flex-start;
      width: 90%;
      background: var(--color-status-available);
      border: var(--border-width) solid var(--color-ink-on-accent);
      border-radius: var(--radius-sm);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      /* Sits on the mint fill — fixed ink. */
      color: var(--color-ink-on-accent);
    }

    .msg--pending {
      opacity: 0.6;
    }

    .panel__error {
      margin: 0;
      padding: var(--space-2) var(--space-3);
      background: var(--color-status-critical);
      border-top: var(--border-width) solid var(--color-ink-on-accent);
      font-size: var(--text-sm);
      /* Sits on the salmon fill — fixed ink. */
      color: var(--color-ink-on-accent);
    }

    .composer {
      display: flex;
      align-items: end;
      gap: var(--space-2);
      padding: var(--space-3);
      border-top: var(--border-width) solid var(--border-color);
    }

    .composer__label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    .composer__input {
      flex: 1;
      font-family: var(--font-body);
      font-size: var(--text-sm);
      color: var(--color-ink);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      padding: var(--space-2) var(--space-3);
    }
  `,
})
export class AgentPanel {
  private readonly runner = inject(AgentRunnerService);
  protected readonly hitl = inject(HitlAuthorizationService);
  readonly hitlSurfaceId = HITL_SURFACE_ID;
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  protected readonly transcript = this.runner.transcript;
  protected readonly status = this.runner.status;
  protected readonly error = this.runner.error;
  protected readonly reasoning = this.runner.reasoning;
  protected readonly activeStreamingToolCalls = computed(() =>
    this.status() === 'running'
      ? this.runner.toolCalls().filter((c) => c.status === 'pending')
      : [],
  );

  protected readonly open = signal(false);
  protected readonly draft = signal('');

  /** How much of the app shell's header is still on screen -- 0 once it's scrolled past. */
  protected readonly dockTop = signal(0);

  /** Stable for the session — whether a real WebMCP surface is present vs the registry fallback. */
  protected readonly liveHint = this.runner.webMcpAvailable()
    ? 'live · document.modelContext'
    : 'fallback · no WebMCP surface';

  constructor() {
    // Move focus to the composer whenever the panel opens (keyboard + screen-reader friendly).
    // Using afterRenderEffect ensures the #inputEl has been rendered into the DOM (since it is inside @if (open())).
    let wasOpen = false;
    afterRenderEffect({
      write: () => {
        const isOpen = this.open();
        if (isOpen && !wasOpen) {
          this.inputEl()?.nativeElement.focus();
        }
        wasOpen = isOpen;
      },
    });

    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const updateDockTop = () => {
        const navHeight = document.querySelector('.app-nav')?.getBoundingClientRect().height ?? 0;
        this.dockTop.set(Math.max(0, navHeight - window.scrollY));
      };
      updateDockTop();
      window.addEventListener('scroll', updateDockTop, { passive: true });
      window.addEventListener('resize', updateDockTop);
      destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', updateDockTop);
        window.removeEventListener('resize', updateDockTop);
      });
    });
  }

  protected toggle(): void {
    this.open.update((o) => !o);
  }

  protected onInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const text = this.draft().trim();
    if (!text) return;
    this.draft.set('');
    void this.runner.send(text);
  }

  protected cancel(): void {
    this.runner.cancel();
  }

  protected reset(): void {
    this.runner.reset();
    this.draft.set('');
  }

  protected argsPreview(args: unknown): string {
    try {
      const s = JSON.stringify(args);
      return s && s !== '{}' ? s : '';
    } catch {
      return '';
    }
  }
}
