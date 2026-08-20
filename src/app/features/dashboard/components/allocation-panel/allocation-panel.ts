import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { PortfolioService } from '../../../../core/services/portfolio.service';
import { AllocationDimension, AllocationSlice } from '../../../../core/models/portfolio.model';
import { Resource, resourceError, resourceLoading, resourceSuccess } from '../../../../core/models/common.model';
import { DonutChart, DonutSlice } from '../../../../shared/ui/donut-chart/donut-chart';
import { Skeleton } from '../../../../shared/ui/skeleton/skeleton';
import { ErrorState } from '../../../../shared/ui/error-state/error-state';
import { colorForKey } from '../../../../shared/utils/chart-colors';

const DIMENSIONS: { id: AllocationDimension; label: string }[] = [
  { id: 'sector', label: 'Sector' },
  { id: 'stock', label: 'Stock' },
  { id: 'assetType', label: 'Asset Type' },
];

/** Interactive allocation breakdown with Sector / Stock / Asset Type switch and drill-down. */
@Component({
  selector: 'app-allocation-panel',
  standalone: true,
  imports: [DonutChart, Skeleton, ErrorState],
  template: `
    <div class="card card-pad">
      <div class="panel-header">
        <span class="panel-title">Portfolio Allocation</span>
        <div class="segmented">
          @for (d of dimensions; track d.id) {
            <button type="button" class="segmented-item" [class.active]="dimension() === d.id" (click)="dimension.set(d.id)">
              {{ d.label }}
            </button>
          }
        </div>
      </div>

      @switch (resource().status) {
        @case ('loading') {
          <div class="alloc-loading">
            <app-skeleton width="148px" height="148px" radius="50%" />
            <div class="alloc-loading-lines">
              @for (i of [1,2,3,4]; track i) { <app-skeleton height="16px" /> }
            </div>
          </div>
        }
        @case ('error') {
          <app-error-state [message]="resource().error!" (retry)="load()" />
        }
        @case ('success') {
          <app-donut-chart [slices]="donutSlices()" (sliceClick)="onSliceClick($event)" />
          @if (selectedSlice(); as sel) {
            <div class="drilldown">
              <span class="drilldown-title">{{ sel.label }} holdings</span>
              <div class="drilldown-chips">
                @for (h of sel.holdings; track h) { <span class="badge badge-neutral">{{ h }}</span> }
              </div>
              @if (sel.targetPct !== undefined) {
                <p class="drilldown-note">Target allocation: {{ sel.targetPct }}% · Current: {{ sel.valuePct.toFixed(1) }}%
                  @if (sel.valuePct > sel.targetPct) { <span class="text-warning"> (+{{ (sel.valuePct - sel.targetPct).toFixed(1) }} pts over target)</span> }
                </p>
              }
            </div>
          }
        }
      }
    </div>
  `,
  styles: [
    `
      .alloc-loading { display: flex; align-items: center; gap: var(--space-6); }
      .alloc-loading-lines { flex: 1; display: flex; flex-direction: column; gap: var(--space-3); }
      .drilldown { margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--border); }
      .drilldown-title { font-size: 12px; font-weight: 700; color: var(--text-secondary); }
      .drilldown-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: var(--space-2); }
      .drilldown-note { font-size: 12px; color: var(--text-secondary); margin-top: var(--space-3); line-height: 1.6; }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllocationPanel {
  private readonly portfolioService = inject(PortfolioService);

  protected readonly dimensions = DIMENSIONS;
  protected readonly dimension = signal<AllocationDimension>('sector');
  protected readonly resource = signal<Resource<AllocationSlice[]>>(resourceLoading());
  protected readonly selectedKey = signal<string | null>(null);

  protected readonly donutSlices = signal<DonutSlice[]>([]);

  constructor() {
    effect(() => {
      // Track only `dimension` — everything load() touches (including a read+write of
      // `resource`) must run untracked, or writing `resource` inside this same effect
      // would re-trigger itself every tick (an infinite effect loop).
      const dim = this.dimension();
      untracked(() => {
        this.selectedKey.set(null);
        this.load(dim);
      });
    });
  }

  load(dimension: AllocationDimension = this.dimension()): void {
    this.resource.set(resourceLoading(this.resource().data));
    this.portfolioService.getAllocation(dimension).subscribe({
      next: (data) => {
        this.resource.set(resourceSuccess(data));
        this.donutSlices.set(data.map((s, i) => ({ key: s.key, label: s.label, valuePct: s.valuePct, color: colorForKey(s.key, i) })));
      },
      error: () => this.resource.set(resourceError('Unable to load allocation data.')),
    });
  }

  onSliceClick(key: string): void {
    this.selectedKey.set(this.selectedKey() === key ? null : key);
  }

  protected selectedSlice(): AllocationSlice | null {
    const key = this.selectedKey();
    if (!key) return null;
    return this.resource().data?.find((s) => s.key === key) ?? null;
  }
}
