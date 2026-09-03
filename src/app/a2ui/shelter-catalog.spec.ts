import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  BasicCatalog,
  provideA2Ui,
  SurfaceComponent,
  A2uiRendererService,
} from '@a2ui/angular/v0_9';
import type { A2uiMessage } from '@a2ui/web_core/v0_9';
import {
  createShelterCustomCatalog,
  provideShelterMarkdownRenderer,
  SHELTER_CATALOG_ID,
  ShelterButtonComponent,
} from './shelter-catalog';

@Component({
  imports: [SurfaceComponent],
  template: `<a2ui-v09-surface [surfaceId]="surfaceId" />`,
})
class CustomCatalogTestHost {
  surfaceId = 'srf-custom-catalog-test';
}

describe('Shelter Custom Catalog', () => {
  let renderer: A2uiRendererService;
  let lastAction: any = null;

  beforeEach(async () => {
    (document as any).adoptedStyleSheets = [];
    lastAction = null;

    await TestBed.configureTestingModule({
      imports: [CustomCatalogTestHost],
      providers: [
        provideShelterMarkdownRenderer(),
        provideA2Ui(() => ({
          catalogs: [new BasicCatalog(), createShelterCustomCatalog()],
          actionHandler: (action) => {
            lastAction = action;
          },
        })),
      ],
    }).compileComponents();

    renderer = TestBed.inject(A2uiRendererService);
  });

  it('registers all 5 custom shelter components, button override, and basic layout primitives in the catalog', () => {
    const catalog = createShelterCustomCatalog();
    expect(catalog.id).toBe(SHELTER_CATALOG_ID);
    expect(catalog.components.has('Column')).toBe(true);
    expect(catalog.components.has('Text')).toBe(true);
    expect(catalog.components.has('Button')).toBe(true);
    expect(catalog.components.get('Button')?.component).toBe(ShelterButtonComponent);
    expect(catalog.components.has('AnimalCard')).toBe(true);
    expect(catalog.components.has('RiskGauge')).toBe(true);
    expect(catalog.components.has('StatusStamp')).toBe(true);
    expect(catalog.components.has('AdoptionChecklist')).toBe(true);
    expect(catalog.components.has('CustomChart')).toBe(true);
  });

  it('renders a surface composed with custom shelter catalog components', async () => {
    const fixture = TestBed.createComponent(CustomCatalogTestHost);
    fixture.detectChanges();

    const surfaceId = 'srf-custom-catalog-test';
    const messages: A2uiMessage[] = [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId,
          catalogId: SHELTER_CATALOG_ID,
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId,
          components: [
            {
              id: 'root',
              component: 'RiskGauge',
              score: { path: '/riskScore' },
              label: 'Surrender Guilt Index',
              sublabel: 'Low risk of owner regret detected',
            },
          ],
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId,
          path: '/',
          value: {
            riskScore: 25,
          },
        },
      },
    ];

    renderer.processMessages(messages);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Surrender Guilt Index');
    expect(el.textContent).toContain('25 / 100');
    expect(el.textContent).toContain('Low risk of owner regret detected');
  });

  it('renders a custom SVG chart component within an A2UI surface', async () => {
    const fixture = TestBed.createComponent(CustomCatalogTestHost);
    fixture.detectChanges();

    const surfaceId = 'srf-custom-catalog-test';
    const messages: A2uiMessage[] = [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId,
          catalogId: SHELTER_CATALOG_ID,
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId,
          components: [
            {
              id: 'root',
              component: 'CustomChart',
              title: 'Shelter Capacity Status',
              chartType: 'bar',
              data: { path: '/chartData' },
            },
          ],
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId,
          path: '/',
          value: {
            chartData: [
              { label: 'Bears', value: 12 },
              { label: 'Rabbits', value: 8 },
            ],
          },
        },
      },
    ];

    renderer.processMessages(messages);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Shelter Capacity Status');
    expect(el.textContent).toContain('Bears');
    expect(el.textContent).toContain('12');
    expect(el.textContent).toContain('Rabbits');
    expect(el.textContent).toContain('8');
  });

  it('renders ShelterButtonComponent wrapping app-button and dispatches click actions', async () => {
    const fixture = TestBed.createComponent(CustomCatalogTestHost);
    fixture.detectChanges();

    const surfaceId = 'srf-custom-catalog-test';
    const messages: A2uiMessage[] = [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId,
          catalogId: SHELTER_CATALOG_ID,
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId,
          components: [
            {
              id: 'root',
              component: 'Button',
              child: 'btn-text',
              action: {
                event: {
                  name: 'select_living',
                  context: { living: 'apartment' },
                },
              },
            },
            {
              id: 'btn-text',
              component: 'Text',
              text: 'Compact Apartment / Studio',
            },
          ],
        },
      },
    ];

    renderer.processMessages(messages);
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const appButton = el.querySelector('app-button');
    expect(appButton).toBeTruthy();

    const nativeBtn = el.querySelector('button.btn') as HTMLButtonElement;
    expect(nativeBtn).toBeTruthy();
    expect(nativeBtn.textContent).toContain('Compact Apartment / Studio');

    // Click the button
    nativeBtn.click();
    fixture.detectChanges();

    expect(lastAction).toBeDefined();
    expect(lastAction?.name).toBe('select_living');
    expect(lastAction?.context?.living).toBe('apartment');
  });
});

