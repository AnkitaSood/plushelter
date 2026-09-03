import { TestBed } from '@angular/core/testing';
import { AdmittedAnimalsStore } from '../data/admitted-animals-store';
import { AdoptedAnimalsStore } from '../data/adopted-animals-store';
import { MOCK_ANIMALS } from '../data/roster';
import {
  admitAnimalTool,
  filterRosterBySpeciesTool,
  searchRosterTool,
  shelterStatsTool,
  type ShelterTool,
} from './shelter-tools';

/** Runs a tool's execute in an injection context (its body calls `inject()`) and returns text. */
function run(tool: ShelterTool, args: unknown): string {
  const out = TestBed.runInInjectionContext(() =>
    (tool.execute as (a: unknown, c: unknown) => { content: { text: string }[] })(args, {}),
  );
  return out.content.map((c) => c.text).join('\n');
}

describe('shelter WebMCP tools', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  describe('searchRoster', () => {
    it('returns only cleared animals matching the criteria', () => {
      const text = run(searchRosterTool, { criteria: 'bear' });
      expect(text.toLowerCase()).toContain('bear');
      // Kelly (id 007) is not available and must never surface.
      expect(text).not.toContain('Kelly');
    });

    it('falls back to all cleared animals when nothing matches', () => {
      const text = run(searchRosterTool, { criteria: 'zzz-no-such-thing' });
      expect(text).toBe('No cleared animals match that description.');
    });

    it('lists all cleared animals for an empty criteria', () => {
      const text = run(searchRosterTool, { criteria: '' });
      const clearedCount = MOCK_ANIMALS.filter((a) => a.available).length;
      expect(text.split('\n').length).toBe(clearedCount);
    });

    it('excludes animals that have been adopted', () => {
      // Find any cleared bear to adopt so we have a concrete target.
      const bear = MOCK_ANIMALS.find((a) => a.available && a.species === 'Bear');
      expect(bear).toBeDefined();

      const store = TestBed.inject(AdoptedAnimalsStore);
      store.adopt(bear!.id, 'Ankita');

      const text = run(searchRosterTool, { criteria: 'bear' });
      expect(text).not.toContain(bear!.name);
    });
  });

  describe('getShelterStats', () => {
    it('reflects animals admitted this session', () => {
      const store = TestBed.inject(AdmittedAnimalsStore);
      store.admit({
        id: 'x1',
        name: 'Patch',
        species: 'Rabbit',
        condition: 'New',
        backstory: '',
        available: false,
        underRepair: true,
      });
      const text = run(shelterStatsTool, {});
      expect(text).toContain('Admitted this session: 1');
    });
  });

  describe('filterRosterBySpecies', () => {
    it('returns only animals of the requested species', () => {
      const text = run(filterRosterBySpeciesTool, { species: 'Bear' });
      const lines = text.split('\n').filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.every((l) => l.includes('Bear'))).toBe(true);
    });

    it('excludes adopted animals from species filter results', () => {
      const bear = MOCK_ANIMALS.find((a) => a.species === 'Bear');
      expect(bear).toBeDefined();

      const store = TestBed.inject(AdoptedAnimalsStore);
      store.adopt(bear!.id, 'Ankita');

      const text = run(filterRosterBySpeciesTool, { species: 'Bear' });
      expect(text).not.toContain(bear!.name);
    });
  });

  describe('admitAnimal', () => {
    it('admits a new under-repair case to the store', () => {
      const store = TestBed.inject(AdmittedAnimalsStore);
      expect(store.admitted().length).toBe(0);
      const text = run(admitAnimalTool, { name: 'Buttons', species: 'Cat', condition: 'Torn ear' });
      expect(text).toContain('Buttons');
      expect(store.admitted().length).toBe(1);
      expect(store.admitted()[0]).toMatchObject({ name: 'Buttons', species: 'Cat', available: false, underRepair: true });
    });
  });
});
