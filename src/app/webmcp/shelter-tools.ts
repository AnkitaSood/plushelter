import { inject, type WebMcpToolDescriptor } from '@angular/core';
import { MOCK_ANIMALS, UNDER_REPAIR_PLACEHOLDER, type Animal } from '../data/roster';
import { AdmittedAnimalsStore } from '../data/admitted-animals-store';
import { AdoptedAnimalsStore } from '../data/adopted-animals-store';

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
export type ShelterTool = WebMcpToolDescriptor<any>;

/** Every WebMCP tool returns MCP content blocks; ours are all plain text. */
function text(body: string): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: body }] };
}

function describe(a: Animal): string {
  return `${a.name} — ${a.species} (${a.condition})`;
}

/** APP-LEVEL: available on every route except /faq (see app.routes.ts's app-tools parent route). */
export const searchRosterTool: ShelterTool = {
  name: 'searchRoster',
  description:
    "Search the shelter's cleared-for-placement roster by free-text criteria (species, " +
    'temperament, condition, or keywords from an animal\'s backstory).',
  inputSchema: {
    type: 'object',
    properties: { criteria: { type: 'string', description: 'What the adopter is looking for.' } },
    required: ['criteria'],
    additionalProperties: false,
  },
  execute: (args) => {
    const criteria = String((args as { criteria?: unknown })?.criteria ?? '').toLowerCase().trim();
    const all = [...MOCK_ANIMALS, ...inject(AdmittedAnimalsStore).admitted()].filter((a) => a.available);
    const matches = criteria
      ? all.filter((a) => `${a.name} ${a.species} ${a.condition} ${a.backstory}`.toLowerCase().includes(criteria))
      : all;
    return text(matches.length ? matches.map(describe).join('\n') : 'No cleared animals match that description.');
  },
};

/** APP-LEVEL: a live count of the shelter's current state (same /faq exclusion as searchRosterTool). */
export const shelterStatsTool: ShelterTool = {
  name: 'getShelterStats',
  description: 'Report current shelter counts: total animals on file, cleared for placement, admitted this session, and adopted this session.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
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
  execute: (args) => {
    const species = String((args as { species?: unknown })?.species ?? '').toLowerCase().trim();
    const matches = [...MOCK_ANIMALS, ...inject(AdmittedAnimalsStore).admitted()].filter(
      (a) => a.species.toLowerCase() === species,
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
    };
    inject(AdmittedAnimalsStore).admit(animal);
    return text(`Admitted ${animal.name} (${animal.species}) to the roster as under repair.`);
  },
};

/** Tools registered via `provideExperimentalWebMcpTools` on the app-tools parent route in
 * app.routes.ts — every route except /faq inherits these. */
export const APP_TOOLS: ShelterTool[] = [searchRosterTool, shelterStatsTool];

/** Tools registered only on the /roster route (with auto-cleanup on navigation away). */
export const ROSTER_ROUTE_TOOLS: ShelterTool[] = [filterRosterBySpeciesTool];

/** How each tool is registered — surfaced by the Agent Console so the four surfaces are legible. */
export interface RegisteredTool {
  scope: 'Application' | 'Route · /roster' | 'Service' | 'Signal Form';
  tool: ShelterTool;
}

/**
 * The inventory the Agent Console renders + invokes. This mirrors (does not replace) the real
 * WebMCP registrations; it's what makes the tools visible and clickable on the projector.
 * `admitAnimalTool`'s "Service" scope is now provided from intake triage's route providers
 * (see app.routes.ts), not the app root — see `ShelterAgentService`'s doc comment.
 */
export const SHELTER_TOOL_REGISTRY: RegisteredTool[] = [
  { scope: 'Application', tool: searchRosterTool },
  { scope: 'Application', tool: shelterStatsTool },
  { scope: 'Route · /roster', tool: filterRosterBySpeciesTool },
  { scope: 'Service', tool: admitAnimalTool },
];
