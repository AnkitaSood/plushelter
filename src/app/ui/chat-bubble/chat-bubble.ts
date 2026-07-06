import { Component, input } from '@angular/core';

@Component({
  selector: 'app-chat-bubble',
  imports: [],
  template: `
    <div class="chat-bubble" [class.chat-bubble--user]="role() === 'user'">
      <p class="chat-bubble__content" aria-live="polite">{{ content() }}</p>
    </div>
  `,
  styles: `
    .chat-bubble {
      display: flex;
      max-width: 32rem;
    }

    .chat-bubble--user {
      margin-inline-start: auto;
    }

    .chat-bubble__content {
      margin: 0;
      font-family: var(--font-body);
      font-size: var(--text-base);
      color: var(--color-ink);
      background: var(--color-bg);
      border: var(--border-width) solid var(--border-color);
      border-radius: var(--radius-md);
      padding: var(--space-3) var(--space-4);
      white-space: pre-wrap;
    }

    .chat-bubble--user .chat-bubble__content {
      background: var(--color-secondary);
    }

    .chat-bubble:not(.chat-bubble--user) .chat-bubble__content {
      background: var(--color-primary);
    }
  `,
})
export class ChatBubble {
  readonly role = input<'user' | 'concierge'>('concierge');
  readonly content = input.required<string>();
}
