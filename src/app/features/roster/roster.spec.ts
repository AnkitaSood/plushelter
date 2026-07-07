import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Roster } from './roster';
import { MOCK_ANIMALS } from '../../data/roster';

describe('Roster', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [Roster],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Roster);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as {
      speciesFilter: { set(v: string): void; (): string };
      statusFilter: { set(v: 'all' | 'available'): void; (): 'all' | 'available' };
      filteredAnimals: () => typeof MOCK_ANIMALS;
      speciesOptions: () => string[];
    };
  }

  it('shows all animals by default', async () => {
    const component = await setup();
    expect(component.filteredAnimals().length).toBe(MOCK_ANIMALS.length);
  });

  it('filters by species', async () => {
    const component = await setup();
    component.speciesFilter.set('Bear');
    const bears = MOCK_ANIMALS.filter((a) => a.species === 'Bear');
    expect(component.filteredAnimals()).toEqual(bears);
  });

  it('filters to available only', async () => {
    const component = await setup();
    component.statusFilter.set('available');
    expect(component.filteredAnimals().every((a) => a.available)).toBe(true);
  });

  it('species filter and status filter compose', async () => {
    const component = await setup();
    component.speciesFilter.set('Bear');
    component.statusFilter.set('available');
    const result = component.filteredAnimals();
    expect(result.every((a) => a.species === 'Bear' && a.available)).toBe(true);
  });

  it('speciesOptions contains each unique species exactly once', async () => {
    const component = await setup();
    const options = component.speciesOptions();
    expect(new Set(options).size).toBe(options.length);
    for (const a of MOCK_ANIMALS) {
      expect(options).toContain(a.species);
    }
  });
});
