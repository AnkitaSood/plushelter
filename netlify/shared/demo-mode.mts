/**
 * Shared DEMO_MODE helper for both Functions and Edge Functions.
 * Switches all endpoints to canned responses when DEMO_MODE env var is set.
 */

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
      'Verify eyes are firmly attached'
    ]
  },
  conciergeChat: {
    tokens: [
      'Based on your criteria, I would recommend Whiskers, a rabbit with excellent ',
      'temperament suitable for young children. The breed is naturally low-maintenance '
    ],
    animals: [
      {
        id: '001',
        name: 'Whiskers',
        species: 'Rabbit',
        condition: 'Excellent',
        available: true
      }
    ]
  },
  animals: [
    {
      id: '001',
      name: 'Whiskers',
      species: 'Rabbit',
      condition: 'Excellent',
      backstory: 'Soft plush rabbit from the 1980s',
      photoUrl: '/images/whiskers.jpg',
      available: true
    },
    {
      id: '002',
      name: 'Stripe',
      species: 'Tiger',
      condition: 'Good',
      backstory: 'Carnival prize tiger, well-loved',
      photoUrl: '/images/stripe.jpg',
      available: true
    }
  ],
  surrenderAnalysis: {
    guiltScore: 65,
    message: 'Surrendering a cherished companion requires courage. Your concern demonstrates responsibility.'
  }
};
