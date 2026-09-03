import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Concierge } from './concierge';
import { ConciergeChatService } from './concierge-chat.service';
import { AdmittedAnimalsStore } from '../../data/admitted-animals-store';
import { AdoptedAnimalsStore } from '../../data/adopted-animals-store';
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
import { of } from 'rxjs';

describe('Concierge (A2UI Live Canvas)', () => {
  let a2ui: A2uiRendererService;
  let chatServiceMock: { streamChat: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    (document as any).adoptedStyleSheets = [];

    chatServiceMock = {
      streamChat: vi.fn().mockReturnValue(of({ type: 'done' })),
    };

    await TestBed.configureTestingModule({
      imports: [Concierge],
      providers: [
        provideRouter([]),
        provideShelterMarkdownRenderer(),
        provideA2Ui(() => ({
          catalogs: [new BasicCatalog(), createShelterCustomCatalog()],
          actionHandler: () => {},
        })),
        { provide: ConciergeChatService, useValue: chatServiceMock },
        AdmittedAnimalsStore,
        AdoptedAnimalsStore,
        A2uiActionDispatcherService,
      ],
    }).compileComponents();

    a2ui = TestBed.inject(A2uiRendererService);
  });

  it('initializes with empty transcript and no active canvas', () => {
    const fixture = TestBed.createComponent(Concierge);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['history']()).toHaveLength(0);
    expect(component['hasActiveCanvas']()).toBe(false);
  });

  it('renders and updates the A2UI recommendation canvas when matched animals are found', () => {
    const fixture = TestBed.createComponent(Concierge);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const mockAnimals = [
      {
        id: '001',
        name: 'Horace',
        species: 'Bear',
        condition: 'Good',
        backstory: 'A very calm and disciplined bear.',
        photoUrl: '/images/horace.jpg',
        available: true,
      },
    ];

    // Trigger canvas surface composition
    (component as any).renderOrUpdateCanvasSurface(mockAnimals);
    fixture.detectChanges();

    expect(component['hasActiveCanvas']()).toBe(true);

    const surface = a2ui.surfaceGroup.getSurface(component.canvasSurfaceId);
    expect(surface).toBeDefined();

    // Verify components in the surface
    const rootComp = surface?.componentsModel.get('root');
    expect(rootComp).toBeDefined();
    expect(rootComp?.type).toBe('Column');

    const cardComp = surface?.componentsModel.get('card_001');
    expect(cardComp).toBeDefined();
    expect(cardComp?.type).toBe('AnimalCard');

    const buttonComp = surface?.componentsModel.get('btn_001');
    expect(buttonComp).toBeDefined();
    expect(buttonComp?.type).toBe('Button');
  });

  it('cleans up the canvas surface on component destruction', () => {
    const fixture = TestBed.createComponent(Concierge);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    (component as any).renderOrUpdateCanvasSurface([
      {
        id: '002',
        name: 'Barnaby',
        species: 'Rabbit',
        condition: 'Mint',
        backstory: 'Introverted rabbit.',
        available: true,
      },
    ]);

    expect(a2ui.surfaceGroup.getSurface(component.canvasSurfaceId)).toBeDefined();

    fixture.destroy();

    expect(a2ui.surfaceGroup.getSurface(component.canvasSurfaceId)).toBeUndefined();
  });
});
