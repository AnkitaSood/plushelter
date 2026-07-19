import { Component, httpResource } from '@angular/core';
import { AccordionGroup, AccordionItem, AccordionTrigger, AccordionPanel } from '@angular/aria/accordion';
import { FaqCategory } from '../../data/faq';

@Component({
  selector: 'app-faq',
  imports: [AccordionGroup, AccordionItem, AccordionTrigger, AccordionPanel],
  template: `
    <div class="faq-container">
      <h1>Frequently Asked Questions</h1>
      
      @if (faqResource.isLoading()) {
        <p>Loading...</p>
      }

      <div accordionGroup class="faq-accordion-group">
        @for (category of faqResource.value() ?? []; track category.id) {
          <div class="faq-category-header">
            <h2>{{ category.icon }} {{ category.title }}</h2>
          </div>
          
          @for (item of category.items; track item.question; let i = $index) {
            <div accordionItem class="faq-accordion-item">
              <button accordionTrigger class="faq-accordion-trigger">
                {{ item.question }}
                <span class="faq-accordion-icon" aria-hidden="true">▼</span>
              </button>
              <div accordionPanel class="faq-accordion-panel">
                <p>{{ item.answer }}</p>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .faq-container {
      max-width: 800px;
      margin: 0 auto;
      padding: var(--spacing-xl) var(--spacing-lg);
    }
    
    h1 {
      font-size: var(--font-size-3xl);
      color: var(--color-ink);
      margin-bottom: var(--spacing-xl);
      text-align: center;
    }
    
    .faq-category-header h2 {
      font-size: var(--font-size-xl);
      color: var(--color-ink);
      margin-top: var(--spacing-xl);
      margin-bottom: var(--spacing-md);
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }
    
    .faq-accordion-group {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }
    
    .faq-accordion-item {
      background: var(--color-paper);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-stacked);
      overflow: hidden;
    }
    
    .faq-accordion-trigger {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-md) var(--spacing-lg);
      background: none;
      border: none;
      font-size: var(--font-size-lg);
      font-family: inherit;
      color: var(--color-ink);
      text-align: left;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }
    
    .faq-accordion-trigger:hover {
      background-color: var(--color-paper-hover);
    }
    
    .faq-accordion-trigger[aria-expanded="true"] .faq-accordion-icon {
      transform: rotate(180deg);
    }
    
    .faq-accordion-icon {
      transition: transform 0.2s ease;
      font-size: var(--font-size-sm);
    }
    
    .faq-accordion-panel {
      padding: 0 var(--spacing-lg) var(--spacing-md) var(--spacing-lg);
      color: var(--color-ink-light);
      line-height: 1.6;
    }
  `
})
export class Faq {
  protected readonly faqResource = httpResource<FaqCategory[]>('/api/faq', {
    id: 'faq-data',
  });
}
