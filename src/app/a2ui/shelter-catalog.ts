import { Component, computed } from '@angular/core';
import { z } from 'zod';
import {
  AngularCatalog,
  BasicCatalogBase,
  ButtonComponent,
  CatalogComponent,
  ComponentHostComponent,
  createComponentImplementation,
  provideMarkdownRenderer,
} from '@a2ui/angular/v0_9';
import { ButtonApi } from '@a2ui/web_core/v0_9/basic_catalog';
import type { ComponentApi } from '@a2ui/web_core/v0_9';
import { CaseFileCard } from '../ui/case-file-card/case-file-card';
import { StatusBadge, type StatusBadgeStatus } from '../ui/status-badge/status-badge';
import { ChecklistItem } from '../ui/checklist-item/checklist-item';
import { Button } from '../ui/button/button';

export const SHELTER_CATALOG_ID = 'https://plushelter.org/catalogs/shelter.json';

// ==========================================
// 1. AnimalCard
// ==========================================
export const AnimalCardApi: ComponentApi = {
  name: 'AnimalCard',
  schema: z.any() as any,
};

@Component({
  selector: 'shelter-animal-card',
  imports: [CaseFileCard, StatusBadge],
  template: `
    <app-case-file-card
      [title]="title()"
      [subtitle]="subtitle()"
      [description]="description()"
      [imageUrl]="imageUrl()"
    >
      @if (status(); as s) {
        <div style="margin-top: var(--space-2)">
          <app-status-badge [status]="s">{{ s }}</app-status-badge>
        </div>
      }
    </app-case-file-card>
  `,
})
export class AnimalCardComponent extends CatalogComponent<any> {
  protected readonly title = computed(() => (this.props() as any)?.['title']?.value() ?? '');
  protected readonly subtitle = computed(() => (this.props() as any)?.['subtitle']?.value() ?? '');
  protected readonly description = computed(() => (this.props() as any)?.['description']?.value() ?? '');
  protected readonly imageUrl = computed(() => (this.props() as any)?.['imageUrl']?.value() ?? '');
  protected readonly status = computed(() => (this.props() as any)?.['status']?.value() as StatusBadgeStatus | undefined);
}

// ==========================================
// 2. RiskGauge
// ==========================================
export const RiskGaugeApi: ComponentApi = {
  name: 'RiskGauge',
  schema: z.any() as any,
};

@Component({
  selector: 'shelter-risk-gauge',
  template: `
    <div class="risk-gauge">
      <header class="risk-gauge__header">
        <span class="risk-gauge__label">{{ label() }}</span>
        <span class="risk-gauge__score" [style.color]="scoreColor()">{{ score() }} / 100</span>
      </header>
      <div class="risk-gauge__track" role="progressbar" [attr.aria-valuenow]="score()" aria-valuemin="0" aria-valuemax="100">
        <div class="risk-gauge__fill" [style.width.%]="score()" [style.background]="scoreColor()"></div>
      </div>
      @if (sublabel()) {
        <p class="risk-gauge__sublabel">{{ sublabel() }}</p>
      }
    </div>
  `,
  styles: `
    .risk-gauge {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
      max-width: 24rem;
    }
    .risk-gauge__header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .risk-gauge__label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-ink-muted, #555);
    }
    .risk-gauge__score {
      font-family: var(--font-display);
      font-size: var(--text-lg);
      font-weight: bold;
    }
    .risk-gauge__track {
      height: 1rem;
      background: var(--color-bg-subtle, #eee);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .risk-gauge__fill {
      height: 100%;
      transition: width 0.4s ease-out;
    }
    .risk-gauge__sublabel {
      margin: 0;
      font-family: var(--font-body);
      font-size: var(--text-sm);
      color: var(--color-ink);
    }
  `,
})
export class RiskGaugeComponent extends CatalogComponent<any> {
  protected readonly score = computed(() => Number((this.props() as any)?.['score']?.value() ?? 0));
  protected readonly label = computed(() => (this.props() as any)?.['label']?.value() ?? 'Risk Assessment');
  protected readonly sublabel = computed(() => (this.props() as any)?.['sublabel']?.value() ?? '');

  protected readonly scoreColor = computed(() => {
    const s = this.score();
    if (s <= 35) return 'var(--color-status-available, #73ba9b)';
    if (s <= 70) return 'var(--color-status-pending, #f2c94c)';
    return 'var(--color-status-critical, #eb5757)';
  });
}

// ==========================================
// 3. StatusStamp
// ==========================================
export const StatusStampApi: ComponentApi = {
  name: 'StatusStamp',
  schema: z.any() as any,
};

