import { Directive, input } from '@angular/core';

/**
 * Auto-dismiss duration directive.
 *
 * Feeds the toast dismissal duration to the progress-bar CSS variable.
 * No timer or removal logic — the NotificationService owns that logic.
 * Apply this directive to toasts via createComponent's directives array.
 */
@Directive({
  selector: '[appAutoDismiss]',
  host: {
    '[style.--dismiss-ms]': "durationMs() + 'ms'",
  },
})
export class AutoDismissDirective {
  durationMs = input(5000);
}
