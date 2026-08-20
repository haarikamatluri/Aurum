import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { combineLatest, map } from 'rxjs';
import { MarketDataService } from '../../core/services/market-data.service';
import { SignedPercentPipe } from '../../shared/pipes/signed-percent.pipe';

/** Compact, always-live index readout for the top header. Collapses on narrow screens. */
@Component({
  selector: 'app-market-ticker',
  standalone: true,
  imports: [AsyncPipe, SignedPercentPipe],
  template: `
    <div class="ticker">
      <span class="status">
        <span class="status-dot"></span>
        <span class="status-text">Market {{ status }}</span>
      </span>
      @if (rows$ | async; as rows) {
        @for (row of rows; track row.symbol) {
          <span class="tick" [class.pos]="row.changePct >= 0" [class.neg]="row.changePct < 0">
            <span class="tick-name">{{ row.name }}</span>
            <span class="tick-val">{{ row.changePct | signedPercent }}</span>
          </span>
        }
      }
    </div>
  `,
  styleUrl: './market-ticker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketTicker {
  private readonly marketData = inject(MarketDataService);
  protected readonly status = 'OPEN';

  protected readonly rows$ = combineLatest([
    this.marketData.index$('SPX'),
    this.marketData.index$('IXIC'),
    this.marketData.index$('VIX'),
  ]).pipe(
    map(([spx, ixic, vix]) => [
      { symbol: 'SPX', name: 'S&P 500', changePct: spx.changePct },
      { symbol: 'IXIC', name: 'NASDAQ', changePct: ixic.changePct },
      { symbol: 'VIX', name: 'VIX', changePct: vix.changePct },
    ]),
  );
}
