import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

/** Consistent "nothing here yet" state with an optional action slot via content projection. */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [Icon],
  template: `
    <div class="empty">
      <div class="empty-icon"><app-icon [name]="icon()" [size]="22" /></div>
      <p class="empty-title">{{ title() }}</p>
      @if (description()) {
        <p class="empty-desc">{{ description() }}</p>
      }
      <div class="empty-action"><ng-content /></div>
    </div>
  `,
  styles: [
    `
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: var(--space-8) var(--space-5);
        color: var(--text-secondary);
      }
      .empty-icon {
        width: 44px;
        height: 44px;
        border-radius: var(--radius-full);
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--surface-elevated);
        border: 1px solid var(--border);
        color: var(--text-tertiary);
        margin-bottom: var(--space-4);
      }
      .empty-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: var(--space-1);
      }
      .empty-desc {
        font-size: 12.5px;
        max-width: 320px;
        line-height: 1.6;
      }
      .empty-action:empty { display: none; }
      .empty-action { margin-top: var(--space-4); }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly icon = input<string>('layers');
  readonly title = input<string>('Nothing here yet');
  readonly description = input<string>('');
}
