import { caseFileToUnderRepairAnimal, toPartialCaseFile } from './intake-triage';
import { UNDER_REPAIR_PLACEHOLDER } from '../../data/roster';
import type { Animal } from '../../data/roster';

describe('toPartialCaseFile', () => {
  it('returns undefined when given undefined', () => {
    expect(toPartialCaseFile(undefined)).toBeUndefined();
  });

  it('maps name to suggestedCaseName', () => {
    const animal: Animal = {
      id: '001', name: 'Horace', species: 'Bear',
      condition: 'Good', backstory: 'A bear.', available: true,
    };
    expect(toPartialCaseFile(animal)?.suggestedCaseName).toBe('Horace');
  });

  it('maps species and condition through unchanged', () => {
    const animal: Animal = {
      id: '002', name: 'Viola', species: 'Octopus',
      condition: 'Excellent', backstory: 'An octopus.', available: true,
    };
    const result = toPartialCaseFile(animal);
    expect(result?.species).toBe('Octopus');
    expect(result?.condition).toBe('Excellent');
  });

  it('defaults huggabilityScore to 0 and recommendedTreatmentPlan to []', () => {
    const animal: Animal = {
      id: '003', name: 'Sabbatical', species: 'Hermit Crab',
      condition: 'Excellent', backstory: 'A crab.', available: true,
    };
    const result = toPartialCaseFile(animal);
    expect(result?.huggabilityScore).toBe(0);
    expect(result?.recommendedTreatmentPlan).toEqual([]);
  });
});

describe('caseFileToUnderRepairAnimal', () => {
  it('maps name, species, and condition through unchanged', () => {
    const animal = caseFileToUnderRepairAnimal({ name: 'Patches', species: 'Bear', condition: 'Torn seam' });
    expect(animal.name).toBe('Patches');
    expect(animal.species).toBe('Bear');
    expect(animal.condition).toBe('Torn seam');
  });

  it('marks the animal under repair, unavailable, with the shared placeholder photo', () => {
    const animal = caseFileToUnderRepairAnimal({ name: 'Patches', species: 'Bear', condition: 'Torn seam' });
    expect(animal.underRepair).toBe(true);
    expect(animal.available).toBe(false);
    expect(animal.photoUrl).toBe(UNDER_REPAIR_PLACEHOLDER);
    expect(animal.backstory).toBe('');
  });

  it('mints a non-empty, unique id per call', () => {
    const a = caseFileToUnderRepairAnimal({ name: 'a', species: 'Bear', condition: 'ok' });
    const b = caseFileToUnderRepairAnimal({ name: 'a', species: 'Bear', condition: 'ok' });
    expect(a.id.length).toBeGreaterThan(0);
    expect(a.id).not.toBe(b.id);
  });

  it('falls back to "Unnamed case" when the name is empty', () => {
    const animal = caseFileToUnderRepairAnimal({ name: '', species: 'Bear', condition: 'ok' });
    expect(animal.name).toBe('Unnamed case');
  });
});
