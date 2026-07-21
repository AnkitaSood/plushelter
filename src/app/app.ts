import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AgentPanel } from './features/agent/agent-panel';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AgentPanel],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
