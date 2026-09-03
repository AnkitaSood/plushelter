import { TestBed } from '@angular/core/testing';
import { AdoptedAnimalsStore, formatStayDuration } from './adopted-animals-store';
import { type Animal } from './roster';

function makeAnimal(overrides: Partial<Animal> = {}): Animal {
  return {
    id: crypto.randomUUID(),
    name: 'Test Animal',
    species: 'Bear',
    condition: 'Good',
    backstory: 'A friendly companion',
    available: true,
    ...overrides,
  };
}

describe('formatStayDuration', () => {
  it('returns 0 years, 0 months, 0 days for same date', () => {
    const from = new Date('2026-09-03T10:00:00.000Z');
    const to = new Date('2026-09-03T10:00:00.000Z');
    expect(formatStayDuration(from, to)).toBe('0 years, 0 months, 0 days');
  });

  it('handles singular units correctly (1 year, 1 month, 1 day)', () => {
    const from = new Date('2025-08-02');
    const to = new Date('2026-09-03');
    expect(formatStayDuration(from, to)).toBe('1 year, 1 month, 1 day');
  });

  it('handles plural units correctly (2 years, 3 months, 15 days)', () => {
    const from = new Date('2024-05-19');
    const to = new Date('2026-09-03');
    expect(formatStayDuration(from, to)).toBe('2 years, 3 months, 15 days');
  });

  it('handles borrowing across months with different lengths including leap year', () => {
    // 2024 is a leap year (February has 29 days)
    const from = new Date('2024-02-28');
    const to = new Date('2024-03-01');
    expect(formatStayDuration(from, to)).toBe('0 years, 0 months, 2 days');
  });

  it('handles future date gracefully', () => {
    const from = new Date('2026-10-01');
    const to = new Date('2026-09-03');
    expect(formatStayDuration(from, to)).toBe('0 years, 0 months, 0 days');
  });
});

describe('AdoptedAnimalsStore', () => {
  function setup(): AdoptedAnimalsStore {
    TestBed.configureTestingModule({});
    return TestBed.inject(AdoptedAnimalsStore);
  }

  it('starts with empty adoptions', () => {
    const store = setup();
    expect(store.adoptions()).toEqual([]);
  });

  it('adopt() tracks adoption records and isAdopted() detects them', () => {
    const store = setup();
    store.adopt('001', 'Alice');
    expect(store.isAdopted('001')).toBe(true);
    expect(store.isAdopted('002')).toBe(false);
    expect(store.getAdopterName('001')).toBe('Alice');
    expect(store.getAdopterName('002')).toBeUndefined();
  });

  it('clear() empties adoption records', () => {
    const store = setup();
    store.adopt('001', 'Alice');
    store.clear();
    expect(store.adoptions()).toEqual([]);
    expect(store.isAdopted('001')).toBe(false);
  });

  describe('getLongestResidentAnimalInfo', () => {
    it('returns the animal with the earliest surrenderedAt date from a custom list', () => {
      const store = setup();
      const testAnimals: Animal[] = [
        makeAnimal({ id: '1', name: 'Fluffy', surrenderedAt: '2024-01-15' }),
        makeAnimal({ id: '2', name: 'Barnaby', surrenderedAt: '2022-06-10' }),
        makeAnimal({ id: '3', name: 'Pip', surrenderedAt: '2023-03-20' }),
      ];

      const refDate = new Date('2026-09-03');
      const result = store.getLongestResidentAnimalInfo(testAnimals, refDate);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Barnaby');
      expect(result?.animalName).toBe('Barnaby');
      expect(result?.duration).toBe('4 years, 2 months, 24 days');
      expect(result?.timeInShelter).toBe('4 years, 2 months, 24 days');
    });

    it('returns Shelley as the longest resident from default MOCK_ANIMALS', () => {
      const store = setup();
      const refDate = new Date('2026-09-03');
      const result = store.getLongestResidentAnimalInfo(undefined, refDate);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Shelley');
    });

    it('excludes adopted animals from consideration', () => {
      const store = setup();
      // Shelley is '009' in MOCK_ANIMALS, Misha is '008' (2023-08-30)
      store.adopt('009', 'Adopter');
      const result = store.getLongestResidentAnimalInfo();

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Misha');
    });

    it('returns null when animal list is empty or no valid dates', () => {
      const store = setup();
      expect(store.getLongestResidentAnimalInfo([])).toBeNull();
      expect(store.getLongestResidentAnimalInfo([makeAnimal({ surrenderedAt: undefined })])).toBeNull();
    });

    it('returns null when all animals are adopted', () => {
      const store = setup();
      const animals = [makeAnimal({ id: '1', surrenderedAt: '2024-01-01' })];
      store.adopt('1', 'Adopter');
      expect(store.getLongestResidentAnimalInfo(animals)).toBeNull();
    });
  });

  describe('getMostRecentResidentAnimal', () => {
    it('returns the animal with the latest surrenderedAt date from a custom list', () => {
      const store = setup();
      const testAnimals: Animal[] = [
        makeAnimal({ id: '1', name: 'Fluffy', surrenderedAt: '2024-01-15' }),
        makeAnimal({ id: '2', name: 'Barnaby', surrenderedAt: '2022-06-10' }),
        makeAnimal({ id: '3', name: 'Pip', surrenderedAt: '2025-08-01' }),
      ];

      const refDate = new Date('2026-09-03');
      const result = store.getMostRecentResidentAnimal(testAnimals, refDate);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Pip');
      expect(result?.animalName).toBe('Pip');
      expect(result?.duration).toBe('1 year, 1 month, 2 days');
      expect(result?.timeInShelter).toBe('1 year, 1 month, 2 days');
    });

    it('returns Elwyn as the most recent resident from default MOCK_ANIMALS', () => {
      const store = setup();
      const result = store.getMostRecentResidentAnimal();

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Elwyn');
    });

    it('excludes adopted animals from consideration', () => {
      const store = setup();
      // Elwyn is '010' in MOCK_ANIMALS, Kelly is '007' (2024-05-19)
      store.adopt('010', 'Adopter');
      const result = store.getMostRecentResidentAnimal();

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Kelly');
    });

    it('returns null when animal list is empty or no valid dates', () => {
      const store = setup();
      expect(store.getMostRecentResidentAnimal([])).toBeNull();
      expect(store.getMostRecentResidentAnimal([makeAnimal({ surrenderedAt: undefined })])).toBeNull();
    });

    it('returns null when all animals are adopted', () => {
      const store = setup();
      const animals = [makeAnimal({ id: '1', surrenderedAt: '2024-01-01' })];
      store.adopt('1', 'Adopter');
      expect(store.getMostRecentResidentAnimal(animals)).toBeNull();
    });
  });
});
