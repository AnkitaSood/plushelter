import {
  ApplicationRef,
  ComponentRef,
  EnvironmentInjector,
  PLATFORM_ID,
  Service,
  Type,
  createComponent,
  inject,
  inputBinding,
  outputBinding,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AutoDismissDirective } from './auto-dismiss.directive';
import { InfoToast } from './info-toast';
import { AlertToast } from './alert-toast';
import { CelebrationToast } from './celebration-toast';

const DEFAULT_DURATION_MS = 5000;

interface ActiveToast {
  ref: ComponentRef<unknown>;
  host: HTMLElement;
  timer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * Service-driven toast notifications rendered with `createComponent()`.
 *
 * Why `createComponent()` and not a child component / `NgComponentOutlet`:
 *  1. Toasts are raised from *code* (this service, called by error handlers and event
 *     handlers) — there's no template for a structural directive to live in.
 *  2. They must render on `document.body`, OUTSIDE the triggering component's view/DOM
 *     subtree, to escape its overflow/stacking context — that's what `hostElement` +
 *     `appRef.attachView()` give us.
 *  3. A toast raised during navigation must outlive the route component that raised it;
 *     each toast is its own `ComponentRef` with an independent lifecycle we destroy explicitly.
 */
@Service()
export class NotificationService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private container: HTMLElement | undefined;
  private readonly active = new Set<ActiveToast>();

  /** Neutral, informational toast — e.g. "Case admitted to roster". */
  info(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.show(InfoToast, message, durationMs);
  }

  /** Error toast with an optional retry action — used for resource failures. */
  alert(message: string, opts: { onRetry?: () => void } = {}, durationMs = 8000): void {
    this.show(AlertToast, message, durationMs, { output: 'retry', onAction: opts.onRetry });
  }

  /** The rare Adoption-Pink moment — a successful placement, with a "view certificate" action. */
  celebrate(message: string, opts: { onView?: () => void } = {}, durationMs = 7000): void {
    this.show(CelebrationToast, message, durationMs, { output: 'viewCertificate', onAction: opts.onView });
  }

  /**
   * The single `createComponent()` call the whole system rests on. Each toast gets its own
   * detached host element placed in the body-level container, a `dismissed` output wired to
   * teardown, and the `AutoDismissDirective` applied via the `directives` array — feeding the
   * chosen duration to the progress-bar CSS variable. An optional secondary action (retry /
   * view certificate) runs its callback and then dismisses the toast.
   */
  private show(
    component: Type<unknown>,
    message: string,
    durationMs: number,
    action?: { output: 'retry' | 'viewCertificate'; onAction?: () => void },
  ): void {
    if (!this.isBrowser) return; // No DOM on the server — toasts are a browser-only concern.

    const host = document.createElement('div');
    host.style.pointerEvents = 'auto';

    const entry: ActiveToast = { ref: undefined!, host, timer: undefined };

    const bindings = [
      inputBinding('message', () => message),
      outputBinding<void>('dismissed', () => this.dismiss(entry)),
    ];
    if (action) {
      bindings.push(
        outputBinding<void>(action.output, () => {
          action.onAction?.();
          this.dismiss(entry);
        }),
      );
    }

    const ref = createComponent(component, {
      environmentInjector: this.environmentInjector,
      hostElement: host,
      bindings,
      directives: [{ type: AutoDismissDirective, bindings: [inputBinding('durationMs', () => durationMs)] }],
    });
    entry.ref = ref;

    this.appRef.attachView(ref.hostView); // Enrol the detached view in change detection.
    this.ensureContainer().appendChild(host); // Make it visible on document.body.

    entry.timer = setTimeout(() => this.dismiss(entry), durationMs);
    this.active.add(entry);
  }

  /** Tears down one toast exactly once — cancel its timer, detach + destroy the view, drop the host. */
  private dismiss(entry: ActiveToast): void {
    if (!this.active.has(entry)) return;
    this.active.delete(entry);
    if (entry.timer) clearTimeout(entry.timer);
    this.appRef.detachView(entry.ref.hostView);
    entry.ref.destroy();
    entry.host.remove();
  }

  /** Lazily creates the fixed, top-right stacking container on `document.body`. */
  private ensureContainer(): HTMLElement {
    if (this.container) return this.container;
    const el = document.createElement('div');
    el.className = 'plushelter-toasts';
    // pointer-events:none lets clicks pass through the gaps; each toast host re-enables its own.
    el.style.cssText =
      'position:fixed;top:var(--space-4,1rem);right:var(--space-4,1rem);z-index:1000;' +
      'display:flex;flex-direction:column;gap:var(--space-2,0.5rem);pointer-events:none;';
    document.body.appendChild(el);
    this.container = el;
    return el;
  }
}
