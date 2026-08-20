import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from '../icon/icon';

/** Small, unmissable indicator that the surrounding data is simulated, not live. */
@Component({
  selector: 'app-demo-badge',
  standalone: true,
  imports: [Icon],
  template: `
    <span class="demo-chip" title="This app currently renders simulated market data for demonstration purposes.">
      <app-icon name="database" [size]="11" />
      Demo data
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoBadge {}
