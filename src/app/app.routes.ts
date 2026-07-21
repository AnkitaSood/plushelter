import { Routes } from '@angular/router';
import { inject, provideEnvironmentInitializer, provideExperimentalWebMcpTools } from '@angular/core';
import { APP_TOOLS, ROSTER_ROUTE_TOOLS } from './webmcp/shelter-tools';
import { ShelterAgentService } from './webmcp/shelter-agent.service';

export const routes: Routes = [
  {
    path: '',
    providers: [provideExperimentalWebMcpTools(APP_TOOLS)],
    children: [
      {
        path: 'component-harness',
        loadComponent: () =>
          import('./component-harness/component-harness').then((m) => m.ComponentHarness),
      },
      {
        path: 'roster',
        loadComponent: () => import('./features/roster/roster').then((m) => m.Roster),
        providers: [provideExperimentalWebMcpTools(ROSTER_ROUTE_TOOLS)],
      },
      {
        path: 'concierge',
        loadComponent: () => import('./features/concierge/concierge').then((m) => m.Concierge),
      },
      {
        path: 'adopt',
        loadComponent: () => import('./features/adoption/adoption').then((m) => m.AdoptionFlow),
      },
      // {
      //   path: 'agent-console',
      //   loadComponent: () => import('./features/agent-console/agent-console').then((m) => m.AgentConsole),
      // },
      {
        path: '',
        providers: [provideEnvironmentInitializer(() => void inject(ShelterAgentService))],
        loadComponent: () => import('./features/intake-triage/intake-triage').then((m) => m.IntakeTriage),
      },
    ],
  },
  {
    path: 'faq',
    loadComponent: () => import('./features/faq/faq').then((m) => m.Faq),
  },
];
