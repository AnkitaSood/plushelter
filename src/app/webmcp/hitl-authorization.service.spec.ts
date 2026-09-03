import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { HitlAuthorizationService, HITL_SURFACE_ID } from './hitl-authorization.service';
import {
  BasicCatalog,
  provideA2Ui,
  A2uiRendererService,
} from '@a2ui/angular/v0_9';
import {
  createShelterCustomCatalog,
  provideShelterMarkdownRenderer,
} from '../a2ui/shelter-catalog';
import { A2uiActionDispatcherService } from '../a2ui/a2ui-action-dispatcher.service';
import { provideRouter } from '@angular/router';

describe('HitlAuthorizationService (Human-In-The-Loop Confirmation)', () => {
  let hitl: HitlAuthorizationService;
  let a2ui: A2uiRendererService;
  let dispatcher: A2uiActionDispatcherService;

  beforeEach(async () => {
    (document as any).adoptedStyleSheets = [];

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideShelterMarkdownRenderer(),
        provideA2Ui(() => ({
          catalogs: [new BasicCatalog(), createShelterCustomCatalog()],
          actionHandler: (action) => dispatcher.dispatch(action),
        })),
        HitlAuthorizationService,
        A2uiActionDispatcherService,
      ],
    });

    hitl = TestBed.inject(HitlAuthorizationService);
    a2ui = TestBed.inject(A2uiRendererService);
    dispatcher = TestBed.inject(A2uiActionDispatcherService);
  });

  it('renders an A2UI authorization surface when a procedure requires human clearance', async () => {
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

    // Check A2UI surface was mounted
    const surface = a2ui.surfaceGroup.getSurface(HITL_SURFACE_ID);
    expect(surface).toBeDefined();

    const title = surface?.componentsModel.get('hitl-title');
    expect(title).toBeDefined();

    const gauge = surface?.componentsModel.get('hitl-gauge');
    expect(gauge).toBeDefined();

    // User approves through action dispatcher
    dispatcher.dispatch({
      name: 'hitl_decision',
      context: { approved: true, animalId: '001', procedure: 'Total Fluff Replacement' },
    } as any);

    const result = await authPromise;
    expect(result.approved).toBe(true);
    expect(hitl.pendingRequest()).toBeNull();

    // Surface was cleaned up
    expect(a2ui.surfaceGroup.getSurface(HITL_SURFACE_ID)).toBeUndefined();
  });

  it('handles procedure rejection when human declines authorization', async () => {
    const authPromise = hitl.requestAuthorization({
      animalId: '002',
      procedureName: 'Micro-Suture Eye Re-anchoring',
      estimatedStuffingLoss: '5% polyfill',
      riskLevel: 'moderate',
    });

    // User rejects through action dispatcher
    dispatcher.dispatch({
      name: 'hitl_decision',
      context: { approved: false, reason: 'Risk too high' },
    } as any);

    const result = await authPromise;
    expect(result.approved).toBe(false);
    expect(result.reason).toBe('Risk too high');
    expect(hitl.pendingRequest()).toBeNull();
  });
});
