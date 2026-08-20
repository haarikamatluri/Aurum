import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Shimmering placeholder block used for every loading state in the app. */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `<span class="skeleton" [style.width]="width()" [style.height]="height()" [style.border-radius]="radius()"></span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {
  readonly width = input<string>('100%');
  readonly height = input<string>('14px');
  readonly radius = input<string>('6px');
}
