import { MOCK_ANIMALS } from './roster';
import type { Animal } from './roster';

describe('MOCK_ANIMALS', () => {
  it('has at least 8 animals', () => {
    expect(MOCK_ANIMALS.length).toBeGreaterThanOrEqual(8);
  });

  it('every animal has required string fields', () => {
    for (const a of MOCK_ANIMALS) {
      expect(typeof a.id).toBe('string');
      expect(a.id.length).toBeGreaterThan(0);
      expect(typeof a.name).toBe('string');
      expect(a.name.length).toBeGreaterThan(0);
      expect(typeof a.species).toBe('string');
      expect(typeof a.condition).toBe('string');
      expect(typeof a.backstory).toBe('string');
      expect(typeof a.available).toBe('boolean');
    }
  });

  it('all ids are unique', () => {
    const ids = MOCK_ANIMALS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('at least one animal is available', () => {
    expect(MOCK_ANIMALS.some((a) => a.available)).toBe(true);
  });
});
