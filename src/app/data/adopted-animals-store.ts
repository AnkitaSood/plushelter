import { inject, Service, signal } from '@angular/core';
import { Animal, MOCK_ANIMALS } from './roster';
import { AdmittedAnimalsStore } from './admitted-animals-store';

export interface AdoptionRecord {
  animalId: Animal['id'];
  adopterName: string;
}

export interface ResidentAnimalInfo {
  name: string;
  duration: string;
  animalName?: string;
  timeInShelter?: string;
}

/**
 * Calculates the difference between two dates in years, months, and days,
 * formatted as e.g. "3 years, 2 months, 22 days".
 */
export function formatStayDuration(fromDate: Date, toDate: Date = new Date()): string {
  const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const to = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());

  if (to.getTime() < from.getTime()) {
    return '0 years, 0 months, 0 days';
  }

  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();

  if (days < 0) {
    const prevMonthDays = new Date(to.getFullYear(), to.getMonth(), 0).getDate();
    days += prevMonthDays;
    months--;
  }

  if (months < 0) {
    months += 12;
    years--;
  }

  if (years < 0) {
    years = 0;
    months = 0;
    days = 0;
  }

  const yUnit = years === 1 ? 'year' : 'years';
  const mUnit = months === 1 ? 'month' : 'months';
  const dUnit = days === 1 ? 'day' : 'days';

  return `${years} ${yUnit}, ${months} ${mUnit}, ${days} ${dUnit}`;
}

function createResidentAnimalInfo(name: string, duration: string): ResidentAnimalInfo {
  const info: ResidentAnimalInfo = { name, duration };
  Object.defineProperty(info, 'animalName', {
    value: name,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(info, 'timeInShelter', {
    value: duration,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return info;
}

/**
 * Session-scoped store of finalized adoptions. A root singleton, mirroring `AdmittedAnimalsStore`'s lifetime
 */
@Service()
export class AdoptedAnimalsStore {
  private readonly _adoptions = signal<AdoptionRecord[]>([]);
  private readonly admittedAnimalsStore: AdmittedAnimalsStore | null = null;

  constructor() {
    try {
      this.admittedAnimalsStore = inject(AdmittedAnimalsStore, { optional: true });
    } catch {
      this.admittedAnimalsStore = null;
    }
  }

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

  private getDefaultAnimals(): Animal[] {
    const admitted = this.admittedAnimalsStore?.admitted() ?? [];
    return [...MOCK_ANIMALS, ...admitted];
  }

  /**
   * Returns information about the animal who has been in the shelter for the longest duration
   * based on the `surrenderedAt` field on Animal[].
   */
  getLongestResidentAnimalInfo(
    animals?: Animal[],
    currentDate: Date = new Date(),
  ): ResidentAnimalInfo | null {
    const source = animals ?? this.getDefaultAnimals();
    const eligible = source.filter(
      (a) => a.surrenderedAt && !this.isAdopted(a.id) && !Number.isNaN(new Date(a.surrenderedAt).getTime()),
    );

    if (eligible.length === 0) {
      return null;
    }

    let longest = eligible[0];
    let longestTime = new Date(longest.surrenderedAt!).getTime();

    for (let i = 1; i < eligible.length; i++) {
      const time = new Date(eligible[i].surrenderedAt!).getTime();
      if (time < longestTime) {
        longest = eligible[i];
        longestTime = time;
      }
    }

    const duration = formatStayDuration(new Date(longest.surrenderedAt!), currentDate);
    return createResidentAnimalInfo(longest.name, duration);
  }

  /**
   * Returns information about the animal who has most recently been admitted to the shelter
   * based on the `surrenderedAt` field on Animal[].
   */
  getMostRecentResidentAnimal(
    animals?: Animal[],
    currentDate: Date = new Date(),
  ): ResidentAnimalInfo | null {
    const source = animals ?? this.getDefaultAnimals();
    const eligible = source.filter(
      (a) => a.surrenderedAt && !this.isAdopted(a.id) && !Number.isNaN(new Date(a.surrenderedAt).getTime()),
    );

    if (eligible.length === 0) {
      return null;
    }

    let mostRecent = eligible[0];
    let mostRecentTime = new Date(mostRecent.surrenderedAt!).getTime();

    for (let i = 1; i < eligible.length; i++) {
      const time = new Date(eligible[i].surrenderedAt!).getTime();
      if (time > mostRecentTime) {
        mostRecent = eligible[i];
        mostRecentTime = time;
      }
    }

    const duration = formatStayDuration(new Date(mostRecent.surrenderedAt!), currentDate);
    return createResidentAnimalInfo(mostRecent.name, duration);
  }

  clear(): void {
    this._adoptions.set([]);
  }
}

