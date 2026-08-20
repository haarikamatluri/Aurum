import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MarketDataService } from '../../../../core/services/market-data.service';
import { MarketIndex } from '../../../../core/models/market.model';
import { Resource, resourceError, resourceLoading, resourceSuccess } from '../../../../core/models/common.model';
import { Sparkline } from '../../../../shared/ui/sparkline/sparkline';
import { ChangeBadge } from '../../../../shared/ui/change-badge/change-badge';
import { Skeleton } from '../../../../shared/ui/skeleton/skeleton';
import { ErrorState } from '../../../../shared/ui/error-state/error-state';

/** Six-index market overview grid — S&P 500, NASDAQ, Dow, Russell 2000, VIX, 10Y yield. */
@Component({
  selector: 'app-market-pulse',
  standalone: true,
  imports: [Sparkline, ChangeBadge, Skeleton, ErrorState],
  template: `
    <div class="card card-pad">
      <div class="panel-header">
        <span class="panel-title">Market Pulse</span>
        <span class="panel-subtitle">Live snapshot</span>
      </div>

      @switch (resource().status) {
        @case ('loading') {
          <div class="pulse-grid">
            @for (i of [1,2,3,4,5,6]; track i) {
              <div class="pulse-tile"><app-skeleton height="52px" /></div>
            }
          </div>
        }
        @case ('error') {
          <app-error-state [message]="resource().error!" (retry)="load()" />
        }
        @case ('success') {
          <div class="pulse-grid">
            @for (idx of resource().data; track idx.symbol) {
              <div class="pulse-tile">
                <div class="pulse-info">
                  <span class="pulse-name">{{ idx.name }}</span>
                  <span class="pulse-value num">{{ idx.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
                  <app-change-badge [value]="idx.changePct" size="sm" />
                </div>
                <div class="pulse-spark"><app-sparkline [points]="idx.sparkline" [showArea]="false" /></div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .pulse-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); }
      .pulse-tile {
        display: flex; align-items: center; justify-content: space-between; gap: var(--space-2);
        padding: var(--space-3); background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-md);
      }
      .pulse-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .pulse-name { font-size: 11px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.02em; }
      .pulse-value { font-size: 14.5px; font-weight: 700; }
      .pulse-spark { width: 56px; height: 30px; flex: none; }
      @media (max-width: 1280px) { .pulse-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 640px) { .pulse-grid { grid-template-columns: minmax(0, 1fr); } }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketPulse implements OnInit {
  private readonly marketData = inject(MarketDataService);
  protected readonly resource = signal<Resource<MarketIndex[]>>(resourceLoading());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.resource.set(resourceLoading(this.resource().data));
    this.marketData.getIndices().subscribe({
      next: (data) => this.resource.set(resourceSuccess(data)),
      error: () => this.resource.set(resourceError('Unable to load market data.')),
    });
  }
}