@Component({
  selector: 'shelter-status-stamp',
  imports: [StatusBadge],
  template: `
    <app-status-badge [status]="status()">{{ text() }}</app-status-badge>
  `,
})
export class StatusStampComponent extends CatalogComponent<any> {
  protected readonly status = computed(() => (this.props() as any)?.['status']?.value() as StatusBadgeStatus ?? 'available');
  protected readonly text = computed(() => (this.props() as any)?.['text']?.value() ?? '');
}

// ==========================================
// 4. AdoptionChecklist
// ==========================================
export const AdoptionChecklistApi: ComponentApi = {
  name: 'AdoptionChecklist',
  schema: z.any() as any,
};

@Component({
  selector: 'shelter-adoption-checklist',
  imports: [ChecklistItem],
  template: `
    <div class="checklist">
      <h4 class="checklist__title">{{ title() }}</h4>
      <div class="checklist__items">
        @for (item of items(); track item.label) {
          <app-checklist-item [label]="item.label" [checked]="item.checked" />
        }
      </div>
    </div>
  `,
  styles: `
    .checklist {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
    }
    .checklist__title {
      margin: 0;
      font-family: var(--font-display);
      font-size: var(--text-base);
      color: var(--color-ink);
    }
    .checklist__items {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
  `,
})
export class AdoptionChecklistComponent extends CatalogComponent<any> {
  protected readonly title = computed(() => (this.props() as any)?.['title']?.value() ?? 'Readiness Checklist');
  protected readonly items = computed(() => ((this.props() as any)?.['items']?.value() ?? []) as Array<{ label: string; checked: boolean }>);
}

// ==========================================
// 5. CustomChart (Handwritten SVG)
// ==========================================
export const CustomChartApi: ComponentApi = {
  name: 'CustomChart',
  schema: z.any() as any,
};

@Component({
  selector: 'shelter-custom-chart',
  template: `
    <div class="shelter-chart">
      <h4 class="shelter-chart__title">{{ title() }}</h4>

      @if (chartType() === 'bar') {
        <div class="bar-chart">
          @for (item of data(); track item.label) {
            <div class="bar-chart__row">
              <span class="bar-chart__label">{{ item.label }}</span>
              <div class="bar-chart__track">
                <div
                  class="bar-chart__bar"
                  [style.width.%]="barPercent(item.value)"
                  [style.background]="item.color || 'var(--color-status-available, #73ba9b)'"
                ></div>
              </div>
              <span class="bar-chart__val">{{ item.value }}</span>
            </div>
          }
        </div>
      } @else {
        <div class="donut-container">
          <svg viewBox="0 0 100 100" class="donut-svg" aria-hidden="true">
            <circle cx="50" cy="50" r="38" fill="none" stroke="var(--color-bg-subtle, #eee)" stroke-width="14" />
            @for (segment of donutSegments(); track segment.label) {
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                [attr.stroke]="segment.color"
                stroke-width="14"
                [attr.stroke-dasharray]="segment.dashArray"
                [attr.stroke-dashoffset]="segment.dashOffset"
                transform="rotate(-90 50 50)"
              />
            }
          </svg>
          <div class="donut-legend">
            @for (item of data(); track item.label) {
              <div class="donut-legend__item">
                <span class="donut-legend__dot" [style.background]="item.color || 'var(--color-status-available)'"></span>
                <span>{{ item.label }}: {{ item.value }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .shelter-chart {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
      max-width: 28rem;
    }
    .shelter-chart__title {
      margin: 0;
      font-family: var(--font-display);
      font-size: var(--text-base);
    }
    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .bar-chart__row {
      display: grid;
      grid-template-columns: 6rem 1fr 2.5rem;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }
    .bar-chart__track {
      height: 1rem;
      background: var(--color-bg-subtle, #eee);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .bar-chart__bar {
      height: 100%;
      transition: width 0.3s ease-out;
    }
    .bar-chart__val {
      text-align: end;
      font-weight: bold;
    }
    .donut-container {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }
    .donut-svg {
      width: 6rem;
      height: 6rem;
      flex-shrink: 0;
    }
    .donut-legend {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }
    .donut-legend__item {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }
    .donut-legend__dot {
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 2px;
      border: 1px solid var(--border-color);
    }
  `,
})
export class CustomChartComponent extends CatalogComponent<any> {
  protected readonly title = computed(() => (this.props() as any)?.['title']?.value() ?? 'Shelter Statistics');
  protected readonly chartType = computed(() => (this.props() as any)?.['chartType']?.value() ?? 'bar');
  protected readonly data = computed(() => ((this.props() as any)?.['data']?.value() ?? []) as Array<{ label: string; value: number; color?: string }>);

