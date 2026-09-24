import { inject, type WebMcpToolDescriptor } from '@angular/core';
import { MOCK_ANIMALS, UNDER_REPAIR_PLACEHOLDER, type Animal } from '../data/roster';
import { AdmittedAnimalsStore } from '../data/admitted-animals-store';
import { AdoptedAnimalsStore } from '../data/adopted-animals-store';
import { HitlAuthorizationService } from './hitl-authorization.service';

/**
 * WebMCP tool definitions for the shelter, defined ONCE and shared two ways:
 *  - passed to `provideExperimentalWebMcpTools()` / `declareExperimentalWebMcpTool()` so a real
 *    browser AI agent (via `document.modelContext`, e.g. behind a polyfill) can call them, and
 *  - listed + invoked directly by the in-app Agent Console (`runInInjectionContext`) so the
 *    capability is visible and demoable on stage without depending on any agent runtime.
 *
 * The `<any>` on the schema generic is deliberate: that generic exists purely to infer the
 * `execute` argument types from the JSON Schema. We validate/coerce args at runtime instead
 * (WebMCP does not guarantee the agent's args match the schema), which keeps these definitions
 * readable — the tradeoff the Angular docs' own "validate tool inputs" note calls for.
 */
/**
 * In Angular 22.2.0+, `WebMcpToolDescriptor` natively supports `annotations?: Annotations`
 * (`readOnlyHint`, `untrustedContentHint`, `consequentialHint`).
 */
export type WebMcpToolAnnotations = NonNullable<WebMcpToolDescriptor<any>['annotations']>;

export type ShelterTool = WebMcpToolDescriptor<any>;

/** Every WebMCP tool returns MCP content blocks; ours are all plain text. */
function text(body: string): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: body }] };
}

function describe(a: Animal): string {
  const detail = a.backstory ? `: ${a.backstory}` : '';
  return `${a.name} — ${a.species} (${a.condition})${detail}`;
}

export const animalDurationStatsTool: ShelterTool = {
  name: 'getAnimalDurationStats',
  description:
    'Get duration statistics for shelter animals: which animal has been in the shelter for the longest time, ' +
    'or which animal has been most recently admitted to the shelter.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'The prompt or question, e.g. "which animal has been in the shelter for the longest time" ' +
          'or "which animal has been most recently admitted to the shelter".',
      },
      type: {
        type: 'string',
        description: 'Specific duration metric: "longest" for longest resident, or "recent" / "most_recent" for most recently admitted.',
        enum: ['longest', 'most_recent', 'recent', 'both'],
      },
    },
    additionalProperties: true,
  },
  annotations: {
    readOnlyHint: true,
    consequentialHint: false,
    untrustedContentHint: false,
  },
  execute: (args) => {
    const rawArgs = args ?? {};
    let queryStr = '';
    if (typeof rawArgs === 'string') {
      queryStr = rawArgs;
    } else if (typeof rawArgs === 'object' && rawArgs !== null) {
      const obj = rawArgs as Record<string, unknown>;
      queryStr = String(
        obj['query'] ??
        obj['prompt'] ??
        obj['type'] ??
        obj['criteria'] ??
        obj['statType'] ??
        obj['which'] ??
        obj['question'] ??
        Object.values(obj).filter((v) => typeof v === 'string').join(' ')
      );
    }
    const q = queryStr.toLowerCase().trim();

    const adoptedStore = inject(AdoptedAnimalsStore);
    const admittedStore = inject(AdmittedAnimalsStore);
    const currentAnimals = [...MOCK_ANIMALS, ...admittedStore.admitted()];

    const isLongest = q.includes('long') || q.includes('oldest') || q.includes('earliest') || q.includes('first');
    const isRecent = q.includes('recent') || q.includes('new') || q.includes('admit') || q.includes('latest') || q.includes('last');

    const longest = adoptedStore.getLongestResidentAnimalInfo(currentAnimals);
    const mostRecent = adoptedStore.getMostRecentResidentAnimal(currentAnimals);

    if (!longest && !mostRecent) {
      return text('No resident animals currently on file in the shelter.');
    }

    if (isLongest && !isRecent) {
      if (!longest) return text('No resident animals currently on file in the shelter.');
      return text(`${longest.name} has been in the shelter for the longest time: ${longest.duration}.`);
    }

    if (isRecent && !isLongest) {
      if (!mostRecent) return text('No resident animals currently on file in the shelter.');
      return text(`${mostRecent.name} has been most recently admitted to the shelter: ${mostRecent.duration}.`);
    }

    // When both or neither are explicitly targeted, return both
    const parts: string[] = [];
    if (longest) {
      parts.push(`Longest resident: ${longest.name} (${longest.duration})`);
    }
    if (mostRecent) {
      parts.push(`Most recently admitted: ${mostRecent.name} (${mostRecent.duration})`);
    }
    return text(parts.join('\n'));
  },
};

