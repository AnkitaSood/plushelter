import { Component, inject } from '@angular/core';
import { ThemeService } from './theme.service';

/**
 * Nav-level theme toggle — a compact icon button showing a half-moon (light →
 * dark) or sun (dark → light).  Uses a real `<button>` with an `aria-label`
 * that announces the action ("Switch to Night Desk" / "Switch to Day Desk").
 */
@Component({
  selector: 'app-theme-toggle',
  template: `
    <button
      type="button"
      class="theme-btn"
      [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to Day Desk' : 'Switch to Night Desk'"
      (click)="theme.toggle()"
    >
      @if (theme.theme() === 'dark') {
        <!-- Sun icon — current theme is dark, clicking switches to light -->
        <svg class="theme-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1"  x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1"  y1="12" x2="3"  y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22" />
        </svg>
      } @else {
        <!-- Half-moon icon — current theme is light, clicking switches to dark -->
        <svg class="theme-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      }
    </button>
  `,
  styles: `
    .theme-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      padding: var(--space-2);
      border-radius: var(--radius-sm);
      color: var(--color-ink);
      transition: background 150ms ease-out;
    }

    .theme-btn:hover {
      background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    }

    .theme-btn:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: 2px;
    }

    .theme-btn__icon {
      width: 1.25rem;
      height: 1.25rem;
    }

    @media (prefers-reduced-motion: reduce) {
      .theme-btn {
        transition: none;
      }
    }
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
}

