import { Component } from '@angular/core';

/** A marching row of animal emoji standing in for a progress bar — each critter bounces
 * in sequence, nose to tail, so the eye reads it as motion/progress rather than a static spinner. */
@Component({
  selector: 'app-critter-loader',
  imports: [],
  template: `
    <div class="critter-loader" role="status" aria-hidden="true">
      @for (critter of critters; track $index) {
        <span class="critter-loader__critter" [style.animation-delay.ms]="$index * 120">{{ critter }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .critter-loader {
      display: flex;
      justify-content: center;
      gap: var(--space-2);
      padding-block: var(--space-2);
      border-bottom: var(--border-width) dashed var(--border-color);
    }

    .critter-loader__critter {
      font-size: var(--text-lg);
      line-height: 1;
      animation: critter-hop 0.9s ease-in-out infinite;
    }

    @keyframes critter-hop {
      0%, 100% {
        transform: translateY(0) scale(1);
      }
      30% {
        transform: translateY(-0.6rem) scale(1.15);
      }
      50% {
        transform: translateY(0) scale(1);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .critter-loader__critter {
        animation: none;
      }
    }
  `,
})
export class CritterLoader {
  protected readonly critters = ['🐻', '🐰', '🦊', '🐨', '🐼'];
}
