import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Concierge } from './concierge';
import { ConciergeChatService } from './concierge-chat.service';
import { AdmittedAnimalsStore } from '../../data/admitted-animals-store';
import { AdoptedAnimalsStore } from '../../data/adopted-animals-store';
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
import { of } from 'rxjs';

describe('Concierge (A2UI Live Canvas)', () => {
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
  });

  it('initializes with empty transcript and no active canvas', () => {
    const fixture = TestBed.createComponent(Concierge);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['history']()).toHaveLength(0);
    expect(component['hasActiveCanvas']()).toBe(false);
    expect(component['canvasOperations']()).toHaveLength(0);
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

    const ops = component['canvasOperations']();
    expect(ops.length).toBeGreaterThan(0);

    const updateComp = ops.find((o) => o.updateComponents);
    expect(updateComp).toBeDefined();

    const comps = updateComp.updateComponents.components;

    // Verify components in the surface
    const rootComp = comps.find((c: any) => c.id === 'root');
    expect(rootComp).toBeDefined();
    expect(rootComp.component).toBe('Column');

    const cardComp = comps.find((c: any) => c.id === 'card_001');
    expect(cardComp).toBeDefined();
    expect(cardComp.component).toBe('AnimalCard');

    const buttonComp = comps.find((c: any) => c.id === 'btn_001');
    expect(buttonComp).toBeDefined();
    expect(buttonComp.component).toBe('Button');
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

    expect(component['canvasOperations']().length).toBeGreaterThan(0);

    fixture.destroy();

    expect(component['canvasOperations']()).toHaveLength(0);
  });
});
