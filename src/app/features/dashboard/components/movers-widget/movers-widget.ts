import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PortfolioService } from '../../../../core/services/portfolio.service';
import { PortfolioMover } from '../../../../core/models/portfolio.model';
import { Resource, resourceError, resourceLoading, resourceSuccess } from '../../../../core/models/common.model';
import { RangeBar } from '../../../../shared/ui/range-bar/range-bar';
import { Skeleton } from '../../../../shared/ui/skeleton/skeleton';
import { ErrorState } from '../../../../shared/ui/error-state/error-state';

/** "Dips to Highs" monitor: 52-week range context for every holding, worst drawdowns first. */
@Component({
  selector: 'app-movers-widget',
  standalone: true,
  imports: [RouterLink, RangeBar, Skeleton, ErrorState],
  template: `
    <div class="card card-pad">
      <div class="panel-header">
        <span class="panel-title">Market &amp; Portfolio Movers</span>
        <span class="panel-subtitle">52-week range context</span>
      </div>

      @switch (resource().status) {
        @case ('loading') {
          <div class="movers-list">
            @for (i of [1,2,3,4]; track i) { <app-skeleton height="58px" /> }
          </div>
        }
        @case ('error') {
          <app-error-state [message]="resource().error!" (retry)="load()" />
        }
        @case ('success') {
          <div class="movers-list">
            @for (m of resource().data!.slice(0, 5); track m.symbol) {
              <a [routerLink]="['/stocks', m.symbol]" class="mover-row">
                <div class="mover-top">
                  <span class="mover-sym">{{ m.symbol }}</span>
                  <span class="mover-price num">\${{ m.currentPrice.toFixed(2) }}</span>
                  <span class="mover-dist" [class.text-negative]="m.distanceFromHighPct < -5" [class.text-warning]="m.distanceFromHighPct >= -5">
                    {{ m.distanceFromHighPct.toFixed(1) }}% from high
                  </span>
                </div>
                <app-range-bar
                  [low]="m.low52w" [high]="m.high52w" [current]="m.currentPrice"
                  [lowLabel]="'$' + m.low52w.toFixed(0)" [highLabel]="'$' + m.high52w.toFixed(0)"
                  [secondaryLow]="m.todayLow" [secondaryHigh]="m.todayHigh"
                />
              </a>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .movers-list { display: flex; flex-direction: column; gap: var(--space-4); }
      .mover-row { display: block; padding: var(--space-2); border-radius: var(--radius-md); transition: background var(--duration-fast) var(--ease-standard); }
      .mover-row:hover { background: var(--surface-hover); }
      .mover-top { display: flex; align-items: baseline; gap: var(--space-3); margin-bottom: var(--space-2); }
      .mover-sym { font-weight: 700; font-size: 13px; width: 46px; flex: none; }
      .mover-price { font-size: 12.5px; color: var(--text-secondary); flex: 1; }
      .mover-dist { font-size: 11.5px; font-weight: 700; font-family: var(--font-mono); }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoversWidget implements OnInit {
  private readonly portfolioService = inject(PortfolioService);
  protected readonly resource = signal<Resource<PortfolioMover[]>>(resourceLoading());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.resource.set(resourceLoading(this.resource().data));
    this.portfolioService.getMovers().subscribe({
      next: (data) => this.resource.set(resourceSuccess(data)),
      error: () => this.resource.set(resourceError('Unable to load movers.')),
    });
  }
}
