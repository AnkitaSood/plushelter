import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { Button } from '../../ui/button/button';
import { AgentRunnerService } from './agent-runner.service';

/**
 * The global WebMCP agent panel. Mounted in the app shell so it is available on every route; because
 * it reads the tools from `document.modelContext` at send-time, its capabilities automatically track
 * whichever tools the current route has registered — no per-route wiring, no change to registration.
 */
@Component({
  selector: 'app-agent-panel',
  imports: [Button],
  template: `
    <div class="dock">
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
              <p class="msg msg--assistant msg--pending" aria-hidden="true">…</p>
            }
          </div>

          @if (error(); as err) {
            <p class="panel__error" role="alert">{{ err }}</p>
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
      /* CSS anchor positioning: pins the dock's top edge to the bottom edge of the app shell's
       * .app-nav (named via anchor-name in app.css), so it tracks the header's real rendered
       * height -- including its responsive wrapping -- with no JS measurement. Chrome-only today
       * (not yet in Firefox/Safari); the 0px fallback keeps unsupported browsers from breaking. */
      position-anchor: --app-nav;
      top: anchor(bottom, 0px);
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
      color: var(--color-ink);
      background: var(--color-primary);
      border: var(--border-width) solid var(--border-color);
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
      border-bottom: var(--border-width) solid var(--border-color);
      background: var(--color-primary);
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
      border: var(--border-width) solid var(--border-color);
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

    .msg__args {
      opacity: 0.75;
    }

    .msg--result {
      align-self: flex-start;
      width: 90%;
      background: var(--color-status-available);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    .msg--pending {
      opacity: 0.6;
    }

    .panel__error {
      margin: 0;
      padding: var(--space-2) var(--space-3);
      background: var(--color-status-critical);
      border-top: var(--border-width) solid var(--border-color);
      font-size: var(--text-sm);
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
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  protected readonly transcript = this.runner.transcript;
  protected readonly status = this.runner.status;
  protected readonly error = this.runner.error;

  protected readonly open = signal(false);
  protected readonly draft = signal('');

  /** Stable for the session — whether a real WebMCP surface is present vs the registry fallback. */
  protected readonly liveHint = this.runner.webMcpAvailable()
    ? 'live · document.modelContext'
    : 'fallback · no WebMCP surface';

  constructor() {
    // Move focus to the composer whenever the panel opens (keyboard + screen-reader friendly).
    effect(() => {
      if (this.open()) this.inputEl()?.nativeElement.focus();
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
