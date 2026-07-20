import { Service, signal } from '@angular/core';
import type { SurrenderRequest } from './surrender-request.model';

/** Session-scoped log of submitted surrender requests — whether a human filled the form or a
 * WebMCP agent invoked the implicit `submitSurrenderRequest` tool, both land here. */
@Service()
export class SurrenderRequestsStore {
  private readonly _requests = signal<SurrenderRequest[]>([]);
  readonly requests = this._requests.asReadonly();

  add(request: SurrenderRequest): void {
    this._requests.update((list) => [...list, request]);
  }

  clear(): void {
    this._requests.set([]);
  }
}
