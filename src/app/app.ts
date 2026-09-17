import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AgentPanel } from './features/agent/agent-panel';
import { ThemeToggle } from './ui/theme/theme-toggle';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AgentPanel, ThemeToggle],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
