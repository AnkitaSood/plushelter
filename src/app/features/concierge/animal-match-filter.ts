import { computed, Signal } from '@angular/core';
import type { Animal } from '../../data/roster';

/**
 * The concierge's search tool can return a broader candidate pool than what Gemini
 * actually recommends in prose (e.g. a weak keyword match falls back to the whole
 * roster). This narrows the pool down to just the animals named in the reply, so the
 * case-file cards always agree with what was said — falling back to the full pool
 * only if the reply doesn't name any of the candidates by name.
 */
export function matchedAnimals(candidates: Signal<Animal[]>, replyText: Signal<string>): Signal<Animal[]> {
  return computed(() => {
    const pool = candidates();
    const text = replyText().toLowerCase();
    const named = pool.filter((animal) => text.includes(animal.name.toLowerCase()));
    return named.length > 0 ? named : pool;
  });
}
