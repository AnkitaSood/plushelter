import { Component, computed, input } from '@angular/core';
import type { AngularToolCall, ToolRenderer } from '@copilotkit/angular';
import { z } from 'zod';
import { CaseFileCard } from '../ui/case-file-card/case-file-card';
import { StatusBadge, type StatusBadgeStatus } from '../ui/status-badge/status-badge';
import { ChecklistItem } from '../ui/checklist-item/checklist-item';

// ==========================================
// 1. AnimalCardRenderer
// ==========================================
export const AnimalCardArgsSchema = z.object({
  title: z.string().describe('Animal title and species'),
  subtitle: z.string().optional().describe('Condition summary'),
  description: z.string().optional().describe('Backstory or biographical notes'),
  imageUrl: z.string().optional().describe('Photo URL'),
  status: z.enum(['available', 'pending', 'critical', 'adopted', 'celebration', 'info']).optional(),
});
export type AnimalCardArgs = z.infer<typeof AnimalCardArgsSchema>;

@Component({
  selector: 'copilot-animal-card-renderer',
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
export class AnimalCardRenderer implements ToolRenderer<AnimalCardArgs> {
  readonly toolCall = input.required<AngularToolCall<AnimalCardArgs>>();

  protected readonly args = computed(() => this.toolCall()?.args ?? {});
  protected readonly title = computed(() => this.args().title ?? '');
  protected readonly subtitle = computed(() => this.args().subtitle ?? '');
  protected readonly description = computed(() => this.args().description ?? '');
  protected readonly imageUrl = computed(() => this.args().imageUrl ?? '');
  protected readonly status = computed(() => this.args().status as StatusBadgeStatus | undefined);
}

// ==========================================
// 2. RiskGaugeRenderer
// ==========================================
export const RiskGaugeArgsSchema = z.object({
  score: z.number().min(0).max(100).describe('Risk score 0-100'),
  label: z.string().optional().describe('Gauge heading label'),
  sublabel: z.string().optional().describe('Sublabel explanation'),
});
export type RiskGaugeArgs = z.infer<typeof RiskGaugeArgsSchema>;

@Component({
  selector: 'copilot-risk-gauge-renderer',
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
export class RiskGaugeRenderer implements ToolRenderer<RiskGaugeArgs> {
  readonly toolCall = input.required<AngularToolCall<RiskGaugeArgs>>();

  protected readonly args = computed(() => this.toolCall()?.args ?? {});
  protected readonly score = computed(() => Number(this.args().score ?? 0));
  protected readonly label = computed(() => this.args().label ?? 'Risk Assessment');
  protected readonly sublabel = computed(() => this.args().sublabel ?? '');

  protected readonly scoreColor = computed(() => {
    const s = this.score();
    if (s <= 35) return 'var(--color-status-available, #73ba9b)';
    if (s <= 70) return 'var(--color-status-pending, #f2c94c)';
    return 'var(--color-status-critical, #eb5757)';
  });
}

// ==========================================
// 3. StatusStampRenderer
// ==========================================
export const StatusStampArgsSchema = z.object({
  status: z.enum(['available', 'pending', 'critical', 'adopted', 'celebration', 'info']).default('available'),
  text: z.string().describe('Stamp badge text'),
});
export type StatusStampArgs = z.infer<typeof StatusStampArgsSchema>;

@Component({
  selector: 'copilot-status-stamp-renderer',
  imports: [StatusBadge],
  template: `
    <app-status-badge [status]="status()">{{ text() }}</app-status-badge>
  `,
})
export class StatusStampRenderer implements ToolRenderer<StatusStampArgs> {
  readonly toolCall = input.required<AngularToolCall<StatusStampArgs>>();

  protected readonly args = computed(() => this.toolCall()?.args ?? {});
  protected readonly status = computed(() => (this.args().status ?? 'available') as StatusBadgeStatus);
  protected readonly text = computed(() => this.args().text ?? '');
}

// ==========================================
// 4. AdoptionChecklistRenderer
// ==========================================
export const AdoptionChecklistArgsSchema = z.object({
  title: z.string().optional().describe('Checklist title'),
  items: z.array(
    z.object({
      label: z.string(),
      checked: z.boolean(),
    }),
  ),
});
export type AdoptionChecklistArgs = z.infer<typeof AdoptionChecklistArgsSchema>;

@Component({
  selector: 'copilot-adoption-checklist-renderer',
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
export class AdoptionChecklistRenderer implements ToolRenderer<AdoptionChecklistArgs> {
  readonly toolCall = input.required<AngularToolCall<AdoptionChecklistArgs>>();

  protected readonly args = computed(() => this.toolCall()?.args ?? {});
  protected readonly title = computed(() => this.args().title ?? 'Readiness Checklist');
  protected readonly items = computed(() => this.args().items ?? []);
}

// ==========================================
// 5. CustomChartRenderer
// ==========================================
export const CustomChartArgsSchema = z.object({
  title: z.string().optional().describe('Chart title'),
  chartType: z.enum(['bar', 'donut']).default('bar'),
  data: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
      color: z.string().optional(),
    }),
  ),
});
export type CustomChartArgs = z.infer<typeof CustomChartArgsSchema>;

@Component({
  selector: 'copilot-custom-chart-renderer',
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
export class CustomChartRenderer implements ToolRenderer<CustomChartArgs> {
  readonly toolCall = input.required<AngularToolCall<CustomChartArgs>>();

  protected readonly args = computed(() => this.toolCall()?.args ?? {});
  protected readonly title = computed(() => this.args().title ?? 'Shelter Statistics');
  protected readonly chartType = computed(() => this.args().chartType ?? 'bar');
  protected readonly data = computed(() => this.args().data ?? []);

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
    const circumference = 2 * Math.PI * 38;

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
