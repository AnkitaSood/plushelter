import {
  Component,
  EnvironmentInjector,
  OnDestroy,
  computed,
  inject,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { SurfaceComponent, A2uiRendererService } from '@a2ui/angular/v0_9';
import type { A2uiMessage } from '@a2ui/web_core/v0_9';
import { Button } from '../../ui/button/button';
import { StatusBadge, type StatusBadgeStatus } from '../../ui/status-badge/status-badge';
import { SHELTER_TOOL_REGISTRY, type RegisteredTool } from '../../webmcp/shelter-tools';
import { A2uiActionDispatcherService } from '../../a2ui/a2ui-action-dispatcher.service';
import { AgentRunnerService } from '../agent/agent-runner.service';
import { SHELTER_CATALOG_ID } from '../../a2ui/shelter-catalog';

interface ToolResult {
  ok: boolean;
  text: string;
}

export type ConsoleTab = 'webmcp' | 'ag-ui' | 'a2ui';

interface LoggedAgUiEvent {
  timestamp: string;
  type: string;
  payload: unknown;
}

@Component({
  selector: 'app-agent-console',
  imports: [Button, StatusBadge, SurfaceComponent],
  template: `
    <section class="console">
      <header class="console__head">
        <div class="tag-row">
          <app-status-badge status="celebration">Protocol Inspector</app-status-badge>
          <span class="tag-text">WebMCP + AG-UI + A2UI Tri-Protocol Architecture</span>
        </div>
        <h1>Agent Protocol Inspector & Console</h1>
        <p class="console__intro">
          This developer console provides a transparent, side-by-side inspection view of all three
          agent protocols: <strong>WebMCP</strong> (client tool execution), <strong>AG-UI</strong> (agent↔client wire events),
          and <strong>A2UI</strong> (generative interface composition).
        </p>
      </header>

      <!-- Protocol Tabs Navigation -->
      <nav class="console-tabs" aria-label="Protocol Inspector Tabs">
        <button
          type="button"
          class="tab-btn"
          [class.tab-btn--active]="activeTab() === 'webmcp'"
          (click)="activeTab.set('webmcp')"
        >
          1. WebMCP Tools ({{ registry.length }})
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.tab-btn--active]="activeTab() === 'ag-ui'"
          (click)="activeTab.set('ag-ui')"
        >
          2. AG-UI Wire Events ({{ agUiEvents().length }})
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.tab-btn--active]="activeTab() === 'a2ui'"
          (click)="activeTab.set('a2ui')"
        >
          3. A2UI Surface Tree ({{ activeSurfaceCount() }})
        </button>
      </nav>

      <!-- TAB 1: WebMCP Protocol -->
      @if (activeTab() === 'webmcp') {
        <section class="tab-pane" role="region" aria-label="WebMCP tools">
          <div class="pane-header">
            <h2>Registered WebMCP In-Browser Tools</h2>
            <p>
              Tools declared to the browser's <code>document.modelContext</code>. Native AI agents
              invoke these tools directly in JavaScript — tool execution remains securely inside the client.
            </p>
          </div>

          @for (rt of registry; track rt.tool.name) {
            <article class="tool">
              <div class="tool__head">
                <h3 class="tool__name">{{ rt.tool.name }}</h3>
                <app-status-badge [status]="scopeBadge(rt.scope)">{{ rt.scope }}</app-status-badge>
              </div>
              <p class="tool__desc">{{ rt.tool.description }}</p>
              @if (rt.tool.annotations; as a) {
                <div class="tool__annotations" aria-label="Tool annotations">
                  <span class="tool__hint" [class.tool__hint--active]="a.readOnlyHint">
                    readOnly: {{ a.readOnlyHint ? 'true' : 'false' }}
                  </span>
                  <span class="tool__hint" [class.tool__hint--alert]="a.consequentialHint">
                    consequential: {{ a.consequentialHint ? 'true' : 'false' }}
                  </span>
                  <span class="tool__hint" [class.tool__hint--alert]="a.untrustedContentHint">
                    untrustedContent: {{ a.untrustedContentHint ? 'true' : 'false' }}
                  </span>
                </div>
              }
              <label class="tool__args-label">
                <span>Arguments (JSON)</span>
                <textarea
                  class="tool__args"
                  rows="3"
                  [value]="argFor(rt)"
                  (input)="setArg(rt.tool.name, $event)"
                ></textarea>
              </label>
              <div class="tool__invoke-row">
                <app-button type="button" (click)="invoke(rt)">Invoke WebMCP Tool</app-button>
              </div>
              @if (results()[rt.tool.name]; as r) {
                <pre class="tool__result" [class.tool__result--error]="!r.ok" role="status">{{ r.text }}</pre>
              }
            </article>
          }
        </section>
      }

      <!-- TAB 2: AG-UI Protocol Wire Stream -->
      @if (activeTab() === 'ag-ui') {
        <section class="tab-pane" role="region" aria-label="AG-UI events">
          <div class="pane-header">
            <h2>AG-UI Wire Event Log</h2>
            <p>
              Normalized, bidirectional event stream complying with the <code>&#64;ag-ui/core</code> standard.
              Shows execution lifecycle, reasoning deltas, tool calls, and state synchronizations.
            </p>
            <div class="pane-actions">
              <app-button type="button" (click)="simulateAgUiRun()">Simulate Agent Turn</app-button>
              <app-button type="button" (click)="clearAgUiEvents()">Clear Event Log</app-button>
            </div>
          </div>

          <div class="event-stream-box">
            @for (ev of agUiEvents(); track ev.timestamp) {
              <div class="event-row">
                <span class="event-time">{{ ev.timestamp }}</span>
                <span class="event-badge" [class]="'badge--' + eventCategory(ev.type)">{{ ev.type }}</span>
                <pre class="event-json">{{ stringify(ev.payload) }}</pre>
              </div>
            } @empty {
              <p class="pane-empty">
                No wire events recorded yet. Click <strong>"Simulate Agent Turn"</strong> above or
                interact with the Adoption Concierge / Agent Panel to observe live AG-UI traffic.
              </p>
            }
          </div>
        </section>
      }

      <!-- TAB 3: A2UI Protocol Surface Hierarchy -->
      @if (activeTab() === 'a2ui') {
        <section class="tab-pane" role="region" aria-label="A2UI surfaces">
          <div class="pane-header">
            <h2>A2UI Generative Surface Inspector</h2>
            <p>
              Inspect live surface structures, component hierarchies, and reactive data model state.
            </p>
            <div class="pane-actions">
              <app-button type="button" (click)="renderSampleSurface()">Compose Case File Surface</app-button>
              <app-button type="button" (click)="updateSampleSurfaceData()">Update Data Model</app-button>
              <app-button type="button" (click)="clearSurfaces()">Clear Surfaces</app-button>
            </div>
          </div>

          @if (dispatcher.lastAction(); as action) {
            <aside class="action-alert" role="status">
              🎯 <strong>Captured A2UI Action:</strong> <code>{{ action.name }}</code>
              <span>Context: <code>{{ stringify(action.context) }}</code></span>
            </aside>
          }

          <div class="surfaces-box">
            @let surfaces = a2ui.surfaceGroup.surfacesMap;
            @for (entry of surfaces; track entry[0]) {
              <article class="surface-frame">
                <header class="surface-frame__header">
                  <span class="surface-frame__tag">Surface</span>
                  <code class="surface-frame__id">{{ entry[0] }}</code>
                  <span class="surface-frame__catalog">Catalog: {{ entry[1].catalog.id }}</span>
                </header>
                <div class="surface-frame__content">
                  <a2ui-v09-surface [surfaceId]="entry[0]" />
                </div>
              </article>
            } @empty {
              <p class="pane-empty">
                No active A2UI surfaces mounted. Click <strong>"Compose Case File Surface"</strong> to
                inspect how A2UI renders custom shelter catalog components.
              </p>
            }
          </div>
        </section>
      }
    </section>
  `,
  styles: `
    .console { display: flex; flex-direction: column; gap: var(--space-4); max-width: 58rem; margin-inline: auto; padding: var(--space-5); font-family: var(--font-body); color: var(--color-ink); }
    .tag-row { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1); }
    .tag-text { font-family: var(--font-mono); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-muted, #666); }
    .console__head h1 { margin: 0 0 var(--space-1); font-family: var(--font-display); font-size: var(--text-2xl); }
    .console__intro { margin: 0; max-width: 70ch; color: var(--color-ink-muted, #555); }
    .console-tabs { display: flex; gap: var(--space-2); border-bottom: var(--border-width) solid var(--border-color); padding-bottom: var(--space-2); overflow-x: auto; }
    .tab-btn { background: var(--color-bg); border: var(--border-width) solid var(--border-color); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); font-family: var(--font-mono); font-size: var(--text-xs); font-weight: bold; cursor: pointer; }
    .tab-btn--active { background: var(--color-ink); color: var(--color-bg); box-shadow: var(--shadow-stacked); }
    .tab-pane { display: flex; flex-direction: column; gap: var(--space-4); }
    .pane-header h2 { margin: 0 0 var(--space-1); font-family: var(--font-display); font-size: var(--text-xl); }
    .pane-header p { margin: 0 0 var(--space-3); font-size: var(--text-sm); color: var(--color-ink-muted, #666); }
    .pane-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .pane-empty { margin: 0; padding: var(--space-5); background: var(--color-bg-subtle, #f5f3ef); border-radius: var(--radius-sm); font-style: italic; color: var(--color-ink-muted, #666); text-align: center; }
    .action-alert { display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-3); background: var(--color-status-available); border: var(--border-width) solid var(--border-color); border-radius: var(--radius-sm); font-size: var(--text-sm); }
    .event-stream-box { display: flex; flex-direction: column; gap: var(--space-2); background: var(--color-bg); border: var(--border-width) solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-stacked); padding: var(--space-3); max-height: 28rem; overflow-y: auto; }
    .event-row { display: grid; grid-template-columns: 5rem 10rem 1fr; align-items: center; gap: var(--space-2); font-family: var(--font-mono); font-size: var(--text-xs); border-bottom: 1px dashed var(--border-color); padding-bottom: var(--space-1); }
    .event-time { color: var(--color-ink-muted, #888); }
    .event-badge { padding: 2px 6px; border-radius: 3px; border: 1px solid var(--border-color); text-align: center; font-weight: bold; }
    .badge--run { background: var(--color-celebration); }
    .badge--msg { background: var(--color-secondary); }
    .badge--tool { background: var(--color-status-pending); }
    .badge--a2ui { background: var(--color-status-available); }
    .badge--state { background: var(--color-info); }
    .badge--other { background: var(--color-muted); }
    .event-json { margin: 0; white-space: pre-wrap; overflow-x: auto; max-height: 4rem; }
    .surfaces-box { display: flex; flex-direction: column; gap: var(--space-4); }
    .surface-frame { display: flex; flex-direction: column; border: 2px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-stacked); }
    .surface-frame__header { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); background: var(--color-muted); border-bottom: var(--border-width) solid var(--border-color); font-family: var(--font-mono); font-size: var(--text-xs); }
    .surface-frame__tag { font-weight: bold; text-transform: uppercase; }
    .surface-frame__catalog { margin-left: auto; color: var(--color-ink-muted, #666); }
    .surface-frame__content { padding: var(--space-4); background: var(--color-bg); }
    .tool { display: flex; flex-direction: column; gap: var(--space-2); background: var(--color-bg); border: var(--border-width) solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-stacked); padding: var(--space-4); }
    .tool__head { display: flex; align-items: center; gap: var(--space-3); }
    .tool__name { margin: 0; font-family: var(--font-mono); font-size: var(--text-base); }
    .tool__desc { margin: 0; font-size: var(--text-sm); }
    .tool__annotations { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: var(--space-1) 0; }
    .tool__hint { font-family: var(--font-mono); font-size: var(--text-xs); padding: 2px 6px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--color-bg-subtle, #f5f3ef); color: var(--color-ink-muted, #666); }
    .tool__hint--active { background: var(--color-status-available); color: var(--color-ink, #4a3f35); font-weight: 500; }
    .tool__hint--alert { background: var(--color-status-critical); color: var(--color-ink, #4a3f35); font-weight: 500; }
    .tool__args-label { display: flex; flex-direction: column; gap: var(--space-1); font-family: var(--font-mono); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; }
    .tool__args { font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-ink); background: var(--color-bg); border: var(--border-width) solid var(--border-color); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); resize: vertical; }
    .tool__args:focus { outline: var(--focus-ring-width) solid var(--focus-ring-color); outline-offset: 2px; }
    .tool__result { margin: 0; background: var(--color-status-available); border: var(--border-width) solid var(--border-color); border-radius: var(--radius-sm); padding: var(--space-3); font-family: var(--font-mono); font-size: var(--text-sm); white-space: pre-wrap; }
    .tool__result--error { background: var(--color-status-critical); }
  `,
})
export class AgentConsole implements OnDestroy {
  private readonly environmentInjector = inject(EnvironmentInjector);
  protected readonly a2ui = inject(A2uiRendererService);
  protected readonly dispatcher = inject(A2uiActionDispatcherService);
  protected readonly runner = inject(AgentRunnerService);

  protected readonly registry = SHELTER_TOOL_REGISTRY;

  protected activeTab = signal<ConsoleTab>('webmcp');
  private readonly argText = signal<Record<string, string>>({});
  protected readonly results = signal<Record<string, ToolResult>>({});

  protected readonly agUiEvents = signal<LoggedAgUiEvent[]>([
    {
      timestamp: '12:00:00',
      type: 'RUN_STARTED',
      payload: { runId: 'run-init-001', threadId: 'thread-plushelter' },
    },
    {
      timestamp: '12:00:01',
      type: 'TEXT_MESSAGE_CONTENT',
      payload: { delta: 'Welcome to Plushelter Stuffed Animal Rehabilitation.' },
    },
  ]);

  protected readonly activeSurfaceCount = computed(
    () => this.a2ui.surfaceGroup.surfacesMap.size,
  );

  ngOnDestroy(): void {
    this.clearSurfaces();
  }

  clearSurfaces(): void {
    const surfaceGroup = this.a2ui.surfaceGroup;
    for (const surfaceId of Array.from(surfaceGroup.surfacesMap.keys())) {
      surfaceGroup.deleteSurface(surfaceId);
    }
  }

  clearAgUiEvents(): void {
    this.agUiEvents.set([]);
  }

  simulateAgUiRun(): void {
    const now = new Date().toLocaleTimeString();
    this.agUiEvents.update((evs) => [
      ...evs,
      {
        timestamp: now,
        type: 'TOOL_CALL_START',
        payload: { toolCallId: `call-${Date.now()}`, toolCallName: 'searchRoster' },
      },
      {
        timestamp: now,
        type: 'TOOL_CALL_ARGS',
        payload: { delta: '{"criteria":"bear"}' },
      },
      {
        timestamp: now,
        type: 'ACTIVITY_SNAPSHOT',
        payload: { activityType: 'a2ui-surface', surfaceId: 'srf-console-demo' },
      },
      {
        timestamp: now,
        type: 'STATE_DELTA',
        payload: { patch: [{ op: 'add', path: '/lastFilter', value: 'bear' }] },
      },
      {
        timestamp: now,
        type: 'RUN_FINISHED',
        payload: { runId: `run-${Date.now()}` },
      },
    ]);
  }

  eventCategory(type: string): string {
    if (type.startsWith('RUN_')) return 'run';
    if (type.startsWith('TEXT_MESSAGE_')) return 'msg';
    if (type.startsWith('TOOL_CALL_')) return 'tool';
    if (type.startsWith('ACTIVITY_')) return 'a2ui';
    if (type.startsWith('STATE_')) return 'state';
    return 'other';
  }

  renderSampleSurface(): void {
    const surfaceId = 'srf-console-demo';
    const messages: A2uiMessage[] = [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId,
          catalogId: SHELTER_CATALOG_ID,
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId,
          components: [
            {
              id: 'root',
              component: 'Column',
              children: ['badge', 'title', 'gauge', 'chart', 'adopt-btn'],
            },
            {
              id: 'badge',
              component: 'StatusStamp',
              status: 'celebration',
              text: { path: '/tag' },
            },
            {
              id: 'title',
              component: 'Text',
              variant: 'h2',
              text: { path: '/name' },
            },
            {
              id: 'gauge',
              component: 'RiskGauge',
              score: 82,
              label: 'Rehabilitation Index',
              sublabel: 'Fully cleared for home placement with low-shedding habits.',
            },
            {
              id: 'chart',
              component: 'CustomChart',
              title: 'Care Requirements',
              chartType: 'bar',
              data: [
                { label: 'Nap Capacity', value: 95 },
                { label: 'Snack Need', value: 40 },
                { label: 'Huggability', value: 88 },
              ],
            },
            {
              id: 'adopt-btn',
              component: 'Button',
              child: 'adopt-btn-text',
              action: {
                event: {
                  name: 'start_adoption',
                  context: { animalId: '001' },
                },
              },
            },
            {
              id: 'adopt-btn-text',
              component: 'Text',
              text: 'Apply for Placement',
            },
          ] as any,
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId,
          path: '/',
          value: {
            tag: 'VERIFIED SHELTER MATCH',
            name: 'Horace (Case #001)',
          },
        },
      },
    ];

    this.a2ui.processMessages(messages);
  }

  updateSampleSurfaceData(): void {
    const surfaceId = 'srf-console-demo';
    const messages: A2uiMessage[] = [
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId,
          path: '/name',
          value: 'Horace (Distinguished Graduate Case #001)',
        },
      },
    ];
    this.a2ui.processMessages(messages);
  }

  protected stringify(val: unknown): string {
    return JSON.stringify(val ?? {});
  }

  protected argFor(rt: RegisteredTool): string {
    return this.argText()[rt.tool.name] ?? this.defaultArgs(rt);
  }

  protected setArg(name: string, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.argText.update((map) => ({ ...map, [name]: value }));
  }

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
