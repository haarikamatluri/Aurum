import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarketDataService } from '../../core/services/market-data.service';
import { StockService } from '../../core/services/stock.service';
import { MarketIndex, SectorPerformance } from '../../core/models/market.model';
import { StockQuote } from '../../core/models/stock.model';
import { Resource, resourceError, resourceLoading, resourceSuccess } from '../../core/models/common.model';
import { Sparkline } from '../../shared/ui/sparkline/sparkline';
import { ChangeBadge } from '../../shared/ui/change-badge/change-badge';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { forkJoin } from 'rxjs';

interface MarketsData {
  indices: MarketIndex[];
  sectors: SectorPerformance[];
  quotes: StockQuote[];
}

@Component({
  selector: 'app-markets-page',
  standalone: true,
  imports: [RouterLink, Sparkline, ChangeBadge, Skeleton, ErrorState],
  templateUrl: './markets.html',
  styleUrl: './markets.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketsPage implements OnInit {
  private readonly marketData = inject(MarketDataService);
  private readonly stockService = inject(StockService);

  protected readonly resource = signal<Resource<MarketsData>>(resourceLoading());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.resource.set(resourceLoading(this.resource().data));
    forkJoin({
      indices: this.marketData.getIndices(),
      sectors: this.marketData.getSectorPerformance(),
      quotes: this.stockService.getAllQuotes(),
    }).subscribe({
      next: (data) => this.resource.set(resourceSuccess(data)),
      error: () => this.resource.set(resourceError('Unable to load market data.')),
    });
  }

  maxAbsSectorChange(sectors: SectorPerformance[]): number {
    return Math.max(...sectors.map((s) => Math.abs(s.changePct)), 1);
  }

  abs(n: number): number {
    return Math.abs(n);
  }
}
