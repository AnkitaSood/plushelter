import { Service, declareExperimentalWebMcpTool } from '@angular/core';
import { admitAnimalTool } from './shelter-tools';

/**
 * Demonstrates the SERVICE-LEVEL WebMCP surface: `declareExperimentalWebMcpTool` registers a
 * tool from within an injection context (this service's constructor) and auto-unregisters it
 * when that context is destroyed. Instantiated from intake triage's route providers (see
 * app.routes.ts), so `admitAnimal` is only available while that route is active.
 */
@Service()
export class ShelterAgentService {
  constructor() {
    void declareExperimentalWebMcpTool(admitAnimalTool);
  }
}
