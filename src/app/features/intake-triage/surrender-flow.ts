import { Component, computed, debounced, effect, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { form, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { Button } from '../../ui/button/button';
import { FormField } from '../../ui/form-field/form-field';
import { TextareaField } from '../../ui/textarea-field/textarea-field';
import { StatusBadge } from '../../ui/status-badge/status-badge';
import { NotificationService } from '../../ui/notifications/notification.service';
import type { Animal } from '../../data/roster';
import { MOCK_ANIMALS, PHOTOS_PENDING_PLACEHOLDER } from '../../data/roster';
import { AdmittedAnimalsStore } from '../../data/admitted-animals-store';
import { SurrenderRequestsStore } from './surrender-requests-store';
import { EMPTY_SURRENDER_REQUEST, type SurrenderRequest } from './surrender-request.model';
import type { GuiltAnalysis, SurrenderRiskErrorBody } from './intake-triage.model';

/** Builds a roster animal from a hand-filled surrender request. There's no photo yet — a shared
 * placeholder stands in and the roster tags it "Photos pending" until a photo is taken. */
export function surrenderToPhotosPendingAnimal(request: SurrenderRequest): Animal {
  return {
    id: crypto.randomUUID(),
    name: request.animalName || 'Unnamed surrender',
    species: request.species,
    condition: request.condition,
    backstory: '',
    photoUrl: PHOTOS_PENDING_PLACEHOLDER,
    available: false,
    photosPending: true,
  };
}

@Component({
  selector: 'app-surrender-flow',
  imports: [Button, FormField, TextareaField, StatusBadge],
  template: `
    <form class="surrender-flow" (submit)="$event.preventDefault(); submitSurrender()">
      <p class="surrender-flow__intro">
        No photo handy? File the surrender by hand. S.A.R.F.'s intake counselor reads the reason as you
        type, and the animal joins the roster with photos pending.
      </p>

      <app-form-field
        label="Owner name"
        [(value)]="surrenderForm.ownerName().value"
        [error]="ownerNameError()"
      />
      <app-form-field
        label="Animal name"
        [(value)]="surrenderForm.animalName().value"
        [error]="animalNameError()"
      />
      <label class="surrender-flow__select-label">
        <span class="surrender-flow__select-name">Species</span>
        <select
          class="surrender-flow__select"
          [value]="surrenderForm.species().value()"
          (change)="surrenderForm.species().value.set($any($event.target).value)"
        >
          @for (s of speciesOptions; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
      </label>
      <app-textarea-field
        label="Current condition"
        [(value)]="surrenderForm.condition().value"
        [error]="conditionError()"
        placeholder="Describe the animal's current condition…"
      />
      <app-textarea-field
        label="Reason for surrender"
        [(value)]="surrenderForm.reason().value"
        [error]="reasonError()"
        placeholder="Describe the circumstances of the surrender…"
      />

      @if (surrenderRiskError(); as riskErr) {
        <app-status-badge status="critical">{{ riskErr.message }}</app-status-badge>
      } @else if (surrenderRiskDisplay(); as risk) {
        <app-textarea-field label="Surrender risk assessment" [value]="risk" [readonly]="true" />
      }

      <p class="surrender-flow__contact">
        Preferred contact times on file: {{ surrenderForm.preferredContactTimes().value().join(', ') }}
      </p>
      <app-button type="submit">Submit surrender request</app-button>
    </form>
  `,
  styles: `
    .surrender-flow {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      font-family: var(--font-body);
      color: var(--color-ink);
    }

    .surrender-flow__intro { margin: 0; max-width: 70ch; }

    .surrender-flow__select-label { display: flex; flex-direction: column; gap: var(--space-1); }
    .surrender-flow__select-name {
      font-family: var(--font-mono);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .surrender-flow__select {
      font-family: var(--font-body);
      font-size: var(--text-base);
      color: var(--color-ink);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
    }
    .surrender-flow__select:focus { outline: var(--focus-ring-width) solid var(--focus-ring-color); outline-offset: 2px; }

    .surrender-flow__contact { margin: 0; font-family: var(--font-mono); font-size: var(--text-xs); opacity: 0.75; }
  `,
})
export class SurrenderFlow {
  private readonly router = inject(Router);
  private readonly admittedStore = inject(AdmittedAnimalsStore);
  private readonly requestsStore = inject(SurrenderRequestsStore);
  private readonly notifications = inject(NotificationService);

  protected readonly speciesOptions = [...new Set(MOCK_ANIMALS.map((a) => a.species))].sort();

  private readonly model = signal<SurrenderRequest>({ ...EMPTY_SURRENDER_REQUEST });
  private readonly submitAttempted = signal(false);

  constructor() {
    // Surface a failed surrender-risk read as a retryable alert toast, alongside the inline badge.
    effect(() => {
      if (this.surrenderRiskResource.error()) {
        this.notifications.alert(this.surrenderRiskError()?.message ?? 'Surrender assessment failed.', {
          onRetry: () => this.surrenderRiskResource.reload(),
        });
      }
    });
  }

  /** A plain Signal Form. Passing `experimentalWebMcpTool` derives a WebMCP tool
   * (`submitSurrenderRequest`) from the model + validators — form-scoped, so the tool lives exactly
   * as long as this component. A human fills it in, or an in-browser agent calls the generated tool;
   * both route through `submission.action`. */
  protected readonly surrenderForm = form(
    this.model,
    (f) => {
      required(f.ownerName, { message: 'Owner name is required.' });
      required(f.animalName, { message: 'Animal name is required.' });
      required(f.condition, { message: "The animal's current condition is required." });
      required(f.reason, { message: 'A reason for surrender is required.' });
    },
    {
      experimentalWebMcpTool: {
        name: 'submitSurrenderRequest',
        description:
          'File a stuffed-animal surrender request with the shelter. Provide the owner name, the ' +
          'animal name, its species, its current condition, and the reason for surrender. The animal ' +
          'is added to the roster with photos pending.',
      },
      submission: {
        action: async (field) => {
          const request = field().value() as SurrenderRequest;
          this.requestsStore.add(request);
          this.admittedStore.admit(surrenderToPhotosPendingAnimal(request));
          this.notifications.info(`${request.animalName || 'The animal'} admitted to the roster — photos pending.`);
          this.model.set({ ...EMPTY_SURRENDER_REQUEST });
          this.submitAttempted.set(false);
          this.router.navigate(['/roster']);
          return undefined;
        },
      },
    },
  );

  /** Live surrender-risk read: the reason field, debounced 400ms so we don't call Gemini on every
   * keystroke, drives an httpResource. Empty reason → `undefined` request → the resource stays idle. */
  private readonly reasonText = computed(() => this.surrenderForm.reason().value());
  private readonly debouncedReason = debounced(this.reasonText, 400);

  protected readonly surrenderRiskResource = httpResource<GuiltAnalysis>(() => {
    const text = (this.debouncedReason.value() ?? '').trim();
    if (!text) return undefined;
    return { url: '/api/surrender-analysis', method: 'POST', body: { submittedText: text } };
  });

  protected readonly surrenderRiskDisplay = computed(() => {
    if (this.surrenderRiskResource.isLoading()) return 'Assessing…';
    const value = this.surrenderRiskResource.value();
    return value ? `${value.guiltScore}/100 — ${value.message}` : '';
  });

  protected readonly surrenderRiskError = computed(() => {
    const error = this.surrenderRiskResource.error();
    if (!error) return undefined;
    const body = (error as { error?: SurrenderRiskErrorBody })?.error?.error;
    return body ?? { code: 'UPSTREAM_ERROR', message: 'Something went wrong assessing surrender risk.' };
  });

  protected readonly ownerNameError = computed(() => this.errorText(this.surrenderForm.ownerName().errors()));
  protected readonly animalNameError = computed(() => this.errorText(this.surrenderForm.animalName().errors()));
  protected readonly conditionError = computed(() => this.errorText(this.surrenderForm.condition().errors()));
  protected readonly reasonError = computed(() => this.errorText(this.surrenderForm.reason().errors()));

  protected async submitSurrender(): Promise<void> {
    this.submitAttempted.set(true);
    await submit(this.surrenderForm);
  }

  private errorText(errors: readonly unknown[]): string {
    if (!this.submitAttempted()) return '';
    return errors
      .map((e) => (e as { message?: string }).message)
      .filter((m): m is string => !!m)
      .join(' ');
  }
}
