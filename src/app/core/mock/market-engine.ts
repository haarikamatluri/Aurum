import { Injectable } from '@angular/core';
import { BehaviorSubject, interval } from 'rxjs';
import { Candle, SeriesPoint, TimeRange } from '../models/common.model';
import { MarketIndex, MarketSessionStatus } from '../models/market.model';
import { StockQuote } from '../models/stock.model';
import { gaussian, generateWalk, randRange, seededRandom } from './rng';
import { SECURITIES, SecurityDef } from './securities.data';

interface RangeConfig {
  points: number;
  intervalMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const RANGE_CONFIG: Record<TimeRange, RangeConfig> = {
  '1D': { points: 78, intervalMs: 5 * MINUTE },
  '5D': { points: 65, intervalMs: 30 * MINUTE },
  '1W': { points: 65, intervalMs: 30 * MINUTE },
  '1M': { points: 22, intervalMs: DAY },
  '3M': { points: 64, intervalMs: DAY },
  '6M': { points: 128, intervalMs: DAY },
  YTD: { points: 160, intervalMs: DAY },
  '1Y': { points: 252, intervalMs: DAY },
  '5Y': { points: 260, intervalMs: 7 * DAY },
  ALL: { points: 420, intervalMs: 7 * DAY },
};

const INDEX_DEFS = [
  { symbol: 'SPX', name: 'S&P 500', base: 6449.8, vol: 0.007 },
  { symbol: 'IXIC', name: 'NASDAQ Composite', base: 21684.3, vol: 0.011 },
  { symbol: 'DJI', name: 'Dow Jones Industrial', base: 42356.1, vol: 0.006 },
  { symbol: 'RUT', name: 'Russell 2000', base: 2312.6, vol: 0.012 },
  { symbol: 'VIX', name: 'CBOE Volatility Index', base: 14.8, vol: 0.045 },
  { symbol: 'TNX', name: '10Y Treasury Yield', base: 4.28, vol: 0.01 },
] as const;

/**
 * Central mock "live market" simulator. Holds a single in-memory source of truth for
 * every quote/index so the rest of the app (positions, watchlist, movers, AI) always
 * agrees on the current price. Nudges values on an interval to feel alive; swap this
 * class for a WebSocket/HTTP-polling gateway when wiring the real Market Data API.
 */
@Injectable({ providedIn: 'root' })
export class MarketEngine {
  readonly marketStatus: MarketSessionStatus = 'OPEN';
  private readonly quoteSubjects = new Map<string, BehaviorSubject<StockQuote>>();
  private readonly indexSubjects = new Map<string, BehaviorSubject<MarketIndex>>();
  private readonly indexPrevClose = new Map<string, number>();
  private readonly rand = seededRandom('market-engine-tick');

  constructor() {
    for (const sec of SECURITIES) {
      this.quoteSubjects.set(sec.symbol, new BehaviorSubject(this.buildInitialQuote(sec)));
    }
    for (const idx of INDEX_DEFS) {
      const rand = seededRandom(`${idx.symbol}-init`);
      const prevClose = idx.base * (1 - randRange(rand, -idx.vol * 1.4, idx.vol * 1.4));
      this.indexPrevClose.set(idx.symbol, prevClose);
      this.indexSubjects.set(
        idx.symbol,
        new BehaviorSubject<MarketIndex>({
          symbol: idx.symbol,
          name: idx.name,
          value: idx.base,
          changeAbs: round2(idx.base - prevClose),
          changePct: round2(((idx.base - prevClose) / prevClose) * 100),
          sparkline: generateWalk({
            points: 60,
            startValue: idx.base * 0.994,
            driftPct: 0.002,
            volatilityPct: idx.vol,
            seed: `${idx.symbol}-spark`,
            intervalMs: 5 * MINUTE,
          }),
        }),
      );
    }

    // Tick every 4s to simulate a live open market without hammering change detection.
    interval(4000).subscribe(() => this.tick());
  }

  private buildInitialQuote(sec: SecurityDef): StockQuote {
    const rand = seededRandom(`${sec.symbol}-init`);
    const prevClose = sec.basePrice * (1 - randRange(rand, -0.01, 0.01));
    const price = sec.basePrice;
    const dayLow = Math.min(price, prevClose) * (1 - randRange(rand, 0, 0.012));
    const dayHigh = Math.max(price, prevClose) * (1 + randRange(rand, 0, 0.012));
    const high52w = price * (1 + randRange(rand, 0.05, 0.32));
    const low52w = price * (1 - randRange(rand, 0.12, 0.4));
    return {
      symbol: sec.symbol,
      name: sec.name,
      price,
      changeAbs: price - prevClose,
      changePct: ((price - prevClose) / prevClose) * 100,
      open: prevClose * (1 + randRange(rand, -0.004, 0.004)),
      prevClose,
      dayLow,
      dayHigh,
      volume: Math.round(randRange(rand, 18_000_000, 92_000_000)),
      avgVolume: Math.round(randRange(rand, 20_000_000, 60_000_000)),
      marketCap: sec.marketCap,
      high52w,
      low52w,
      peRatio: Math.round(randRange(rand, 14, 58) * 10) / 10,
      eps: Math.round(randRange(rand, 1.2, 14) * 100) / 100,
      beta: sec.beta,
      dividendYieldPct: Math.round(randRange(rand, 0, 1.8) * 100) / 100,
    };
  }

