import { Component, computed, input, model } from '@angular/core';

let nextId = 0;

/** Auto-growing textarea field — height always matches its content via the CSS
 * `field-sizing: content` property, no resize handle and no JS measuring needed. */
@Component({
  selector: 'app-textarea-field',
  imports: [],
  template: `
    <div class="textarea-field">
      <label [for]="id" class="textarea-field__label">{{ label() }}</label>
      <textarea
        [id]="id"
        [value]="value()"
        [readonly]="readonly()"
        (input)="onInput($event)"
        [attr.aria-describedby]="describedBy()"
        [attr.aria-invalid]="error() ? true : null"
        [placeholder]="placeholder()"
        class="textarea-field__input"
      ></textarea>
      @if (hint() && !error()) {
        <p [id]="hintId" class="textarea-field__hint">{{ hint() }}</p>
      }
      @if (error()) {
        <p [id]="errorId" class="textarea-field__error" role="alert">{{ error() }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .textarea-field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      font-family: var(--font-body);
    }

    .textarea-field__label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-ink);
    }

    .textarea-field__input {
      field-sizing: content;
      min-height: 2.5rem;
      width: 100%;
      font-family: var(--font-body);
      font-size: var(--text-base);
      color: var(--color-ink);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: var(--space-2) var(--space-3);
      resize: none;
    }

    .textarea-field__input[aria-invalid='true'] {
      border-color: var(--color-status-critical);
    }

    .textarea-field__hint {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--color-ink);
      opacity: 0.75;
    }

    .textarea-field__error {
      display: flex;
      align-items: baseline;
      gap: var(--space-1);
      margin: 0;
      font-size: var(--text-sm);
      color: var(--color-ink);
    }

    .textarea-field__error::before {
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
export class TextareaField {
  readonly label = input.required<string>();
  readonly hint = input<string>();
  readonly error = input<string>();
  readonly placeholder = input('');
  readonly readonly = input(false);
  readonly value = model('');

  protected readonly id = `textarea-field-${nextId++}`;
  protected readonly hintId = `${this.id}-hint`;
  protected readonly errorId = `${this.id}-error`;

  protected readonly describedBy = computed(() => {
    if (this.error()) return this.errorId;
    if (this.hint()) return this.hintId;
    return null;
  });

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLTextAreaElement).value);
  }
}
