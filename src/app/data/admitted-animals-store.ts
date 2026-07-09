import { Service, signal } from '@angular/core';
import { Animal } from './roster';

/**
 * Session-scoped store of animals admitted through Intake Triage. A root singleton, so the
 * list survives navigation between pages but resets on a hard browser refresh — exactly the
 * lifetime chosen for the "Admit to shelter" flow. No persistence, no binary data.
 */
@Service()
export class AdmittedAnimalsStore {
  private readonly _admitted = signal<Animal[]>([]);

  /** Read-only view for consumers (the roster merges this into its filtered list). */
  readonly admitted = this._admitted.asReadonly();

  admit(animal: Animal): void {
    this._admitted.update((list) => [...list, animal]);
  }
}
