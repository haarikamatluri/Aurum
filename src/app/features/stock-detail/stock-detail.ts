import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { StockService } from '../../core/services/stock.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { NewsService } from '../../core/services/news.service';
import { PredictionService } from '../../core/services/prediction.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { StockProfile, StockQuote, TechnicalIndicators, Fundamentals, CorporateEvent } from '../../core/models/stock.model';
import { NewsArticle } from '../../core/models/news.model';
import { PredictionOutlook } from '../../core/models/prediction.model';
import { Position } from '../../core/models/portfolio.model';
import { Candle, TimeRange } from '../../core/models/common.model';
import { UiStateService } from '../../core/services/ui-state.service';

import { Icon } from '../../shared/ui/icon/icon';
import { ChangeBadge } from '../../shared/ui/change-badge/change-badge';
import { RangeBar } from '../../shared/ui/range-bar/range-bar';
import { Tabs, TabDef } from '../../shared/ui/tabs/tabs';
import { PriceChart, PriceChartIndicatorState } from '../../shared/ui/price-chart/price-chart';
import { PredictionCard } from '../../shared/ui/prediction-card/prediction-card';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { CompactNumberPipe } from '../../shared/pipes/compact-number.pipe';

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'chart', label: 'Chart' },
  { id: 'technical', label: 'Technical' },
  { id: 'fundamentals', label: 'Fundamentals' },
  { id: 'news', label: 'News' },
  { id: 'events', label: 'Events' },
  { id: 'prediction', label: 'Prediction' },
  { id: 'impact', label: 'Portfolio Impact' },
];

const CHART_RANGES: TimeRange[] = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y'];

@Component({
  selector: 'app-stock-detail-page',
  standalone: true,
  imports: [RouterLink, DatePipe, Icon, ChangeBadge, RangeBar, Tabs, PriceChart, PredictionCard, Skeleton, EmptyState, TooltipDirective, RelativeTimePipe, CompactNumberPipe],
  templateUrl: './stock-detail.html',
  styleUrl: './stock-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockDetailPage implements OnDestroy {
  private readonly stockService = inject(StockService);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly newsService = inject(NewsService);
  private readonly predictionService = inject(PredictionService);
  private readonly portfolioService = inject(PortfolioService);
  protected readonly ui = inject(UiStateService);

  readonly symbol = input.required<string>();

  protected readonly tabs = TABS;
  protected readonly activeTab = signal('overview');
  protected readonly chartRanges = CHART_RANGES;
  protected readonly chartRange = signal<TimeRange>('3M');
  protected readonly indicators = signal<PriceChartIndicatorState>({ sma20: true, sma50: false, sma200: false, ema: false, bollinger: false, volume: true });

  protected readonly quote = signal<StockQuote | null>(null);
  protected readonly profile = signal<StockProfile | null>(null);
  protected readonly technical = signal<TechnicalIndicators | null>(null);
  protected readonly fundamentals = signal<Fundamentals | null>(null);
  protected readonly news = signal<NewsArticle[]>([]);
  protected readonly events = signal<CorporateEvent[]>([]);
  protected readonly prediction = signal<PredictionOutlook | null>(null);
  protected readonly position = signal<Position | null>(null);
  protected readonly candles = signal<Candle[]>([]);
  protected readonly loading = signal(true);
  protected readonly candlesLoading = signal(true);

  private quoteSub: Subscription | null = null;

  constructor() {
    effect(() => {
      const sym = this.symbol();
      this.activeTab.set('overview');
      this.loadAll(sym);
    });

    effect(() => {
      const sym = this.symbol();
      const range = this.chartRange();
      this.candlesLoading.set(true);
      this.stockService.getPriceHistory(sym, range).subscribe((res) => {
        this.candles.set(res.candles);
        this.candlesLoading.set(false);
      });
    });
  }

  private loadAll(symbol: string): void {
    this.loading.set(true);
    this.quoteSub?.unsubscribe();
    this.quoteSub = this.stockService.quote$(symbol).subscribe((q) => this.quote.set(q));

    forkJoin({
      profile: this.stockService.getProfile(symbol),
      technical: this.analyticsService.getTechnicalIndicators(symbol),
      fundamentals: this.analyticsService.getFundamentals(symbol),
      news: this.newsService.getForSymbol(symbol),
      events: this.stockService.getEvents(symbol),
      prediction: this.predictionService.getOutlook(symbol),
      positions: this.portfolioService.getPositions(),
    }).subscribe(({ profile, technical, fundamentals, news, events, prediction, positions }) => {
      this.profile.set(profile);
      this.technical.set(technical);
      this.fundamentals.set(fundamentals);
      this.news.set(news);
      this.events.set(events);
      this.prediction.set(prediction);
      this.position.set(positions.find((p) => p.symbol === symbol) ?? null);
      this.loading.set(false);
    });
  }

  toggleIndicator(key: keyof PriceChartIndicatorState): void {
    this.indicators.update((s) => ({ ...s, [key]: !s[key] }));
  }

  askAiAboutStock(): void {
    this.ui.aiPanelOpen.set(true);
  }

  ngOnDestroy(): void {
    this.quoteSub?.unsubscribe();
  }
}
