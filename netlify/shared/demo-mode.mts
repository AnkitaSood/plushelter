import { MOCK_ANIMALS } from '../../src/app/data/roster.ts';

export function isDemoMode(): boolean {
  const mode = typeof Netlify !== 'undefined' && Netlify.env
    ? Netlify.env.get('DEMO_MODE')
    : (typeof Deno !== 'undefined' ? Deno.env.get('DEMO_MODE') : process.env.DEMO_MODE);
  return mode === 'true' || mode === '1';
}

/**
 * Simulates per-token delay for streaming responses.
 * In DEMO_MODE, this creates a realistic feel without network latency.
 */
export async function simulateTokenDelay(ms: number = 50): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Canned responses for DEMO_MODE
export const DEMO_RESPONSES = {
  intakeTriage: {
    species: 'Stuffed Tiger',
    condition: 'Slightly worn but structurally sound',
    suggestedCaseName: 'Stripe #2847',
    huggabilityScore: 8,
    recommendedTreatmentPlan: [
      'Inspect seams for loose stitching',
      'Gentle surface wash if needed',
      'Check for embedded lint',
      'Verify eyes are firmly attached',
    ],
  },
  conciergeChat: {
    tokens: [
      "Based on what you're looking for, I'd recommend Horace — a bear who did a long stretch in rehabilitation and came out the other side genuinely low-maintenance. ",
      "He's calm, even-tempered, and great with kids.",
    ],
    animals: [MOCK_ANIMALS[0]],
  },
  animals: MOCK_ANIMALS,
  surrenderAnalysis: {
    guiltScore: 65,
    message: 'Surrendering a cherished companion requires courage. Your concern demonstrates responsibility.',
  },
};
