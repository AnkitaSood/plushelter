import { Component, input, output } from '@angular/core';
import { NgOptimizedImage, NgTemplateOutlet } from '@angular/common';

@Component({
  selector: 'app-case-file-card',
  imports: [NgOptimizedImage, NgTemplateOutlet],
  template: `
    @if (clickable()) {
      <button type="button" class="case-file-card" (click)="activated.emit()">
        <ng-container *ngTemplateOutlet="body" />
      </button>
    } @else {
      <article class="case-file-card">
        <ng-container *ngTemplateOutlet="body" />
      </article>
    }

    <ng-template #body>
      @if (imageUrl(); as src) {
        <img [ngSrc]="src" width="320" height="200" class="case-file-card__image" />
      }
      <div class="case-file-card__content">
        <h3 class="case-file-card__title">{{ title() }}</h3>
        @if (subtitle()) {
          <p class="case-file-card__subtitle">{{ subtitle() }}</p>
        }
        @if (description()) {
          <p class="case-file-card__description">{{ description() }}</p>
        }
        <ng-content />
      </div>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
    }

    .case-file-card {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 20rem;
      text-align: start;
      font-family: var(--font-body);
      color: var(--color-ink);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
      padding: 0;
      overflow: hidden;
      cursor: default;
    }

    button.case-file-card {
      cursor: pointer;
    }

    .case-file-card__image {
      display: block;
      width: 100%;
      height: 10rem;
      object-fit: cover;
      border-bottom: var(--border-width) solid var(--border-color);
    }

    .case-file-card__content {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-4);
    }

    .case-file-card__title {
      font-family: var(--font-display);
      font-size: var(--text-lg);
      margin: 0;
    }

    .case-file-card__subtitle {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.75;
    }

    .case-file-card__description {
      margin: 0;
      font-size: var(--text-sm);
    }
  `,
})
export class CaseFileCard {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly description = input<string>();
  readonly imageUrl = input<string>();
  readonly clickable = input(false);

  readonly activated = output<void>();
}
