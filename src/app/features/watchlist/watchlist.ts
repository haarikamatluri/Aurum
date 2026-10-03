import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WatchlistService } from '../../core/services/watchlist.service';
import { FormsModule } from '@angular/forms';
import { POPULAR_RESEARCH_STOCKS } from '../ai-analyst/ai-analyst'; // or similar

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-watchlist',
  styleUrl: './watchlist.scss',
  templateUrl: './watchlist.html',
})
export class Watchlist {
  private readonly watchlistService = inject(WatchlistService);
  private readonly router = inject(Router);

  readonly symbols = this.watchlistService.symbols;
  searchQuery = '';

  get watchlistItems() {
    return this.symbols().map(sym => {
      const pop = POPULAR_RESEARCH_STOCKS.find(p => p.symbol === sym);
      return {
        symbol: sym,
        companyName: pop ? pop.companyName : sym,
        price: null, // Ideally we fetch real-time price here or use a pipe
        changePct: null
      };
    });
  }

  async addStock(symbol: string) {
    if (symbol.trim()) {
      await this.watchlistService.addSymbol(symbol.trim().toUpperCase());
      this.searchQuery = '';
    }
  }

  async removeStock(symbol: string, event: Event) {
    event.stopPropagation();
    await this.watchlistService.removeSymbol(symbol);
  }

  openAnalysis(symbol: string) {
    this.router.navigate(['/money/ai-analyst'], { queryParams: { symbol } });
  }
}
