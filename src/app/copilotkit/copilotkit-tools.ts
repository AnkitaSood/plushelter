import { inject, Service } from '@angular/core';
import { registerFrontendTool } from '@copilotkit/angular';
import { z } from 'zod';
import { MOCK_ANIMALS, type Animal } from '../data/roster';
import { AdmittedAnimalsStore } from '../data/admitted-animals-store';
import { AdoptedAnimalsStore } from '../data/adopted-animals-store';
import { SurrenderRequestsStore } from '../features/intake-triage/surrender-requests-store';
import { surrenderToPhotosPendingAnimal } from '../features/intake-triage/surrender-flow';
import { HitlAuthorizationService } from '../webmcp/hitl-authorization.service';
import {
  clearedRoster,
  matchRosterByCriteria,
  extractCriteria,
} from '../webmcp/shelter-tools';

function describe(a: Animal): string {
  const detail = a.backstory ? `: ${a.backstory}` : '';
  return `${a.name} — ${a.species} (${a.condition})${detail}`;
}

@Service()
export class ShelterCopilotToolsService {
  private readonly admittedStore = inject(AdmittedAnimalsStore);
  private readonly adoptedStore = inject(AdoptedAnimalsStore);
  private readonly requestsStore = inject(SurrenderRequestsStore);
  private readonly hitl = inject(HitlAuthorizationService);

  constructor() {
    this.registerAllTools();
  }

  private getClearedPool(): Animal[] {
    const adoptedIds = new Set(this.adoptedStore.adoptions().map((r) => r.animalId));
    return clearedRoster(this.admittedStore.admitted(), adoptedIds);
  }

  private registerAllTools(): void {
    // 1. searchRoster
    registerFrontendTool({
      name: 'searchRoster',
      description:
        'Search the shelter roster by free-text criteria (species, personality, special needs, maintenance level). Returns matching animals with their IDs, names, species, condition, and backstories.',
      parameters: z.object({
        criteria: z.string().describe('Search query describing the desired companion'),
      }),
      webmcp: {
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
      },
      handler: async (args) => {
        const query = extractCriteria(args);
        const pool = this.getClearedPool();
        const matches = matchRosterByCriteria(query, pool);

        if (matches.length === 0) {
          const suggestions = pool.slice(0, 3).map(describe).join('\n');
          return `No animals currently match "${query}". Here are a few residents currently available:\n${suggestions}`;
        }
        return matches.map(describe).join('\n');
      },
    });

    // 2. getShelterStats
    registerFrontendTool({
      name: 'getShelterStats',
      description:
        'Report current shelter counts: total animals ever admitted, currently available for adoption, and total adoptions finalized.',
      parameters: z.object({}),
      webmcp: {
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
      },
      handler: async () => {
        const admittedCount = this.admittedStore.admitted().length;
        const adoptedCount = this.adoptedStore.adoptions().length;
        const totalAdmittedEver = MOCK_ANIMALS.length + admittedCount;
        const availableNow = totalAdmittedEver - adoptedCount;

        return (
          `Total animals ever admitted: ${totalAdmittedEver}\n` +
          `Currently available for adoption: ${availableNow}\n` +
          `Total adoptions finalized: ${adoptedCount}`
        );
      },
    });

    // 3. getAnimalDurationStats
    registerFrontendTool({
      name: 'getAnimalDurationStats',
      description:
        'Get duration statistics for shelter animals: which animal has been in the shelter for the longest time, or which animal has been most recently admitted.',
      parameters: z.object({
        query: z.string().optional().describe('Duration question or query prompt'),
        type: z.enum(['longest', 'most_recent', 'recent', 'both']).optional().describe('Metric type'),
      }),
      webmcp: {
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
      },
      handler: async (args) => {
        const queryStr = String(args.query ?? args.type ?? '').toLowerCase();
        const currentAnimals = [...MOCK_ANIMALS, ...this.admittedStore.admitted()];
        const isLongest = queryStr.includes('long') || queryStr.includes('oldest') || queryStr.includes('earliest');
        const isRecent = queryStr.includes('recent') || queryStr.includes('new') || queryStr.includes('latest');

        const longest = this.adoptedStore.getLongestResidentAnimalInfo(currentAnimals);
        const mostRecent = this.adoptedStore.getMostRecentResidentAnimal(currentAnimals);

        if (!longest && !mostRecent) {
          return 'No resident animals currently on file in the shelter.';
        }

        if (isLongest && !isRecent) {
          return longest
            ? `${longest.name} has been in the shelter for the longest time: ${longest.duration}.`
            : 'No resident animals currently on file in the shelter.';
        }

        if (isRecent && !isLongest) {
          return mostRecent
            ? `${mostRecent.name} has been most recently admitted to the shelter: ${mostRecent.duration}.`
            : 'No resident animals currently on file in the shelter.';
        }

        const parts: string[] = [];
        if (longest) parts.push(`Longest resident: ${longest.name} (${longest.duration})`);
        if (mostRecent) parts.push(`Most recently admitted: ${mostRecent.name} (${mostRecent.duration})`);
        return parts.join('\n');
      },
    });

    // 4. getSurrenderInfo
    registerFrontendTool({
      name: 'getSurrenderInfo',
      description:
        'Look up information about the shelter surrender process, including the surrender fee policy, guilt-mitigation counseling, and how to surrender a stuffed animal.',
      parameters: z.object({}),
      webmcp: {
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
      },
      handler: async () => {
        return (
          'Surrender Information:\n' +
          '• Surrender fee: $0 (free, subsidized by generous donors and emotional reparations)\n' +
          '• Guilt counseling: Every surrender undergoes automated guilt scoring and therapeutic debriefing\n' +
          '• Intake triage: Physical condition (seam tension, stuffing density) is assessed on arrival\n' +
          '• How to surrender: Use the "Intake / Surrender" tab in the navigation bar to submit a case'
        );
      },
    });

    // 5. admitAnimal
    registerFrontendTool({
      name: 'admitAnimal',
      description:
        'Admit a newly surrendered stuffed animal into the shelter after physical intake and triage. Adds the animal to the shelter roster as available for adoption.',
      parameters: z.object({
        name: z.string().describe('The animal name'),
        species: z.string().describe('Species, e.g. Bear, Rabbit, Dog'),
        condition: z.string().describe('Condition assessment'),
        backstory: z.string().optional().describe('Background story'),
      }),
      webmcp: {
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: false,
        },
      },
      handler: async ({ name, species, condition, backstory }) => {
        const id = `admit-${Date.now()}`;
        const newAnimal: Animal = {
          id,
          name,
          species,
          condition,
          backstory: backstory ?? 'Recently surrendered to the care of Plushelter.',
          photoUrl: 'https://images.unsplash.com/photo-1559454403-b8fb88521f11?w=400',
          available: true,
          underRepair: false,
          photosPending: false,
          surrenderedAt: new Date().toISOString().split('T')[0],
        };

        this.admittedStore.admit(newAnimal);
        return `ADMITTED: ${name} the ${species} has been registered into the shelter roster (ID: ${id}) with condition "${condition}". Available for adoption immediately.`;
      },
    });

