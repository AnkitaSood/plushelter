import { Component, computed, input, model } from '@angular/core';

let nextId = 0;

@Component({
  selector: 'app-form-field',
  imports: [],
  template: `
    <div class="form-field">
      <label [for]="id" class="form-field__label">{{ label() }}</label>
      <input
        [id]="id"
        [type]="type()"
        [value]="value()"
        (input)="onInput($event)"
        [attr.aria-describedby]="describedBy()"
        [attr.aria-invalid]="error() ? true : null"
        class="form-field__input"
      />
      @if (hint() && !error()) {
        <p [id]="hintId" class="form-field__hint">{{ hint() }}</p>
      }
      @if (error()) {
        <p [id]="errorId" class="form-field__error" role="alert">{{ error() }}</p>
      }
    </div>
  `,
  styles: `
    .form-field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      font-family: var(--font-body);
    }

    .form-field__label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-ink);
    }

    .form-field__input {
      font-family: var(--font-body);
      font-size: var(--text-base);
      color: var(--color-ink);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: var(--space-2) var(--space-3);
    }

    .form-field__input[aria-invalid='true'] {
      border-color: var(--color-status-critical);
    }

    .form-field__hint {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--color-ink);
      opacity: 0.75;
    }

    .form-field__error {
      display: flex;
      align-items: baseline;
      gap: var(--space-1);
      margin: 0;
      font-size: var(--text-sm);
      color: var(--color-ink);
    }

    .form-field__error::before {
      content: '!';
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1rem;
      height: 1rem;
      flex-shrink: 0;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-weight: 700;
      color: var(--color-ink);
      background: var(--color-status-critical);
      border-radius: var(--radius-sm);
    }
  `,
})
export class FormField {
  readonly label = input.required<string>();
  readonly type = input('text');
  readonly hint = input<string>();
  readonly error = input<string>();
  readonly value = model('');

  protected readonly id = `form-field-${nextId++}`;
  protected readonly hintId = `${this.id}-hint`;
  protected readonly errorId = `${this.id}-error`;

  protected readonly describedBy = computed(() => {
    if (this.error()) return this.errorId;
    if (this.hint()) return this.hintId;
    return null;
  });

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
