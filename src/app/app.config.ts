import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners, provideExperimentalWebMcpTools,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withAutoCleanupInjectors } from '@angular/router';
import { provideExperimentalWebMcpForms } from '@angular/forms/signals';
import {
  BasicCatalog,
  createComponentImplementation,
  provideA2Ui,
} from '@a2ui/angular/v0_9';
import { ButtonApi } from '@a2ui/web_core/v0_9/basic_catalog';
import { A2uiActionDispatcherService } from './a2ui/a2ui-action-dispatcher.service';
import {
  createShelterCustomCatalog,
  provideShelterMarkdownRenderer,
  ShelterButtonComponent,
} from './a2ui/shelter-catalog';

import { routes } from './app.routes';
import {APP_TOOLS} from './webmcp/shelter-tools';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withAutoCleanupInjectors()),
    provideHttpClient(),
    provideExperimentalWebMcpTools(APP_TOOLS),
    provideExperimentalWebMcpForms(),
    provideShelterMarkdownRenderer(),
    provideA2Ui(() => {
      const dispatcher = inject(A2uiActionDispatcherService);
      return {
        catalogs: [
          new BasicCatalog({
            components: {
              button: createComponentImplementation(ButtonApi, ShelterButtonComponent),
            },
          }),
          createShelterCustomCatalog(),
        ],
        actionHandler: (action) => dispatcher.dispatch(action),
      };
    }),
  ],
};
