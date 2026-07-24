import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { provideHttpClient, withInterceptors, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { FAQ_DATA } from './data/faq-data';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideHttpClient(withInterceptors([
      (req, next) => {
        if (req.url.endsWith('/api/faq')) {
          return of(new HttpResponse({ status: 200, body: FAQ_DATA }));
        }
        return next(req);
      }
    ]))
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
