import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

/** Generic modal shell: backdrop, Esc-to-close, header with title + close button, content projection. */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [Icon],
  template: `
    @if (open()) {
      <div class="backdrop" (click)="close.emit()">
        <div
          class="dialog"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title()"
          (click)="$event.stopPropagation()"
        >
          <div class="dialog-header">
            <h2 class="dialog-title">{{ title() }}</h2>
            <button type="button" class="btn btn-icon btn-ghost" (click)="close.emit()" aria-label="Close dialog">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="dialog-body">
            <ng-content />
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(4, 6, 9, 0.6);
        backdrop-filter: blur(2px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-4);
        z-index: var(--z-modal);
        animation: fadeIn var(--duration-base) var(--ease-standard);
      }
      .dialog {
        width: 100%;
        max-width: 520px;
        max-height: 90vh;
        overflow-y: auto;
        background: var(--surface-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        animation: scaleIn var(--duration-base) var(--ease-standard);
      }
      .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-4) var(--space-5);
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        background: var(--surface-elevated);
      }
      .dialog-title { font-size: 15px; font-weight: 700; }
      .dialog-body { padding: var(--space-5); }

      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes scaleIn { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: none; } }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Modal {
  readonly open = input<boolean>(false);
  readonly title = input<string>('');
  readonly close = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close.emit();
  }
}
