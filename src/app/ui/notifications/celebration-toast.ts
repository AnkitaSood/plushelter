import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-celebration-toast',
  host: {
    role: 'status',
    'aria-live': 'polite',
  },
  template: `
    <div class="toast toast--celebration">
      <div class="toast__paper">
        <h3 class="toast__heading">Placement Finalized</h3>
        <p class="toast__message">{{ message() }}</p>
        <div class="toast__actions">
          <button
            type="button"
            class="toast__action"
            (click)="viewCertificate.emit()"
          >
            View certificate
          </button>
          <button
            type="button"
            class="toast__dismiss"
            aria-label="Dismiss notification"
            (click)="dismissed.emit()"
          >
            ✕
          </button>
        </div>
      </div>
      <span class="toast__progress" aria-hidden="true"></span>
    </div>
  `,
  styles: `
    .toast {
      background: var(--color-celebration);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      padding: var(--space-3);
      min-width: 18rem;
      max-width: 24rem;
      position: relative;
    }

    .toast__paper {
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
      padding: var(--space-3);
    }

    .toast__heading {
      margin: 0 0 var(--space-2) 0;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--color-ink);
    }

    .toast__message {
      margin: 0 0 var(--space-3) 0;
      font-size: var(--text-base);
      color: var(--color-ink);
      line-height: 1.5;
      font-family: var(--font-body);
    }

    .toast__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      align-items: center;
    }

    .toast__action {
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
      color: var(--color-ink);
      cursor: pointer;
      font-family: var(--font-body);
      font-size: var(--text-sm);
      font-weight: 500;
      padding: var(--space-1) var(--space-3);
      transition: box-shadow 0.2s;
    }

    .toast__action:hover {
      box-shadow: var(--shadow-stacked);
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

    /* Ink, not pink — a pink bar on the pink frame would be invisible. */
    .toast__progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2px;
      background: var(--color-ink);
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
export class CelebrationToast {
  message = input.required<string>();
  viewCertificate = output<void>();
  dismissed = output<void>();
}
