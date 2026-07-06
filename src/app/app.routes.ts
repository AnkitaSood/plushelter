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
];
