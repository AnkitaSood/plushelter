import { Component, input, model } from '@angular/core';

@Component({
  selector: 'app-checklist-item',
  template: `
    <label class="checklist-item">
      <input
        type="checkbox"
        class="visually-hidden"
        [checked]="checked()"
        [disabled]="disabled()"
        (change)="onChange($event)"
      />
      <span class="checklist-item__box" aria-hidden="true"></span>
      <span class="checklist-item__label">{{ label() }}</span>
    </label>
  `,
  styles: `
    .checklist-item {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      cursor: pointer;
      font-family: var(--font-body);
      color: var(--color-ink);
    }

    .checklist-item__box {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      flex-shrink: 0;
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
      background: var(--color-bg);
    }

    .checklist-item__box::after {
      content: '';
      width: 0.6rem;
      height: 0.35rem;
      border-left: 2px solid var(--color-ink);
      border-bottom: 2px solid var(--color-ink);
      transform: rotate(-45deg) translateY(-1px);
      opacity: 0;
    }

    .checklist-item input:checked ~ .checklist-item__box {
      background: var(--color-status-available);
    }

    .checklist-item input:checked ~ .checklist-item__box::after {
      opacity: 1;
    }

    .checklist-item input:focus-visible ~ .checklist-item__box {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: 2px;
    }

    .checklist-item:has(input:disabled) {
      cursor: not-allowed;
      opacity: 0.5;
    }
  `,
})
export class ChecklistItem {
  readonly label = input.required<string>();
  readonly disabled = input(false);
  readonly checked = model(false);

  protected onChange(event: Event): void {
    this.checked.set((event.target as HTMLInputElement).checked);
  }
}
