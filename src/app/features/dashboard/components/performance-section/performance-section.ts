import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { PortfolioService } from '../../../../core/services/portfolio.service';
import { TimeRange } from '../../../../core/models/common.model';
import { PerformancePoint } from '../../../../core/models/portfolio.model';
import { PerformanceChart } from '../../../../shared/ui/performance-chart/performance-chart';

const RANGES: TimeRange[] = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'];

@Component({
  selector: 'app-performance-section',
  standalone: true,
  imports: [PerformanceChart],
  template: `
    <div class="card card-pad">
      <div class="panel-header">
        <span class="panel-title">Portfolio Performance</span>
        <div class="segmented">
          @for (r of ranges; track r) {
            <button type="button" class="segmented-item" [class.active]="range() === r" (click)="range.set(r)">{{ r }}</button>
          }
        </div>
      </div>
      <app-performance-chart [data]="data()" [loading]="loading()" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerformanceSection {
  private readonly portfolioService = inject(PortfolioService);
  protected readonly ranges = RANGES;
  protected readonly range = signal<TimeRange>('1M');
  protected readonly data = signal<PerformancePoint[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    effect(() => {
      const r = this.range();
      this.loading.set(true);
      this.portfolioService.getPerformance(r).subscribe((points) => {
        this.data.set(points);
        this.loading.set(false);
      });
    });
  }
}
