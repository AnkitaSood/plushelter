import { PLATFORM_ID, Service, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'plushelter-theme';

/**
 * Single source of truth for the light/dark theme. Mirrors the inline bootstrap
 * script in index.html (which sets `data-theme` before Angular loads to avoid a
 * flash of the wrong theme) — this service takes over that attribute afterward
 * and is what the toggle component and any theme-aware code read/write through.
 */
@Service()
export class ThemeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly root = this.isBrowser ? document.documentElement : undefined;

  readonly theme = signal<Theme>(this.readInitial());

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this.theme.set(theme);
    this.root?.setAttribute('data-theme', theme);
    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }

  /** Reads whatever the inline bootstrap script already committed to the DOM/storage. */
  private readInitial(): Theme {
    if (!this.isBrowser) return 'light';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
}
