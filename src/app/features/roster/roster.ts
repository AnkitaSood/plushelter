import { Component, computed, debounced, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CaseFileCard } from '../../ui/case-file-card/case-file-card';
import { FormField } from '../../ui/form-field/form-field';
import { StatusBadge, type StatusBadgeStatus } from '../../ui/status-badge/status-badge';
import { Animal, MOCK_ANIMALS } from '../../data/roster';
import { AdmittedAnimalsStore } from '../../data/admitted-animals-store';
import { AdoptedAnimalsStore } from '../../data/adopted-animals-store';
import { Button } from '../../ui/button/button';
import type { RosterSearchErrorBody, RosterSearchResult } from './roster-search.model';

@Component({
  imports: [Button, CaseFileCard, FormField, StatusBadge],
  template: `
    <section class="roster">
      <h1>Active Case Roster</h1>
      <p class="roster__intro">
        Animals currently on file. Select a cleared case to begin adoption.
      </p>

      <div class="roster__search">
        <app-form-field
          label="Search the roster"
          hint="Describe the companion you're after — our concierge reads the whole roster."
          [(value)]="searchQuery"
        />
        <div class="roster__search-status" aria-live="polite">
          @if (isDebouncing()) {
            <app-status-badge status="info">Debouncing…</app-status-badge>
          } @else if (searchResults.isLoading()) {
            <app-status-badge status="info">Searching the roster…</app-status-badge>
          } @else if (searchError(); as err) {
            <app-status-badge status="critical">{{ err.message }}</app-status-badge>
            <app-button type="button" variant="secondary" (click)="searchResults.reload()">Retry</app-button>
          } @else if (isSearchActive()) {
            <app-status-badge status="available">{{ displayedAnimals().length }} match(es)</app-status-badge>
          }
        </div>
      </div>

      <div class="roster__filters">
        <label class="roster__filter-label">
          <span class="roster__filter-name">Species</span>
          <select
            class="roster__select"
            [value]="speciesFilter()"
            (change)="speciesFilter.set($any($event.target).value)"
          >
            <option value="">All species</option>
            @for (s of speciesOptions(); track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
        </label>

        <label class="roster__filter-label">
          <span class="roster__filter-name">Status</span>
          <select
            class="roster__select"
            [value]="statusFilter()"
            (change)="statusFilter.set($any($event.target).value)"
          >
            <option value="all">All statuses</option>
            <option value="available">Cleared for placement</option>
          </select>
        </label>
      </div>

      @if (displayedAnimals().length === 0) {
        <p class="roster__empty">
          @if (isSearchActive()) {
            No cleared cases match that search.
          } @else {
            No cases match the current filters.
          }
        </p>
      }

      <div class="roster__grid">
        @for (item of displayedAnimals(); track item.animal.id) {
          @defer (on viewport) {
            <app-case-file-card
              [title]="item.animal.name"
              [subtitle]="item.animal.species + ' · ' + item.animal.condition"
              [description]="item.animal.backstory"
              [imageUrl]="item.animal.photoUrl"
              [clickable]="item.animal.available && !adoptedStore.isAdopted(item.animal.id)"
              (activated)="beginAdoption(item.animal)"
            >
              <app-status-badge [status]="badgeStatus(item.animal)">
                {{ statusLabel(item.animal) }}
              </app-status-badge>
              @if (item.reason) {
                <p class="roster__match-reason">{{ item.reason }}</p>
              }
            </app-case-file-card>
          } @placeholder {
            <div class="roster__card-placeholder"></div>
          }
        }
      </div>
    </section>
  `,
  styles: `
    .roster {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      max-width: 56rem;
      margin-inline: auto;
      padding: var(--space-5);
      font-family: var(--font-body);
      color: var(--color-ink);
    }

    .roster__intro {
      margin: 0;
    }

    .roster__search {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .roster__search-status {
      display: flex;
      gap: var(--space-2);
      min-height: 1.75rem;
      align-items: center;
    }

    .roster__match-reason {
      margin: var(--space-2) 0 0;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      line-height: 1.4;
      opacity: 0.8;
    }

    .roster__filters {
      display: flex;
      gap: var(--space-4);
      flex-wrap: wrap;
    }

    .roster__filter-label {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .roster__filter-name {
      font-family: var(--font-mono);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .roster__select {
      font-family: var(--font-body);
      font-size: var(--text-base);
      color: var(--color-ink);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
    }

    .roster__select:focus {
      outline: 3px solid var(--color-primary);
      outline-offset: 2px;
    }

    .roster__empty {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.6;
    }

    .roster__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
      gap: var(--space-4);
    }

    .roster__card-placeholder {
      width: 100%;
      min-height: 16rem;
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
    }
  `,
})
export class Roster {
  private readonly router = inject(Router);
  private readonly admittedStore = inject(AdmittedAnimalsStore);
  protected readonly adoptedStore = inject(AdoptedAnimalsStore);

