import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PredictionOutlook } from '../../../core/models/prediction.model';
import { Icon } from '../icon/icon';
import { TooltipDirective } from '../../directives/tooltip.directive';

/**
 * Model-estimate output card. Always explicitly labeled MODEL ESTIMATE — never presented
 * as a guaranteed forecast, per the app's financial-UX rules.
 */
@Component({
  selector: 'app-prediction-card',
  standalone: true,
  imports: [RouterLink, Icon, TooltipDirective],
  template: `
    <div class="pred-card">
      <div class="pred-head">
        @if (showSymbol()) {
          <a [routerLink]="['/stocks', outlook().symbol]" class="pred-symbol">{{ outlook().symbol }}</a>
        }
        <span class="badge badge-accent model-badge" appTooltip="This is a statistical model output, not a guarantee of future performance.">
          <app-icon name="zap" [size]="10" /> Model Estimate
        </span>
      </div>

      <span class="pred-horizon">{{ outlook().horizonDays }}-Day Outlook</span>

      <div class="prob-bars">
        <div class="prob-row">
          <span class="prob-label positive">Positive</span>
          <div class="prob-track"><div class="prob-fill positive" [style.width.%]="outlook().positivePct"></div></div>
          <span class="prob-val num">{{ outlook().positivePct }}%</span>
        </div>
        <div class="prob-row">
          <span class="prob-label neutral">Neutral</span>
          <div class="prob-track"><div class="prob-fill neutral" [style.width.%]="outlook().neutralPct"></div></div>
          <span class="prob-val num">{{ outlook().neutralPct }}%</span>
        </div>
        <div class="prob-row">
          <span class="prob-label negative">Negative</span>
          <div class="prob-track"><div class="prob-fill negative" [style.width.%]="outlook().negativePct"></div></div>
          <span class="prob-val num">{{ outlook().negativePct }}%</span>
        </div>
      </div>

      <div class="pred-meta">
        <span><span class="meta-label">Expected Volatility</span><span class="meta-val">{{ outlook().expectedVolatility }}</span></span>
        <span><span class="meta-label">Confidence</span><span class="meta-val">{{ outlook().confidence }}</span></span>
      </div>

      @if (showDrivers()) {
        <ul class="drivers">
          @for (d of outlook().driverSummary; track d) { <li>{{ d }}</li> }
        </ul>
      }

      <span class="pred-footnote">{{ outlook().modelName }} · Not investment advice</span>
    </div>
  `,
  styles: [
    `
      .pred-card { display: flex; flex-direction: column; gap: var(--space-3); }
      .pred-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
      .pred-symbol { font-weight: 800; font-size: 14px; color: var(--text-primary); }
      .model-badge { gap: 4px; }
      .pred-horizon { font-size: 12px; font-weight: 600; color: var(--text-secondary); }

      .prob-bars { display: flex; flex-direction: column; gap: 8px; }
      .prob-row { display: grid; grid-template-columns: 58px minmax(0, 1fr) 40px; align-items: center; gap: var(--space-2); }
      .prob-label { font-size: 11px; font-weight: 700; }
      .prob-label.positive { color: var(--positive); }
      .prob-label.neutral { color: var(--text-tertiary); }
      .prob-label.negative { color: var(--negative); }
      .prob-track { height: 6px; border-radius: var(--radius-full); background: var(--bg-secondary); overflow: hidden; }
      .prob-fill { height: 100%; border-radius: var(--radius-full); }
      .prob-fill.positive { background: var(--positive); }
      .prob-fill.neutral { background: var(--text-tertiary); }
      .prob-fill.negative { background: var(--negative); }
      .prob-val { font-size: 11.5px; font-weight: 700; text-align: right; }

      .pred-meta { display: flex; gap: var(--space-5); padding-top: var(--space-2); border-top: 1px solid var(--border-subtle); }
      .meta-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-tertiary); font-weight: 700; }
      .meta-val { font-size: 12.5px; font-weight: 700; }

      .drivers { display: flex; flex-direction: column; gap: 5px; padding-left: 16px; list-style: disc; }
      .drivers li { font-size: 11.5px; color: var(--text-secondary); line-height: 1.5; }

      .pred-footnote { font-size: 10.5px; color: var(--text-tertiary); }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PredictionCard {
  readonly outlook = input.required<PredictionOutlook>();
  readonly showSymbol = input<boolean>(true);
  readonly showDrivers = input<boolean>(true);
}