/** Words too short or too generic to usefully narrow a match on their own. */
const CRITERIA_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'who', 'that', 'this', 'looking', 'someone', 'something', 'want', 'wants',
  'companion', 'companions', 'animal', 'animals', 'stuffy', 'stuffies', 'pet', 'pets', 'resident', 'residents',
  'friend', 'friends', 'creature', 'creatures', 'one', 'ones', 'type', 'types',
]);

/** Robustly extracts search criteria from raw tool arguments, accommodating varied property names from LLMs and serialized JSON strings. */
export function extractCriteria(args: unknown): string {
  if (!args) return '';
  if (typeof args === 'string') {
    const trimmed = args.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null) {
          args = parsed;
        } else {
          return trimmed;
        }
      } catch {
        return trimmed;
      }
    } else {
      return trimmed;
    }
  }
  if (typeof args === 'object' && args !== null) {
    const obj = args as Record<string, unknown>;
    const val =
      obj['criteria'] ??
      obj['query'] ??
      obj['prompt'] ??
      obj['search'] ??
      obj['keywords'] ??
      obj['filter'] ??
      obj['temperament'] ??
      obj['species'];
    if (typeof val === 'string') return val.trim();
    const stringVals = Object.values(obj).filter(
      (v): v is string => typeof v === 'string' && v.trim().length > 0,
    );
    if (stringVals.length > 0) return stringVals[0].trim();
  }
  return '';
}

function matchesToken(haystack: string, token: string): boolean {
  if (haystack.includes(token)) return true;
  return token.endsWith('s') && token.length > 3 && haystack.includes(token.slice(0, -1));

}

export function matchRosterByCriteria(criteria: string, all: Animal[]): Animal[] {
  const raw = criteria.toLowerCase().trim();
  if (!raw) return [];

  // Normalize hyphens and punctuation to spaces for flexible tokenization
  const normalized = raw.replace(/[-_]+/g, ' ');
  const tokens = normalized
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !CRITERIA_STOPWORDS.has(w));
  if (tokens.length === 0) return [];

  // If multiple tokens are provided (e.g. "low maintenance", "calm bear"), prefer animals
  // matching all tokens so high-maintenance animals don't match on "maintenance" alone.
  if (tokens.length > 1) {
    const allTokenMatches = all.filter((a) => {
      const haystack = `${a.name} ${a.species} ${a.condition} ${a.backstory}`
        .toLowerCase()
        .replace(/[-_]+/g, ' ');
      return tokens.every((token) => matchesToken(haystack, token));
    });
    if (allTokenMatches.length > 0) {
      // Sort exact phrase match first
      return allTokenMatches.sort((a, b) => {
        const aHaystack = `${a.name} ${a.species} ${a.condition} ${a.backstory}`
          .toLowerCase()
          .replace(/[-_]+/g, ' ');
        const bHaystack = `${b.name} ${b.species} ${b.condition} ${b.backstory}`
          .toLowerCase()
          .replace(/[-_]+/g, ' ');
        const aPhrase = aHaystack.includes(normalized) ? 1 : 0;
        const bPhrase = bHaystack.includes(normalized) ? 1 : 0;
        return bPhrase - aPhrase;
      });
    }
  }

  return all.filter((a) => {
    const haystack = `${a.name} ${a.species} ${a.condition} ${a.backstory}`
      .toLowerCase()
      .replace(/[-_]+/g, ' ');
    return tokens.some((token) => matchesToken(haystack, token));
  });
}

/** The cleared-for-placement, not-yet-adopted pool `searchRosterTool` and concierge both search over. */
export function clearedRoster(admitted: Animal[], adoptedIds: Set<string>): Animal[] {
  return [...MOCK_ANIMALS, ...admitted].filter((a) => a.available && !adoptedIds.has(a.id));
}

