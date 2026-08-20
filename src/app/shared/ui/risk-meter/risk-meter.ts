import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TooltipDirective } from '../../directives/tooltip.directive';

/** Labeled 0-100 risk meter with threshold coloring + explicit numeric + text level (never color-only). */
@Component({
  selector: 'app-risk-meter',
  standalone: true,
  imports: [TooltipDirective],
  template: `
    <div class="meter">
      <div class="meter-top">
        <span class="meter-label" [appTooltip]="hint()">{{ label() }}</span>
        <span class="meter-value" [class]="'lvl-' + level()">{{ value() }}<span class="of100">/100</span></span>
      </div>
      <div class="meter-track" role="progressbar" [attr.aria-valuenow]="value()" aria-valuemin="0" aria-valuemax="100">
        <div class="meter-fill" [class]="'lvl-' + level()" [style.width.%]="value()"></div>
      </div>
      <span class="meter-tag" [class]="'lvl-' + level()">{{ levelLabel() }}</span>
    </div>
  `,
  styles: [
    `
      .meter { display: flex; flex-direction: column; gap: 6px; }
      .meter-top { display: flex; align-items: baseline; justify-content: space-between; }
      .meter-label { font-size: 12.5px; color: var(--text-secondary); cursor: help; }
      .meter-value { font-family: var(--font-mono); font-weight: 700; font-size: 13.5px; }
      .of100 { color: var(--text-tertiary); font-weight: 500; font-size: 11px; }
      .meter-track {
        height: 6px;
        border-radius: var(--radius-full);
        background: var(--bg-secondary);
        overflow: hidden;
      }
      .meter-fill { height: 100%; border-radius: var(--radius-full); transition: width var(--duration-base) var(--ease-standard); }
      .lvl-low { color: var(--positive); }
      .lvl-moderate { color: var(--warning); }
      .lvl-high { color: var(--negative); }
      .meter-fill.lvl-low { background: var(--positive); }
      .meter-fill.lvl-moderate { background: var(--warning); }
      .meter-fill.lvl-high { background: var(--negative); }
      .meter-tag {
        align-self: flex-start;
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskMeter {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly hint = input<string>('');
  readonly highIsGood = input<boolean>(false);

  readonly level = computed<'low' | 'moderate' | 'high'>(() => {
    const v = this.value();
    const raw = v < 40 ? 'low' : v < 70 ? 'moderate' : 'high';
    if (!this.highIsGood()) return raw;
    return raw === 'low' ? 'high' : raw === 'high' ? 'low' : 'moderate';
  });

  readonly levelLabel = computed(() => {
    const l = this.level();
    return l === 'low' ? 'Low' : l === 'moderate' ? 'Elevated' : 'High';
  });
}