    // 6. performCriticalMedicalProcedure
    registerFrontendTool({
      name: 'performCriticalMedicalProcedure',
      description:
        'Perform an invasive surgical or restorative medical procedure on a stuffed animal patient. Requires clinical review.',
      parameters: z.object({
        animalId: z.string().describe('ID of the animal being treated'),
        procedureName: z.string().describe('Clinical name of the procedure'),
        estimatedStuffingLoss: z.string().optional().describe('Anticipated loss of batting'),
        riskLevel: z.string().optional().describe('Assessed risk: moderate or critical'),
      }),
      webmcp: {
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: false,
        },
      },
      handler: async ({ animalId, procedureName, estimatedStuffingLoss, riskLevel }) => {
        const decision = await this.hitl.requestAuthorization({
          animalId,
          procedureName,
          estimatedStuffingLoss: estimatedStuffingLoss ?? '15% polyfill',
          riskLevel: riskLevel ?? 'critical',
        });

        if (!decision.approved) {
          return `PROCEDURE DENIED BY HUMAN CLINICAL DIRECTOR: "${procedureName}" was rejected. Pivoting to conservative therapy.`;
        }
        return `PROCEDURE AUTHORIZED AND COMPLETED: "${procedureName}" successfully performed on patient #${animalId}. Post-op stuffing levels stabilized.`;
      },
    });

    // 7. filterRosterBySpecies
    registerFrontendTool({
      name: 'filterRosterBySpecies',
      description:
        'Filter the shelter roster to a specific species: Bear, Rabbit, Dog, Dinosaur, Duck, or All. Updates the on-screen roster view.',
      parameters: z.object({
        species: z.string().describe('Species to filter to: Bear, Rabbit, Dog, Dinosaur, Duck, or All'),
      }),
      webmcp: {
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
      },
      handler: async ({ species }) => {
        const pool = this.getClearedPool();
        const filtered =
          species.toLowerCase() === 'all'
            ? pool
            : pool.filter((a) => a.species.toLowerCase() === species.toLowerCase());
        return `Filter applied for "${species}". ${filtered.length} matching residents:\n` +
          filtered.map((a) => `${a.name} (${a.species})`).join(', ');
      },
    });

    // 8. submitSurrenderRequest
    registerFrontendTool({
      name: 'submitSurrenderRequest',
      description:
        'File a stuffed-animal surrender request with the shelter. Provide the owner name, animal name, species, condition, and reason for surrender.',
      parameters: z.object({
        ownerName: z.string().describe('Name of the surrendering owner'),
        animalName: z.string().describe('Name of the animal'),
        species: z.string().describe('Species of the animal'),
        condition: z.string().describe('Current physical condition'),
        reason: z.string().describe('Reason for surrender'),
      }),
      webmcp: {
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: false,
        },
      },
      handler: async ({ ownerName, animalName, species, condition, reason }) => {
        const req = {
          ownerName,
          animalName,
          species,
          condition,
          reason,
          submittedAt: new Date().toISOString(),
        };
        this.requestsStore.add(req);
        this.admittedStore.admit(surrenderToPhotosPendingAnimal(req));
        return `SURRENDER FILED: ${animalName} (${species}) surrendered by ${ownerName}. Admitted to shelter roster with photos pending.`;
      },
    });
  }
}
