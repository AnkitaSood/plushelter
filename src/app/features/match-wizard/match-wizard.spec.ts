import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdaptiveMatchWizard } from './match-wizard';
import {
  BasicCatalog,
  provideA2Ui,
  A2uiRendererService,
} from '@a2ui/angular/v0_9';
import {
  createShelterCustomCatalog,
  provideShelterMarkdownRenderer,
} from '../../a2ui/shelter-catalog';
import { A2uiActionDispatcherService } from '../../a2ui/a2ui-action-dispatcher.service';
import { provideRouter } from '@angular/router';

describe('AdaptiveMatchWizard (Dynamic Multi-Step A2UI Surface)', () => {
  let a2ui: A2uiRendererService;
  let dispatcher: A2uiActionDispatcherService;

  beforeEach(async () => {
    (document as any).adoptedStyleSheets = [];

    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: any) => {
      const body = JSON.parse(init?.body || '{}');
      const step = body.step ?? 1;

      if (step === 1) {
        return {
          ok: true,
          json: async () => ({
            promptTitle: 'Step 1: Habitat Architecture Assessment',
            promptBody: 'Disclose habitat...',
            options: [
              { id: 'opt-studio', label: 'Compact Studio', value: 'studio' },
              { id: 'opt-house', label: 'Suburban House', value: 'house' },
              { id: 'opt-desk', label: 'Tech Desk', value: 'desk' },
            ],
          }),
        };
      }

      if (step === 2) {
        return {
          ok: true,
          json: async () => ({
            promptTitle: 'Step 2: Behavioral Specialization',
            promptBody: 'Choose role...',
            options: [
              { id: 'opt-rubber-duck', label: 'Rubber Duck', value: 'debug' },
              { id: 'opt-heavyweight', label: 'Heavyweight', value: 'heavyweight' },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          matchedAnimalId: '001',
          compatibilityScore: 94,
          compatibilityRationale: 'High compatibility match with Horace.',
          checklistItems: [
            { label: 'Arrival protocol 1', checked: true },
            { label: 'Arrival protocol 2', checked: false },
          ],
        }),
      };
    }));

    await TestBed.configureTestingModule({
      imports: [AdaptiveMatchWizard],
      providers: [
        provideRouter([]),
        provideShelterMarkdownRenderer(),
        provideA2Ui(() => ({
          catalogs: [new BasicCatalog(), createShelterCustomCatalog()],
          actionHandler: (action) => dispatcher.dispatch(action),
        })),
        A2uiActionDispatcherService,
      ],
    }).compileComponents();

    a2ui = TestBed.inject(A2uiRendererService);
    dispatcher = TestBed.inject(A2uiActionDispatcherService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders Step 1 on initialization and mounts habitat options', async () => {
    const fixture = TestBed.createComponent(AdaptiveMatchWizard);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component['currentStep']()).toBe(1);

    const surface = a2ui.surfaceGroup.getSurface(component.surfaceId);
    expect(surface).toBeDefined();

    const title = surface?.componentsModel.get('title');
    expect(title).toBeDefined();
    expect(title?.properties['text']).toContain('Step 1');

    const studioOpt = surface?.componentsModel.get('opt-studio');
    expect(studioOpt).toBeDefined();
  });

  it('transitions from Step 1 to Step 2 dynamically adapting questions upon action dispatch', async () => {
    const fixture = TestBed.createComponent(AdaptiveMatchWizard);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Dispatch living situation selection
    dispatcher.dispatch({
      name: 'select_living',
      context: { living: 'desk' },
    } as any);

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component['currentStep']()).toBe(2);

    const surface = a2ui.surfaceGroup.getSurface(component.surfaceId);
    expect(surface).toBeDefined();

    const duckOpt = surface?.componentsModel.get('opt-rubber-duck');
    expect(duckOpt).toBeDefined();
  });

  it('transitions to Step 3 and renders the final matched AnimalCard and compatibility gauge', async () => {
    const fixture = TestBed.createComponent(AdaptiveMatchWizard);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Advance to step 2
    dispatcher.dispatch({
      name: 'select_living',
      context: { living: 'house' },
    } as any);
    await fixture.whenStable();
    fixture.detectChanges();

    // Advance to step 3
    dispatcher.dispatch({
      name: 'select_role',
      context: { role: 'heavyweight' },
    } as any);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component['currentStep']()).toBe(3);

    const surface = a2ui.surfaceGroup.getSurface(component.surfaceId);
    expect(surface).toBeDefined();

    const card = surface?.componentsModel.get('animal-card');
    expect(card).toBeDefined();
    expect(card?.type).toBe('AnimalCard');

    const gauge = surface?.componentsModel.get('compatibility-gauge');
    expect(gauge).toBeDefined();
    expect(gauge?.type).toBe('RiskGauge');
  });

  it('resets back to Step 1 when resetWizard() is called', async () => {
    const fixture = TestBed.createComponent(AdaptiveMatchWizard);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    dispatcher.dispatch({
      name: 'select_living',
      context: { living: 'apartment' },
    } as any);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component['currentStep']()).toBe(2);

    component.resetWizard();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component['currentStep']()).toBe(1);
    const surface = a2ui.surfaceGroup.getSurface(component.surfaceId);
    expect(surface?.componentsModel.get('title')?.properties['text']).toContain('Step 1');
  });

  it('cleans up surface on component destruction', () => {
    const fixture = TestBed.createComponent(AdaptiveMatchWizard);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(a2ui.surfaceGroup.getSurface(component.surfaceId)).toBeDefined();

    fixture.destroy();
    expect(a2ui.surfaceGroup.getSurface(component.surfaceId)).toBeUndefined();
  });

  it('does NOT trigger infinite fetch calls when selecting an option at step 2', async () => {
    let fetchCount = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: any) => {
      fetchCount++;
      const body = JSON.parse(init?.body || '{}');
      const step = body.step ?? 1;
      return {
        ok: true,
        json: async () => ({
          promptTitle: `Step ${step}`,
          promptBody: 'Test prompt',
          options: [{ id: 'opt-test', label: 'Test', value: 'test' }],
          matchedAnimalId: '001',
          compatibilityScore: 90,
          compatibilityRationale: 'Test rationale',
          checklistItems: [{ label: 'Item 1', checked: true }],
        }),
      };
    }));

    const fixture = TestBed.createComponent(AdaptiveMatchWizard);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fetchCount).toBe(1); // Step 1 initial request

    dispatcher.dispatch({ name: 'select_living', context: { living: 'desk' } } as any);
    await fixture.whenStable();
    expect(fetchCount).toBe(2); // Step 2 request

    // Dispatched option at step 2
    dispatcher.dispatch({ name: 'select_role', context: { role: 'debug' } } as any);
    await fixture.whenStable();
    expect(fetchCount).toBe(3); // Exactly ONE request for Step 3, not infinite
    expect(fixture.componentInstance['currentStep']()).toBe(3);
  });
});
