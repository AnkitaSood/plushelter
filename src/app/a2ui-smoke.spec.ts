import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideA2Ui, A2uiRendererService, BasicCatalog, SurfaceComponent } from '@a2ui/angular/v0_9';
import { provideShelterMarkdownRenderer } from './a2ui/shelter-catalog';
import type { A2uiMessage } from '@a2ui/web_core/v0_9';

describe('A2UI Renderer Smoke Test (Angular 22 Compatibility)', () => {
  const catalogId = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json';
  const surfaceId = 'smoke-surface';

  beforeEach(async () => {
    if (typeof document !== 'undefined' && !document.adoptedStyleSheets) {
      (document as any).adoptedStyleSheets = [];
    }
    await TestBed.configureTestingModule({
      imports: [SurfaceComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideShelterMarkdownRenderer(),
        provideA2Ui(() => ({
          catalogs: [new BasicCatalog()],
        })),
      ],
    }).compileComponents();
  });

  it('renders a surface from v0.9 operations and reactively updates on dataModel change', async () => {
    const fixture = TestBed.createComponent(SurfaceComponent);
    fixture.componentRef.setInput('surfaceId', surfaceId);

    const rendererService = TestBed.inject(A2uiRendererService);
    expect(rendererService).toBeTruthy();

    // 1. Initial operations: createSurface, updateComponents, updateDataModel
    const initialMessages: A2uiMessage[] = [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId,
          catalogId,
          sendDataModel: false,
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId,
          components: [
            {
              id: 'root',
              component: 'Text',
              variant: 'h1',
              text: { path: '/greeting' },
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
            greeting: 'Hello Plushelter!',
          },
        },
      },
    ];

    rendererService.processMessages(initialMessages);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Hello Plushelter!');

    // 2. Reactive update: updateDataModel with new value
    const updateMessages: A2uiMessage[] = [
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId,
          path: '/greeting',
          value: 'Welcome to Plushelter!',
        },
      },
    ];

    rendererService.processMessages(updateMessages);
    await fixture.whenStable();

    expect(element.textContent).toContain('Welcome to Plushelter!');
  });
});
