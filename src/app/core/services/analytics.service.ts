import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Fundamentals, TechnicalIndicators } from '../models/stock.model';
import { Sentiment } from '../models/common.model';
import { MarketEngine } from '../mock/market-engine';
import { getSecurity } from '../mock/securities.data';
import { randRange, seededRandom } from '../mock/rng';

const NETWORK_DELAY = 360;

/** Derived analytics layered on top of raw quotes: technical indicators & fundamentals. */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly engine = inject(MarketEngine);

  getTechnicalIndicators(symbol: string): Observable<TechnicalIndicators> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() => {
        const q = this.engine.quoteSnapshot(symbol);
        const rand = seededRandom(symbol + '-technical-' + new Date().toDateString());
        const rsiValue = Math.round(randRange(rand, 25, 78));
        const macdHist = Math.round(randRange(rand, -2.2, 2.2) * 100) / 100;
        const macdSentiment: Sentiment = macdHist > 0.3 ? 'bullish' : macdHist < -0.3 ? 'bearish' : 'neutral';
        const trendSentiment: Sentiment = q.changePct > 1 ? 'bullish' : q.changePct < -1 ? 'bearish' : 'neutral';
        const volAnnPct = Math.round(randRange(rand, 18, 62) * 10) / 10;
        return {
          rsi: { value: rsiValue, label: rsiValue > 70 ? 'Overbought' : rsiValue < 30 ? 'Oversold' : 'Neutral' },
          macd: { value: macdHist, signalLine: Math.round((macdHist * 0.7) * 100) / 100, histogram: macdHist, label: macdSentiment },
          trend: { label: trendSentiment === 'bullish' ? 'Positive' : trendSentiment === 'bearish' ? 'Negative' : 'Sideways', sentiment: trendSentiment },
          volatility: { annualizedPct: volAnnPct, label: volAnnPct > 45 ? 'High' : volAnnPct > 28 ? 'Moderate' : 'Low' },
          relativeStrength: { label: q.changePct > 0.5 ? 'Strong vs. sector' : q.changePct < -0.5 ? 'Weak vs. sector' : 'In line with sector', sentiment: trendSentiment },
          movingAverages: [
            { period: 20, type: 'SMA', value: Math.round(q.price * (1 - randRange(rand, -0.02, 0.03)) * 100) / 100 },
            { period: 50, type: 'SMA', value: Math.round(q.price * (1 - randRange(rand, -0.01, 0.06)) * 100) / 100 },
            { period: 200, type: 'SMA', value: Math.round(q.price * (1 - randRange(rand, -0.04, 0.12)) * 100) / 100 },
            { period: 12, type: 'EMA', value: Math.round(q.price * (1 - randRange(rand, -0.015, 0.02)) * 100) / 100 },
          ],
          bollinger: {
            upper: Math.round(q.price * 1.045 * 100) / 100,
            middle: Math.round(q.price * 100) / 100,
            lower: Math.round(q.price * 0.955 * 100) / 100,
          },
          support: Math.round(q.price * (1 - randRange(rand, 0.03, 0.07)) * 100) / 100,
          resistance: Math.round(q.price * (1 + randRange(rand, 0.03, 0.07)) * 100) / 100,
        };
      }),
    );
  }

  getFundamentals(symbol: string): Observable<Fundamentals> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() => {
        const q = this.engine.quoteSnapshot(symbol);
        const sec = getSecurity(symbol);
        const rand = seededRandom(symbol + '-fundamentals');
        return {
          marketCap: q.marketCap,
          peRatio: q.peRatio,
          forwardPe: Math.round(q.peRatio * randRange(rand, 0.82, 0.95) * 10) / 10,
          eps: q.eps,
          epsGrowthPct: Math.round(randRange(rand, -8, 38) * 10) / 10,
          revenueTtm: Math.round(q.marketCap * randRange(rand, 0.08, 0.28)),
          revenueGrowthPct: Math.round(randRange(rand, 2, 32) * 10) / 10,
          grossMarginPct: Math.round(randRange(rand, 38, 78) * 10) / 10,
          operatingMarginPct: Math.round(randRange(rand, 14, 42) * 10) / 10,
          netMarginPct: Math.round(randRange(rand, 8, 34) * 10) / 10,
          debtToEquity: Math.round(randRange(rand, 0.1, 1.8) * 100) / 100,
          freeCashFlow: Math.round(q.marketCap * randRange(rand, 0.02, 0.09)),
          dividendYieldPct: q.dividendYieldPct,
          payoutRatioPct: Math.round(randRange(rand, 0, 55) * 10) / 10,
          roe: Math.round(randRange(rand, 8, 45) * 10) / 10,
          beta: sec.beta,
        };
      }),
    );
  }
}
