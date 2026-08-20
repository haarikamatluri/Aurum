import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

/** Small chevron indicator for sortable table headers. */
@Component({
  selector: 'app-sort-icon',
  standalone: true,
  imports: [Icon],
  template: `
    @if (direction() === 'asc') {
      <app-icon name="chevron-up" [size]="12" />
    } @else if (direction() === 'desc') {
      <app-icon name="chevron-down" [size]="12" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortIcon {
  readonly direction = input<'asc' | 'desc' | null>(null);
}
