import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { CaseFileCard } from '../../ui/case-file-card/case-file-card';
import { StatusBadge } from '../../ui/status-badge/status-badge';
import { Animal, MOCK_ANIMALS } from '../../data/roster';

@Component({
  selector: 'app-roster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaseFileCard, StatusBadge],
  template: `
    <section class="roster">
      <h1>Active Case Roster</h1>
      <p class="roster__intro">
        Animals currently on file. Select a cleared case to begin placement intake.
      </p>

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

      @if (filteredAnimals().length === 0) {
        <p class="roster__empty">No cases match the current filters.</p>
      }

      <div class="roster__grid">
        @for (animal of filteredAnimals(); track animal.id) {
          @defer (on viewport) {
            <app-case-file-card
              [title]="animal.name"
              [subtitle]="animal.species + ' · ' + animal.condition"
              [description]="animal.backstory"
              [clickable]="animal.available"
              (activated)="onAdopt(animal)"
            >
              <app-status-badge [status]="animal.available ? 'available' : 'pending'">
                {{ animal.available ? 'Cleared for placement' : 'Pending clearance' }}
              </app-status-badge>
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

  protected readonly speciesFilter = signal<string>('');
  protected readonly statusFilter = signal<'all' | 'available'>('all');

  protected readonly speciesOptions = computed(() =>
    [...new Set(MOCK_ANIMALS.map((a) => a.species))].sort(),
  );

  protected readonly filteredAnimals = computed(() =>
    MOCK_ANIMALS.filter((a) => !this.speciesFilter() || a.species === this.speciesFilter()).filter(
      (a) => this.statusFilter() === 'all' || a.available,
    ),
  );

  protected onAdopt(animal: Animal): void {
    this.router.navigate(['/'], { state: animal });
  }
}
