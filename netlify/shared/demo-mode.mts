import { MOCK_ANIMALS } from '../../src/app/data/roster.ts';
import { FAQ_DATA } from '../../src/app/data/faq-data.ts';

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
  // Canned two-phase loop for the in-browser WebMCP agent (/api/agent). First the model "decides" to
  // call a page tool; the browser runs it and calls back; then the model narrates the result.
  webmcpAgent: {
    interactionId: 'demo-interaction-1',
    planTokens: ['Let me check the roster for you. '],
    toolCall: {
      id: 'demo-call-1',
      name: 'searchRoster',
      arguments: { criteria: 'low-maintenance' },
    },
    narrationTokens: [
      'I searched the shelter roster and found a solid low-maintenance match. ',
      'Horace, a rehabilitated bear, is calm, even-tempered, and cleared for placement.',
    ],
  },
  animals: MOCK_ANIMALS,
  surrenderAnalysis: {
    guiltScore: 65,
    message: 'Surrendering a cherished companion requires courage. Your concern demonstrates responsibility.',
  },
  rosterSearch: {
    matches: [
      { id: '001', reason: 'Cleared for placement as a low-maintenance companion following an extended rehabilitation stay.' },
      { id: '003', reason: 'A self-sufficient resident whose independent temperament suits a low-contact household.' },
    ],
  },
  adoptionCertificate: {
    certificateText:
      "By the authority vested in S.A.R.F.'s placement registrar, this certifies that Horace has been placed " +
      "in the household of Jamie, who notes a strict no-shoes-on-the-couch policy — a rule Horace, with his " +
      "reinforced seams and disciplined temperament, is expected to observe without incident. Welcome home.",
  },
  faq: FAQ_DATA,
};
