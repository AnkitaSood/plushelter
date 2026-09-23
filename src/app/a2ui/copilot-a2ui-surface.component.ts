import {
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import { SurfaceComponent, A2uiRendererService } from '@a2ui/angular/v0_9';

@Component({
  selector: 'app-copilot-a2ui-surface',
  imports: [SurfaceComponent],
  template: `
    <a2ui-v09-surface [surfaceId]="surfaceId()" />
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
})
export class CopilotA2uiSurfaceComponent {
  readonly surfaceId = input<string>('default');
  readonly operations = input<any[]>([]);

  private readonly a2ui = inject(A2uiRendererService, { optional: true });

  constructor() {
    effect(() => {
      const ops = this.operations();
      const id = this.surfaceId();
      if (this.a2ui) {
        if (ops && ops.length > 0) {
          const hasSurface = !!this.a2ui.surfaceGroup.getSurface(id);
          const filteredOps = hasSurface
            ? ops.filter((msg: any) => !('createSurface' in msg))
            : ops;
          this.a2ui.processMessages(filteredOps);
        } else {
          this.a2ui.surfaceGroup.deleteSurface(id);
        }
      }
    });
  }
}
