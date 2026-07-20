import { Component, EnvironmentInjector, inject, runInInjectionContext, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '../../ui/button/button';
import { StatusBadge, type StatusBadgeStatus } from '../../ui/status-badge/status-badge';
import { SHELTER_TOOL_REGISTRY, type RegisteredTool } from '../../webmcp/shelter-tools';

interface ToolResult {
  ok: boolean;
  text: string;
}

@Component({
  imports: [Button, StatusBadge, RouterLink],
  template: `
    <section class="console">
      <h1>WebMCP Agent Console</h1>
      <p class="console__intro">
        Every capability below is registered with the browser as a WebMCP tool, so a native
        in-browser AI agent could call it directly — no DOM clicking required. This console lists
        the same tool definitions and invokes them here so the wiring is visible on screen.
      </p>
      <p class="console__intro">
        The implicit Signal-Form tool <code>submitSurrenderRequest</code> now lives on the
        <a routerLink="/">Intake / Surrender</a> route — its form is a real intake surface there, not
        just a demo.
      </p>

      <h2 class="console__heading">Registered tools</h2>
      @for (rt of registry; track rt.tool.name) {
        <article class="tool">
          <div class="tool__head">
            <h3 class="tool__name">{{ rt.tool.name }}</h3>
            <app-status-badge [status]="scopeBadge(rt.scope)">{{ rt.scope }}</app-status-badge>
          </div>
          <p class="tool__desc">{{ rt.tool.description }}</p>
          <label class="tool__args-label">
            <span>Arguments (JSON)</span>
            <textarea
              class="tool__args"
              rows="3"
              [value]="argFor(rt)"
              (input)="setArg(rt.tool.name, $event)"
            ></textarea>
          </label>
          <app-button type="button" (click)="invoke(rt)">Invoke tool</app-button>
          @if (results()[rt.tool.name]; as r) {
            <pre class="tool__result" [class.tool__result--error]="!r.ok" role="status">{{ r.text }}</pre>
          }
        </article>
      }
    </section>
  `,
  styles: `
    .console {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      max-width: 48rem;
      margin-inline: auto;
      padding: var(--space-5);
      font-family: var(--font-body);
      color: var(--color-ink);
    }

    .console__intro { margin: 0; max-width: 70ch; }
    .console__heading { font-family: var(--font-display); font-size: var(--text-xl); margin: var(--space-3) 0 0; }
    code { font-family: var(--font-mono); font-size: var(--text-sm); }

    .tool {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
      padding: var(--space-4);
    }

    .tool__head { display: flex; align-items: center; gap: var(--space-3); }
    .tool__name { margin: 0; font-family: var(--font-mono); font-size: var(--text-base); }
    .tool__desc { margin: 0; }

    .tool__args-label { display: flex; flex-direction: column; gap: var(--space-1); font-family: var(--font-mono); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; }

    .tool__args {
      font-family: var(--font-mono);
      font-size: var(--text-base);
      color: var(--color-ink);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      padding: var(--space-2) var(--space-3);
      resize: vertical;
    }

    .tool__args:focus { outline: var(--focus-ring-width) solid var(--focus-ring-color); outline-offset: 2px; }

    .tool__result {
      margin: 0;
      background: var(--color-status-available);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: var(--space-3);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      white-space: pre-wrap;
    }

    .tool__result--error { background: var(--color-status-critical); }
  `,
})
export class AgentConsole {
  private readonly environmentInjector = inject(EnvironmentInjector);

  protected readonly registry = SHELTER_TOOL_REGISTRY;

  private readonly argText = signal<Record<string, string>>({});
  protected readonly results = signal<Record<string, ToolResult>>({});

  protected argFor(rt: RegisteredTool): string {
    return this.argText()[rt.tool.name] ?? this.defaultArgs(rt);
  }

  protected setArg(name: string, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.argText.update((map) => ({ ...map, [name]: value }));
  }

  /** Parse the JSON args, run the tool's `execute` in an injection context so its `inject()`
   * calls resolve, and surface the returned MCP text content. */
  protected async invoke(rt: RegisteredTool): Promise<void> {
    const name = rt.tool.name;
    let args: unknown = {};
    const raw = this.argFor(rt).trim();
    if (raw) {
      try {
        args = JSON.parse(raw);
      } catch {
        this.setResult(name, { ok: false, text: 'Arguments are not valid JSON.' });
        return;
      }
    }
    try {
      const run = rt.tool.execute as (a: unknown, c: unknown) => unknown;
      const out = await Promise.resolve(runInInjectionContext(this.environmentInjector, () => run(args, {})));
      this.setResult(name, { ok: true, text: this.extractText(out) });
    } catch (error) {
      this.setResult(name, { ok: false, text: error instanceof Error ? error.message : 'Tool invocation failed.' });
    }
  }

  protected scopeBadge(scope: RegisteredTool['scope']): StatusBadgeStatus {
    switch (scope) {
      case 'Application':
        return 'info';
      case 'Route · /roster':
        return 'pending';
      case 'Service':
        return 'available';
      default:
        return 'celebration';
    }
  }

  /** A JSON skeleton seeded from the tool's input schema, so the args box starts editable. */
  private defaultArgs(rt: RegisteredTool): string {
    const props = (rt.tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
    const skeleton: Record<string, string> = {};
    for (const key of Object.keys(props)) skeleton[key] = '';
    return JSON.stringify(skeleton, null, 2);
  }

  private extractText(out: unknown): string {
    const content = (out as { content?: { type?: string; text?: string }[] })?.content ?? [];
    const text = content
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('\n');
    return text || JSON.stringify(out);
  }

  private setResult(name: string, result: ToolResult): void {
    this.results.update((map) => ({ ...map, [name]: result }));
  }
}