  protected readonly speciesFilter = signal<string>('');
  protected readonly statusFilter = signal<'all' | 'available'>('all');

  /** Free-text search box. Every keystroke lands here immediately… */
  protected readonly searchQuery = signal('');

  /** …but `debounced()` gives us a *Resource* whose value only catches up to `searchQuery`
   * after 400ms of quiet. We drive the network search off the debounced value, not the raw
   * one, so we don't fire a Gemini call on every keystroke. */
  protected readonly debouncedQuery = debounced(this.searchQuery, 400);

  /** The debounce window made visible: true while the raw box is ahead of the settled value. */
  protected readonly isDebouncing = computed(() => {
    const raw = this.searchQuery().trim();
    return raw.length > 0 && raw !== (this.debouncedQuery.value() ?? '').trim();
  });

  /** Plain `resource()` — the one signals primitive the rest of the app doesn't use. Idle while
   * the debounced query is empty; otherwise loads AI matches, cancelling a superseded request
   * via `abortSignal` when the debounced value changes again mid-flight. */
  protected readonly searchResults = resource({
    params: () => {
      const q = (this.debouncedQuery.value() ?? '').trim();
      return q.length > 0 ? q : undefined;
    },
    loader: async ({ params, abortSignal }) => {
      const res = await fetch('/api/roster-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: params }),
        signal: abortSignal,
      });
      if (!res.ok) {
        const body: RosterSearchErrorBody | undefined = await res.json().catch(() => undefined);
        throw new Error(body?.error?.message ?? `Search failed (${res.status})`);
      }
      return (await res.json()) as RosterSearchResult;
    },
  });

  protected readonly searchError = computed(() => {
    const err = this.searchResults.error();
    if (!err) return undefined;
    return { message: err instanceof Error ? err.message : 'Something went wrong searching the roster.' };
  });

  /** A search is "active" once the debounced query is non-empty — even while loading — so the
   * grid switches from browse-mode into search-mode results. */
  protected readonly isSearchActive = computed(() => (this.debouncedQuery.value() ?? '').trim().length > 0);

  protected readonly speciesOptions = computed(() =>
    [...new Set([...MOCK_ANIMALS, ...this.admittedStore.admitted()].map((a) => a.species))].sort(),
  );

  /** Browse-mode list: the mock roster + this session's admitted cases, narrowed by the dropdowns. */
  protected readonly filteredAnimals = computed(() =>
    [...MOCK_ANIMALS, ...this.admittedStore.admitted()]
      .filter((a) => !this.speciesFilter() || a.species === this.speciesFilter())
      .filter((a) => this.statusFilter() === 'all' || a.available),
  );

  /** What the grid actually renders. In browse-mode it's `filteredAnimals` with no reason.
   * In search-mode the AI matches (ordered by relevance) are intersected with the dropdown
   * filters — search layers on top of the filters rather than replacing them — and each row
   * carries the concierge's one-line reason. */
  protected readonly displayedAnimals = computed<{ animal: Animal; reason?: string }[]>(() => {
    const base = this.filteredAnimals();
    if (!this.isSearchActive() || !this.searchResults.hasValue()) {
      return base.map((animal) => ({ animal }));
    }
    const byId = new Map(base.map((a) => [a.id, a]));
    return this.searchResults
      .value()
      .matches.filter((m) => byId.has(m.id))
      .map((m) => ({ animal: byId.get(m.id)!, reason: m.reason }));
  });

  protected statusLabel(animal: Animal): string {
    const adopterName = this.adoptedStore.getAdopterName(animal.id);
    if (adopterName) return `Adopted by ${adopterName}`;
    if (animal.photosPending) return 'Photos pending';
    if (animal.underRepair) return 'Under repair — check back soon';
    return animal.available ? 'Cleared for placement' : 'Pending clearance';
  }

  protected badgeStatus(animal: Animal): StatusBadgeStatus {
    if (this.adoptedStore.isAdopted(animal.id)) return 'celebration';
    return animal.available ? 'available' : 'pending';
  }

  protected beginAdoption(animal: Animal): void {
    this.router.navigate(['/adopt'], { state: animal });
  }
}
