import { Injectable, signal } from '@angular/core';

export interface HitlRequest {
  animalId: string;
  procedureName: string;
  estimatedStuffingLoss: string;
  riskLevel: string;
}

export interface HitlDecision {
  approved: boolean;
  reason?: string;
}

export const HITL_SURFACE_ID = 'hitl-authorization';

@Injectable({ providedIn: 'root' })
export class HitlAuthorizationService {
  private readonly _pendingRequest = signal<HitlRequest | null>(null);
  readonly pendingRequest = this._pendingRequest.asReadonly();

  private pendingResolver: ((decision: HitlDecision) => void) | null = null;

  /**
   * Called by WebMCP / Copilot tools when human approval is required before execution.
   * Prompts the user in the agent panel and halts execution until a decision is made.
   */
  requestAuthorization(req: HitlRequest): Promise<HitlDecision> {
    this._pendingRequest.set(req);

    return new Promise<HitlDecision>((resolve) => {
      this.pendingResolver = resolve;
    });
  }

  resolveDecision(approved: boolean, reason?: string): void {
    if (this.pendingResolver) {
      const resolver = this.pendingResolver;
      this.pendingResolver = null;
      this._pendingRequest.set(null);
      resolver({ approved, reason });
    }
  }
}
