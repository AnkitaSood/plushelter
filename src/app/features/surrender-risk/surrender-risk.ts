import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CopilotA2uiSurfaceComponent } from '../../a2ui/copilot-a2ui-surface.component';
import { Button } from '../../ui/button/button';
import { FormField } from '../../ui/form-field/form-field';
import { SHELTER_CATALOG_ID } from '../../a2ui/shelter-catalog';
import { A2uiActionDispatcherService } from '../../a2ui/a2ui-action-dispatcher.service';
import { AdmittedAnimalsStore } from '../../data/admitted-animals-store';
import type { A2uiMessage } from '@a2ui/web_core/v0_9';

const RISK_SURFACE_ID = 'surrender-risk-report';

@Component({
  selector: 'app-surrender-risk',
  imports: [Button, FormField, CopilotA2uiSurfaceComponent],
  template: `
    <div class="risk-report-view">
      <header class="risk-report-view__header">
        <h1>Surrender Risk & Intake Analysis</h1>
        <p class="risk-report-view__sub">
          A clinical, multi-factor evaluation of relinquishment guilt, fabric fatigue, and
          re-homing probability — dynamically synthesized as an interactive A2UI generative surface.
        </p>
      </header>

      <div class="risk-layout">
        <!-- Left: Intake Parameters Controls -->
        <section class="risk-controls" role="region" aria-label="Triage parameters">
          <h2 class="risk-controls__title">Triage Assessment Form</h2>
          <p class="risk-controls__desc">
            Adjust the clinical parameters below to see the A2UI generative surface react
            in real time:
          </p>

          <app-form-field label="Patient Name" [(value)]="animalName" hint="Stuffed animal name" />

          <label class="control-group">
            <span class="control-label">Species Classification</span>
            <select class="control-select" [value]="species()" (change)="onSpeciesChange($event)">
              <option value="Bear">Ursine (Bear)</option>
              <option value="Rabbit">Lagomorph (Rabbit)</option>
              <option value="Dog">Canine (Dog)</option>
              <option value="Dinosaur">Saurian (Dinosaur)</option>
              <option value="Duck">Anatine (Duck)</option>
            </select>
          </label>

          <label class="control-group">
            <span class="control-label">Fabric & Seam Condition</span>
            <select class="control-select" [value]="condition()" (change)="onConditionChange($event)">
              <option value="Mint — intact factory seams">Mint (Factory Seams)</option>
              <option value="Fair — minor fuzz loss and loosened ear">Fair (Minor Seam Strain)</option>
              <option value="Critical — acute stuffing decompression">Critical (Acute Decompression)</option>
            </select>
          </label>

          <label class="control-group">
            <div class="slider-head">
              <span class="control-label">Relinquishment Guilt Index</span>
              <span class="slider-val">{{ guiltScore() }} / 100</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              [value]="guiltScore()"
              (input)="onGuiltChange($event)"
              class="control-range"
            />
          </label>

          <label class="control-group">
            <div class="slider-head">
              <span class="control-label">Huggability Coefficient</span>
              <span class="slider-val">{{ huggability() }} / 5</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              [value]="huggability()"
              (input)="onHuggabilityChange($event)"
              class="control-range"
            />
          </label>

          <div class="risk-actions">
            <app-button type="button" (click)="generateReport()">
              Synthesize A2UI Report
            </app-button>
            <app-button type="button" (click)="resetForm()">
              Reset
            </app-button>
          </div>

          @if (admissionSuccess()) {
            <aside class="admission-banner" role="status">
              🎉 <strong>Admitted:</strong> {{ animalName() }} has been transferred to the active
              rehabilitation roster!
            </aside>
          }
        </section>

        <!-- Right: A2UI Surface Output -->
        <section class="risk-surface-pane" role="region" aria-label="Generated Risk Surface">
          <header class="risk-surface-pane__header">
            <div>
              <h2 class="risk-surface-pane__title">A2UI Generative Surface</h2>
            </div>
            <span class="surface-id-tag"><code>{{ surfaceId }}</code></span>
          </header>

          <div class="risk-surface-pane__content">
            @if (hasReport()) {
              <app-copilot-a2ui-surface [surfaceId]="surfaceId" [operations]="operations()" />
            } @else {
              <div class="empty-surface">
                <div class="empty-icon" aria-hidden="true">📊</div>
                <h3>No Risk Report Synthesized</h3>
                <p>
                  Click <strong>"Synthesize A2UI Report"</strong> to generate a multi-widget risk
                  assessment surface featuring gauges, checklists, and dynamic SVG charts.
                </p>
              </div>
            }
          </div>
        </section>
      </div>
    </div>
  `,
  styles: `
    .risk-report-view {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      max-width: 76rem;
      margin-inline: auto;
      padding: var(--space-5);
      font-family: var(--font-body);
      color: var(--color-ink);
    }

    .risk-report-view__header h1 {
      margin: 0 0 var(--space-1);
      font-family: var(--font-display);
      font-size: var(--text-2xl);
    }

    .risk-report-view__sub {
      margin: 0;
      color: var(--color-ink-muted, #555);
      max-width: 70ch;
    }

    .risk-layout {
      display: grid;
      grid-template-columns: 1fr 1.35fr;
      gap: var(--space-5);
      align-items: start;
    }

    @media (max-width: 960px) {
      .risk-layout {
        grid-template-columns: 1fr;
      }
    }

    .risk-controls {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
    }

    .risk-controls__title {
      margin: 0;
      font-family: var(--font-display);
      font-size: var(--text-lg);
    }

    .risk-controls__desc {
      margin: 0 0 var(--space-2);
      font-size: var(--text-sm);
      color: var(--color-ink-muted, #666);
    }

    .control-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .control-label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .control-select {
      font-family: var(--font-body);
      font-size: var(--text-base);
      padding: var(--space-2);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
    }

    .control-select:focus {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
    }

    .slider-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }

    .slider-val {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-weight: bold;
    }

    .control-range {
      width: 100%;
      cursor: pointer;
    }

    .risk-actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-3);
    }

    .admission-banner {
      padding: var(--space-3);
      background: var(--color-celebration);
      border: var(--border-width) solid var(--color-ink-on-accent);
      border-radius: var(--radius-sm);
      font-size: var(--text-sm);
      margin-top: var(--space-2);
      /* Sits on the pink fill — fixed ink, overriding the page's flipping ink. */
      color: var(--color-ink-on-accent);
    }

    .risk-surface-pane {
      display: flex;
      flex-direction: column;
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
      overflow: hidden;
      min-height: 32rem;
    }

    .risk-surface-pane__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-3) var(--space-4);
      background: var(--color-muted);
      border-bottom: var(--border-width) solid var(--border-color);
    }

    .risk-surface-pane__title {
      margin: 0;
      font-family: var(--font-display);
      font-size: var(--text-lg);
    }

    .risk-surface-pane__badge {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-ink-muted, #666);
    }

    .surface-id-tag code {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      background: var(--color-bg);
      padding: 2px 6px;
      border: 1px solid var(--border-color);
      border-radius: 3px;
    }

    .risk-surface-pane__content {
      padding: var(--space-4);
      overflow-y: auto;
    }

    .empty-surface {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--space-6) var(--space-4);
      gap: var(--space-2);
      color: var(--color-ink-muted, #666);
    }

    .empty-icon {
      font-size: 3rem;
      line-height: 1;
    }
  `,
})
export class SurrenderRiskReport implements OnInit, OnDestroy {
  private readonly dispatcher = inject(A2uiActionDispatcherService);
  private readonly admittedStore = inject(AdmittedAnimalsStore);

