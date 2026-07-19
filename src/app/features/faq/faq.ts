import { Component, inject } from '@angular/core';
import { AccordionGroup, AccordionPanel, AccordionTrigger, AccordionContent } from '@angular/aria/accordion';
import { FaqStore } from '../../data/faq-store';
import {CritterLoader} from '../../ui/critter-loader/critter-loader';

@Component({
  selector: 'app-faq',
  imports: [AccordionGroup, AccordionPanel, AccordionTrigger, AccordionContent, CritterLoader],
  template: `
    <section class="faq">
      <h1>Frequently Asked Questions</h1>

      @if (faqResource.isLoading()) {
        <app-critter-loader/>
      }

      @for (category of faqResource.value() ?? []; track category.id) {
        <div class="faq-category">
          <div class="faq-category-header">
            <h2>{{ category.icon }} {{ category.title }}</h2>
          </div>

          @defer (hydrate on viewport) {
            <div ngAccordionGroup class="faq-accordion-group">
              @for (item of category.items; track item.question) {
                <div class="faq-accordion-item">
                  <button ngAccordionTrigger [panel]="panel" class="faq-accordion-trigger">
                    {{ item.question }}
                    <span class="faq-accordion-icon" aria-hidden="true">▼</span>
                  </button>
                  <div ngAccordionPanel #panel="ngAccordionPanel" class="faq-accordion-panel">
                    <ng-template ngAccordionContent>
                      <p>{{ item.answer }}</p>
                    </ng-template>
                  </div>
                </div>
              }
            </div>
          } @placeholder {
            <div class="faq-accordion-group">
              @for (item of category.items; track item.question) {
                <p class="faq-accordion-item faq-static-question">{{ item.question }}</p>
              }
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .faq {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      max-width: 40rem;
      margin-inline: auto;
      padding: var(--space-6) var(--space-5);
      font-family: var(--font-body);
      color: var(--color-ink);
    }

    h1 {
      font-family: var(--font-display);
      font-size: var(--text-2xl);
      font-weight: 600;
      line-height: var(--leading-tight);
      margin: 0;
      text-align: center;
    }

    .faq__loading {
      margin: 0;
      text-align: center;
    }

    .faq-category {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .faq-category-header h2 {
      font-family: var(--font-display);
      font-size: var(--text-lg);
      font-weight: 600;
      line-height: var(--leading-tight);
      margin: 0;
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .faq-accordion-group {
      display: flex;
      flex-direction: column;
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
      overflow: hidden;
    }

    .faq-accordion-item:not(:last-child) {
      border-bottom: var(--border-width) solid var(--border-color);
    }

    .faq-accordion-trigger {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: none;
      border: none;
      font-size: var(--text-base);
      font-family: inherit;
      color: var(--color-ink);
      text-align: left;
      cursor: pointer;
      transition: background-color 150ms ease-out;
    }

    .faq-accordion-trigger:hover {
      background-color: color-mix(in srgb, var(--color-primary) 25%, transparent);
    }

    .faq-accordion-trigger[aria-expanded='true'] .faq-accordion-icon {
      transform: rotate(180deg);
    }

    .faq-accordion-icon {
      flex-shrink: 0;
      font-size: var(--text-xs);
      transition: transform 150ms ease-out;
    }

    .faq-accordion-panel {
      padding: 0 var(--space-4) var(--space-3) var(--space-4);
      line-height: var(--leading-normal);
    }

    .faq-accordion-panel p {
      margin: 0;
    }

    .faq-static-question {
      margin: 0;
      padding: var(--space-3) var(--space-4);
    }

    @media (prefers-reduced-motion: reduce) {
      .faq-accordion-trigger,
      .faq-accordion-icon {
        transition: none;
      }
    }
  `
})
export class Faq {
  private readonly faqStore = inject(FaqStore);
  protected readonly faqResource = this.faqStore.faq;
}
