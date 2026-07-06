import { Component, input } from '@angular/core';

export type StatusBadgeStatus = 'available' | 'critical' | 'pending' | 'info' | 'celebration' | 'tag';

@Component({
  selector: 'app-status-badge',
  imports: [],
  template: `
    <span class="badge" [class]="'badge--' + status()" role="status">
      <ng-content />
    </span>
  `,
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-ink);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: var(--space-1) var(--space-2);
    }

    .badge--available {
      background: var(--color-status-available);
    }

    .badge--critical {
      background: var(--color-status-critical);
    }

    .badge--pending {
      background: var(--color-status-pending);
    }

    .badge--info {
      background: var(--color-info);
    }

    .badge--celebration {
      background: var(--color-celebration);
    }

    .badge--tag {
      background: var(--color-badge);
    }
  `,
})
export class StatusBadge {
  readonly status = input<StatusBadgeStatus>('available');
}
