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
    path: 'adopt',
    loadComponent: () => import('./features/adoption/adoption').then((m) => m.AdoptionFlow),
  },
  {
    path: 'faq',
    loadComponent: () => import('./features/faq/faq').then((m) => m.Faq),
  },
  {
    path: '',
    loadComponent: () => import('./features/intake-triage/intake-triage').then((m) => m.IntakeTriage),
  },
];
