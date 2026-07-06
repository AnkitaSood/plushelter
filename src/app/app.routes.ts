import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'components',
    loadComponent: () => import('./component-harness/component-harness').then((m) => m.ComponentHarness),
  },
];
