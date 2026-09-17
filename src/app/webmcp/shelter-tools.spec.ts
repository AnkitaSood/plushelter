import { TestBed } from '@angular/core/testing';
import { AdmittedAnimalsStore } from '../data/admitted-animals-store';
import { AdoptedAnimalsStore } from '../data/adopted-animals-store';
import { MOCK_ANIMALS } from '../data/roster';
import {
  admitAnimalTool,
  animalDurationStatsTool,
  filterRosterBySpeciesTool,
  performCriticalMedicalProcedureTool,
  searchRosterTool,
  shelterStatsTool,
  SHELTER_TOOL_REGISTRY,
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

    it('returns no matches for criteria that hits nothing', () => {
      const text = run(searchRosterTool, { criteria: 'zzz-no-such-thing' });
      expect(text).toBe('No cleared animals match that description.');
    });

    it('returns no matches for empty criteria, rather than the whole roster', () => {
      const text = run(searchRosterTool, { criteria: '' });
      expect(text).toBe('No cleared animals match that description.');
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

    it('matches low-maintenance animals whether hyphenated or space-separated', () => {
      const hyphenText = run(searchRosterTool, { criteria: 'low-maintenance' });
      expect(hyphenText).toContain('Horace');
      expect(hyphenText).toContain('Viola');
      expect(hyphenText).toContain('Sabbatical');
      expect(hyphenText).toContain('Misha');
      expect(hyphenText).toContain('Shelley');
      // Must include backstory so the model has grounding context
      expect(hyphenText).toContain('institutional therapy');
      // Must not match high-maintenance animals
      expect(hyphenText).not.toContain('Ron');
      expect(hyphenText).not.toContain('Jefferson');

      const spaceText = run(searchRosterTool, { criteria: 'low maintenance' });
      expect(spaceText).toContain('Horace');
      expect(spaceText).not.toContain('Ron');

      const companionText = run(searchRosterTool, { criteria: 'low-maintenance companion' });
      expect(companionText).toContain('Horace');
      expect(companionText).toContain('Viola');
      expect(companionText).not.toContain('Ron');
    });

    it('accepts alternate property names like query or prompt from LLM calls', () => {
      const queryText = run(searchRosterTool, { query: 'low-maintenance' });
      expect(queryText).toContain('Horace');

      const promptText = run(searchRosterTool, { prompt: 'octopus' });
      expect(promptText).toContain('Viola');

      // WebMCP executeTool passes JSON-serialized strings
      const jsonStringText = run(searchRosterTool, '{"criteria":"low-maintenance"}');
      expect(jsonStringText).toContain('Horace');
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

  describe('getAnimalDurationStats', () => {
    it('returns longest resident when prompted about longest time in shelter', () => {
      const text = run(animalDurationStatsTool, {
        query: 'which animal has been in the shelter for the longest time',
      });
      expect(text).toContain('Shelley');
      expect(text).toContain('has been in the shelter for the longest time');
      expect(text).toContain('years');
    });

    it('returns most recently admitted resident when prompted about most recently admitted', () => {
      const text = run(animalDurationStatsTool, {
        query: 'which animal has been most recently admitted to the shelter',
      });
      expect(text).toContain('Elwyn');
      expect(text).toContain('has been most recently admitted to the shelter');
      expect(text).toContain('years');
    });

    it('handles explicit type filter parameters', () => {
      const longestText = run(animalDurationStatsTool, { type: 'longest' });
      expect(longestText).toContain('Shelley');

      const recentText = run(animalDurationStatsTool, { type: 'recent' });
      expect(recentText).toContain('Elwyn');
    });

    it('always reflects the most recent updates to the store (admissions and adoptions)', () => {
      // 1. Newly admitted animal becomes the most recent resident
      const admittedStore = TestBed.inject(AdmittedAnimalsStore);
      admittedStore.admit({
        id: 'new-zebra-id',
        name: 'Ziggy',
        species: 'Zebra',
        condition: 'Mint',
        backstory: 'A recent arrival',
        available: true,
        surrenderedAt: new Date().toISOString(),
      });

      const recentText = run(animalDurationStatsTool, { query: 'most recently admitted' });
      expect(recentText).toContain('Ziggy');

      // 2. Adopting Shelley causes next earliest (Misha) to become the longest resident
      const adoptedStore = TestBed.inject(AdoptedAnimalsStore);
      adoptedStore.adopt('009', 'Ankita'); // Shelley is 009

      const longestText = run(animalDurationStatsTool, { query: 'longest time in the shelter' });
      expect(longestText).toContain('Misha');
      expect(longestText).not.toContain('Shelley');
    });

    it('returns both stats when called with empty or generic query', () => {
      const text = run(animalDurationStatsTool, {});
      expect(text).toContain('Longest resident:');
      expect(text).toContain('Most recently admitted:');
      expect(text).toContain('Shelley');
      expect(text).toContain('Elwyn');
    });
  });

  describe('tool annotations', () => {
    it('defines WebMCP annotations for all registered shelter tools', () => {
      expect(SHELTER_TOOL_REGISTRY.length).toBeGreaterThan(0);
      for (const entry of SHELTER_TOOL_REGISTRY) {
        expect(entry.tool.annotations).toBeDefined();
        expect(typeof entry.tool.annotations?.readOnlyHint).toBe('boolean');
        expect(typeof entry.tool.annotations?.consequentialHint).toBe('boolean');
        expect(typeof entry.tool.annotations?.untrustedContentHint).toBe('boolean');
      }
    });

    it('marks read-only query tools with readOnlyHint: true and consequentialHint: false', () => {
      expect(searchRosterTool.annotations).toEqual({
        readOnlyHint: true,
        consequentialHint: false,
        untrustedContentHint: false,
      });

      expect(shelterStatsTool.annotations).toEqual({
        readOnlyHint: true,
        consequentialHint: false,
        untrustedContentHint: false,
      });

      expect(animalDurationStatsTool.annotations).toEqual({
        readOnlyHint: true,
        consequentialHint: false,
        untrustedContentHint: false,
      });

      expect(filterRosterBySpeciesTool.annotations).toEqual({
        readOnlyHint: true,
        consequentialHint: false,
        untrustedContentHint: false,
      });
    });

    it('marks state-mutating intake tool with readOnlyHint: false and consequentialHint: false', () => {
      expect(admitAnimalTool.annotations).toEqual({
        readOnlyHint: false,
        consequentialHint: false,
        untrustedContentHint: false,
      });
    });

    it('marks high-stakes HITL clinical procedure with consequentialHint: true and readOnlyHint: false', () => {
      expect(performCriticalMedicalProcedureTool.annotations).toEqual({
        readOnlyHint: false,
        consequentialHint: true,
        untrustedContentHint: false,
      });
    });
  });
});

