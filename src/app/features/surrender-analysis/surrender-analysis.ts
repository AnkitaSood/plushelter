import { Component, computed, resource, signal } from '@angular/core';
import { Button } from '../../ui/button/button';
import { StatusBadge } from '../../ui/status-badge/status-badge';

interface GuiltAnalysis {
  guiltScore: number;
  message: string;
}

interface AnalysisErrorBody {
  error?: { code: string; message: string };
}

async function fetchSurrenderAnalysis(submittedText: string, abortSignal: AbortSignal): Promise<GuiltAnalysis> {
  const response = await fetch('/api/surrender-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submittedText }),
    signal: abortSignal,
  });

  const body = await response.json();
  if (!response.ok) throw body as AnalysisErrorBody;
  return body as GuiltAnalysis;
}

@Component({
  selector: 'app-surrender-analysis',
  imports: [Button, StatusBadge],
  template: `
    <section class="surrender">
      <h1>Surrender Risk Assessment</h1>
      <p class="surrender__intro">
        Describe your situation. S.A.R.F.'s intake counselor will review it and return a guilt assessment.
      </p>

      <form class="surrender__form" (submit)="onSubmit($event)">
        <textarea
          class="surrender__textarea"
          rows="5"
          [value]="draftText()"
          (input)="draftText.set($any($event.target).value)"
          placeholder="Explain your circumstances…"
        ></textarea>
        <app-button type="submit" [disabled]="!draftText().trim() || analysis.isLoading()">Submit for review</app-button>
      </form>

      @if (analysis.isLoading()) {
        <app-status-badge status="pending">Reviewing submission…</app-status-badge>
      }

      @if (analysisError(); as err) {
        <app-status-badge status="critical">{{ err.message }}</app-status-badge>
      }

      @if (analysis.hasValue()) {
        <div class="gauge">
          <svg class="gauge__svg" viewBox="0 0 200 110" role="img" [attr.aria-label]="'Guilt score ' + analysis.value().guiltScore + ' out of 100'">
            <path d="M 10 100 A 90 90 0 1 1 190 100" class="gauge__track" />
            <path
              d="M 10 100 A 90 90 0 1 1 190 100"
              class="gauge__fill"
              pathLength="100"
              [style.stroke-dasharray]="gaugeDashArray()"
            />
          </svg>
          <span class="gauge__score">{{ analysis.value().guiltScore }}</span>
        </div>
        <p class="surrender__message">{{ analysis.value().message }}</p>
      }
    </section>
  `,
  styles: `
    .surrender {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      max-width: 32rem;
      margin-inline: auto;
      padding: var(--space-5);
      font-family: var(--font-body);
      color: var(--color-ink);
    }

    .surrender__intro {
      margin: 0;
    }

    .surrender__form {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      align-items: flex-start;
    }

    .surrender__textarea {
      width: 100%;
      font-family: var(--font-body);
      font-size: var(--text-base);
      color: var(--color-ink);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: var(--space-3);
      resize: vertical;
    }

    .gauge {
      position: relative;
      display: flex;
      justify-content: center;
    }

    .gauge__svg {
      width: 100%;
      max-width: 20rem;
    }

    .gauge__track {
      fill: none;
      stroke: var(--color-ink);
      opacity: 0.15;
      stroke-width: 16;
    }

    .gauge__fill {
      fill: none;
      stroke: var(--color-info);
      stroke-width: 16;
      stroke-linecap: round;
      transition: stroke-dasharray 0.3s ease;
    }

    .gauge__score {
      position: absolute;
      bottom: 0;
      font-family: var(--font-mono);
      font-size: var(--text-xl);
      font-weight: 600;
    }

    .surrender__message {
      font-family: var(--font-body);
      text-align: center;
    }
  `,
})
export class SurrenderAnalysis {
  protected readonly draftText = signal('');
  private readonly submittedText = signal<string | undefined>(undefined);

  protected readonly analysis = resource({
    params: () => this.submittedText(),
    loader: ({ params, abortSignal }) => fetchSurrenderAnalysis(params!, abortSignal),
  });

  protected readonly analysisError = computed(() => {
    const error = this.analysis.error();
    if (!error) return undefined;
    const body = (error as AnalysisErrorBody)?.error;
    return body ?? { code: 'UPSTREAM_ERROR', message: 'Something went wrong reviewing that submission.' };
  });

  /** [style.stroke-dasharray] against a path with pathLength="100" lets the score map
   * directly to a percentage without computing the arc's actual geometric length. */
  protected readonly gaugeDashArray = computed(() => {
    const score = this.analysis.value()?.guiltScore ?? 0;
    return `${Math.min(Math.max(score, 0), 100)} 100`;
  });

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const text = this.draftText().trim();
    if (!text) return;
    this.submittedText.set(text);
  }
}
