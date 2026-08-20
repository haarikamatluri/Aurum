import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { TimeRange } from '../models/common.model';
import { CorporateEvent, PriceHistoryResponse, StockProfile, StockQuote, WatchlistQuote } from '../models/stock.model';
import { MarketEngine } from '../mock/market-engine';
import { getSecurity, SECURITIES } from '../mock/securities.data';
import { pick, randRange, seededRandom } from '../mock/rng';
import { Sentiment } from '../models/common.model';

const NETWORK_DELAY = 340;

const WATCHLIST_SYMBOLS = ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AMD', 'JPM', 'V'];

/** Individual-security data: quotes, profile, historical candles, corporate events. Backs GET /api/stocks/*. */
@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly engine = inject(MarketEngine);

  getQuote(symbol: string): Observable<StockQuote> {
    return of(null).pipe(delay(NETWORK_DELAY), map(() => this.engine.quoteSnapshot(symbol)));
  }

  getAllQuotes(): Observable<StockQuote[]> {
    return of(null).pipe(delay(NETWORK_DELAY), map(() => this.engine.allQuoteSnapshots()));
  }

  quote$(symbol: string) {
    return this.engine.quote$(symbol);
  }

  getProfile(symbol: string): Observable<StockProfile> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() => {
        const sec = getSecurity(symbol);
        return { symbol: sec.symbol, name: sec.name, sector: sec.sector, industry: sec.industry, description: sec.description };
      }),
    );
  }

  getPriceHistory(symbol: string, range: TimeRange): Observable<PriceHistoryResponse> {
    return of(null).pipe(delay(NETWORK_DELAY), map(() => ({ symbol, candles: this.engine.buildCandles(symbol, range) })));
  }

  getEvents(symbol: string): Observable<CorporateEvent[]> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() => {
        const rand = seededRandom(symbol + '-events');
        const days = [7, 34, 62, -12, -45];
        const types: CorporateEvent['type'][] = ['Earnings', 'Dividend', 'Conference', 'Earnings', 'Dividend'];
        return days.map((d, i) => {
          const date = new Date();
          date.setDate(date.getDate() + d);
          const type = types[i];
          const title =
            type === 'Earnings' ? `Q${Math.ceil(randRange(rand, 1, 4))} Earnings Call`
            : type === 'Dividend' ? 'Ex-Dividend Date'
            : 'Investor Conference';
          return {
            id: `${symbol}-evt-${i}`,
            date: date.toISOString(),
            type,
            title,
            description:
              type === 'Earnings' ? `Quarterly results and management commentary for ${symbol}.`
              : type === 'Dividend' ? `Shareholders of record receive the declared quarterly dividend.`
              : `Management presents at an industry investor conference.`,
          };
        }).sort((a, b) => a.date.localeCompare(b.date));
      }),
    );
  }

  getWatchlist(): Observable<WatchlistQuote[]> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() =>
        WATCHLIST_SYMBOLS.map((symbol) => {
          const q = this.engine.quoteSnapshot(symbol);
          const rand = seededRandom(symbol + '-watchlist-' + new Date().toDateString());
          const rsi = Math.round(randRange(rand, 28, 78));
          const trend: Sentiment = q.changePct > 0.4 ? 'bullish' : q.changePct < -0.4 ? 'bearish' : 'neutral';
          const volumeState = pick(rand, ['Low', 'Normal', 'Normal', 'High'] as const);
          return {
            ...q,
            rsi,
            trend,
            predictionPct: Math.round(randRange(rand, 42, 72)),
            hasAlert: rand() > 0.65,
            volumeState,
          };
        }),
      ),
    );
  }

  searchSymbols(query: string): Observable<StockQuote[]> {
    const q = query.trim().toUpperCase();
    return of(null).pipe(
      delay(150),
      map(() =>
        SECURITIES.filter((s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q))
          .slice(0, 8)
          .map((s) => this.engine.quoteSnapshot(s.symbol)),
      ),
    );
  }

  allSymbols(): string[] {
    return SECURITIES.map((s) => s.symbol);
  }
}
