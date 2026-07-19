# Active Case Roster (FR-4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browsable `/roster` gallery page showing all shelter animals, with signal-based filtering and a one-click handoff that pre-seeds the Intake Triage form with the selected animal's data.

**Architecture:** A shared `src/app/data/roster.ts` becomes the single source of truth for the `Animal` interface and mock catalog; both the Angular app and the Netlify edge function import from it. The Roster component demonstrates `@defer (on viewport)` and chained `computed()` filter signals. The Intake Triage component's `linkedSignal` is extended to initialize from either an AI vision result or router navigation state.

**Tech Stack:** Angular 22 (standalone, zoneless, OnPush), Vitest via `@angular/build:unit-test`, Netlify Edge Functions (Deno), plain TypeScript data file shared across both runtimes.

## Global Constraints

- No `standalone: true` in Angular decorators — it's the default in Angular 22.
- Use `inject()` not constructor injection.
- Use `input()` / `output()` functions not decorators.
- `changeDetection: ChangeDetectionStrategy.OnPush` on every component.
- No Tailwind, no Angular Material, no external component library.
- All interactive elements use semantic HTML — `<button>`, not `<div>` with click handlers.
- `GEMINI_API_KEY` is never referenced client-side.
- All body/interactive text ≥ 16px (1rem floor).
- No gradients, no soft drop-shadows — stacked-paper shadow only (`2px 2px 0 0 #4a3f35`).
- Corner radius ≤ 8px.
- Use `@if` / `@for` / `@switch` — never `*ngIf` / `*ngFor`.
- Use `class` bindings not `ngClass`. Use `style` bindings not `ngStyle`.
- No `mutate` on signals — use `update` or `set`.
- All copy written in complete bureaucratic sincerity — no winking at the joke.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/app/data/roster.ts` | **Create** | `Animal` interface + `MOCK_ANIMALS` constant |
| `src/app/data/roster.spec.ts` | **Create** | Catalog integrity tests |
| `netlify/shared/demo-mode.mts` | **Modify** | Import `MOCK_ANIMALS` instead of defining it inline |
| `src/app/features/concierge/concierge-chat.service.ts` | **Modify** | Re-export `Animal` from new location |
| `src/app/features/roster/roster.ts` | **Create** | Roster gallery component |
| `src/app/features/roster/roster.spec.ts` | **Create** | Filter logic tests |
| `src/app/features/intake-triage/intake-triage.ts` | **Modify** | Multi-source `linkedSignal`, roster UI branch |
| `src/app/features/intake-triage/intake-triage.spec.ts` | **Create** | `toPartialCaseFile` mapping tests |
| `src/app/app.routes.ts` | **Modify** | Add `/roster` route |
| `src/app/app.html` | **Modify** | Add nav link |

---

## Task 1: Shared animal catalog

**Files:**
- Create: `src/app/data/roster.ts`
- Create: `src/app/data/roster.spec.ts`
- Modify: `netlify/shared/demo-mode.mts`
- Modify: `src/app/features/concierge/concierge-chat.service.ts`

**Interfaces:**
- Produces: `Animal` interface and `MOCK_ANIMALS` constant, consumed by Tasks 2, 3 and the edge function

- [ ] **Step 1: Write failing tests for the catalog**

Create `src/app/data/roster.spec.ts`:

```ts
import { MOCK_ANIMALS } from './roster';
import type { Animal } from './roster';

