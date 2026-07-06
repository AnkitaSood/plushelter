import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./component-harness/component-harness').then((m) => m.ComponentHarness),
  },
  {
    path: 'concierge',
    loadComponent: () => import('./features/concierge/concierge').then((m) => m.Concierge),
  },
  {
    path: 'intake',
    loadComponent: () => import('./features/intake-triage/intake-triage').then((m) => m.IntakeTriage),
  },
];
