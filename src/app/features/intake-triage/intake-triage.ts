import { Component, computed, linkedSignal, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { form } from '@angular/forms/signals';
import { Button } from '../../ui/button/button';
import { CaseFileCard } from '../../ui/case-file-card/case-file-card';
import { ChecklistItem } from '../../ui/checklist-item/checklist-item';
import { FormField } from '../../ui/form-field/form-field';
import { StatusBadge } from '../../ui/status-badge/status-badge';

interface CaseFile {
  species: string;
  condition: string;
  suggestedCaseName: string;
  huggabilityScore: number;
  recommendedTreatmentPlan: string[];
}

interface UploadedPhoto {
  base64: string;
  mimeType: string;
}

interface TriageErrorBody {
  error: { code: string; message: string };
}

const EMPTY_CASE_FILE: CaseFile = {
  species: '',
  condition: '',
  suggestedCaseName: '',
  huggabilityScore: 0,
  recommendedTreatmentPlan: [],
};

/** Strips the `data:<mime>;base64,` prefix FileReader adds — the backend wants raw base64. */
function readFileAsBase64(file: File): Promise<UploadedPhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ base64: (reader.result as string).split(',')[1], mimeType: file.type });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

@Component({
  selector: 'app-intake-triage',
  imports: [Button, CaseFileCard, ChecklistItem, FormField, StatusBadge],
  template: `
    <section class="intake">
      <h1>Intake Vision Triage</h1>

      <label class="intake__upload">
        <span>Upload a photo of the intake animal</span>
        <input type="file" accept="image/*" (change)="onPhotoSelected($event)" />
      </label>

      @if (triageResource.isLoading()) {
        <app-status-badge status="pending">Assessing photo…</app-status-badge>
      }

      @if (triageError(); as triageErr) {
        <app-status-badge status="critical">{{ triageErr.message }}</app-status-badge>
      }

      @if (triageResource.hasValue()) {
        <div class="intake__layout">
          <form class="intake-form">
            <div class="intake-form__fields">
              <app-form-field label="Species" [(value)]="intakeForm.species().value" />
              <app-form-field label="Condition" [(value)]="intakeForm.condition().value" />
              <app-form-field label="Case name" [(value)]="intakeForm.suggestedCaseName().value" />
              <app-form-field label="Huggability score" type="number" [value]="scoreFieldText()" (valueChange)="onScoreInput($event)" />
            </div>
          </form>

          <div class="intake__treatment">
            <h2>Recommended treatment plan</h2>
            @for (step of caseFile().recommendedTreatmentPlan; track step) {
              <app-checklist-item [label]="step" [checked]="isStepDone(step)" (checkedChange)="setStepDone(step, $event)" />
            }
          </div>

          <app-case-file-card
            [title]="intakeForm.suggestedCaseName().value() || 'Unnamed case'"
            [subtitle]="intakeForm.species().value() + ' · ' + intakeForm.condition().value()"
            [description]="'Huggability score: ' + scoreFieldText()"
          />
        </div>
      }

      <app-button type="button" (click)="clear()">Start over</app-button>
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

    .intake__upload {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
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

    .intake-form__fields > *:nth-child(1) {
      animation-delay: 0ms;
    }
    .intake-form__fields > *:nth-child(2) {
      animation-delay: 60ms;
    }
    .intake-form__fields > *:nth-child(3) {
      animation-delay: 120ms;
    }
    .intake-form__fields > *:nth-child(4) {
      animation-delay: 180ms;
    }

    @keyframes intake-field-reveal {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
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
  `,
})
export class IntakeTriage {
  protected readonly uploadedPhoto = signal<UploadedPhoto | undefined>(undefined);
  protected readonly completedSteps = signal<ReadonlySet<string>>(new Set());

  protected readonly triageResource = httpResource<CaseFile>(() => {
    const photo = this.uploadedPhoto();
    if (!photo) return undefined;
    return {
      url: '/api/intake-triage',
      method: 'POST',
      body: { photoBase64: photo.base64, mimeType: photo.mimeType },
    };
  });

  protected readonly triageError = computed(() => {
    const error = this.triageResource.error();
    if (!error) return undefined;
    const body = (error as { error?: TriageErrorBody })?.error?.error;
    return body ?? { code: 'UPSTREAM_ERROR', message: 'Something went wrong assessing that photo.' };
  });

  /** Resets to the newest resolved case file whenever a new triage completes, while
   * surviving unrelated re-renders in between — that's the whole point of linkedSignal
   * over a plain computed(): edits made via the form below aren't wiped by re-evaluation
   * unless the underlying resource value itself changes (AC-1.3). */
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
    this.completedSteps.set(new Set());
  }
}
