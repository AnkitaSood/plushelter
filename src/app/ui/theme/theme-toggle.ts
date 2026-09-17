import { Component, inject } from '@angular/core';
import { ThemeService } from './theme.service';

/**
 * Nav-level theme switch. A real checkbox under a switch-shaped visual layer —
 * same accessibility pattern as ChecklistItem — with the current/target state
 * spelled out in the label so the control's meaning never depends on color
 * alone ("Night Desk" while dark, "Day Desk" while light).
 */
@Component({
  selector: 'app-theme-toggle',
  template: `
    <label class="theme-toggle">
      <input
        type="checkbox"
        class="visually-hidden"
        [checked]="theme.theme() === 'dark'"
        (change)="theme.toggle()"
      />
      <span class="theme-toggle__track" aria-hidden="true">
        <span class="theme-toggle__thumb"></span>
      </span>
      <span class="theme-toggle__label">{{ theme.theme() === 'dark' ? 'Night Desk' : 'Day Desk' }}</span>
    </label>
  `,
  styles: `
    .theme-toggle {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      cursor: pointer;
      font-family: var(--font-mono);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-ink);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      border: var(--border-width) solid transparent;
      transition: background 150ms ease-out;
    }

    .theme-toggle:hover {
      background: color-mix(in srgb, var(--color-primary) 25%, transparent);
    }

    .theme-toggle__track {
      position: relative;
      width: 2.5rem;
      height: 1.25rem;
      flex-shrink: 0;
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
    }

    .theme-toggle__thumb {
      position: absolute;
      top: 1px;
      left: 1px;
      width: 0.75rem;
      height: 0.75rem;
      background: var(--color-ink);
      border-radius: var(--radius-sm);
      transition: transform 150ms ease-out;
    }

    .theme-toggle input:checked ~ .theme-toggle__track .theme-toggle__thumb {
      transform: translateX(1.15rem);
    }

    .theme-toggle input:focus-visible ~ .theme-toggle__track {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      .theme-toggle__thumb,
      .theme-toggle {
        transition: none;
      }
    }
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
}
