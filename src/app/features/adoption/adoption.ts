import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { form } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { NotificationService } from '../../ui/notifications/notification.service';
import { Button } from '../../ui/button/button';
import { CaseFileCard } from '../../ui/case-file-card/case-file-card';
import { FormField } from '../../ui/form-field/form-field';
import { StatusBadge } from '../../ui/status-badge/status-badge';
import { TextareaField } from '../../ui/textarea-field/textarea-field';
import { CritterLoader } from '../../ui/critter-loader/critter-loader';
import type { Animal } from '../../data/roster';
import { AdoptedAnimalsStore } from '../../data/adopted-animals-store';
import {
  EMPTY_APPLICATION,
  type AdoptionApplication,
  type AdoptionCertificate,
  type AdoptionCertificateErrorBody,
} from './adoption.model';

@Component({
  imports: [Button, CaseFileCard, FormField, StatusBadge, TextareaField, CritterLoader],
  template: `
    <section class="adoption">
      <h1>Adoption Application</h1>

      @if (animal(); as a) {
        @if (!certificateResource.value()) {
          <div class="adoption__review">
            <p class="adoption__intro">
              Reviewing {{ a.name }}'s case file one last time before this placement is finalized.
            </p>

            <app-case-file-card
              [title]="a.name"
              [subtitle]="a.species + ' · ' + a.condition"
              [description]="a.backstory"
              [imageUrl]="a.photoUrl"
            />

            <form class="adoption-form">
              <div class="adoption-form__fields">
                <app-form-field label="Adopter name" [(value)]="applicationForm.adopterName().value" />
                <app-textarea-field
                  label="Household note"
                  [(value)]="applicationForm.householdNote().value"
                  placeholder="Anything this animal should know about its new household?"
                />
              </div>
            </form>

            @if (certificateResource.isLoading()) {
              <div class="adoption__loading">
                <app-critter-loader />
                <p class="adoption__loading-text">Filing adoption paperwork</p>
              </div>
            }

            @if (certificateError(); as err) {
              <div class="adoption__error" role="alert">
                <app-status-badge status="critical">{{ err.message }}</app-status-badge>
                <app-button type="button" variant="secondary" (click)="certificateResource.reload()">Retry</app-button>
              </div>
            }

            <div class="adoption__actions">
              <app-button type="button" variant="secondary" (click)="backToRoster()">← Back to Roster</app-button>
              <app-button
                type="button"
                [disabled]="!canSubmit() || certificateResource.isLoading()"
                (click)="confirmAdoption(a)"
              >
                Confirm Adoption
              </app-button>
            </div>
          </div>
        } @else {
          <div #certificate class="adoption__certificate">
            <div class="adoption__certificate-frame">
              <div class="adoption__certificate-paper">
                <div class="adoption__certificate-heading">
                  <app-status-badge status="celebration">Adopted!</app-status-badge>
                  <p class="adoption__certificate-case">Case No. {{ a.id }} · Placement Finalized</p>
                </div>
                <p class="adoption__certificate-text">{{ certificateResource.value()?.certificateText }}</p>
              </div>
            </div>
            <div class="adoption__actions">
              <app-button type="button" (click)="backToRoster()">Back to Roster</app-button>
            </div>
          </div>
        }
      }
    </section>
  `,
  styles: `
    .adoption {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      max-width: 40rem;
      margin-inline: auto;
      padding: var(--space-5);
      font-family: var(--font-body);
      color: var(--color-ink);
    }

    .adoption__review {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .adoption__intro {
      margin: 0;
    }

    .adoption-form__fields {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .adoption-form__fields > * {
      animation: adoption-field-reveal 0.25s ease-out both;
    }

    .adoption-form__fields > *:nth-child(1) { animation-delay: 0ms; }
    .adoption-form__fields > *:nth-child(2) { animation-delay: 60ms; }

    @keyframes adoption-field-reveal {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .adoption__loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
    }

    .adoption__loading-text {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.75;
    }

    .adoption__error {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
      align-items: center;
    }

    /* The one deliberate Adoption Pink moment in the app — reserved exclusively for a
     * successful placement (DESIGN.md §2). The pink frame stays; the certificate text
     * itself sits on Form White so it reads as a document, not a colored panel of prose. */
    .adoption__certificate {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .adoption__certificate-frame {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-3);
      background: var(--color-celebration);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      padding: var(--space-5);
      animation: certificate-reveal 0.3s ease-out both;
    }

    .adoption__certificate-paper {
      width: 100%;
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
      padding: var(--space-4);
    }

    .adoption__certificate-heading {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
    }

    .adoption__certificate-case {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.75;
    }

    .adoption__certificate-text {
      margin: 0;
    }

    @keyframes certificate-reveal {
      from { opacity: 0; transform: scale(0.98); }
      to   { opacity: 1; transform: scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .adoption-form__fields > *,
      .adoption__certificate-frame {
        animation: none;
      }
    }

    .adoption__actions {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
      align-items: center;
    }
  `,
})
export class AdoptionFlow {
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly adoptedStore = inject(AdoptedAnimalsStore);
  private readonly notifications = inject(NotificationService);
  private readonly certificate = viewChild<ElementRef<HTMLElement>>('certificate');