/** APP-LEVEL: available on every route. */
export const searchRosterTool: ShelterTool = {
  name: 'searchRoster',
  description:
    "Search the shelter's cleared-for-placement, not-yet-adopted roster by free-text criteria (species, " +
    'temperament, condition, or keywords from an animal\'s backstory).',
  inputSchema: {
    type: 'object',
    properties: { criteria: { type: 'string', description: 'What the adopter is looking for.' } },
    required: ['criteria'],
    additionalProperties: true,
  },
  annotations: {
    readOnlyHint: true,
    consequentialHint: false,
    untrustedContentHint: false,
  },
  execute: (args) => {
    const criteria = extractCriteria(args);
    const adoptedIds = new Set(inject(AdoptedAnimalsStore).adoptions().map((r) => r.animalId));
    const all = clearedRoster(inject(AdmittedAnimalsStore).admitted(), adoptedIds);
    const matches = matchRosterByCriteria(criteria, all);
    return text(matches.length ? matches.map(describe).join('\n') : 'No cleared animals match that description.');
  },
};

/** APP-LEVEL: static shelter-policy lookup, no store dependency. Mirrors chat.mts's retired getSurrenderInfo. */
export const getSurrenderInfoTool: ShelterTool = {
  name: 'getSurrenderInfo',
  description:
    'Look up how an adopter surrenders a stuffed animal to the shelter. Call this whenever someone says they ' +
    'want to give up, surrender, or hand over an animal — do not answer from general knowledge about donating toys.',
  inputSchema: {
    type: 'object',
    properties: { animalName: { type: 'string', description: 'Name of the animal being surrendered, if mentioned.' } },
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    consequentialHint: false,
    untrustedContentHint: false,
  },
  execute: (args) => {
    const animalName = (args as { animalName?: unknown })?.animalName;
    return text(
      "To surrender a stuffed animal, use the shelter's Intake Triage page — it walks through the animal's " +
        'condition and assigns a huggability score before admitting it to the roster as an under-repair case.' +
        (typeof animalName === 'string' && animalName ? ` (Regarding: ${animalName}.)` : ''),
    );
  },
};

/** APP-LEVEL: a live count of the shelter's current state (same /faq exclusion as searchRosterTool). */
export const shelterStatsTool: ShelterTool = {
  name: 'getShelterStats',
  description: 'Report current shelter counts: total animals on file, cleared for placement, admitted this session, and adopted this session.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: {
    readOnlyHint: true,
    consequentialHint: false,
    untrustedContentHint: false,
  },
  execute: () => {
    const admitted = inject(AdmittedAnimalsStore).admitted();
    const adopted = inject(AdoptedAnimalsStore).adoptions();
    const all = [...MOCK_ANIMALS, ...admitted];
    const cleared = all.filter((a) => a.available).length;
    return text(
      `Total on file: ${all.length}. Cleared for placement: ${cleared}. ` +
        `Admitted this session: ${admitted.length}. Adopted this session: ${adopted.length}.`,
    );
  },
};

/** ROUTE-LEVEL: only registered while the /roster route is active. */
export const filterRosterBySpeciesTool: ShelterTool = {
  name: 'filterRosterBySpecies',
  description: 'List every animal on the roster of a given species. Only available while viewing the Active Case Roster.',
  inputSchema: {
    type: 'object',
    properties: { species: { type: 'string', description: 'Exact species to filter by, e.g. "Bear".' } },
    required: ['species'],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    consequentialHint: false,
    untrustedContentHint: false,
  },
  execute: (args) => {
    const species = String((args as { species?: unknown })?.species ?? '').toLowerCase().trim();
    const adoptedIds = new Set(inject(AdoptedAnimalsStore).adoptions().map((r) => r.animalId));
    const matches = [...MOCK_ANIMALS, ...inject(AdmittedAnimalsStore).admitted()].filter(
      (a) => a.species.toLowerCase() === species && !adoptedIds.has(a.id),
    );
    return text(matches.length ? matches.map(describe).join('\n') : `No animals on file of species "${species}".`);
  },
};

/** SERVICE-LEVEL: a state-mutating action — the agent admits a new case to the roster.
 * Only registered while intake triage ('/') is active (see app.routes.ts) — deliberately
 * excluded from /roster, where a case is already admitted, and from /faq. */
