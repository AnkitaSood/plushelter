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
