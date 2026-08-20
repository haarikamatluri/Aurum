import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

/** Consistent error state with a Retry action, used whenever a Resource<T> enters 'error'. */
@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [Icon],
  template: `
    <div class="error-state">
      <div class="error-icon"><app-icon name="alert-triangle" [size]="20" /></div>
      <p class="error-title">{{ message() }}</p>
      <button type="button" class="btn btn-sm btn-outline" (click)="retry.emit()">
        <app-icon name="refresh-cw" [size]="13" /> Retry
      </button>
    </div>
  `,
  styles: [
    `
      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: var(--space-7) var(--space-5);
        gap: var(--space-3);
      }
      .error-icon { color: var(--negative); }
      .error-title { font-size: 13px; color: var(--text-secondary); max-width: 320px; }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorState {
  readonly message = input<string>('Unable to load data.');
  readonly retry = output<void>();
}
