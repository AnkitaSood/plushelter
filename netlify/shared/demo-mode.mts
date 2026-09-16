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

  matchWizard: {
    step1: {
      promptTitle: 'Step 1: Habitat Architecture Assessment',
      promptBody: 'Pursuant to S.A.R.F. Placement Regulation §4.2, applicants must disclose the primary habitat in which the companion will reside. Please select the configuration that most accurately describes your domicile.',
      options: [
        { id: 'opt-apartment', label: '🏢 Compact Studio / Urban Apartment — low ambient noise, minimal shelf footprint required', value: 'apartment' },
        { id: 'opt-house',    label: '🏡 Suburban House — multi-room territory, elevated cuddle capacity per square meter',      value: 'house' },
        { id: 'opt-desk',     label: '💻 Workstation / Tech Desk — high-pressure environment, non-vocal support role preferred', value: 'desk' },
      ],
    },
    step2: (livingValue: string) => {
      if (livingValue === 'desk') {
        return {
          promptTitle: 'Step 2: Behavioral Specialization — Workstation Track',
          promptBody: 'Desk environments require a companion certified in non-disruptive co-working protocols. Please indicate the primary functional role required.',
          options: [
            { id: 'opt-debug',  label: '🦆 Rubber-Duck Debugging Specialist — attentive silence during architecture crises', value: 'debug' },
            { id: 'opt-stress', label: '🧘 High-Density Tactile Decompression Unit — approved for deadline-induced distress',  value: 'stress' },
          ],
        };
      }
      if (livingValue === 'house') {
        return {
          promptTitle: 'Step 2: Behavioral Specialization — Residential Track',
          promptBody: 'A multi-room domicile opens additional placement options. Please specify the companion\'s primary duty assignment.',
          options: [
            { id: 'opt-heavyweight', label: '🐻 Full-Scale Heavyweight — high cuddle endurance, shelf-anchor certified',          value: 'heavyweight' },
            { id: 'opt-pack',        label: '🐰 Pack Integration Candidate — thrives alongside existing plush cohort',            value: 'pack' },
          ],
        };
      }
      // apartment / default
      return {
        promptTitle: 'Step 2: Behavioral Specialization — Urban Track',
        promptBody: 'Apartment living demands respectful volume levels and a modest territorial footprint. Indicate the specialization most aligned with your daily routine.',
        options: [
          { id: 'opt-cuddle',  label: '🛋️ Discreet Sofa Companion — low-energy, observational temperament',              value: 'cuddle' },
          { id: 'opt-reading', label: '🌙 Reading Lamp Observer — tolerates extended late-night reading sessions',          value: 'reading' },
        ],
      };
    },
    step3: {
      matchedAnimalId: '001',
      compatibilityScore: 94,
      compatibilityRationale:
        'Based on habitat profile and behavioral role declaration, Case #001 (Horace) presents the strongest psycho-fabric alignment. ' +
        'His documented rehabilitation history and confirmed low-maintenance temperament satisfy the applicant\'s stated environmental constraints.',
      checklistItems: [
        { label: 'Designate primary resting shelf with moderate ambient light exposure', checked: true },
        { label: 'Confirm gentle-handling agreement with all household occupants', checked: true },
        { label: 'Schedule introductory welcome hug within 10 minutes of arrival', checked: false },
        { label: 'Submit Placement Registration Form PS-7 to S.A.R.F. records office', checked: false },
      ],
    },
  },

  // AG-UI recorded stream fixtures for offline demo & deterministic testing
  agUiFixtures: {
    // Standard tool calling conversation
    toolCallFlow: {
      threadId: 'thread-demo-1',
      runId: 'run-demo-1',
      planText: 'Let me inspect our resident roster to see who is available. ',
      toolCall: {
        id: 'call-roster-1',
        name: 'searchRoster',
        args: { criteria: 'calm bear' },
        interactionId: 'interaction-demo-1',
      },
      narrationText:
        'I found Horace! He is a calm, low-maintenance bear who is fully cleared for placement.',
    },

    // A2UI Generative Surface response
    a2uiSurfaceFlow: {
      threadId: 'thread-demo-a2ui',
      runId: 'run-demo-a2ui',
      messageId: 'msg-a2ui-1',
      introText: 'Here is Horace\'s official shelter case file and temperament assessment:',
      surfaceId: 'surface-horace-match',
      a2uiMessages: [
        {
          version: 'v0.9',
          createSurface: {
            surfaceId: 'surface-horace-match',
            catalogId: 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json',
          },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'surface-horace-match',
            components: [
              {
                id: 'root',
                component: 'Column',
                children: ['header', 'details', 'action-btn'],
              },
              {
                id: 'header',
                component: 'Text',
                variant: 'h2',
                text: { path: '/name' },
              },
              {
                id: 'details',
                component: 'Text',
                variant: 'body',
                text: { path: '/summary' },
              },
              {
                id: 'action-btn',
                component: 'Button',
                child: 'action-btn-text',
                action: {
                  event: {
                    name: 'start_adoption',
                    context: { animalId: '001' },
                  },
                },
              },
              {
                id: 'action-btn-text',
                component: 'Text',
                text: 'Begin Adoption Case',
              },
            ],
          },
        },
        {
          version: 'v0.9',
          updateDataModel: {
            surfaceId: 'surface-horace-match',
            path: '/',
            value: {
              name: 'Horace (Case #001)',
              summary:
                'Species: Bear | Size: Medium | Status: Cleared for placement. Exceptionally calm and well-behaved.',
            },
          },
        },
      ],
    },
  },
};

