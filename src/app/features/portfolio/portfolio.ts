import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PortfolioService } from '../../core/services/portfolio.service';
import { Position } from '../../core/models/portfolio.model';
import { Resource, resourceError, resourceLoading, resourceSuccess } from '../../core/models/common.model';
import { ChangeBadge } from '../../shared/ui/change-badge/change-badge';
import { SortIcon } from '../../shared/ui/sort-icon/sort-icon';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Icon } from '../../shared/ui/icon/icon';
import { SignedCurrencyPipe } from '../../shared/pipes/signed-currency.pipe';

type SortKey = keyof Pick<Position, 'symbol' | 'shares' | 'avgCost' | 'currentPrice' | 'marketValue' | 'todayPnlAbs' | 'totalPnlAbs' | 'totalPnlPct' | 'weightPct' | 'riskContribution'>;

interface ColumnDef {
  key: SortKey;
  label: string;
  optional: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: 'symbol', label: 'Symbol', optional: false },
  { key: 'shares', label: 'Shares', optional: true },
  { key: 'avgCost', label: 'Avg Cost', optional: true },
  { key: 'currentPrice', label: 'Price', optional: false },
  { key: 'marketValue', label: 'Market Value', optional: false },
  { key: 'todayPnlAbs', label: "Today's P&L", optional: false },
  { key: 'totalPnlAbs', label: 'Total P&L', optional: true },
  { key: 'totalPnlPct', label: 'Return %', optional: false },
  { key: 'weightPct', label: 'Weight', optional: false },
  { key: 'riskContribution', label: 'Risk', optional: true },
];

@Component({
  selector: 'app-portfolio-page',
  standalone: true,
  imports: [ChangeBadge, SortIcon, Skeleton, ErrorState, EmptyState, Icon, SignedCurrencyPipe],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortfolioPage implements OnInit {
  private readonly portfolioService = inject(PortfolioService);
  private readonly router = inject(Router);

  protected readonly resource = signal<Resource<Position[]>>(resourceLoading());
  protected readonly search = signal('');
  protected readonly sectorFilter = signal('All');
  protected readonly sortKey = signal<SortKey>('marketValue');
  protected readonly sortDir = signal<'asc' | 'desc'>('desc');
  protected readonly columns = COLUMNS;
  protected readonly hiddenColumns = signal<Set<SortKey>>(new Set(['avgCost', 'totalPnlAbs', 'riskContribution']));
  protected readonly columnsMenuOpen = signal(false);

  protected readonly sectors = computed(() => {
    const data = this.resource().data ?? [];
    return ['All', ...Array.from(new Set(data.map((p) => p.sector))).sort()];
  });

  protected readonly filteredPositions = computed(() => {
    let list = this.resource().data ?? [];
    const term = this.search().trim().toLowerCase();
    if (term) list = list.filter((p) => p.symbol.toLowerCase().includes(term) || p.name.toLowerCase().includes(term));
    if (this.sectorFilter() !== 'All') list = list.filter((p) => p.sector === this.sectorFilter());

    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  });

  protected readonly totals = computed(() => {
    const list = this.resource().data ?? [];
    return {
      marketValue: list.reduce((s, p) => s + p.marketValue, 0),
      todayPnl: list.reduce((s, p) => s + p.todayPnlAbs, 0),
      totalPnl: list.reduce((s, p) => s + p.totalPnlAbs, 0),
      count: list.length,
    };
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.resource.set(resourceLoading(this.resource().data));
    this.portfolioService.getPositions().subscribe({
      next: (data) => this.resource.set(resourceSuccess(data)),
      error: () => this.resource.set(resourceError('Unable to load positions.')),
    });
  }

  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set('desc');
    }
  }

  toggleColumn(key: SortKey): void {
    this.hiddenColumns.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  isColumnVisible(key: SortKey): boolean {
    return !this.hiddenColumns().has(key);
  }

  goToStock(symbol: string): void {
    this.router.navigate(['/stocks', symbol]);
  }
}