  /** Arrives the same way Intake Triage's roster branch used to read it — via nav `state` —
   * but is required here: this route only makes sense arriving from a roster click. */
  protected readonly animal = signal<Animal | undefined>(
    'id' in (history.state ?? {}) ? (history.state as Animal) : undefined,
  );

  protected readonly applicationForm = form(signal<AdoptionApplication>(EMPTY_APPLICATION));

  protected readonly canSubmit = computed(() => this.applicationForm.adopterName().value().trim().length > 0);

  private readonly submittedApplication = signal<AdoptionApplication | undefined>(undefined);

  protected readonly certificateResource = httpResource<AdoptionCertificate>(() => {
    const application = this.submittedApplication();
    const animal = this.animal();
    if (!application || !animal) return undefined;
    return {
      url: '/api/adoption-certificate',
      method: 'POST',
      body: { animal, application },
    };
  });

  protected readonly certificateError = computed(() => {
    const error = this.certificateResource.error();
    if (!error) return undefined;
    const body = (error as { error?: AdoptionCertificateErrorBody })?.error?.error;
    return body ?? { code: 'UPSTREAM_ERROR', message: 'Something went wrong finalizing this placement.' };
  });

  constructor() {
    if (!this.animal()) this.router.navigate(['/roster']);

    // The rare Adoption-Pink celebration toast — fired the moment the certificate resolves.
    effect(() => {
      if (this.certificateResource.status() === 'resolved') {
        this.notifications.celebrate(
          `${this.animal()?.name ?? 'This companion'} has been placed. Certificate on file.`,
          {
            onView: () => this.certificate()?.nativeElement.scrollIntoView({ behavior: 'smooth' }),
          },
        );
      }
    });

  }

  /** Confirms, then commits the adoption and kicks off the certificate resource. ConfirmDialog
   * is dynamically imported rather than statically imported at the top of this file — same
   * rationale as IntakeTriage.admit(): it's only ever opened imperatively via `Dialog.open()`. */
  protected async confirmAdoption(animal: Animal): Promise<void> {
    const adopterName = this.applicationForm.adopterName().value().trim();
    const { ConfirmDialog } = await import('../../ui/confirm-dialog/confirm-dialog');
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      data: {
        title: 'Confirm adoption',
        message: `This will finalize the adoption of ${animal.name} by ${adopterName}. Continue?`,
        confirmLabel: 'Adopt',
        cancelLabel: 'Cancel',
      },
      ariaModal: true,
      ariaLabelledBy: 'confirm-dialog-title',
      ariaDescribedBy: 'confirm-dialog-message',
      backdropClass: 'app-dialog-backdrop',
    });

    ref.closed.subscribe((confirmed) => {
      if (!confirmed) return;
      this.adoptedStore.adopt(animal.id, adopterName);
      this.submittedApplication.set({
        adopterName,
        householdNote: this.applicationForm.householdNote().value(),
      });
    });
  }

  protected backToRoster(): void {
    this.router.navigate(['/roster']);
  }
}
