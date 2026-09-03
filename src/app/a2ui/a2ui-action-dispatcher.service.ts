import { Injectable, Injector, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { A2uiClientAction } from '@a2ui/web_core/v0_9';
import { HitlAuthorizationService } from '../webmcp/hitl-authorization.service';

@Injectable({ providedIn: 'root' })
export class A2uiActionDispatcherService {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  private readonly _lastAction = signal<A2uiClientAction | null>(null);
  readonly lastAction = this._lastAction.asReadonly();

  private readonly actionListeners = new Set<(action: A2uiClientAction) => void>();

  /**
   * Subscribes to discrete client actions dispatched from A2UI surfaces.
   * Returns an unsubscribe function.
   */
  onAction(listener: (action: A2uiClientAction) => void): () => void {
    this.actionListeners.add(listener);
    return () => {
      this.actionListeners.delete(listener);
    };
  }

  dispatch(action: A2uiClientAction): void {
    console.log('[A2UI Action]', action);
    this._lastAction.set(action);

    for (const listener of this.actionListeners) {
      try {
        listener(action);
      } catch (err) {
        console.error('[A2UI Action Listener Error]', err);
      }
    }

    // Built-in routing actions from A2UI generative surfaces
    const actionName = action.name || (action as any).action;
    const context = action.context || {};

    if (actionName === 'start_adoption' && context['animalId']) {
      this.router.navigate(['/adopt'], { queryParams: { id: context['animalId'] } });
      return;
    }

    if (actionName === 'view_animal' && context['animalId']) {
      this.router.navigate(['/roster'], { queryParams: { q: context['animalId'] } });
      return;
    }

    if (actionName === 'hitl_decision') {
      const hitl = this.injector.get(HitlAuthorizationService);
      hitl.resolveDecision(Boolean(context['approved']), context['reason'] ? String(context['reason']) : undefined);
      return;
    }

    if (actionName === 'navigate' && typeof context['path'] === 'string') {
      this.router.navigateByUrl(context['path']);
      return;
    }
  }
}
