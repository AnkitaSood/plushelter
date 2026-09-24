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

  it('should start with hamburger menu closed', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(app.menuOpen()).toBe(false);
    const toggleBtn = compiled.querySelector<HTMLButtonElement>('.app-nav__toggle');
    expect(toggleBtn?.getAttribute('aria-expanded')).toBe('false');
    const navLinks = compiled.querySelector('.app-nav__links');
    expect(navLinks?.classList.contains('is-open')).toBe(false);
    expect(compiled.querySelector('.app-nav__backdrop')).toBeNull();
  });

  it('should toggle hamburger menu when toggle button is clicked', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    const toggleBtn = compiled.querySelector<HTMLButtonElement>('.app-nav__toggle')!;
    toggleBtn.click();
    fixture.detectChanges();

    expect(app.menuOpen()).toBe(true);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(compiled.querySelector('.app-nav__links')?.classList.contains('is-open')).toBe(true);
    expect(compiled.querySelector('.app-nav__backdrop')).not.toBeNull();

    toggleBtn.click();
    fixture.detectChanges();

    expect(app.menuOpen()).toBe(false);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(compiled.querySelector('.app-nav__links')?.classList.contains('is-open')).toBe(false);
    expect(compiled.querySelector('.app-nav__backdrop')).toBeNull();
  });

  it('should close menu when backdrop is clicked', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.menuOpen.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const backdrop = compiled.querySelector<HTMLElement>('.app-nav__backdrop')!;
    expect(backdrop).not.toBeNull();

    backdrop.click();
    fixture.detectChanges();

    expect(app.menuOpen()).toBe(false);
    expect(compiled.querySelector('.app-nav__backdrop')).toBeNull();
  });

  it('should close menu when a navigation link is clicked', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.menuOpen.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const firstLink = compiled.querySelector<HTMLAnchorElement>('.app-nav__link')!;
    firstLink.click();
    fixture.detectChanges();

    expect(app.menuOpen()).toBe(false);
  });

  it('should close menu on Escape key press', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.menuOpen.set(true);
    fixture.detectChanges();

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    fixture.nativeElement.dispatchEvent(event);
    fixture.detectChanges();

    expect(app.menuOpen()).toBe(false);
  });
});
