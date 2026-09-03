import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

import { provideA2Ui } from '@a2ui/angular/v0_9';
import { provideShelterMarkdownRenderer } from './a2ui/shelter-catalog';

describe('App', () => {
  beforeEach(async () => {
    (document as any).adoptedStyleSheets = [];

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideShelterMarkdownRenderer(),
        provideA2Ui(() => ({ catalogs: [], actionHandler: () => {} })),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-nav__title')?.textContent).toContain('Plushelter');
  });
});
