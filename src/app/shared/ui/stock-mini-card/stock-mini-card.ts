import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StockCardData } from '../../../core/models/ai.model';
import { ChangeBadge } from '../change-badge/change-badge';

/** Compact, clickable stock summary embedded inside AI responses and briefing cards. */
@Component({
  selector: 'app-stock-mini-card',
  standalone: true,
  imports: [RouterLink, ChangeBadge],
  template: `
    <a class="mini-card" [routerLink]="['/stocks', data().symbol]">
      <div class="mini-top">
        <span class="symbol">{{ data().symbol }}</span>
        <app-change-badge [value]="data().changePct" size="sm" />
      </div>
      <span class="name truncate">{{ data().name }}</span>
      <span class="price num">\${{ data().price.toFixed(2) }}</span>
      <div class="mini-stats">
        @if (data().portfolioWeightPct !== undefined) {
          <span class="stat"><span class="stat-label">Weight</span><span class="stat-val">{{ data().portfolioWeightPct!.toFixed(1) }}%</span></span>
        }
        @if (data().modelProbabilityPct !== undefined) {
          <span class="stat"><span class="stat-label">5D Model</span><span class="stat-val">{{ data().modelProbabilityPct }}%</span></span>
        }
      </div>
    </a>
  `,
  styles: [
    `
      .mini-card {
        display: flex;
        flex-direction: column;
        gap: 3px;
        width: 168px;
        padding: var(--space-3);
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        transition: border-color var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard);
        flex: none;
      }
      .mini-card:hover { border-color: var(--accent-border); transform: translateY(-1px); }
      .mini-top { display: flex; align-items: center; justify-content: space-between; }
      .symbol { font-weight: 800; font-size: 13px; }
      .name { font-size: 11px; color: var(--text-tertiary); }
      .price { font-size: 15px; font-weight: 700; margin-top: 2px; }
      .mini-stats { display: flex; gap: var(--space-3); margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-subtle); }
      .stat { display: flex; flex-direction: column; }
      .stat-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-tertiary); }
      .stat-val { font-size: 11.5px; font-weight: 700; font-family: var(--font-mono); }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockMiniCard {
  readonly data = input.required<StockCardData>();
}
