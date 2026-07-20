import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-info-toast',
  host: {
    role: 'status',
    'aria-live': 'polite',
  },
  template: `
    <div class="toast toast--info">
      <p class="toast__message">{{ message() }}</p>
      <div class="toast__actions">
        <button
          type="button"
          class="toast__dismiss"
          aria-label="Dismiss notification"
          (click)="dismissed.emit()"
        >
          ✕
        </button>
      </div>
      <span class="toast__progress" aria-hidden="true"></span>
    </div>
  `,
  styles: `
    .toast {
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
      font-family: var(--font-body);
      padding: var(--space-3) var(--space-4);
      min-width: 18rem;
      max-width: 24rem;
      position: relative;
      border-left: 4px solid var(--color-info);
    }

    .toast__message {
      margin: 0;
      font-size: var(--text-base);
      color: var(--color-ink);
      line-height: 1.5;
    }

    .toast__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }

    .toast__dismiss {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-ink);
      font-size: var(--text-base);
      padding: 0 var(--space-1);
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .toast__dismiss:hover {
      opacity: 1;
    }

    .toast__progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2px;
      background: var(--color-info);
      display: block;
      border-radius: 0 0 var(--radius-md) 0;
    }

    @media (prefers-reduced-motion: no-preference) {
      .toast__progress {
        animation: shrink linear var(--dismiss-ms, 5000ms) forwards;
      }

      @keyframes shrink {
        from {
          width: 100%;
        }
        to {
          width: 0%;
        }
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .toast__progress {
        animation: none;
      }
    }
  `,
})
export class InfoToast {
  message = input.required<string>();
  dismissed = output<void>();
}