  readonly surfaceId = RISK_SURFACE_ID;

  protected animalName = signal('Barnaby the Bear');
  protected species = signal('Bear');
  protected condition = signal('Critical — acute stuffing decompression');
  protected guiltScore = signal(78);
  protected huggability = signal(4);

  protected hasReport = signal(false);
  protected admissionSuccess = signal(false);
  protected readonly operations = signal<any[]>([]);

  private surfaceInitialized = false;
  private unregisterActionHandler?: () => void;

  constructor() {
    // Reactively update the A2UI data model when sliders change if report is active
    effect(() => {
      const guilt = this.guiltScore();
      const hug = this.huggability();
      const name = this.animalName();
      if (this.surfaceInitialized && this.hasReport()) {
        this.updateSurfaceDataModel(name, guilt, hug);
      }
    });
  }

  ngOnInit(): void {
    this.unregisterActionHandler = this.dispatcher.onAction((action) => {
      const actionName = action.name || (action as any).action;
      if (actionName === 'admit_to_roster') {
        this.admitCurrentAnimal();
      }
    });
  }

  ngOnDestroy(): void {
    this.unregisterActionHandler?.();
    this.clearSurface();
  }

  clearSurface(): void {
    this.operations.set([]);
    this.surfaceInitialized = false;
    this.hasReport.set(false);
  }

  resetForm(): void {
    this.animalName.set('Barnaby the Bear');
    this.species.set('Bear');
    this.condition.set('Critical — acute stuffing decompression');
    this.guiltScore.set(78);
    this.huggability.set(4);
    this.admissionSuccess.set(false);
    this.generateReport();
  }

  protected onSpeciesChange(event: Event): void {
    this.species.set((event.target as HTMLSelectElement).value);
  }

