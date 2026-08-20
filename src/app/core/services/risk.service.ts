import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { CorrelationMatrix, RiskFlag, RiskScoreBreakdown, StressTestResult } from '../models/risk.model';
import { MarketEngine } from '../mock/market-engine';
import { HOLDINGS } from '../mock/portfolio.mock';
import { getSecurity } from '../mock/securities.data';
import { randRange, seededRandom } from '../mock/rng';

const NETWORK_DELAY = 380;

/** Portfolio-level risk analytics. Backs GET /api/risk/portfolio. */
@Injectable({ providedIn: 'root' })
export class RiskService {
  private readonly engine = inject(MarketEngine);

  getRiskScore(): Observable<RiskScoreBreakdown> {
    return of({
      overall: 62,
      concentration: 78,
      volatility: 61,
      sectorExposure: 72,
      correlation: 68,
      drawdown: 43,
      beta: 1.24,
      maxDrawdownPct: -14.2,
    }).pipe(delay(NETWORK_DELAY));
  }

  getRiskFlags(): Observable<RiskFlag[]> {
    return of<RiskFlag[]>([
      { id: 'f1', severity: 'warning', message: 'Technology concentration increased to 54%, above your 42% target.' },
      { id: 'f2', severity: 'warning', message: 'NVDA position exceeds target allocation by 5.8 percentage points.' },
      { id: 'f3', severity: 'success', message: 'Portfolio drawdown remains within your stated tolerance.' },
      { id: 'f4', severity: 'info', message: 'Correlation across top 5 holdings is moderately elevated versus last quarter.' },
    ]).pipe(delay(NETWORK_DELAY));
  }

  getCorrelationMatrix(): Observable<CorrelationMatrix> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() => {
        const symbols = HOLDINGS.slice(0, 8).map((h) => h.symbol);
        const rand = seededRandom('correlation-matrix');
        const cells = [];
        for (const a of symbols) {
          for (const b of symbols) {
            if (a === b) {
              cells.push({ symbolA: a, symbolB: b, correlation: 1 });
              continue;
            }
            const secA = getSecurity(a);
            const secB = getSecurity(b);
            const sameSector = secA.sector === secB.sector ? 0.28 : 0;
            const base = randRange(rand, -0.15, 0.55) + sameSector;
            cells.push({ symbolA: a, symbolB: b, correlation: Math.round(Math.min(base, 0.97) * 100) / 100 });
          }
        }
        return { symbols, cells };
      }),
    );
  }

  getStressTests(): Observable<StressTestResult[]> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() => {
        const totalValue = HOLDINGS.reduce((s, h) => s + this.engine.quoteSnapshot(h.symbol).price * h.shares, 0);
        const scenarios: { scenario: string; pct: number }[] = [
          { scenario: 'Market Correction (-10%)', pct: -9.1 },
          { scenario: 'Market Crash (-20%)', pct: -19.4 },
          { scenario: 'Technology Selloff (-15%)', pct: -8.7 },
          { scenario: 'Rate Shock (+100bps)', pct: -4.2 },
          { scenario: 'Broad Market Rally (+10%)', pct: 10.8 },
        ];
        return scenarios.map((s) => ({
          scenario: s.scenario,
          portfolioImpactPct: s.pct,
          portfolioImpactAbs: Math.round(totalValue * (s.pct / 100)),
        }));
      }),
    );
  }
}
