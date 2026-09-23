import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SurrenderRiskReport } from './surrender-risk';
import { AdmittedAnimalsStore } from '../../data/admitted-animals-store';
import {
  BasicCatalog,
  provideA2Ui,
} from '@a2ui/angular/v0_9';
import {
  createShelterCustomCatalog,
  provideShelterMarkdownRenderer,
} from '../../a2ui/shelter-catalog';
import { A2uiActionDispatcherService } from '../../a2ui/a2ui-action-dispatcher.service';
import { provideRouter } from '@angular/router';

describe('SurrenderRiskReport (A2UI Generative Assessment)', () => {
  let dispatcher: A2uiActionDispatcherService;
  let admittedStore: AdmittedAnimalsStore;

  beforeEach(async () => {
    (document as any).adoptedStyleSheets = [];

    await TestBed.configureTestingModule({
      imports: [SurrenderRiskReport],
      providers: [
        provideRouter([]),
        provideShelterMarkdownRenderer(),
        provideA2Ui(() => ({
          catalogs: [new BasicCatalog(), createShelterCustomCatalog()],
          actionHandler: (action) => dispatcher.dispatch(action),
        })),
        AdmittedAnimalsStore,
        A2uiActionDispatcherService,
      ],
    }).compileComponents();

    dispatcher = TestBed.inject(A2uiActionDispatcherService);
    admittedStore = TestBed.inject(AdmittedAnimalsStore);
  });

  it('initializes with default patient data and no active report', () => {
    const fixture = TestBed.createComponent(SurrenderRiskReport);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['animalName']()).toBe('Barnaby the Bear');
    expect(component['hasReport']()).toBe(false);
    expect(component['operations']()).toHaveLength(0);
  });

  it('generates an A2UI risk surface with RiskGauge, CustomChart, and AdoptionChecklist', () => {
    const fixture = TestBed.createComponent(SurrenderRiskReport);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.generateReport();
    fixture.detectChanges();

    expect(component['hasReport']()).toBe(true);

    const ops = component['operations']();
    expect(ops.length).toBeGreaterThan(0);

    // Verify component composition
    const updateCompOp = ops.find((op) => op.updateComponents);
    expect(updateCompOp).toBeDefined();

    const components = updateCompOp.updateComponents.components;
    const gauge = components.find((c: any) => c.id === 'guilt-gauge');
    expect(gauge).toBeDefined();
    expect(gauge.component).toBe('RiskGauge');

    const chart = components.find((c: any) => c.id === 'risk-chart');
    expect(chart).toBeDefined();
    expect(chart.component).toBe('CustomChart');

    const checklist = components.find((c: any) => c.id === 'clinical-checklist');
    expect(checklist).toBeDefined();
    expect(checklist.component).toBe('AdoptionChecklist');

    // Verify data model
    const dataOp = ops.find((op) => op.updateDataModel);
    expect(dataOp).toBeDefined();
    expect(dataOp.updateDataModel.value.guiltScore).toBe(78);
    expect(dataOp.updateDataModel.value.statusText).toContain('URGENT');
  });

  it('admits the animal into AdmittedAnimalsStore when admit action is captured', () => {
    const fixture = TestBed.createComponent(SurrenderRiskReport);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.generateReport();
    fixture.detectChanges();

    // Trigger action through dispatcher
    dispatcher.dispatch({
      name: 'admit_to_roster',
      context: { animalName: 'Barnaby the Bear' },
    } as any);

    fixture.detectChanges();

    expect(component['admissionSuccess']()).toBe(true);
    expect(admittedStore.admitted().some((a) => a.name === 'Barnaby the Bear')).toBe(true);
  });

  it('cleans up the risk report surface on component destruction', () => {
    const fixture = TestBed.createComponent(SurrenderRiskReport);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.generateReport();
    expect(component['operations']().length).toBeGreaterThan(0);

    fixture.destroy();
    expect(component['operations']()).toHaveLength(0);
  });
});
