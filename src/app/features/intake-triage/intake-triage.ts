import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { form } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { Tabs, TabList, Tab, TabPanel, TabContent } from '@angular/aria/tabs';
import { NotificationService } from '../../ui/notifications/notification.service';
import { Button } from '../../ui/button/button';
import { ChecklistItem } from '../../ui/checklist-item/checklist-item';
import { FormField } from '../../ui/form-field/form-field';
import { StatusBadge } from '../../ui/status-badge/status-badge';
import { TextareaField } from '../../ui/textarea-field/textarea-field';
import { CritterLoader } from '../../ui/critter-loader/critter-loader';
import { SurrenderFlow } from './surrender-flow';
import type { Animal } from '../../data/roster';
import { UNDER_REPAIR_PLACEHOLDER } from '../../data/roster';
import { AdmittedAnimalsStore } from '../../data/admitted-animals-store';
import {
  EMPTY_CASE_FILE,
  type CaseFile,
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
  imports: [
    Button,
    ChecklistItem,
    FormField,
    StatusBadge,
    TextareaField,
    CritterLoader,
    Tabs,
    TabList,
    Tab,
    TabPanel,
    TabContent,
    SurrenderFlow,
  ],
  template: `
    <section class="intake">
      <h1>Intake / Surrender</h1>
      <p class="intake__intro">
        Bring a stuffed animal into S.A.R.F. either way: upload a photo or file a surrender if you don't have a photo yet.
      </p>

      <div ngTabs class="intake__tabs">
        <ul ngTabList [(selectedTab)]="mode" class="intake__tablist" aria-label="Intake method">
          <li ngTab value="photo" class="intake__tab">Intake</li>
          <li ngTab value="surrender" class="intake__tab">Surrender</li>
        </ul>

        <div ngTabPanel value="photo" class="intake__panel">
          <ng-template ngTabContent>
            <div class="intake__upload">
              <input #fileInput type="file" accept="image/*" class="intake__file-input" (change)="onPhotoSelected($event)" />
              <app-button type="button" (click)="fileInput.click()">Upload a photo</app-button>
            </div>

            @if (triageResource.isLoading()) {
              <div class="intake__loading">
                <app-critter-loader />
                <p class="intake__loading-text">Triaging image</p>
              </div>
            }

            @if (triageError(); as triageErr) {
              <div class="intake__error" role="alert">
                <app-status-badge status="critical">{{ triageErr.message }}</app-status-badge>
                <app-button type="button" variant="secondary" (click)="triageResource.reload()">Retry</app-button>
              </div>
            }

            @if (triageResource.hasValue()) {
              <div class="intake__layout">
                <form class="intake-form">
                  <div class="intake-form__fields">
                    <app-form-field label="Species" [(value)]="intakeForm.species().value" />
                    <app-textarea-field label="Condition" [(value)]="intakeForm.condition().value" />
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
          </ng-template>
        </div>

        <div ngTabPanel value="surrender" class="intake__panel">
          <ng-template ngTabContent>
            <app-surrender-flow />
          </ng-template>
        </div>
      </div>
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

    .intake__tabs {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .intake__tablist {
      display: flex;
      gap: var(--space-1);
      margin: 0;
      padding: 0;
      list-style: none;
      border-bottom: var(--border-width) solid var(--border-color);
    }

    .intake__tab {
      padding: var(--space-2) var(--space-4);
      margin-bottom: calc(-1 * var(--border-width));
      font-family: var(--font-body);
      font-size: var(--text-base);
      color: var(--color-ink);
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      user-select: none;
    }

    .intake__tab[aria-selected='true'] {
      border-bottom-color: var(--color-primary);
      font-weight: 600;
    }

    .intake__tab:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: 2px;
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

    .intake__error {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
      align-items: center;
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
  private readonly notifications = inject(NotificationService);

  /** Selected intake method, two-way bound to the aria TabList. Seeds the photo tab as the default. */
  protected readonly mode = signal<string | undefined>('photo');

  protected readonly uploadedPhoto = signal<UploadedPhoto | undefined>(undefined);
  protected readonly completedSteps = signal<ReadonlySet<string>>(new Set());

  /** Photo-only now: triage fires the moment a photo is present and re-fires on a newer upload.
   * Returning `undefined` while there's no photo keeps the request from firing and, per httpResource,
   * cancels a superseded in-flight request when the photo signal changes again (AC-1.2). */
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
      // Fired before navigating away — the toast is created on document.body, so it outlives
      // this route component being destroyed and is still visible on the roster page.
      this.notifications.info(`${caseName} admitted to the roster as under repair.`);
      this.router.navigate(['/roster']);
    });
  }
}
