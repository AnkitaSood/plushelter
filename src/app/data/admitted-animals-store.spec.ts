import { TestBed } from '@angular/core/testing';
import { AdmittedAnimalsStore } from './admitted-animals-store';
import type { Animal } from './roster';

function makeAnimal(overrides: Partial<Animal> = {}): Animal {
  return {
    id: crypto.randomUUID(),
    name: 'Test',
    species: 'Bear',
    condition: 'Good',
    backstory: '',
    available: false,
    ...overrides,
  };
}

describe('AdmittedAnimalsStore', () => {
  function setup(): AdmittedAnimalsStore {
    TestBed.configureTestingModule({});
    return TestBed.inject(AdmittedAnimalsStore);
  }

  it('starts empty', () => {
    expect(setup().admitted()).toEqual([]);
  });

  it('admit() appends the animal', () => {
    const store = setup();
    const animal = makeAnimal({ name: 'Newbie' });
    store.admit(animal);
    expect(store.admitted()).toEqual([animal]);
  });

  it('admits accumulate in insertion order', () => {
    const store = setup();
    store.admit(makeAnimal({ name: 'First' }));
    store.admit(makeAnimal({ name: 'Second' }));
    expect(store.admitted().map((a) => a.name)).toEqual(['First', 'Second']);
  });
});
