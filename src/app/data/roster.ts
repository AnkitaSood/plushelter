export interface Animal {
  id: string;
  name: string;
  species: string;
  condition: string;
  backstory: string;
  photoUrl?: string;
  available: boolean;
}

export const MOCK_ANIMALS: Animal[] = [
  {
    id: '001',
    name: 'Horace',
    species: 'Bear',
    condition: 'Good — a few reinforced seams, otherwise sound',
    backstory:
      "Did a long stretch in SAlcatraz's rehabilitation wing before turning his life around. Years of institutional therapy left him calm, disciplined, and genuinely low-maintenance — the kind of even-tempered, medium-size bear who's great with kids and doesn't need much beyond a steady routine.",
    photoUrl: '/images/horace.jpg',
    available: true,
  },
  {
    id: '002',
    name: 'Viola',
    species: 'Octopus',
    condition: 'Excellent',
    backstory:
      "Won the Stuffed Animal Science Fair in 2019 for her project on rising sea levels, and she's been fiercely self-sufficient ever since. Small, quiet, and happiest left to her own devices — about as low-maintenance and independent as they come.",
    photoUrl: '/images/viola.jpg',
    available: true,
  },
  {
    id: '003',
    name: 'Sabbatical',
    species: 'Hermit Crab',
    condition: 'Excellent, barely handled',
    backstory:
      'Technically a business consultant who\'s been "on sabbatical" since he arrived — tiny, aloof, and about the lowest-maintenance stuffy in the building. Prefers billable hours to belly rubs and mostly keeps to himself.',
    photoUrl: '/images/sabbatical.jpg',
    available: true,
  },
  {
    id: '004',
    name: 'Carlo',
    species: 'Bear',
    condition: 'Good',
    backstory:
      'A cleaning enthusiast who will absolutely help you make your bed. Medium-size and eager to please, Carlo needs a bit more day-to-day attention than most bears his size, but pays it back tenfold with tidy, high-energy devotion.',
    photoUrl: '/images/carlo.jpg',
    available: true,
  },
  {
    id: '005',
    name: 'Ron',
    species: 'Hyena',
    condition: 'Good, slightly matted fur',
    backstory:
      'A professional snuggler with a proven record. Medium-large and famously high-touch, Ron is the most affection-hungry animal on the roster — wonderful for someone who wants a constant, cuddly companion, higher-maintenance for anyone who does not.',
    photoUrl: '/images/ron.jpg',
    available: true,
  },
  {
    id: '006',
    name: 'Jefferson',
    species: 'Duck',
    condition: 'Fair, one wing reinforced',
    backstory:
      'A relentless cryptocurrency enthusiast who will pitch you on StuffyCoin within minutes of meeting. Small but chaotic and genuinely high-maintenance — best matched with an experienced, patient owner who can handle nonstop energy.',
    photoUrl: '/images/jefferson.jpg',
    available: true,
  },
  {
    id: '007',
    name: 'Kelly',
    species: 'Cow',
    condition: 'Excellent',
    backstory:
      'An outdoor adventurer who lives for hikes, kayaking, and riding in the basket of a dirt bike. Large and relentlessly high-energy, Kelly needs an active household — not a low-maintenance choice, but a rewarding one for the right family.',
    photoUrl: '/images/kelly.jpg',
    available: false,
  },
  {
    id: '008',
    name: 'Misha',
    species: 'Grizzly Bear',
    condition: 'Good — retired from the ring',
    backstory:
      'A multi-year resident with a former career as a professional wrestler. Large and imposing on sight, Misha is actually the gentlest, calmest animal in the building — surprisingly low-maintenance and great with kids despite the size.',
    photoUrl: '/images/misha.jpg',
    available: true,
  },
  {
    id: '009',
    name: 'Shelley',
    species: 'Turtle',
    condition: 'Excellent, shell fully intact',
    backstory:
      'Famously philosophical and famously immobile. Tiny, quiet, and about as low-maintenance as a stuffy gets — Shelley is content to sit still and contemplate the universe, which suits a calm household perfectly.',
    photoUrl: '/images/shelley.jpg',
    available: true,
  },
  {
    id: '010',
    name: 'Elwyn',
    species: 'Goat',
    condition: 'Good',
    backstory:
      "An accountant by disposition, meticulous and numerically minded despite an aversion to using a calculator with hooves. Medium-size, orderly, and moderate-maintenance — Elwyn does best with a routine-loving family who appreciates a tidy, methodical companion.",
    photoUrl: '/images/elwyn.jpg',
    available: true,
  },
];
