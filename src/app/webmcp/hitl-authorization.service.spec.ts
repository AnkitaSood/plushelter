import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { HitlAuthorizationService } from './hitl-authorization.service';

describe('HitlAuthorizationService (Human-In-The-Loop Confirmation)', () => {
  let hitl: HitlAuthorizationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HitlAuthorizationService],
    });

    hitl = TestBed.inject(HitlAuthorizationService);
  });

  it('sets pending request when a procedure requires human clearance', async () => {
    expect(hitl.pendingRequest()).toBeNull();

    // Start authorization request in background
    const authPromise = hitl.requestAuthorization({
      animalId: '001',
      procedureName: 'Total Fluff Replacement',
      estimatedStuffingLoss: '25% polyfill',
      riskLevel: 'critical',
    });

    expect(hitl.pendingRequest()).toEqual({
      animalId: '001',
      procedureName: 'Total Fluff Replacement',
      estimatedStuffingLoss: '25% polyfill',
      riskLevel: 'critical',
    });

    // User approves through resolveDecision
    hitl.resolveDecision(true);

    const result = await authPromise;
    expect(result.approved).toBe(true);
    expect(hitl.pendingRequest()).toBeNull();
  });

  it('handles procedure rejection when human declines authorization', async () => {
    const authPromise = hitl.requestAuthorization({
      animalId: '002',
      procedureName: 'Micro-Suture Eye Re-anchoring',
      estimatedStuffingLoss: '5% polyfill',
      riskLevel: 'moderate',
    });

    expect(hitl.pendingRequest()).toBeDefined();

    // User rejects through resolveDecision
    hitl.resolveDecision(false, 'Risk too high');

    const result = await authPromise;
    expect(result.approved).toBe(false);
    expect(result.reason).toBe('Risk too high');
    expect(hitl.pendingRequest()).toBeNull();
  });
});
