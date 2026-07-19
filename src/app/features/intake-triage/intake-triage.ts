import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { form } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { Button } from '../../ui/button/button';
import { ChecklistItem } from '../../ui/checklist-item/checklist-item';
import { FormField } from '../../ui/form-field/form-field';
import { StatusBadge } from '../../ui/status-badge/status-badge';
import { TextareaField } from '../../ui/textarea-field/textarea-field';
import { CritterLoader } from '../../ui/critter-loader/critter-loader';
import type { Animal } from '../../data/roster';
import { UNDER_REPAIR_PLACEHOLDER } from '../../data/roster';
import { AdmittedAnimalsStore } from '../../data/admitted-animals-store';
import {
  EMPTY_CASE_FILE,
  type CaseFile,
  type GuiltAnalysis,
  type SurrenderRiskErrorBody,
  type TriageErrorBody,
  type UploadedPhoto,
} from './intake-triage.model';

/** Strips the `data:<mime>;base64,` prefix FileReader adds — the backend wants raw base64. */
function readFileAsBase64(file: File): Promise<UploadedPhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ base64: (reader.result as string).split(',')[1], mimeType: file.type });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Builds a not-yet-cleared roster animal from the reviewed intake fields. The uploaded photo
 * is never carried over — a shared placeholder stands in until the stuffy is "repaired". */
export function caseFileToUnderRepairAnimal(fields: {
  name: string;
  species: string;
  condition: string;
}): Animal {
  return {
    id: crypto.randomUUID(),
    name: fields.name || 'Unnamed case',
    species: fields.species,
    condition: fields.condition,
    backstory: '',
    photoUrl: UNDER_REPAIR_PLACEHOLDER,
    available: false,
    underRepair: true,
  };
}

@Component({
  imports: [Button, ChecklistItem, FormField, StatusBadge, TextareaField, CritterLoader],
  template: `
    <section class="intake">
      <h1>Intake Vision Triage</h1>
      <p class="intake__intro">
        Describe the surrender situation and upload a photo of the stuffed animal. Once both are in,
        S.A.R.F.'s intake counselor reviews the photo and the situation together to produce a case file.
      </p>

      <div class="intake__upload">
        <app-textarea-field
          label="Surrender Risk Assessment"
          [(value)]="surrenderRiskText"
          placeholder="Describe the surrendering owner's situation…"
        />
        <input #fileInput type="file" accept="image/*" class="intake__file-input" (change)="onPhotoSelected($event)" />
        <app-button type="button" (click)="fileInput.click()">Upload a photo</app-button>
        @if (uploadedPhoto() && !surrenderRiskText().trim()) {
          <app-status-badge status="pending">Surrender Risk Assessment is required before triage can begin.</app-status-badge>
        }
      </div>

      @if (triageResource.isLoading() || surrenderRiskResource.isLoading()) {
        <div class="intake__loading">
          <app-critter-loader />
          @if (triageResource.isLoading()) {
            <p class="intake__loading-text">Triaging image</p>
          }
          @if (surrenderRiskResource.isLoading()) {
            <p class="intake__loading-text">Analyzing surrender reason</p>
          }
        </div>
      }

      @if (triageError(); as triageErr) {
        <app-status-badge status="critical">{{ triageErr.message }}</app-status-badge>
      }

      @if (surrenderRiskError(); as riskErr) {
        <app-status-badge status="critical">{{ riskErr.message }}</app-status-badge>
      }

      @if (triageResource.hasValue()) {
        <div class="intake__layout">
          <form class="intake-form">
            <div class="intake-form__fields">
              <app-form-field label="Species" [(value)]="intakeForm.species().value" />
              <app-textarea-field label="Condition" [(value)]="intakeForm.condition().value" />
              <app-form-field label="Case name" [(value)]="intakeForm.suggestedCaseName().value" />
              <app-form-field label="Huggability score" type="number" [value]="scoreFieldText()" (valueChange)="onScoreInput($event)" />
              <app-textarea-field label="Surrender risk assessment" [value]="surrenderRiskDisplay()" [readonly]="true" />
            </div>
          </form>

          <div class="intake__treatment">
            <h2>Recommended treatment plan</h2>
            @for (step of caseFile().recommendedTreatmentPlan; track step) {
              <app-checklist-item [label]="step" [checked]="isStepDone(step)" (checkedChange)="setStepDone(step, $event)" />
            }
          </div>
        </div>
      }

      @if (triageResource.hasValue() || triageError()) {
        <div class="intake__actions">
          @if (triageResource.hasValue()) {
            <app-button type="button" (click)="admit()">Admit to shelter</app-button>
          }
          <app-button type="button" variant="secondary" (click)="clear()">Start over</app-button>
        </div>
      }
    </section>
  `,
  styles: `
    .intake {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      max-width: 40rem;
      margin-inline: auto;
      padding: var(--space-5);
      font-family: var(--font-body);
      color: var(--color-ink);
    }

    .intake__intro {
      margin: 0;
    }

    .intake__upload {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      align-items: flex-start;
    }

    .intake__file-input {
      display: none;
    }

    .intake__loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
    }

    .intake__loading-text {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.75;
    }

    .intake__layout {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .intake-form__fields {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .intake-form__fields > * {
      animation: intake-field-reveal 0.25s ease-out both;
    }

    .intake-form__fields > *:nth-child(1) { animation-delay: 0ms; }
    .intake-form__fields > *:nth-child(2) { animation-delay: 60ms; }
    .intake-form__fields > *:nth-child(3) { animation-delay: 120ms; }
    .intake-form__fields > *:nth-child(4) { animation-delay: 180ms; }
    .intake-form__fields > *:nth-child(5) { animation-delay: 240ms; }

    @keyframes intake-field-reveal {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .intake__treatment {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .intake__treatment h2 {
      font-family: var(--font-display);
      font-size: var(--text-lg);
      margin: 0;
    }

    .intake__actions {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
      align-items: center;
    }
  `,
})
export class IntakeTriage {
  private readonly router = inject(Router);
  private readonly admittedStore = inject(AdmittedAnimalsStore);
  private readonly dialog = inject(Dialog);