  private tick(): void {
    for (const [symbol, subj] of this.quoteSubjects) {
      const q = subj.value;
      const shock = gaussian(this.rand, 0.0002, 0.0022);
      const price = Math.max(q.price * (1 + shock), 0.5);
      subj.next({
        ...q,
        price: Math.round(price * 100) / 100,
        changeAbs: Math.round((price - q.prevClose) * 100) / 100,
        changePct: Math.round(((price - q.prevClose) / q.prevClose) * 10000) / 100,
        dayLow: Math.round(Math.min(q.dayLow, price) * 100) / 100,
        dayHigh: Math.round(Math.max(q.dayHigh, price) * 100) / 100,
        volume: q.volume + Math.round(randRange(this.rand, 5_000, 90_000)),
      });
    }
    for (const [symbol, subj] of this.indexSubjects) {
      const idx = subj.value;
      const def = INDEX_DEFS.find((d) => d.symbol === symbol)!;
      const prevClose = this.indexPrevClose.get(symbol)!;
      const shock = gaussian(this.rand, 0.0001, def.vol / 8);
      const value = idx.value * (1 + shock);
      subj.next({
        ...idx,
        value: Math.round(value * 100) / 100,
        changeAbs: Math.round((value - prevClose) * 100) / 100,
        changePct: Math.round(((value - prevClose) / prevClose) * 10000) / 100,
        sparkline: [...idx.sparkline.slice(1), { t: new Date().toISOString(), v: value }],
      });
    }
  }

  quote$(symbol: string) {
    return this.quoteSubjects.get(symbol)!.asObservable();
  }

  quoteSnapshot(symbol: string): StockQuote {
    return this.quoteSubjects.get(symbol)!.value;
  }

  allQuoteSnapshots(): StockQuote[] {
    return SECURITIES.map((s) => this.quoteSubjects.get(s.symbol)!.value);
  }

  index$(symbol: string) {
    return this.indexSubjects.get(symbol)!.asObservable();
  }

  allIndexSnapshots(): MarketIndex[] {
    return INDEX_DEFS.map((d) => this.indexSubjects.get(d.symbol)!.value);
  }

  /** Deterministic historical candle series for a symbol + range (regenerated per call, not live). */
  buildCandles(symbol: string, range: TimeRange): Candle[] {
    const cfg = RANGE_CONFIG[range];
    const sec = SECURITIES.find((s) => s.symbol === symbol);
    const anchor = this.quoteSnapshot(symbol)?.price ?? sec?.basePrice ?? 100;
    const rand = seededRandom(`${symbol}-${range}-candles`);
    const vol = (sec?.beta ?? 1) * 0.014;
    const points = generateWalk({
      points: cfg.points,
      startValue: anchor / (1 + randRange(rand, -0.15, 0.35)),
      driftPct: randRange(rand, -0.02, 0.06),
      volatilityPct: vol,
      seed: `${symbol}-${range}-walk`,
      intervalMs: cfg.intervalMs,
    });
    // Force the walk to end at the live anchor price for continuity with the quote.
    const scale = anchor / points[points.length - 1].v;
    return points.map((p, i) => {
      const close = p.v * scale;
      const prev = i > 0 ? points[i - 1].v * scale : close;
      const open = prev;
      const high = Math.max(open, close) * (1 + randRange(rand, 0, 0.006));
      const low = Math.min(open, close) * (1 - randRange(rand, 0, 0.006));
      return {
        t: p.t,
        open: round2(open),
        high: round2(high),
        low: round2(low),
        close: round2(close),
        volume: Math.round(randRange(rand, 8_000_000, 70_000_000)),
      };
    });
  }

  /** Portfolio + benchmark value series for a given range, correlated but not identical. */
  buildPerformanceSeries(range: TimeRange, startValue: number): { t: string; portfolio: number; benchmark: number }[] {
    const cfg = RANGE_CONFIG[range];
    const rand = seededRandom(`portfolio-perf-${range}`);
    const portfolio = generateWalk({
      points: cfg.points,
      startValue: startValue / (1 + randRange(rand, 0.02, 0.19)),
      driftPct: randRange(rand, 0.01, 0.09),
      volatilityPct: 0.009,
      seed: `portfolio-${range}`,
      intervalMs: cfg.intervalMs,
    });
    const scale = startValue / portfolio[portfolio.length - 1].v;
    const benchRand = seededRandom(`benchmark-perf-${range}`);
    let benchReturn = 0;
    return portfolio.map((p, i) => {
      const val = p.v * scale;
      benchReturn += gaussian(benchRand, 0.0002, 0.0065);
      return { t: p.t, portfolio: round2(val), benchmark: round2(benchReturn * 100) };
    });
  }

  seriesPointsFromCandles(candles: Candle[]): SeriesPoint[] {
    return candles.map((c) => ({ t: c.t, v: c.close }));
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
