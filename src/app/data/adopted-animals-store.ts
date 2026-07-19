import { Service, signal } from '@angular/core';
import { Animal } from './roster';

export interface AdoptionRecord {
  animalId: Animal['id'];
  adopterName: string;
}

/**
 * Session-scoped store of finalized adoptions. A root singleton, mirroring
 * `AdmittedAnimalsStore`'s lifetime: survives navigation, resets on a hard browser refresh.
 * No persistence, no binary data.
 */
@Service()
export class AdoptedAnimalsStore {
  private readonly _adoptions = signal<AdoptionRecord[]>([]);

  /** Read-only view for consumers (the roster reads this to badge/lock adopted cards). */
  readonly adoptions = this._adoptions.asReadonly();

  adopt(animalId: Animal['id'], adopterName: string): void {
    this._adoptions.update((list) => [...list, { animalId, adopterName }]);
  }

  isAdopted(animalId: Animal['id']): boolean {
    return this._adoptions().some((record) => record.animalId === animalId);
  }

  getAdopterName(animalId: Animal['id']): string | undefined {
    return this._adoptions().find((record) => record.animalId === animalId)?.adopterName;
  }

  clear(): void {
    this._adoptions.set([]);
  }
}