describe('MOCK_ANIMALS', () => {
  it('has at least 8 animals', () => {
    expect(MOCK_ANIMALS.length).toBeGreaterThanOrEqual(8);
  });

  it('every animal has required string fields', () => {
    for (const a of MOCK_ANIMALS) {
      expect(typeof a.id).toBe('string');
      expect(a.id.length).toBeGreaterThan(0);
      expect(typeof a.name).toBe('string');
      expect(a.name.length).toBeGreaterThan(0);
      expect(typeof a.species).toBe('string');
      expect(typeof a.condition).toBe('string');
      expect(typeof a.backstory).toBe('string');
      expect(typeof a.available).toBe('boolean');
    }
  });

  it('all ids are unique', () => {
    const ids = MOCK_ANIMALS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('at least one animal is available', () => {
    expect(MOCK_ANIMALS.some((a) => a.available)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
ng test --include="src/app/data/roster.spec.ts"
```

Expected: test runner reports module not found for `./roster`.

- [ ] **Step 3: Create `src/app/data/roster.ts`**

Move the `Animal` interface out of `concierge-chat.service.ts` and the animal array out of `demo-mode.mts`:

```ts
export interface Animal {
  id: string;
  name: string;
  species: string;
  condition: string;
  backstory: string;
  photoUrl?: string;
  available: boolean;
}

export const MOCK_ANIMALS: Animal[] = [
  {
    id: '001',
    name: 'Horace',
    species: 'Bear',
    condition: 'Good — a few reinforced seams, otherwise sound',
    backstory:
      "Did a long stretch in SAlcatraz's rehabilitation wing before turning his life around. Years of institutional therapy left him calm, disciplined, and genuinely low-maintenance — the kind of even-tempered, medium-size bear who's great with kids and doesn't need much beyond a steady routine.",
    photoUrl: '/images/horace.jpg',
    available: true,
  },
  {
    id: '002',
    name: 'Viola',
    species: 'Octopus',
    condition: 'Excellent',
    backstory:
      "Won the Stuffed Animal Science Fair in 2019 for her project on rising sea levels, and she's been fiercely self-sufficient ever since. Small, quiet, and happiest left to her own devices — about as low-maintenance and independent as they come.",
    photoUrl: '/images/viola.jpg',
    available: true,
  },
  {
    id: '003',
    name: 'Sabbatical',
    species: 'Hermit Crab',
    condition: 'Excellent, barely handled',
    backstory:
      'Technically a business consultant who\'s been "on sabbatical" since he arrived — tiny, aloof, and about the lowest-maintenance stuffy in the building. Prefers billable hours to belly rubs and mostly keeps to himself.',
    photoUrl: '/images/sabbatical.jpg',
    available: true,
  },
  {
    id: '004',
    name: 'Carlo',
    species: 'Bear',
    condition: 'Good',
    backstory:
      'A cleaning enthusiast who will absolutely help you make your bed. Medium-size and eager to please, Carlo needs a bit more day-to-day attention than most bears his size, but pays it back tenfold with tidy, high-energy devotion.',
    photoUrl: '/images/carlo.jpg',
    available: true,
  },
  {
    id: '005',
    name: 'Ron',
    species: 'Hyena',
    condition: 'Good, slightly matted fur',
    backstory:
      'A professional snuggler with a proven record. Medium-large and famously high-touch, Ron is the most affection-hungry animal on the roster — wonderful for someone who wants a constant, cuddly companion, higher-maintenance for anyone who does not.',
    photoUrl: '/images/ron.jpg',
    available: true,
  },
  {
    id: '006',
    name: 'Jefferson',
    species: 'Duck',
    condition: 'Fair, one wing reinforced',
    backstory:
      'A relentless cryptocurrency enthusiast who will pitch you on StuffyCoin within minutes of meeting. Small but chaotic and genuinely high-maintenance — best matched with an experienced, patient owner who can handle nonstop energy.',
    photoUrl: '/images/jefferson.jpg',
    available: true,
  },
  {
    id: '007',
    name: 'Kelly',
    species: 'Cow',
    condition: 'Excellent',
    backstory:
      'An outdoor adventurer who lives for hikes, kayaking, and riding in the basket of a dirt bike. Large and relentlessly high-energy, Kelly needs an active household — not a low-maintenance choice, but a rewarding one for the right family.',
    photoUrl: '/images/kelly.jpg',
    available: false,
  },
  {
    id: '008',
    name: 'Misha',
    species: 'Grizzly Bear',
    condition: 'Good — retired from the ring',
    backstory:
      'A multi-year resident with a former career as a professional wrestler. Large and imposing on sight, Misha is actually the gentlest, calmest animal in the building — surprisingly low-maintenance and great with kids despite the size.',
    photoUrl: '/images/misha.jpg',
    available: true,
  },
  {
    id: '009',
    name: 'Shelley',
    species: 'Turtle',
    condition: 'Excellent, shell fully intact',
    backstory:
      'Famously philosophical and famously immobile. Tiny, quiet, and about as low-maintenance as a stuffy gets — Shelley is content to sit still and contemplate the universe, which suits a calm household perfectly.',
    photoUrl: '/images/shelley.jpg',
    available: true,
  },
  {
    id: '010',
    name: 'Elwyn',
    species: 'Goat',
    condition: 'Good',
    backstory:
      "An accountant by disposition, meticulous and numerically minded despite an aversion to using a calculator with hooves. Medium-size, orderly, and moderate-maintenance — Elwyn does best with a routine-loving family who appreciates a tidy, methodical companion.",
    photoUrl: '/images/elwyn.jpg',
    available: true,
  },
];
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
ng test --include="src/app/data/roster.spec.ts"
```

Expected: `✓ src/app/data/roster.spec.ts (4 tests)`.

- [ ] **Step 5: Update `netlify/shared/demo-mode.mts`**

Replace the inline `animals` array with an import. The full file becomes:

```ts
import { MOCK_ANIMALS } from '../../src/app/data/roster.ts';

export function isDemoMode(): boolean {
  const mode = typeof Netlify !== 'undefined' && Netlify.env
    ? Netlify.env.get('DEMO_MODE')
    : (typeof Deno !== 'undefined' ? Deno.env.get('DEMO_MODE') : process.env.DEMO_MODE);
  return mode === 'true' || mode === '1';
}

export async function simulateTokenDelay(ms: number = 50): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const DEMO_RESPONSES = {
  intakeTriage: {
    species: 'Stuffed Tiger',
    condition: 'Slightly worn but structurally sound',
    suggestedCaseName: 'Stripe #2847',
    huggabilityScore: 8,
    recommendedTreatmentPlan: [
      'Inspect seams for loose stitching',
      'Gentle surface wash if needed',
      'Check for embedded lint',
      'Verify eyes are firmly attached',
    ],
  },
  conciergeChat: {
    tokens: [
      "Based on what you're looking for, I'd recommend Horace — a bear who did a long stretch in rehabilitation and came out the other side genuinely low-maintenance. ",
      "He's calm, even-tempered, and great with kids.",
    ],
    animals: [MOCK_ANIMALS[0]],
  },
  animals: MOCK_ANIMALS,
  surrenderAnalysis: {
    guiltScore: 65,
    message: 'Surrendering a cherished companion requires courage. Your concern demonstrates responsibility.',
  },
};
```

- [ ] **Step 6: Update `src/app/features/concierge/concierge-chat.service.ts`**

Move the `Animal` import to the new location and re-export it. Change only the import line and add a re-export — leave all other code untouched:

```ts
// Replace this line:
export interface Animal { ... }
// With these two lines:
export type { Animal } from '../../data/roster';
import type { Animal } from '../../data/roster';
```

The full updated imports block at the top of `concierge-chat.service.ts`:

```ts
import { Service } from '@angular/core';
import { Observable } from 'rxjs';
export type { Animal } from '../../data/roster';
import type { Animal } from '../../data/roster';
```

Remove the old `Animal` interface definition (lines 4–12 of the current file). Keep everything else (`ChatTokenEvent`, `ChatToolResultEvent`, `ChatDoneEvent`, `ChatErrorEvent`, `ChatSseEvent`, `parseSseRecord`, `ConciergeChatService`) exactly as-is.

- [ ] **Step 7: Verify the Angular build compiles**

```bash
ng build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/data/roster.ts src/app/data/roster.spec.ts netlify/shared/demo-mode.mts src/app/features/concierge/concierge-chat.service.ts
git commit -m "feat: extract shared animal catalog to src/app/data/roster.ts"
```

---

## Task 2: Roster component, route, and nav link

**Files:**
- Create: `src/app/features/roster/roster.ts`
- Create: `src/app/features/roster/roster.spec.ts`
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/app.html`

**Interfaces:**
- Consumes: `Animal`, `MOCK_ANIMALS` from `../../data/roster`
- Consumes: `CaseFileCard` from `../../ui/case-file-card/case-file-card` (`[clickable]`, `[title]`, `[subtitle]`, `[description]`, `(activated)`)
- Consumes: `StatusBadge` from `../../ui/status-badge/status-badge` (`[status]`: `'available' | 'pending'`)
- Consumes: `Router` from `@angular/router`

- [ ] **Step 1: Write failing tests for filter logic**

Create `src/app/features/roster/roster.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Roster } from './roster';
import { MOCK_ANIMALS } from '../../data/roster';

describe('Roster', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [Roster],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Roster);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as {
      speciesFilter: { set(v: string): void; (): string };
      statusFilter: { set(v: 'all' | 'available'): void; (): 'all' | 'available' };
      filteredAnimals: () => typeof MOCK_ANIMALS;
      speciesOptions: () => string[];
    };
  }

  it('shows all animals by default', async () => {
    const component = await setup();
    expect(component.filteredAnimals().length).toBe(MOCK_ANIMALS.length);
  });

  it('filters by species', async () => {
    const component = await setup();
    component.speciesFilter.set('Bear');
    const bears = MOCK_ANIMALS.filter((a) => a.species === 'Bear');
    expect(component.filteredAnimals()).toEqual(bears);
  });

  it('filters to available only', async () => {
    const component = await setup();
    component.statusFilter.set('available');
    expect(component.filteredAnimals().every((a) => a.available)).toBe(true);
  });

  it('species filter and status filter compose', async () => {
    const component = await setup();
    component.speciesFilter.set('Bear');
    component.statusFilter.set('available');
    const result = component.filteredAnimals();
    expect(result.every((a) => a.species === 'Bear' && a.available)).toBe(true);
  });

  it('speciesOptions contains each unique species exactly once', async () => {
    const component = await setup();
    const options = component.speciesOptions();
    expect(new Set(options).size).toBe(options.length);
    for (const a of MOCK_ANIMALS) {
      expect(options).toContain(a.species);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
ng test --include="src/app/features/roster/roster.spec.ts"
```

Expected: module not found for `./roster`.

- [ ] **Step 3: Create `src/app/features/roster/roster.ts`**

```ts
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
      font-size: var(--text-xs);
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
      font-size: var(--text-xs);
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
ng test --include="src/app/features/roster/roster.spec.ts"
```

Expected: `✓ src/app/features/roster/roster.spec.ts (5 tests)`.

- [ ] **Step 5: Add `/roster` route to `src/app/app.routes.ts`**

The full updated file:

```ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'component-harness',
    loadComponent: () =>
      import('./component-harness/component-harness').then((m) => m.ComponentHarness),
  },
  {
    path: 'roster',
    loadComponent: () => import('./features/roster/roster').then((m) => m.Roster),
  },
  {
    path: 'concierge',
    loadComponent: () => import('./features/concierge/concierge').then((m) => m.Concierge),
  },
  {
    path: 'surrender-analysis',
    loadComponent: () =>
      import('./features/surrender-analysis/surrender-analysis').then((m) => m.SurrenderAnalysis),
  },
  {
    path: '',
    loadComponent: () => import('./features/intake-triage/intake-triage').then((m) => m.IntakeTriage),
  },
];
```

- [ ] **Step 6: Add nav link to `src/app/app.html`**

The full updated file:

```html
<a href="#main-content" class="skip-link">Skip to main content</a>
<header class="app-nav">
  <div class="app-nav__brand">
    <span class="app-nav__title">Plushelter</span>
    <span class="app-nav__subtitle">Stuffed Animal Rehabilitation Facility</span>
  </div>
  <nav class="app-nav__links" aria-label="Main navigation">
    <a
      routerLink="/"
      routerLinkActive="is-active"
      [routerLinkActiveOptions]="{ exact: true }"
      ariaCurrentWhenActive="page"
      class="app-nav__link"
    >Intake Triage</a>
    <a
      routerLink="/roster"
      routerLinkActive="is-active"
      ariaCurrentWhenActive="page"
      class="app-nav__link"
    >Active Case Roster</a>
    <a
      routerLink="/concierge"
      routerLinkActive="is-active"
      ariaCurrentWhenActive="page"
      class="app-nav__link"
    >Adoption Concierge</a>
    <a
      routerLink="/surrender-analysis"
      routerLinkActive="is-active"
      ariaCurrentWhenActive="page"
      class="app-nav__link"
    >Surrender Risk Assessment</a>
  </nav>
</header>
<main id="main-content">
  <router-outlet />
</main>
```

- [ ] **Step 7: Verify the Angular build compiles**

```bash
ng build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/features/roster/roster.ts src/app/features/roster/roster.spec.ts src/app/app.routes.ts src/app/app.html
git commit -m "feat: add Active Case Roster page with signal filtering and defer cards"
```

---

## Task 3: Intake Triage multi-source handoff

**Files:**
- Modify: `src/app/features/intake-triage/intake-triage.ts`
- Create: `src/app/features/intake-triage/intake-triage.spec.ts`

**Interfaces:**
- Consumes: `Animal` from `../../data/roster`
- Consumes: `Router` from `@angular/router`
- Produces: exported `toPartialCaseFile(animal: Animal | undefined): CaseFile | undefined`

- [ ] **Step 1: Write failing tests for the mapping function**

Create `src/app/features/intake-triage/intake-triage.spec.ts`:

```ts
import { toPartialCaseFile } from './intake-triage';
import type { Animal } from '../../data/roster';

describe('toPartialCaseFile', () => {
  it('returns undefined when given undefined', () => {
    expect(toPartialCaseFile(undefined)).toBeUndefined();
  });

  it('maps name to suggestedCaseName', () => {
    const animal: Animal = {
      id: '001', name: 'Horace', species: 'Bear',
      condition: 'Good', backstory: 'A bear.', available: true,
    };
    expect(toPartialCaseFile(animal)?.suggestedCaseName).toBe('Horace');
  });

  it('maps species and condition through unchanged', () => {
    const animal: Animal = {
      id: '002', name: 'Viola', species: 'Octopus',
      condition: 'Excellent', backstory: 'An octopus.', available: true,
    };
    const result = toPartialCaseFile(animal);
    expect(result?.species).toBe('Octopus');
    expect(result?.condition).toBe('Excellent');
  });

  it('defaults huggabilityScore to 0 and recommendedTreatmentPlan to []', () => {
    const animal: Animal = {
      id: '003', name: 'Sabbatical', species: 'Hermit Crab',
      condition: 'Excellent', backstory: 'A crab.', available: true,
    };
    const result = toPartialCaseFile(animal);
    expect(result?.huggabilityScore).toBe(0);
    expect(result?.recommendedTreatmentPlan).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
ng test --include="src/app/features/intake-triage/intake-triage.spec.ts"
```

Expected: `toPartialCaseFile` is not exported / not found.

- [ ] **Step 3: Update `src/app/features/intake-triage/intake-triage.ts`**

The full updated file. Changes from the current version are:
1. Add `Router` import from `@angular/router`
2. Add `Animal` import from `../../data/roster`
3. Export `toPartialCaseFile` as a module-level function (before the `@Component`)
4. Add `private readonly rosterAnimal` signal reading `history.state`
5. Update `caseFile` linkedSignal to use `toPartialCaseFile(this.rosterAnimal())`
6. Update the template to gate photo upload on `!rosterAnimal()`
7. Update the bottom button to show "← Back to Roster" when from roster
8. Add `backToRoster()` method

```ts
import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { form } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { Button } from '../../ui/button/button';
import { CaseFileCard } from '../../ui/case-file-card/case-file-card';
import { ChecklistItem } from '../../ui/checklist-item/checklist-item';
import { FormField } from '../../ui/form-field/form-field';
import { StatusBadge } from '../../ui/status-badge/status-badge';
import type { Animal } from '../../data/roster';

interface CaseFile {
  species: string;
  condition: string;
  suggestedCaseName: string;
  huggabilityScore: number;
  recommendedTreatmentPlan: string[];
}

interface UploadedPhoto {
  base64: string;
  mimeType: string;
}

interface TriageErrorBody {
  error: { code: string; message: string };
}

const EMPTY_CASE_FILE: CaseFile = {
  species: '',
  condition: '',
  suggestedCaseName: '',
  huggabilityScore: 0,
  recommendedTreatmentPlan: [],
};

/** Strips the `data:<mime>;base64,` prefix FileReader adds — the backend wants raw base64. */
function readFileAsBase64(file: File): Promise<UploadedPhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ base64: (reader.result as string).split(',')[1], mimeType: file.type });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function toPartialCaseFile(animal: Animal | undefined): CaseFile | undefined {
  if (!animal) return undefined;
  return {
    suggestedCaseName: animal.name,
    species: animal.species,
    condition: animal.condition,
    huggabilityScore: 0,
    recommendedTreatmentPlan: [],
  };
}

@Component({
  selector: 'app-intake-triage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, CaseFileCard, ChecklistItem, FormField, StatusBadge],
  template: `
    <section class="intake">
      <h1>Intake Vision Triage</h1>

      @if (!rosterAnimal()) {
        <div class="intake__upload">
          <input #fileInput type="file" accept="image/*" class="intake__file-input" (change)="onPhotoSelected($event)" />
          <app-button type="button" (click)="fileInput.click()">Upload a photo</app-button>
        </div>
      }

      @if (triageResource.isLoading()) {
        <app-status-badge status="pending">Assessing photo…</app-status-badge>
      }

      @if (triageError(); as triageErr) {
        <app-status-badge status="critical">{{ triageErr.message }}</app-status-badge>
      }

      @if (triageResource.hasValue() || rosterAnimal()) {
        <div class="intake__layout">
          <form class="intake-form">
            <div class="intake-form__fields">
              <app-form-field label="Species" [(value)]="intakeForm.species().value" />
              <app-form-field label="Condition" [(value)]="intakeForm.condition().value" />
              <app-form-field label="Case name" [(value)]="intakeForm.suggestedCaseName().value" />
              <app-form-field label="Huggability score" type="number" [value]="scoreFieldText()" (valueChange)="onScoreInput($event)" />
            </div>
          </form>

          <div class="intake__treatment">
            <h2>Recommended treatment plan</h2>
            @for (step of caseFile().recommendedTreatmentPlan; track step) {
              <app-checklist-item [label]="step" [checked]="isStepDone(step)" (checkedChange)="setStepDone(step, $event)" />
            }
          </div>

          <app-case-file-card
            [title]="intakeForm.suggestedCaseName().value() || 'Unnamed case'"
            [subtitle]="intakeForm.species().value() + ' · ' + intakeForm.condition().value()"
            [description]="'Huggability score: ' + scoreFieldText()"
          />
        </div>
      }

      @if (triageResource.hasValue() || triageError() || rosterAnimal()) {
        @if (rosterAnimal()) {
          <app-button type="button" variant="secondary" (click)="backToRoster()">← Back to Roster</app-button>
        } @else {
          <app-button type="button" variant="secondary" (click)="clear()">Start over</app-button>
        }
      }
    </section>
  `,
  styles: `
    .intake {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      max-width: 40rem;
      margin-inline: auto;
      padding: var(--space-5);
      font-family: var(--font-body);
      color: var(--color-ink);
    }

    .intake__upload {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .intake__file-input {
      display: none;
    }

    .intake__layout {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .intake-form__fields {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .intake-form__fields > * {
      animation: intake-field-reveal 0.25s ease-out both;
    }

    .intake-form__fields > *:nth-child(1) { animation-delay: 0ms; }
    .intake-form__fields > *:nth-child(2) { animation-delay: 60ms; }
    .intake-form__fields > *:nth-child(3) { animation-delay: 120ms; }
    .intake-form__fields > *:nth-child(4) { animation-delay: 180ms; }

    @keyframes intake-field-reveal {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .intake__treatment {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .intake__treatment h2 {
      font-family: var(--font-display);
      font-size: var(--text-lg);
      margin: 0;
    }
  `,
})
export class IntakeTriage {
  private readonly router = inject(Router);

  protected readonly uploadedPhoto = signal<UploadedPhoto | undefined>(undefined);
  protected readonly completedSteps = signal<ReadonlySet<string>>(new Set());

  protected readonly triageResource = httpResource<CaseFile>(() => {
    const photo = this.uploadedPhoto();
    if (!photo) return undefined;
    return {
      url: '/api/intake-triage',
      method: 'POST',
      body: { photoBase64: photo.base64, mimeType: photo.mimeType },
    };
  });

  protected readonly triageError = computed(() => {
    const error = this.triageResource.error();
    if (!error) return undefined;
    const body = (error as { error?: TriageErrorBody })?.error?.error;
    return body ?? { code: 'UPSTREAM_ERROR', message: 'Something went wrong assessing that photo.' };
  });

  private readonly rosterAnimal = signal<Animal | undefined>(
    'id' in (history.state ?? {}) ? (history.state as Animal) : undefined,
  );

  /** Resets to the newest resolved value whenever triageResource fires OR initializes from
   * roster navigation state — two sources, one reactive form. The edits survive re-renders
   * unless the underlying resource value itself changes (linkedSignal's whole point). */
  protected readonly caseFile = linkedSignal<CaseFile>(
    () => this.triageResource.value() ?? toPartialCaseFile(this.rosterAnimal()) ?? EMPTY_CASE_FILE,
  );

  /** Template binds directly to each field's FieldState.value (e.g. [(value)]="intakeForm.species().value")
   * rather than importing Angular's own `Field`/`FormField` directives from '@angular/forms/signals' —
   * those names collide with this app's own `FormField` UI component (../../ui/form-field/form-field).
   * Don't "fix" this by importing Angular's FormField under an alias unless you also rename the local one. */
  protected readonly intakeForm = form(this.caseFile);

  /** huggabilityScore is a number field in the model but app-form-field only speaks string
   * values — this mirrors it as text and writes parsed edits straight back into the field's
   * own value signal, so the Signal Form (not this component) stays the single source of truth. */
  protected readonly scoreFieldText = computed(() => String(this.intakeForm.huggabilityScore().value()));

  protected onScoreInput(text: string): void {
    const parsed = Number(text);
    if (!Number.isNaN(parsed)) this.intakeForm.huggabilityScore().value.set(parsed);
  }

  protected async onPhotoSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.completedSteps.set(new Set());
    this.uploadedPhoto.set(await readFileAsBase64(file));
  }

  protected isStepDone(step: string): boolean {
    return this.completedSteps().has(step);
  }

  protected setStepDone(step: string, done: boolean): void {
    const next = new Set(this.completedSteps());
    if (done) next.add(step);
    else next.delete(step);
    this.completedSteps.set(next);
  }

  protected clear(): void {
    this.uploadedPhoto.set(undefined);
    this.completedSteps.set(new Set());
  }

  protected backToRoster(): void {
    this.router.navigate(['/roster']);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
ng test --include="src/app/features/intake-triage/intake-triage.spec.ts"
```

Expected: `✓ src/app/features/intake-triage/intake-triage.spec.ts (4 tests)`.

- [ ] **Step 5: Run all tests**

```bash
ng test
```

Expected: all test suites pass. Check for any regressions in `app.spec.ts`.

- [ ] **Step 6: Verify the full build**

```bash
ng build
```

Expected: build succeeds, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/intake-triage/intake-triage.ts src/app/features/intake-triage/intake-triage.spec.ts
git commit -m "feat: extend IntakeTriage linkedSignal to accept roster navigation handoff"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task covering it |
|---|---|
| AC-1: `/roster` renders catalog with no network request | Task 2 |
| AC-2: Filter controls narrow list reactively | Task 2 (filter signals + computed) |
| AC-3: Cards not in viewport are not rendered | Task 2 (`@defer on viewport`) |
| AC-4: Clicking card pre-fills intake form | Task 2 (`onAdopt`) + Task 3 (`rosterAnimal` signal) |
| AC-5: Intake form fields are editable after pre-fill | Task 3 (`linkedSignal` + `form()`) |
| AC-6: "← Back to Roster" navigates to `/roster` | Task 3 (`backToRoster`) |
| AC-7: Normal nav to intake shows photo upload | Task 3 (`!rosterAnimal()` gate) |
| AC-8: Concierge uses same `MOCK_ANIMALS` catalog | Task 1 (`demo-mode.mts` import) |
| AC-9: No external component library | All tasks (CSS-only) |
| AC-10: Semantic HTML on interactive elements | Task 2 (`CaseFileCard` renders as `<button>` when `clickable`) |

All acceptance criteria are covered. No gaps found.
