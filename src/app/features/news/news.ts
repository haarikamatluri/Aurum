import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AiAnalystService, StockNewsItem } from '../../core/services/ai-analyst.service';
import { PortfolioService } from '../../core/services/portfolio.service';

@Component({
  standalone: true,
  imports: [DatePipe],
  selector: 'app-news',
  styleUrl: './news.scss',
  templateUrl: './news.html',
})
export class News implements OnInit {
  private readonly aiService = inject(AiAnalystService);
  private readonly portfolioService = inject(PortfolioService);

  readonly articles = signal<StockNewsItem[]>([]);
  readonly isLoading = signal(true);

  async ngOnInit() {
    this.isLoading.set(true);
    try {
      // Get unique symbols from portfolio
      const holdings = this.portfolioService.holdings();
      const uniqueSymbols = Array.from(new Set(holdings.map(h => h.symbol)));
      
      // Fetch news for the first 3 symbols to avoid rate limits
      const symbolsToFetch = uniqueSymbols.slice(0, 3);
      if (symbolsToFetch.length === 0) {
        symbolsToFetch.push('TCS'); // Default fallback
      }

      let allNews: StockNewsItem[] = [];
      for (const sym of symbolsToFetch) {
        const news = await this.aiService.fetchStockNews(sym);
        allNews = [...allNews, ...news];
      }
      
      // Sort by pubDate descending
      allNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      this.articles.set(allNews);
    } catch (err) {
      console.warn('Error fetching news:', err);
    } finally {
      this.isLoading.set(false);
    }
  }
}
