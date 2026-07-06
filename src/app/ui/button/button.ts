import { Component, input } from '@angular/core';

@Component({
  selector: 'app-button',
  imports: [],
  template: `
    <button class="btn" [class.btn--secondary]="variant() === 'secondary'" [type]="type()" [disabled]="disabled()">
      <ng-content />
    </button>
  `,
  styles: `
    :host {
      display: inline-block;
    }

    .btn {
      font-family: var(--font-display);
      font-size: var(--text-base);
      font-weight: 600;
      color: var(--color-ink);
      background: var(--color-primary);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
      padding: var(--space-2) var(--space-4);
      cursor: pointer;
      transition:
        transform 0.1s ease,
        box-shadow 0.1s ease;
    }

    .btn--secondary {
      background: var(--color-secondary);
    }

    .btn:active:not(:disabled) {
      transform: translate(2px, 2px);
      box-shadow: none;
    }

    .btn:disabled {
      cursor: not-allowed;
      opacity: 0.5;
      box-shadow: none;
    }
  `,
})
export class Button {
  readonly variant = input<'primary' | 'secondary'>('primary');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false);
}
