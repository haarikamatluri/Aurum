import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PortfolioService } from '../../core/services/portfolio.service';
import { Transaction, TransactionAction, TransactionDraft } from '../../core/models/portfolio.model';
import { Resource, resourceError, resourceLoading, resourceSuccess } from '../../core/models/common.model';
import { Icon } from '../../shared/ui/icon/icon';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { TransactionModal } from './transaction-modal/transaction-modal';

const ACTION_FILTERS: (TransactionAction | 'All')[] = ['All', 'Buy', 'Sell', 'Dividend', 'Transfer'];

@Component({
  selector: 'app-transactions-page',
  standalone: true,
  imports: [RouterLink, DatePipe, Icon, Skeleton, ErrorState, EmptyState, TransactionModal],
  templateUrl: './transactions.html',
  styleUrl: './transactions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsPage implements OnInit {
  private readonly portfolioService = inject(PortfolioService);

  protected readonly resource = signal<Resource<Transaction[]>>(resourceLoading());
  protected readonly modalOpen = signal(false);
  protected readonly actionFilter = signal<TransactionAction | 'All'>('All');
  protected readonly actionFilters = ACTION_FILTERS;

  protected readonly filtered = computed(() => {
    const list = this.resource().data ?? [];
    return this.actionFilter() === 'All' ? list : list.filter((t) => t.action === this.actionFilter());
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.resource.set(resourceLoading(this.resource().data));
    this.portfolioService.getTransactions().subscribe({
      next: (data) => this.resource.set(resourceSuccess(data)),
      error: () => this.resource.set(resourceError('Unable to load transactions.')),
    });
  }

  addTransaction(draft: TransactionDraft): void {
    this.portfolioService.addTransaction(draft).subscribe(() => {
      this.modalOpen.set(false);
      this.load();
    });
  }

  actionBadgeClass(action: TransactionAction): string {
    switch (action) {
      case 'Buy': return 'badge-positive';
      case 'Sell': return 'badge-negative';
      case 'Dividend': return 'badge-accent';
      default: return 'badge-neutral';
    }
  }
}
