import { Service, inject, signal } from '@angular/core';
import { A2uiRendererService } from '@a2ui/angular/v0_9';
import type { A2uiMessage } from '@a2ui/web_core/v0_9';
import { SHELTER_CATALOG_ID } from '../a2ui/shelter-catalog';
import { A2uiActionDispatcherService } from '../a2ui/a2ui-action-dispatcher.service';

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

@Service()
export class HitlAuthorizationService {
  private readonly a2ui = inject(A2uiRendererService);
  private readonly dispatcher = inject(A2uiActionDispatcherService);

  private readonly _pendingRequest = signal<HitlRequest | null>(null);
  readonly pendingRequest = this._pendingRequest.asReadonly();

  private pendingResolver: ((decision: HitlDecision) => void) | null = null;

  constructor() {
    // Listen for client action dispatches from the HITL A2UI confirmation surface
    // Note: We register this inside the service to intercept 'hitl_decision'
  }

  /**
   * Called by WebMCP tools when human approval is required before execution.
   * Renders an interactive A2UI surface and halts execution until the human decides.
   */
  requestAuthorization(req: HitlRequest): Promise<HitlDecision> {
    this._pendingRequest.set(req);
    this.renderAuthorizationSurface(req);

    return new Promise<HitlDecision>((resolve) => {
      this.pendingResolver = resolve;
    });
  }

  resolveDecision(approved: boolean, reason?: string): void {
    if (this.pendingResolver) {
      const resolver = this.pendingResolver;
      this.pendingResolver = null;
      this._pendingRequest.set(null);
      this.a2ui.surfaceGroup.deleteSurface(HITL_SURFACE_ID);
      resolver({ approved, reason });
    }
  }

  private renderAuthorizationSurface(req: HitlRequest): void {
    const isCritical = req.riskLevel.toLowerCase() === 'critical';
    const messages: A2uiMessage[] = [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: HITL_SURFACE_ID,
          catalogId: SHELTER_CATALOG_ID,
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: HITL_SURFACE_ID,
          components: [
            {
              id: 'root',
              component: 'Column',
              children: [
                'hitl-stamp',
                'hitl-title',
                'hitl-gauge',
                'hitl-desc',
                'hitl-checklist',
                'hitl-btn-approve',
                'hitl-btn-reject',
              ],
            },
            {
              id: 'hitl-stamp',
              component: 'StatusStamp',
              status: isCritical ? 'critical' : 'pending',
              text: 'HUMAN CLINICAL AUTHORIZATION REQUIRED',
            },
            {
              id: 'hitl-title',
              component: 'Text',
              variant: 'h2',
              text: `Protocol Approval: ${req.procedureName}`,
            },
            {
              id: 'hitl-gauge',
              component: 'RiskGauge',
              score: isCritical ? 88 : 55,
              label: 'Procedural Seam Strain & Trauma Risk',
              sublabel: `Anticipated Batting Loss: ${req.estimatedStuffingLoss}. Requires steady hands and emotional grounding.`,
            },
            {
              id: 'hitl-desc',
              component: 'Text',
              variant: 'body',
              text: `The native WebMCP agent is requesting immediate clinical clearance to perform ${req.procedureName} on patient #${req.animalId}. This operation will modify the physical state of the patient in the shelter database.`,
            },
            {
              id: 'hitl-checklist',
              component: 'AdoptionChecklist',
              title: 'Prerequisite Safety Verification',
              items: [
                { label: 'Sterilize curved suture needle and dental floss', checked: true },
                { label: 'Prepare 100g hypoallergenic replacement fluff', checked: true },
                { label: 'Administer pre-op lavender aromatherapy calming mist', checked: false },
              ],
            },
            {
              id: 'hitl-btn-approve',
              component: 'Button',
              child: 'hitl-btn-approve-text',
              action: {
                event: {
                  name: 'hitl_decision',
                  context: { approved: true, animalId: req.animalId, procedure: req.procedureName },
                },
              },
            },
            {
              id: 'hitl-btn-approve-text',
              component: 'Text',
              text: '✓ Authorize Procedure (Proceed with WebMCP Execution)',
            },
            {
              id: 'hitl-btn-reject',
              component: 'Button',
              child: 'hitl-btn-reject-text',
              action: {
                event: {
                  name: 'hitl_decision',
                  context: { approved: false, animalId: req.animalId, procedure: req.procedureName },
                },
              },
            },
            {
              id: 'hitl-btn-reject-text',
              component: 'Text',
              text: '✕ Reject & Pivot to Conservative Non-Invasive Care',
            },
          ] as any,
        },
      },
    ];

    this.a2ui.processMessages(messages);
  }
}
