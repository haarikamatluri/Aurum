import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { PortfolioService } from '../../../../core/services/portfolio.service';
import { PortfolioSummary } from '../../../../core/models/portfolio.model';
import { Resource, resourceError, resourceLoading, resourceSuccess } from '../../../../core/models/common.model';
import { KpiCard } from '../../../../shared/ui/kpi-card/kpi-card';

/** Top KPI row: Portfolio Value, Today's P&L, Total Return, Benchmark, Risk Score. */
@Component({
  selector: 'app-portfolio-summary',
  standalone: true,
  imports: [KpiCard],
  template: `
    <div class="kpi-grid">
      <app-kpi-card
        label="Portfolio Value"
        [value]="summary()?.data ? ('$' + summary()!.data!.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : ''"
        [sparkline]="summary()?.data?.valueSparkline"
        subLabel="Since yesterday"
        [changePct]="summary()?.data?.todayPnlPct"
        hint="Total current market value of all holdings plus cash."
        [loading]="summary().status === 'loading'"
      />
      <app-kpi-card
        label="Today's P&L"
        [value]="summary()?.data ? (signOf(summary()!.data!.todayPnlAbs) + '$' + abs(summary()!.data!.todayPnlAbs).toFixed(2)) : ''"
        [changePct]="summary()?.data?.todayPnlPct"
        hint="Unrealized gain or loss across your portfolio since the prior close."
        [loading]="summary().status === 'loading'"
      />
      <app-kpi-card
        label="Total Return"
        [value]="summary()?.data ? (signOf(summary()!.data!.totalReturnAbs) + '$' + abs(summary()!.data!.totalReturnAbs).toLocaleString('en-US', { maximumFractionDigits: 0 })) : ''"
        [changePct]="summary()?.data?.totalReturnPct"
        subLabel="All-time"
        hint="Cumulative gain or loss versus your total cost basis."
        [loading]="summary().status === 'loading'"
      />
      <app-kpi-card
        label="Benchmark"
        [value]="summary()?.data ? (signOf(summary()!.data!.benchmarkTodayPct) + summary()!.data!.benchmarkTodayPct.toFixed(2) + '%') : ''"
        subLabel="S&P 500 today"
        hint="Today's return of the S&P 500 for comparison."
        [loading]="summary().status === 'loading'"
      />
      <app-kpi-card
        label="Risk Score"
        [value]="summary()?.data ? (summary()!.data!.riskScore + ' / 100') : ''"
        subLabel="Moderate-High"
        hint="Composite score across concentration, volatility, sector exposure, and correlation. Higher means more risk."
        [loading]="summary().status === 'loading'"
      />
    </div>
  `,
  styles: [
    `
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: var(--space-4);
      }
      @media (max-width: 1280px) {
        .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
      @media (max-width: 768px) {
        .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 480px) {
        .kpi-grid { grid-template-columns: minmax(0, 1fr); }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortfolioSummaryWidget implements OnInit {
  private readonly portfolioService = inject(PortfolioService);

  protected readonly summary = signal<Resource<PortfolioSummary>>(resourceLoading());

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.summary.set(resourceLoading(this.summary().data));
    this.portfolioService.getPortfolioSummary().subscribe({
      next: (data) => this.summary.set(resourceSuccess(data)),
      error: () => this.summary.set(resourceError('Unable to load portfolio summary.')),
    });
  }

  protected signOf(n: number): string {
    return n > 0 ? '+' : n < 0 ? '-' : '';
  }

  protected abs(n: number): number {
    return Math.abs(n);
  }
}