  protected onConditionChange(event: Event): void {
    this.condition.set((event.target as HTMLSelectElement).value);
  }

  protected onGuiltChange(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.guiltScore.set(val);
  }

  protected onHuggabilityChange(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.huggability.set(val);
  }

  generateReport(): void {
    const messages: A2uiMessage[] = [];

    if (!this.surfaceInitialized) {
      messages.push({
        version: 'v0.9',
        createSurface: {
          surfaceId: this.surfaceId,
          catalogId: SHELTER_CATALOG_ID,
        },
      });
      this.surfaceInitialized = true;
    }

    const guilt = this.guiltScore();
    const hug = this.huggability();
    const name = this.animalName();

    messages.push({
      version: 'v0.9',
      updateComponents: {
        surfaceId: this.surfaceId,
        components: [
          {
            id: 'root',
            component: 'Column',
            children: [
              'report-title',
              'status-stamp',
              'guilt-gauge',
              'risk-chart',
              'clinical-checklist',
              'admit-action',
            ],
          },
          {
            id: 'report-title',
            component: 'Text',
            variant: 'h2',
            text: { path: '/headerText' },
          },
          {
            id: 'status-stamp',
            component: 'StatusStamp',
            status: guilt > 65 ? 'critical' : 'pending',
            text: { path: '/statusText' },
          },
          {
            id: 'guilt-gauge',
            component: 'RiskGauge',
            score: { path: '/guiltScore' },
            label: 'Surrender Guilt & Remorse Index',
            sublabel: { path: '/assessmentNarrative' },
          },
          {
            id: 'risk-chart',
            component: 'CustomChart',
            title: 'Multidimensional Risk Vectors',
            chartType: 'bar',
            data: { path: '/chartVectors' },
          },
          {
            id: 'clinical-checklist',
            component: 'AdoptionChecklist',
            title: 'Prescribed Rehabilitation Steps',
            items: { path: '/checklistItems' },
          },
          {
            id: 'admit-action',
            component: 'Button',
            child: 'admit-action-text',
            action: {
              event: {
                name: 'admit_to_roster',
                context: { animalName: name },
              },
            },
          },
          {
            id: 'admit-action-text',
            component: 'Text',
            text: 'Admit to Intensive Care Roster',
          },
        ] as any,
      },
    });

    messages.push({
      version: 'v0.9',
      updateDataModel: {
        surfaceId: this.surfaceId,
        path: '/',
        value: this.buildDataModel(name, guilt, hug),
      },
    });

    this.operations.set(messages);
    this.hasReport.set(true);
  }

  private updateSurfaceDataModel(name: string, guilt: number, hug: number): void {
    const updateMsg = {
      version: 'v0.9',
      updateDataModel: {
        surfaceId: this.surfaceId,
        path: '/',
        value: this.buildDataModel(name, guilt, hug),
      },
    };
    this.operations.update((ops) => [...ops, updateMsg]);
  }

  private buildDataModel(name: string, guilt: number, hug: number): Record<string, unknown> {
    const isCritical = guilt > 65;
    const narrative = isCritical
      ? `High risk: Adopter exhibits profound attachment conflict. Immediate emotional stabilization and stuffed companion support recommended.`
      : `Moderate risk: Standard relinquishment routine; fabric wear aligns with typical childhood attachment patterns.`;

    return {
      headerText: `Triage Analysis: ${name}`,
      statusText: isCritical ? 'URGENT CLINICAL CASE' : 'ROUTINE SURRENDER CASE',
      guiltScore: guilt,
      assessmentNarrative: narrative,
      chartVectors: [
        { label: 'Relinquishment Guilt', value: guilt, color: isCritical ? 'var(--color-status-critical)' : 'var(--color-status-pending)' },
        { label: 'Structural Trauma', value: 100 - hug * 18, color: 'var(--color-info)' },
        { label: 'Re-homing Outlook', value: Math.min(100, hug * 20), color: 'var(--color-status-available)' },
      ],
      checklistItems: [
        { label: 'Perform emergency seam palpation and tension test', checked: true },
        { label: 'Replace fatigued polyester fluff with hypoallergenic fiberfill', checked: false },
        { label: 'Enroll former owner in closure follow-up support program', checked: isCritical },
        { label: 'Conduct 24-hour acclimatization nap test', checked: false },
      ],
    };
  }

  private admitCurrentAnimal(): void {
    this.admittedStore.admit({
      id: `sr-${Date.now()}`,
      name: this.animalName(),
      species: this.species(),
      condition: this.condition(),
      backstory: `Admitted via Surrender Risk Assessment with Guilt Index of ${this.guiltScore()}/100.`,
      available: false,
      underRepair: true,
      surrenderedAt: new Date().toISOString(),
    });
    this.admissionSuccess.set(true);
  }
}
