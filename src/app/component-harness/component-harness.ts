import { Component, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Button } from '../ui/button/button';
import { FormField } from '../ui/form-field/form-field';
import { StatusBadge } from '../ui/status-badge/status-badge';
import { ChecklistItem } from '../ui/checklist-item/checklist-item';
import { ChatBubble } from '../ui/chat-bubble/chat-bubble';
import { CaseFileCard } from '../ui/case-file-card/case-file-card';
import { ConfirmDialog } from '../ui/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-component-harness',
  imports: [Button, FormField, StatusBadge, ChecklistItem, ChatBubble, CaseFileCard],
  templateUrl: './component-harness.html',
  styleUrl: './component-harness.css',
})
export class ComponentHarness {
  private readonly dialog = inject(Dialog);

  protected readonly caseFileEmail = signal('');
  protected readonly treatmentDone = signal(false);
  protected readonly dialogResult = signal<'confirmed' | 'cancelled' | null>(null);

  protected openAdoptDialog(): void {
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      data: {
        title: 'Confirm adoption',
        message: 'This will finalize the adoption record for Horace. Continue?',
        confirmLabel: 'Adopt',
        cancelLabel: 'Cancel',
      },
      ariaModal: true,
      ariaLabelledBy: 'confirm-dialog-title',
      ariaDescribedBy: 'confirm-dialog-message',
      backdropClass: 'app-dialog-backdrop',
    });

    ref.closed.subscribe((result) => {
      this.dialogResult.set(result ? 'confirmed' : 'cancelled');
    });
  }
}
