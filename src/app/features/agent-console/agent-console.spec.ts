import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentConsole } from './agent-console';
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
import { AdmittedAnimalsStore } from '../../data/admitted-animals-store';
import { AdoptedAnimalsStore } from '../../data/adopted-animals-store';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideCopilotKit } from '@copilotkit/angular';

describe('AgentConsole (Protocol Inspector: WebMCP + AG-UI + A2UI)', () => {
  let a2ui: A2uiRendererService;
  let dispatcher: A2uiActionDispatcherService;

  beforeEach(async () => {
    (document as any).adoptedStyleSheets = [];

    await TestBed.configureTestingModule({
      imports: [AgentConsole],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideCopilotKit({ runtimeUrl: '/api/copilotkit' }),
        provideShelterMarkdownRenderer(),
        provideA2Ui(() => ({
          catalogs: [new BasicCatalog(), createShelterCustomCatalog()],
          actionHandler: (action) => dispatcher.dispatch(action),
        })),
        AdmittedAnimalsStore,
        AdoptedAnimalsStore,
        A2uiActionDispatcherService,
      ],
    }).compileComponents();

    a2ui = TestBed.inject(A2uiRendererService);
    dispatcher = TestBed.inject(A2uiActionDispatcherService);
  });

  it('renders WebMCP tab with tool registry by default', () => {
    const fixture = TestBed.createComponent(AgentConsole);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['activeTab']()).toBe('webmcp');
    expect(component['registry'].length).toBeGreaterThanOrEqual(4);
  });

  it('switches to AG-UI wire events tab and logs simulated events', () => {
    const fixture = TestBed.createComponent(AgentConsole);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['activeTab'].set('ag-ui');
    fixture.detectChanges();

    const initialCount = component['agUiEvents']().length;
    component.simulateAgUiRun();
    fixture.detectChanges();

    expect(component['agUiEvents']().length).toBe(initialCount + 5);
  });

  it('composes and updates A2UI surface on the A2UI tab', () => {
    const fixture = TestBed.createComponent(AgentConsole);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['activeTab'].set('a2ui');
    fixture.detectChanges();

    expect(a2ui.surfaceGroup.surfacesMap.size).toBe(0);

    component.renderSampleSurface();
    fixture.detectChanges();

    expect(a2ui.surfaceGroup.surfacesMap.size).toBe(1);
    const surface = a2ui.surfaceGroup.getSurface('srf-console-demo');
    expect(surface).toBeDefined();

    // Verify component composition
    const cardComp = surface?.componentsModel.get('title');
    expect(cardComp).toBeDefined();

    // Update data model
    component.updateSampleSurfaceData();
    fixture.detectChanges();

    const data = surface?.dataModel.get('/name');
    expect(data).toContain('Distinguished Graduate');

    // Clean up
    component.clearSurfaces();
    expect(a2ui.surfaceGroup.surfacesMap.size).toBe(0);
  });

  it('executes a WebMCP tool and stores result', async () => {
    const fixture = TestBed.createComponent(AgentConsole);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const statsTool = component['registry'].find((r) => r.tool.name === 'getShelterStats');
    expect(statsTool).toBeDefined();

    await (component as any).invoke(statsTool);
    fixture.detectChanges();

    const result = component['results']()['getShelterStats'];
    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
    expect(result.text).toContain('Total on file');
  });

  it('cleans up surfaces on destroy', () => {
    const fixture = TestBed.createComponent(AgentConsole);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.renderSampleSurface();
    expect(a2ui.surfaceGroup.surfacesMap.size).toBe(1);

    fixture.destroy();
    expect(a2ui.surfaceGroup.surfacesMap.size).toBe(0);
  });
});
