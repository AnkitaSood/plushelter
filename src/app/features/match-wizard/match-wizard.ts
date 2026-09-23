import {
  Component,
  OnDestroy,
  OnInit,
  effect,
  inject,
  resource,
  signal,
} from '@angular/core';
import type { A2uiClientAction, A2uiMessage } from '@a2ui/web_core/v0_9';
import { SHELTER_CATALOG_ID } from '../../a2ui/shelter-catalog';
import { A2uiActionDispatcherService } from '../../a2ui/a2ui-action-dispatcher.service';
import { CopilotA2uiSurfaceComponent } from '../../a2ui/copilot-a2ui-surface.component';
import { MOCK_ANIMALS } from '../../data/roster';
import { Button } from '../../ui/button/button';

// ─── API response types (mirror netlify/functions/match-wizard.mts) ──────────

interface WizardOption {
  id: string;
  label: string;
  value: string;
}

interface StepOptionsResponse {
  promptTitle: string;
  promptBody: string;
  options: WizardOption[];
}

interface Step3Response {
  matchedAnimalId: string;
  compatibilityScore: number;
  compatibilityRationale: string;
  checklistItems: Array<{ label: string; checked: boolean }>;
}

type WizardApiResponse = StepOptionsResponse | Step3Response;

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function callMatchWizard(
  body: { step: number; livingValue?: string; roleValue?: string },
  abortSignal: AbortSignal,
): Promise<WizardApiResponse> {
  const res = await fetch('/api/match-wizard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: abortSignal,
  });
  if (!res.ok) {
    let code = 'UPSTREAM_ERROR';
    let message = 'The assessment system encountered an error.';
    try {
      const json = await res.json();
      code = json?.error?.code ?? code;
      message = json?.error?.message ?? message;
    } catch { /* ignore parse errors */ }
    throw new Error(`[${code}] ${message}`);
  }
  return res.json() as Promise<WizardApiResponse>;
}

const WIZARD_SURFACE_ID = 'match-wizard-surface';

@Component({
  selector: 'app-match-wizard',
  imports: [Button, CopilotA2uiSurfaceComponent],
  template: `
    <div class="wizard-view">
      <header class="wizard-view__header">
        <h1>Adaptive Companion Match Wizard</h1>
        <p class="wizard-view__sub">
          A multi-step placement assessment where the interface itself adapts. Each question's layout,
          options, and clinical recommendations are dynamically composed by the agent based on your prior answers.
        </p>
      </header>

      <div class="wizard-container">
        <header class="wizard-container__bar">
          <div class="step-indicator">
            <span class="step-dot" [class.step-dot--active]="currentStep() >= 1">1. Environment</span>
            <span class="step-arrow">&rarr;</span>
            <span class="step-dot" [class.step-dot--active]="currentStep() >= 2">2. Dynamic Role</span>
            <span class="step-arrow">&rarr;</span>
            <span class="step-dot" [class.step-dot--active]="currentStep() >= 3">3. Final Match</span>
          </div>
          <app-button type="button" [variant]="'secondary'" class="wizard-reset" (click)="resetWizard()">Restart Assessment</app-button>
        </header>

        <main class="wizard-canvas">
          <app-copilot-a2ui-surface [surfaceId]="surfaceId" [operations]="operations()" />
        </main>
      </div>
    </div>
  `,
  styles: `
    .wizard-view {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      max-width: 54rem;
      margin-inline: auto;
      padding: var(--space-5);
      font-family: var(--font-body);
      color: var(--color-ink);
    }

    .wizard-tag {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-1);
    }

    .wizard-badge {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-ink-muted, #666);
    }

    .wizard-view__header h1 {
      margin: 0 0 var(--space-1);
      font-family: var(--font-display);
      font-size: var(--text-2xl);
    }

    .wizard-view__sub {
      margin: 0;
      color: var(--color-ink-muted, #555);
      max-width: 70ch;
    }

    .wizard-container {
      display: flex;
      flex-direction: column;
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
      overflow: hidden;
      min-height: 28rem;
    }

    .wizard-container__bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-3) var(--space-4);
      background: var(--color-muted);
      border-bottom: var(--border-width) solid var(--border-color);
    }

    .step-indicator {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    .step-dot {
      color: var(--color-ink-muted, #888);
      font-weight: normal;
    }

    .step-dot--active {
      color: var(--color-ink);
      font-weight: bold;
    }

    .step-arrow {
      color: var(--color-ink-muted, #bbb);
    }

    .wizard-canvas {
      padding: var(--space-5);
    }
  `,
})
export class AdaptiveMatchWizard implements OnInit, OnDestroy {
  private readonly dispatcher = inject(A2uiActionDispatcherService);

