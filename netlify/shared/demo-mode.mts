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
  adoptionCertificate: {
    certificateText:
      "By the authority vested in S.A.R.F.'s placement registrar, this certifies that Horace has been placed " +
      "in the household of Jamie, who notes a strict no-shoes-on-the-couch policy — a rule Horace, with his " +
      "reinforced seams and disciplined temperament, is expected to observe without incident. Welcome home.",
  },
  faq: [
    {
      id: 'adoption',
      title: 'Adoption Process',
      icon: '🏠',
      items: [
        { question: 'How do I adopt a stuffed animal?', answer: 'Browse our Active Case Roster for cleared animals, then start a placement request through our Intake Triage page. Our AI concierge will guide you through compatibility screening.' },
        { question: 'Is there an adoption fee?', answer: 'Never. Plushelter placements are free — we match on compatibility, not cash. Monetary donations are always welcome but never required.' },
        { question: 'How long does the adoption process take?', answer: 'Most placements clear within 1–3 business days once our triage AI confirms a match. Complex cases (animals with specialized care plans) may take up to a week.' },
        { question: 'Can I meet the animal before committing?', answer: 'Absolutely. All animals on the Active Case Roster have full backstories, condition reports, and photos. We also host periodic Petting Zoo pop-up events — follow us for announcements.' },
        { question: 'My application was declined. Can I reapply?', answer: 'Yes! Applications are declined for specific compatibility reasons, not personal ones. Review the feedback from our AI concierge, adjust, and resubmit.' },
        { question: 'Can I return an animal if we don\'t get along?', answer: 'Due to our thorough AI-driven screening process, personality conflicts are rare. But if something isn\'t working, contact us — we\'ll find a resolution on a case-by-case basis.' }
      ]
    },
    {
      id: 'repairs',
      title: 'Repairs & Rehabilitation',
      icon: '🧵',
      items: [
        { question: 'Do you repair stuffed animals?', answer: 'Yes! Our rehabilitation wing handles seam reinforcement, stuffing replenishment, eye reattachment, and surface cleaning. Animals marked "Under repair" on the Roster are currently in treatment.' },
        { question: 'How long does rehabilitation take?', answer: 'It depends on the case. A simple seam fix takes a day; a full destuffing-and-restuffing can take a week. Track status on the Active Case Roster page.' },
        { question: 'Can I bring in my own stuffed animal for repairs?', answer: 'Plushelter primarily handles shelter residents, but we accept outside repair requests by appointment. Use the Intake Triage page and mark "repair only."' },
        { question: 'Do the animals need vaccinations?', answer: 'All rehabilitation is completed before an animal is cleared for placement. No further shots, pills, or check-ups required — just snuggles.' }
      ]
    },
    {
      id: 'facility',
      title: 'Facility & Operations',
      icon: '🏢',
      items: [
        { question: 'Where is Plushelter located?', answer: 'We\'re a fully digital shelter — all interactions happen right here on this site. No physical facility to visit, but every stuffed animal gets the same first-class digital care.' },
        { question: 'Who runs Plushelter?', answer: 'Plushelter is a demo app built for an Angular conference talk. It\'s inspired by The SARF (thesarf.org), a very real and very delightful stuffed animal rescue foundation in Austin, TX.' },
        { question: 'Is this a real shelter?', answer: 'Plushelter is satirical — the animals are fictional, but the Angular patterns powering the app are production-grade. Think of it as a tech demo that takes plush welfare very seriously.' },
        { question: 'Do you accept stuffed-animal donations?', answer: 'In the Plushelter universe, absolutely. Use the Intake Triage page to surrender an animal. In real life, consider donating to The SARF (thesarf.org).' }
      ]
    },
    {
      id: 'logistics',
      title: 'Logistics & Practical Info',
      icon: '📦',
      items: [
        { question: 'Do stuffed animals eat?', answer: 'Not a thing. Unlike live pets, stuffed animals require zero food, water, or treats. Individual care requirements center on snuggling frequency, sleeping arrangements, and preferred transportation methods.' },
        { question: 'Do they bite?', answer: 'No stuffed animal has ever bitten anyone. Some may be socially awkward (looking at you, Jefferson the cryptocurrency duck), but physical harm potential is effectively zero.' },
        { question: 'What\'s a "huggability score"?', answer: 'Our AI triage system rates each incoming animal on a 1–10 huggability scale based on softness, structural integrity, and overall cuddle potential. Higher is snugglier.' },
        { question: 'What does "Cleared for placement" mean?', answer: 'It means the animal has passed all rehabilitation checks — seams inspected, stuffing verified, eyes secured — and is ready for a forever home.' }
      ]
    }
  ],
};