  protected readonly uploadedPhoto = signal<UploadedPhoto | undefined>(undefined);
  protected readonly surrenderRiskText = signal('');
  protected readonly completedSteps = signal<ReadonlySet<string>>(new Set());

  /** Triage (both the vision assessment and the surrender-risk read) only starts once
   * the photo AND the surrender-risk description are both present — neither resource
   * fires on its own. */
  private readonly triageInputs = computed(() => {
    const photo = this.uploadedPhoto();
    const situation = this.surrenderRiskText().trim();
    return photo && situation ? { photo, situation } : undefined;
  });

  protected readonly triageResource = httpResource<CaseFile>(() => {
    const inputs = this.triageInputs();
    if (!inputs) return undefined;
    return {
      url: '/api/intake-triage',
      method: 'POST',
      body: { photoBase64: inputs.photo.base64, mimeType: inputs.photo.mimeType },
    };
  });

  protected readonly surrenderRiskResource = httpResource<GuiltAnalysis>(() => {
    const inputs = this.triageInputs();
    if (!inputs) return undefined;
    return {
      url: '/api/surrender-analysis',
      method: 'POST',
      body: { submittedText: inputs.situation },
    };
  });

  protected readonly surrenderRiskError = computed(() => {
    const error = this.surrenderRiskResource.error();
    if (!error) return undefined;
    const body = (error as { error?: SurrenderRiskErrorBody })?.error?.error;
    return body ?? { code: 'UPSTREAM_ERROR', message: 'Something went wrong assessing surrender risk.' };
  });

  protected readonly surrenderRiskDisplay = computed(() => {
    if (this.surrenderRiskResource.isLoading()) return 'Assessing…';
    const value = this.surrenderRiskResource.value();
    return value ? `${value.guiltScore}/100 — ${value.message}` : '';
  });

  protected readonly triageError = computed(() => {
    const error = this.triageResource.error();
    if (!error) return undefined;
    const body = (error as { error?: TriageErrorBody })?.error?.error;
    return body ?? { code: 'UPSTREAM_ERROR', message: 'Something went wrong assessing that photo.' };
  });

  /** Resets to the newest resolved value whenever triageResource fires. The edits survive
   * re-renders unless the underlying resource value itself changes. */
  protected readonly caseFile = linkedSignal<CaseFile>(() => this.triageResource.value() ?? EMPTY_CASE_FILE);

  /** Template binds directly to each field's FieldState.value (e.g. [(value)]="intakeForm.species().value")
   * rather than importing Angular's own `Field`/`FormField` directives from '@angular/forms/signals' —
   * those names collide with this app's own `FormField` UI component (../../ui/form-field/form-field).
   * Don't "fix" this by importing Angular's FormField under an alias unless you also rename the local one. */
  protected readonly intakeForm = form(this.caseFile);

  /** huggabilityScore is a number field in the model but app-form-field only speaks string
   * values — this mirrors it as text and writes parsed edits straight back into the field's
   * own value signal, so the Signal Form (not this component) stays the single source of truth. */
  protected readonly scoreFieldText = computed(() => String(this.intakeForm.huggabilityScore().value()));

  protected onScoreInput(text: string): void {
    const parsed = Number(text);
    if (!Number.isNaN(parsed)) this.intakeForm.huggabilityScore().value.set(parsed);
  }

  protected async onPhotoSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.completedSteps.set(new Set());
    this.uploadedPhoto.set(await readFileAsBase64(file));
  }

  protected isStepDone(step: string): boolean {
    return this.completedSteps().has(step);
  }

  protected setStepDone(step: string, done: boolean): void {
    const next = new Set(this.completedSteps());
    if (done) next.add(step);
    else next.delete(step);
    this.completedSteps.set(next);
  }

  protected clear(): void {
    this.uploadedPhoto.set(undefined);
    this.surrenderRiskText.set('');
    this.completedSteps.set(new Set());
  }

  /** Confirms, then commits the reviewed case file to the roster as an under-repair animal.
   * ConfirmDialog is dynamically imported rather than statically imported at the top of this
   * file — it's only ever opened imperatively via `Dialog.open()`, never placed in a template,
   * so `@defer` can't gate it. A dynamic import is the equivalent for imperative usage: its
   * chunk is fetched on first click here instead of eagerly alongside this route's chunk. */
  protected async admit(): Promise<void> {
    const { ConfirmDialog } = await import('../../ui/confirm-dialog/confirm-dialog');
    const caseName = this.intakeForm.suggestedCaseName().value() || 'this case';
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      data: {
        title: 'Confirm admission',
        message: `This will admit ${caseName} to the shelter roster as under repair. Continue?`,
        confirmLabel: 'Admit',
        cancelLabel: 'Cancel',
      },
      ariaModal: true,
      ariaLabelledBy: 'confirm-dialog-title',
      ariaDescribedBy: 'confirm-dialog-message',
      backdropClass: 'app-dialog-backdrop',
    });

    ref.closed.subscribe((confirmed) => {
      if (!confirmed) return;
      this.admittedStore.admit(
        caseFileToUnderRepairAnimal({
          name: this.intakeForm.suggestedCaseName().value(),
          species: this.intakeForm.species().value(),
          condition: this.intakeForm.condition().value(),
        }),
      );
      this.router.navigate(['/roster']);
    });
  }
}
