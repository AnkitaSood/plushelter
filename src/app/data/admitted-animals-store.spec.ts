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

  it('has() reports whether an animal is admitted', () => {
    const store = setup();
    const admitted = makeAnimal({ id: 'admitted-id' });
    store.admit(admitted);

    expect(store.has('admitted-id')).toBe(true);
    expect(store.has('missing-id')).toBe(false);
  });

  it('remove() deletes only the matching animal', () => {
    const store = setup();
    const first = makeAnimal({ id: 'first-id', name: 'First' });
    const second = makeAnimal({ id: 'second-id', name: 'Second' });

    store.admit(first);
    store.admit(second);
    store.remove('first-id');

    expect(store.admitted()).toEqual([second]);
  });

  it('clear() removes all admitted animals', () => {
    const store = setup();
    store.admit(makeAnimal({ name: 'First' }));
    store.admit(makeAnimal({ name: 'Second' }));

    store.clear();

    expect(store.admitted()).toEqual([]);
  });
});
