import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { TimeRange } from '../models/common.model';
import {
  AllocationDimension,
  AllocationSlice,
  Contributor,
  PerformancePoint,
  PortfolioMover,
  PortfolioSummary,
  Position,
  Transaction,
  TransactionDraft,
} from '../models/portfolio.model';
import { MarketEngine } from '../mock/market-engine';
import { CASH_BALANCE, HOLDINGS, TRANSACTIONS } from '../mock/portfolio.mock';
import { getSecurity } from '../mock/securities.data';
import { generateWalk } from '../mock/rng';

const NETWORK_DELAY = 380;

/**
 * Portfolio domain service. All methods return Observables so the eventual ASP.NET Core
 * implementation (GET /api/portfolio/*) is a drop-in replacement — only the internals
 * of this class change, consuming components stay untouched.
 */
@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private readonly engine = inject(MarketEngine);
  private transactions: Transaction[] = [...TRANSACTIONS];

  getPositions(): Observable<Position[]> {
    return of(null).pipe(delay(NETWORK_DELAY), map(() => this.computePositions()));
  }

  private computePositions(): Position[] {
    const totalValue = this.computeTotalMarketValue();
    return HOLDINGS.map((h) => {
      const sec = getSecurity(h.symbol);
      const quote = this.engine.quoteSnapshot(h.symbol);
      const marketValue = quote.price * h.shares;
      const todayPnlAbs = (quote.price - quote.prevClose) * h.shares;
      const totalCost = h.avgCost * h.shares;
      const totalPnlAbs = marketValue - totalCost;
      return {
        symbol: h.symbol,
        name: sec.name,
        sector: sec.sector,
        assetType: sec.assetType,
        shares: h.shares,
        avgCost: h.avgCost,
        currentPrice: quote.price,
        marketValue,
        todayPnlAbs,
        todayPnlPct: quote.changePct,
        totalPnlAbs,
        totalPnlPct: (totalPnlAbs / totalCost) * 100,
        weightPct: (marketValue / totalValue) * 100,
        riskContribution: Math.round(((marketValue / totalValue) * sec.beta) * 1000) / 10,
        targetWeightPct: h.targetWeightPct,
      };
    }).sort((a, b) => b.marketValue - a.marketValue);
  }

  private computeTotalMarketValue(): number {
    return HOLDINGS.reduce((sum, h) => sum + this.engine.quoteSnapshot(h.symbol).price * h.shares, 0) + CASH_BALANCE;
  }

  getPortfolioSummary(): Observable<PortfolioSummary> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() => {
        const positions = this.computePositions();
        const totalValue = positions.reduce((s, p) => s + p.marketValue, 0) + CASH_BALANCE;
        const todayPnlAbs = positions.reduce((s, p) => s + p.todayPnlAbs, 0);
        const totalCost = HOLDINGS.reduce((s, h) => s + h.avgCost * h.shares, 0);
        const totalPnlAbs = positions.reduce((s, p) => s + p.totalPnlAbs, 0);
        const spx = this.engine.index$('SPX');
        return {
          totalValue,
          todayPnlAbs,
          todayPnlPct: (todayPnlAbs / (totalValue - todayPnlAbs)) * 100,
          totalReturnAbs: totalPnlAbs,
          totalReturnPct: (totalPnlAbs / totalCost) * 100,
          benchmarkTodayPct: this.engine.allIndexSnapshots().find((i) => i.symbol === 'SPX')?.changePct ?? 0,
          benchmarkSymbol: 'S&P 500',
          riskScore: 62,
          cashBalance: CASH_BALANCE,
          valueSparkline: generateWalk({
            points: 30,
            startValue: totalValue * 0.97,
            driftPct: 0.02,
            volatilityPct: 0.006,
            seed: 'portfolio-value-spark',
            intervalMs: 3_600_000,
          }),
        };
      }),
    );
  }

  getPerformance(range: TimeRange): Observable<PerformancePoint[]> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() => {
        const totalValue = this.computeTotalMarketValue();
        const raw = this.engine.buildPerformanceSeries(range, totalValue);
        const firstVal = raw[0].portfolio;
        return raw.map((p) => ({
          t: p.t,
          portfolioValue: p.portfolio,
          portfolioReturnPct: ((p.portfolio - firstVal) / firstVal) * 100,
          benchmarkReturnPct: p.benchmark,
        }));
      }),
    );
  }

  getContributors(): Observable<{ top: Contributor[]; bottom: Contributor[] }> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() => {
        const positions = this.computePositions();
        const ranked = [...positions].sort((a, b) => b.todayPnlAbs - a.todayPnlAbs);
        const toContributor = (p: Position): Contributor => ({
          symbol: p.symbol,
          name: p.name,
          contributionAbs: p.todayPnlAbs,
          contributionPct: p.todayPnlPct,
        });
        return {
          top: ranked.slice(0, 4).map(toContributor),
          bottom: ranked.slice(-4).reverse().map(toContributor),
        };
      }),
    );
  }

  getAllocation(dimension: AllocationDimension): Observable<AllocationSlice[]> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() => {
        const positions = this.computePositions();
        const totalValue = this.computeTotalMarketValue();
        if (dimension === 'stock') {
          const slices: AllocationSlice[] = positions.map((p) => ({
            key: p.symbol,
            label: p.symbol,
            valuePct: p.weightPct,
            valueAbs: p.marketValue,
          }));
          const cash = (CASH_BALANCE / totalValue) * 100;
          slices.push({ key: 'CASH', label: 'Cash', valuePct: cash, valueAbs: CASH_BALANCE });
          return slices;
        }
        if (dimension === 'assetType') {
          const groups = new Map<string, { abs: number; holdings: string[] }>();
          for (const p of positions) {
            const g = groups.get(p.assetType) ?? { abs: 0, holdings: [] };
            g.abs += p.marketValue;
            g.holdings.push(p.symbol);
            groups.set(p.assetType, g);
          }
          groups.set('Cash', { abs: CASH_BALANCE, holdings: [] });
          return Array.from(groups.entries()).map(([key, g]) => ({
            key,
            label: key,
            valuePct: (g.abs / totalValue) * 100,
            valueAbs: g.abs,
            holdings: g.holdings,
          }));
        }
        // sector (default)
        const groups = new Map<string, { abs: number; holdings: string[] }>();
        for (const p of positions) {
          const g = groups.get(p.sector) ?? { abs: 0, holdings: [] };
          g.abs += p.marketValue;
          g.holdings.push(p.symbol);
          groups.set(p.sector, g);
        }
        return Array.from(groups.entries())
          .map(([key, g]) => ({
            key,
            label: key,
            valuePct: (g.abs / totalValue) * 100,
            valueAbs: g.abs,
            holdings: g.holdings,
            targetPct: key === 'Technology' ? 42 : undefined,
          }))
          .sort((a, b) => b.valuePct - a.valuePct);
      }),
    );
  }

  getMovers(): Observable<PortfolioMover[]> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() =>
        HOLDINGS.map((h) => {
          const sec = getSecurity(h.symbol);
          const q = this.engine.quoteSnapshot(h.symbol);
          return {
            symbol: h.symbol,
            name: sec.name,
            currentPrice: q.price,
            high52w: q.high52w,
            low52w: q.low52w,
            distanceFromHighPct: ((q.price - q.high52w) / q.high52w) * 100,
            distanceFromLowPct: ((q.price - q.low52w) / q.low52w) * 100,
            todayLow: q.dayLow,
            todayHigh: q.dayHigh,
          };
        }).sort((a, b) => a.distanceFromHighPct - b.distanceFromHighPct),
      ),
    );
  }

  getTransactions(): Observable<Transaction[]> {
    return of(null).pipe(delay(NETWORK_DELAY), map(() => [...this.transactions].sort((a, b) => b.date.localeCompare(a.date))));
  }

  addTransaction(draft: TransactionDraft): Observable<Transaction> {
    const total = draft.action === 'Dividend' ? draft.quantity * draft.price : draft.quantity * draft.price + draft.fees;
    const tx: Transaction = { id: `tx-${Date.now()}`, total, ...draft };
    this.transactions = [tx, ...this.transactions];
    return of(tx).pipe(delay(NETWORK_DELAY));
  }

  deleteTransaction(id: string): Observable<void> {
    this.transactions = this.transactions.filter((t) => t.id !== id);
    return of(void 0).pipe(delay(200));
  }
}