  readonly surfaceId = WIZARD_SURFACE_ID;
  readonly operations = signal<any[]>([]);

  protected currentStep = signal<number>(1);
  private readonly livingValue = signal<string | undefined>(undefined);
  private readonly roleValue = signal<string | undefined>(undefined);

  /**
   * Wizard state machine: the resource params triple drives all three fetches.
   * - step 1: { step: 1 }
   * - step 2: { step: 2, livingValue: '...' }
   * - step 3: { step: 3, livingValue: '...', roleValue: '...' }
   *
   * Changing this signal re-runs the resource loader automatically.
   */
  private wizardParams = signal<{ step: number; livingValue?: string; roleValue?: string }>({ step: 1 });

  private readonly wizardResource = resource({
    params: () => this.wizardParams(),
    loader: async ({ params, abortSignal }) => {
      const data = await callMatchWizard(params, abortSignal);
      return { step: params.step, data };
    },
  });

  private surfaceCreated = false;
  private unregisterActionHandler?: () => void;

  constructor() {
    // React to wizardResource state transitions and sync with the A2UI surface
    effect(() => {
      const status = this.wizardResource.status();
      switch (status) {
        case 'loading':
        case 'reloading':
          this.renderLoadingState();
          break;
        case 'error': {
          const err = this.wizardResource.error();
          this.renderErrorState(err instanceof Error ? err.message : String(err));
          break;
        }
        case 'resolved': {
          const res = this.wizardResource.value();
          if (res) {
            const { step, data } = res;
            if (step === 1 || step === 2) {
              this.renderOptionsStep(step, data as StepOptionsResponse);
            } else if (step === 3) {
              this.renderFinalStep(data as Step3Response);
            }
          }
          break;
        }
      }
    });
  }

  ngOnInit(): void {
    this.unregisterActionHandler = this.dispatcher.onAction((action) => {
      this.handleAction(action);
    });
  }

  ngOnDestroy(): void {
    this.unregisterActionHandler?.();
    this.clearSurface();
  }

  private handleAction(action: A2uiClientAction): void {
    const rawAction = (action as any)?.userAction ?? action;
    const actionName = rawAction.name || rawAction.action;
    const ctx = rawAction.context || {};

    if (actionName === 'select_living' && ctx['living']) {
      const living = String(ctx['living']);
      this.livingValue.set(living);
      this.currentStep.set(2);
      this.wizardParams.set({ step: 2, livingValue: living });
    } else if (actionName === 'select_role' && ctx['role']) {
      const role = String(ctx['role']);
      this.roleValue.set(role);
      this.currentStep.set(3);
      this.wizardParams.set({
        step: 3,
        livingValue: this.livingValue(),
        roleValue: role,
      });
    }
  }

  clearSurface(): void {
    this.operations.set([]);
    this.surfaceCreated = false;
  }

  resetWizard(): void {
    this.clearSurface();
    this.livingValue.set(undefined);
    this.roleValue.set(undefined);
    this.currentStep.set(1);
    this.wizardParams.set({ step: 1 });
  }

  // ─── Surface renderers ────────────────────────────────────────────────────

  private ensureSurface(): A2uiMessage[] {
    return [
      {
        version: 'v0.9',
        createSurface: { surfaceId: this.surfaceId, catalogId: SHELTER_CATALOG_ID },
      },
    ];
  }

  private renderLoadingState(): void {
    const messages = this.ensureSurface();
    messages.push({
      version: 'v0.9',
      updateComponents: {
        surfaceId: this.surfaceId,
        components: [
          { id: 'root', component: 'Column', children: ['loading-stamp', 'loading-text'] },
          {
            id: 'loading-stamp',
            component: 'StatusStamp',
            status: 'pending',
            text: 'CONSULTING PLACEMENT REGISTRY',
          },
          {
            id: 'loading-text',
            component: 'Text',
            variant: 'body',
            text: 'The assessment system is processing your profile. Please stand by.',
          },
        ] as any,
      },
    });
    this.operations.set(messages);
  }

