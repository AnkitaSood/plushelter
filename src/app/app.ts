import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AgentPanel } from './features/agent/agent-panel';
import { ThemeToggle } from './ui/theme/theme-toggle';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AgentPanel, ThemeToggle],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(keydown.escape)': 'closeMenu()',
  },
})
export class App {
  readonly menuOpen = signal(false);

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }
}
