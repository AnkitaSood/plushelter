import { Service } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { FaqCategory } from './faq.model';

/**
 * Root singleton so the FAQ resource is created once, in the root injector, and outlives the
 * `Faq` route component. Without this, navigating away from `/faq` destroys the component (and
 * any resource created inside it), so returning to `/faq` re-fetches every time.
 */
@Service()
export class FaqStore {
  readonly faq = httpResource<FaqCategory[]>(() => '/api/faq');
}
