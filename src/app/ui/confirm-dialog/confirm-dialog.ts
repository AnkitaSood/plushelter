import { Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Button } from '../button/button';

export interface ConfirmDialogData {
  title: string;
  message: string;
  detail?: {
    label: string;
    value: string;
  };
  confirmLabel?: string;
  cancelLabel?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [Button],
  template: `
    <h2 [id]="titleId" class="confirm-dialog__title">{{ data.title }}</h2>
    <div [id]="messageId" class="confirm-dialog__content">
      <p class="confirm-dialog__message">{{ data.message }}</p>
      @if (data.detail; as detail) {
        <dl class="confirm-dialog__detail">
          <dt>{{ detail.label }}</dt>
          <dd>{{ detail.value }}</dd>
        </dl>
      }
    </div>
    <div class="confirm-dialog__actions">
      <app-button variant="secondary" (click)="dialogRef.close(false)">
        {{ data.cancelLabel ?? 'Cancel' }}
      </app-button>
      <app-button (click)="dialogRef.close(true)">
        {{ data.confirmLabel ?? 'Confirm' }}
      </app-button>
    </div>
  `,
  styles: `
    :host {
      display: block;
      max-width: 24rem;
      font-family: var(--font-body);
      color: var(--color-ink);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
      padding: var(--space-5);
    }

    .confirm-dialog__title {
      font-family: var(--font-display);
      font-size: var(--text-xl);
      margin: 0 0 var(--space-3);
    }

    .confirm-dialog__content {
      margin: 0 0 var(--space-5);
    }

    .confirm-dialog__message {
      margin: 0;
    }

    .confirm-dialog__detail {
      margin: var(--space-4) 0 0;
      padding: var(--space-3);
      background: var(--color-info);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
    }

    .confirm-dialog__detail dt {
      margin-bottom: var(--space-1);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .confirm-dialog__detail dd {
      margin: 0;
    }

    .confirm-dialog__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
    }
  `,
})
export class ConfirmDialog {
  protected readonly dialogRef = inject(DialogRef<boolean>);
  protected readonly data = inject<ConfirmDialogData>(DIALOG_DATA);

  // Fixed ids, not derived from `dialogRef.id`: the caller needs the same id
  // up front to set `ariaLabelledBy`/`ariaDescribedBy` in the `Dialog.open()`
  // config, before the dialog (and its ref) exist. One confirm dialog is ever
  // open at a time in this app, so a fixed id is correct, not a shortcut.
  protected readonly titleId = 'confirm-dialog-title';
  protected readonly messageId = 'confirm-dialog-message';
}
