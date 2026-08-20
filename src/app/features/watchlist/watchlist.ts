import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StockService } from '../../core/services/stock.service';
import { WatchlistQuote } from '../../core/models/stock.model';
import { Resource, resourceError, resourceLoading, resourceSuccess } from '../../core/models/common.model';
import { ChangeBadge } from '../../shared/ui/change-badge/change-badge';
import { Icon } from '../../shared/ui/icon/icon';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';

@Component({
  selector: 'app-watchlist-page',
  standalone: true,
  imports: [RouterLink, ChangeBadge, Icon, Skeleton, ErrorState, EmptyState],
  templateUrl: './watchlist.html',
  styleUrl: './watchlist.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchlistPage implements OnInit {
  private readonly stockService = inject(StockService);
  protected readonly resource = signal<Resource<WatchlistQuote[]>>(resourceLoading());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.resource.set(resourceLoading(this.resource().data));
    this.stockService.getWatchlist().subscribe({
      next: (data) => this.resource.set(resourceSuccess(data)),
      error: () => this.resource.set(resourceError('Unable to load your watchlist.')),
    });
  }

  trendClass(trend: string): string {
    return trend === 'bullish' ? 'badge-positive' : trend === 'bearish' ? 'badge-negative' : 'badge-neutral';
  }

  volumeClass(state: string): string {
    return state === 'High' ? 'text-warning' : state === 'Low' ? 'text-tertiary' : 'text-secondary';
  }
}