export const admitAnimalTool: ShelterTool = {
  name: 'admitAnimal',
  description: "Admit a new stuffed animal to the shelter roster as an under-repair case that isn't yet cleared for placement.",
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Case name for the animal.' },
      species: { type: 'string', description: 'Species, e.g. "Bear".' },
      condition: { type: 'string', description: 'Short condition note.' },
    },
    required: ['name', 'species'],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: false,
    consequentialHint: false,
    untrustedContentHint: false,
  },
  execute: (args) => {
    const a = args as { name?: unknown; species?: unknown; condition?: unknown };
    const animal: Animal = {
      id: crypto.randomUUID(),
      name: String(a?.name ?? 'Unnamed case'),
      species: String(a?.species ?? 'Unknown'),
      condition: String(a?.condition ?? 'Awaiting assessment'),
      backstory: '',
      photoUrl: UNDER_REPAIR_PLACEHOLDER,
      available: false,
      underRepair: true,
      surrenderedAt: new Date().toISOString(),
    };
    inject(AdmittedAnimalsStore).admit(animal);
    return text(`Admitted ${animal.name} (${animal.species}) to the roster as under repair.`);
  },
};

/** HITL TOOL: Performs an invasive clinical rehabilitation procedure requiring human clearance. */
export const performCriticalMedicalProcedureTool: ShelterTool = {
  name: 'performCriticalMedicalProcedure',
  description:
    'Authorize and execute an invasive clinical rehabilitation procedure on a stuffed animal (e.g. Total Fluff Replacement, Micro-Suture Eye Re-anchoring). Requires human authorization before execution.',
  inputSchema: {
    type: 'object',
    properties: {
      animalId: { type: 'string', description: 'ID of the animal being treated.' },
      procedureName: { type: 'string', description: 'Clinical name of the procedure.' },
      estimatedStuffingLoss: { type: 'string', description: 'Anticipated loss of internal batting (e.g. "15% polyfill").' },
      riskLevel: { type: 'string', description: 'Assessed risk: "moderate" or "critical".' },
    },
    required: ['animalId', 'procedureName'],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: false,
    consequentialHint: true,
    untrustedContentHint: false,
  },
  execute: async (args) => {
    const a = args as { animalId?: unknown; procedureName?: unknown; estimatedStuffingLoss?: unknown; riskLevel?: unknown };
    const animalId = String(a?.animalId ?? '001');
    const procedureName = String(a?.procedureName ?? 'Total Fluff Replacement');
    const loss = String(a?.estimatedStuffingLoss ?? '15% polyfill');
    const risk = String(a?.riskLevel ?? 'critical');

    const hitl = inject(HitlAuthorizationService);
    const decision = await hitl.requestAuthorization({
      animalId,
      procedureName,
      estimatedStuffingLoss: loss,
      riskLevel: risk,
    });

    if (!decision.approved) {
      return text(`PROCEDURE DENIED BY HUMAN CLINICAL DIRECTOR: "${procedureName}" was rejected. Pivoting to conservative therapy.`);
    }

    return text(`PROCEDURE AUTHORIZED AND COMPLETED: "${procedureName}" successfully performed on patient #${animalId}. Post-op stuffing levels stabilized.`);
  },
};

/** Tools registered via `provideExperimentalWebMcpTools` on the app-tools parent route in
 * app.routes.ts — every route except /faq inherits these. */
export const APP_TOOLS: ShelterTool[] = [
  searchRosterTool,
  shelterStatsTool,
  animalDurationStatsTool,
  performCriticalMedicalProcedureTool,
  getSurrenderInfoTool,
];

/** Tools registered only on the /roster route (with auto-cleanup on navigation away). */
export const ROSTER_ROUTE_TOOLS: ShelterTool[] = [filterRosterBySpeciesTool];

export interface RegisteredTool {
  scope: 'Application' | 'Route · /roster' | 'Service' | 'Signal Form';
  tool: ShelterTool;
}

export const SHELTER_TOOL_REGISTRY: RegisteredTool[] = [
  { scope: 'Application', tool: searchRosterTool },
  { scope: 'Application', tool: shelterStatsTool },
  { scope: 'Application', tool: animalDurationStatsTool },
  { scope: 'Application', tool: performCriticalMedicalProcedureTool },
  { scope: 'Application', tool: getSurrenderInfoTool },
  { scope: 'Route · /roster', tool: filterRosterBySpeciesTool },
  { scope: 'Service', tool: admitAnimalTool },
];
