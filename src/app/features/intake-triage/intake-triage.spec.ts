import { toPartialCaseFile } from './intake-triage';
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