  private renderErrorState(message: string): void {
    const messages = this.ensureSurface();
    messages.push({
      version: 'v0.9',
      updateComponents: {
        surfaceId: this.surfaceId,
        components: [
          { id: 'root', component: 'Column', children: ['error-stamp', 'error-text'] },
          {
            id: 'error-stamp',
            component: 'StatusStamp',
            status: 'critical',
            text: 'ASSESSMENT SYSTEM ERROR',
          },
          {
            id: 'error-text',
            component: 'Text',
            variant: 'body',
            text: message,
          },
        ] as any,
      },
    });
    this.operations.set(messages);
  }

  /**
   * Renders a question step (step 1 or step 2).
   * Gemini supplies the prompt copy and the option list.
   * The action name encodes which selection signal to set next.
   */
  private renderOptionsStep(step: number, data: StepOptionsResponse): void {
    const actionName = step === 1 ? 'select_living' : 'select_role';
    const contextKey = step === 1 ? 'living' : 'role';

    const optionComponentIds = data.options.flatMap((o) => [o.id, `${o.id}-text`]);
    const rootChildren = ['title', 'desc', ...data.options.map((o) => o.id)];

    const optionComponents = data.options.flatMap((o) => [
      {
        id: o.id,
        component: 'Button',
        child: `${o.id}-text`,
        action: { event: { name: actionName, context: { [contextKey]: o.value } } },
      },
      {
        id: `${o.id}-text`,
        component: 'Text',
        text: o.label,
      },
    ]);

    const messages = this.ensureSurface();
    messages.push({
      version: 'v0.9',
      updateComponents: {
        surfaceId: this.surfaceId,
        components: [
          { id: 'root', component: 'Column', children: rootChildren },
          { id: 'title', component: 'Text', variant: 'h2', text: data.promptTitle },
          { id: 'desc', component: 'Text', variant: 'body', text: data.promptBody },
          ...optionComponents,
        ] as any,
      },
    });
    this.operations.set(messages);
  }

  /**
   * Renders the final match screen (step 3).
   * Gemini selects the animal id, score, rationale, and checklist from the real roster.
   */
  private renderFinalStep(data: Step3Response): void {
    const match = MOCK_ANIMALS.find((a) => a.id === data.matchedAnimalId) ?? MOCK_ANIMALS[0];

    const messages = this.ensureSurface();
    messages.push({
      version: 'v0.9',
      updateComponents: {
        surfaceId: this.surfaceId,
        components: [
          {
            id: 'root',
            component: 'Column',
            children: [
              'final-header',
              'match-badge',
              'animal-card',
              'compatibility-gauge',
              'preparation-checklist',
              'adopt-button',
            ],
          },
          {
            id: 'final-header',
            component: 'Text',
            variant: 'h2',
            text: 'Assessment Complete: Clinical Match Verified',
          },
          {
            id: 'match-badge',
            component: 'StatusStamp',
            status: 'celebration',
            text: `${data.compatibilityScore}% PSYCHO-FABRIC COMPATIBILITY`,
          },
          {
            id: 'animal-card',
            component: 'AnimalCard',
            title: `${match.name} (${match.species})`,
            subtitle: `Condition: ${match.condition}`,
            description: match.backstory,
            imageUrl: match.photoUrl,
            status: 'available',
          },
          {
            id: 'compatibility-gauge',
            component: 'RiskGauge',
            score: data.compatibilityScore,
            label: 'Compatibility Index',
            sublabel: data.compatibilityRationale,
          },
          {
            id: 'preparation-checklist',
            component: 'AdoptionChecklist',
            title: 'Recommended Arrival Protocol',
            items: data.checklistItems,
          },
          {
            id: 'adopt-button',
            component: 'Button',
            child: 'adopt-button-text',
            action: {
              event: { name: 'start_adoption', context: { animalId: match.id } },
            },
          },
          {
            id: 'adopt-button-text',
            component: 'Text',
            text: `Begin Official Adoption of ${match.name}`,
          },
        ] as any,
      },
    });
    this.operations.set(messages);
  }
}
