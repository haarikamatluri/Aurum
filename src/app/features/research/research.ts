import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NewsService } from '../../core/services/news.service';
import { NewsArticle } from '../../core/models/news.model';
import { Resource, resourceError, resourceLoading, resourceSuccess } from '../../core/models/common.model';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';

const CATEGORIES = ['All', 'Markets', 'Earnings', 'Company', 'Macro', 'Analyst Rating'] as const;

@Component({
  selector: 'app-research-page',
  standalone: true,
  imports: [RouterLink, Skeleton, ErrorState, RelativeTimePipe],
  templateUrl: './research.html',
  styleUrl: './research.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResearchPage implements OnInit {
  private readonly newsService = inject(NewsService);

  protected readonly resource = signal<Resource<NewsArticle[]>>(resourceLoading());
  protected readonly categories = CATEGORIES;
  protected readonly categoryFilter = signal<(typeof CATEGORIES)[number]>('All');

  protected readonly filtered = computed(() => {
    const list = this.resource().data ?? [];
    return this.categoryFilter() === 'All' ? list : list.filter((a) => a.category === this.categoryFilter());
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.resource.set(resourceLoading(this.resource().data));
    this.newsService.getLatest(30).subscribe({
      next: (data) => this.resource.set(resourceSuccess(data)),
      error: () => this.resource.set(resourceError('Unable to load research.')),
    });
  }

  sentimentBadge(s: NewsArticle['sentiment']): string {
    return s === 'positive' ? 'badge-positive' : s === 'negative' ? 'badge-negative' : 'badge-neutral';
  }
}