  private readonly maxValue = computed(() => {
    const vals = this.data().map((d) => d.value);
    return Math.max(1, ...vals);
  });

  protected barPercent(val: number): number {
    return Math.min(100, Math.round((val / this.maxValue()) * 100));
  }

  protected readonly donutSegments = computed(() => {
    const items = this.data();
    const total = items.reduce((sum, d) => sum + d.value, 0) || 1;
    const circumference = 2 * Math.PI * 38; // ~238.76

    let accumulatedOffset = 0;
    const colors = [
      'var(--color-status-available, #73ba9b)',
      'var(--color-celebration, #f2994a)',
      'var(--color-info, #2d9cdb)',
      'var(--color-status-pending, #f2c94c)',
      'var(--color-status-critical, #eb5757)',
    ];

    return items.map((item, idx) => {
      const segLength = (item.value / total) * circumference;
      const dashArray = `${segLength} ${circumference - segLength}`;
      const dashOffset = -accumulatedOffset;
      accumulatedOffset += segLength;
      return {
        label: item.label,
        color: item.color || colors[idx % colors.length],
        dashArray,
        dashOffset,
      };
    });
  });
}

// ==========================================
// 6. ShelterButton (Wraps app-button)
// ==========================================
@Component({
  selector: 'shelter-button',
  imports: [Button, ComponentHostComponent],
  template: `
    <app-button
      [variant]="appVariant()"
      [type]="buttonType()"
      [disabled]="isDisabled()"
      (click)="onButtonClick($event)"
    >
      @if (child(); as childKey) {
        <a2ui-v09-component-host [componentKey]="childKey" [surfaceId]="surfaceId()" />
      } @else if (text()) {
        {{ text() }}
      }
    </app-button>
  `,
  styles: `
    :host {
      display: inline-block;
      --_a2ui-text-margin: 0;
      --_a2ui-text-color: inherit;
    }
    :host ::ng-deep .a2ui-text {
      font-family: inherit;
      color: inherit;
    }
    :host ::ng-deep .a2ui-text p {
      margin: 0;
      display: inline;
    }
  `,
})
export class ShelterButtonComponent extends ButtonComponent {
  protected readonly text = computed(() => (this.props() as any)?.['text']?.value() ?? '');

  protected readonly isDisabled = computed(
    () => (this.props() as any)?.['isValid']?.value() === false
  );

  protected readonly appVariant = computed(() => {
    const v = (this.props() as any)?.['variant']?.value() ?? this.variant();
    return v === 'secondary' ? 'secondary' : 'primary';
  });

  protected readonly buttonType = computed(() =>
    this.variant() === 'primary' ? 'submit' : 'button'
  );

  protected onButtonClick(event: Event): void {
    event.stopPropagation();
    if (this.isDisabled()) return;
    this.handleClick();
  }
}

// ==========================================
// Catalog Factory
// ==========================================
export function createShelterCustomCatalog(): AngularCatalog {
  return new BasicCatalogBase({
    id: SHELTER_CATALOG_ID,
    components: {
      button: createComponentImplementation(ButtonApi, ShelterButtonComponent),
    },
    extraComponents: [
      createComponentImplementation(AnimalCardApi, AnimalCardComponent),
      createComponentImplementation(RiskGaugeApi, RiskGaugeComponent),
      createComponentImplementation(StatusStampApi, StatusStampComponent),
      createComponentImplementation(AdoptionChecklistApi, AdoptionChecklistComponent),
      createComponentImplementation(CustomChartApi, CustomChartComponent),
    ],
  });
}

/**
 * Escapes unsafe HTML characters in markdown text.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Lightweight markdown rendering function for A2UI text components.
 * Safely parses common markdown formatting (bold, italic, code, line breaks) without
 * attempting to dynamically import the optional `@a2ui/markdown-it` peer dependency.
 */
export async function shelterMarkdownRenderer(markdown: string): Promise<string> {
  if (!markdown) return '';

  const escaped = escapeHtml(markdown);

  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

/**
 * Provides A2UI's MarkdownRenderer using our lightweight internal renderer.
 * Eliminates the console warning:
 * "[DefaultMarkdownRenderer] Failed to load optional `@a2ui/markdown-it` renderer. Using fallback."
 */
export function provideShelterMarkdownRenderer() {
  return provideMarkdownRenderer(shelterMarkdownRenderer);
}


