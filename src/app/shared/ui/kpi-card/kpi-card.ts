import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SeriesPoint } from '../../../core/models/common.model';
import { Sparkline } from '../sparkline/sparkline';
import { ChangeBadge } from '../change-badge/change-badge';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { Skeleton } from '../skeleton/skeleton';

/** The compact, information-dense KPI tile used across the top of the dashboard. */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [Sparkline, ChangeBadge, TooltipDirective, Skeleton],
  template: `
    <div class="kpi card card-pad">
      <div class="kpi-label-row">
        <span class="kpi-label" [appTooltip]="hint()">{{ label() }}</span>
      </div>

      @if (loading()) {
        <app-skeleton height="26px" width="70%" />
        <app-skeleton height="14px" width="45%" />
      } @else {
        <div class="kpi-value">{{ value() }}</div>
        <div class="kpi-sub">
          @if (changePct() !== undefined) {
            <app-change-badge [value]="changePct()!" />
          }
          @if (subLabel()) {
            <span class="kpi-subtext">{{ subLabel() }}</span>
          }
        </div>
      }

      @if (!loading() && sparkline() && sparkline()!.length > 1) {
        <div class="kpi-spark">
          <app-sparkline [points]="sparkline()!" />
        </div>
      }
    </div>
  `,
  styles: [
    `
      .kpi {
        position: relative;
        overflow: hidden;
        min-height: 108px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        transition: border-color var(--duration-base) var(--ease-standard), transform var(--duration-base) var(--ease-standard);
      }
      .kpi:hover { border-color: var(--border-strong); }
      .kpi-label-row { margin-bottom: var(--space-2); }
      .kpi-label {
        font-size: 11.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-tertiary);
        cursor: help;
        border-bottom: 1px dashed transparent;
      }
      .kpi-value {
        font-family: var(--font-mono);
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--text-primary);
        margin-bottom: 6px;
      }
      .kpi-sub {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: 12.5px;
      }
      .kpi-subtext { color: var(--text-tertiary); }
      .kpi-spark {
        position: absolute;
        right: var(--space-4);
        bottom: var(--space-4);
        width: 84px;
        height: 30px;
        opacity: 0.9;
      }
      @media (max-width: 520px) {
        .kpi-spark { display: none; }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input<string>('');
  readonly changePct = input<number | undefined>(undefined);
  readonly subLabel = input<string>('');
  readonly sparkline = input<SeriesPoint[] | undefined>(undefined);
  readonly hint = input<string>('');
  readonly loading = input<boolean>(false);
}
