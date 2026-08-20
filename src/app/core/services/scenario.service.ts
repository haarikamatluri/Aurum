import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ScenarioInput, ScenarioPreset, ScenarioResult } from '../models/scenario.model';
import { MarketEngine } from '../mock/market-engine';
import { HOLDINGS, CASH_BALANCE } from '../mock/portfolio.mock';
import { getSecurity } from '../mock/securities.data';

const NETWORK_DELAY = 300;

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  { id: 'correction', label: 'Market Correction', description: 'Broad market declines 10% while your holdings move with their beta.', input: { priceChangePct: -10, marketCondition: 'correction', otherHoldings: 'proportional' } },
  { id: 'crash', label: 'Market Crash', description: 'A sharp 20% market drawdown, amplified for higher-beta names.', input: { priceChangePct: -20, marketCondition: 'crash', otherHoldings: 'proportional' } },
  { id: 'techSelloff', label: 'Technology Selloff', description: 'Technology-sector-specific 15% decline; other sectors roughly flat.', input: { priceChangePct: -15, marketCondition: 'sectorSelloff', otherHoldings: 'unchanged' } },
  { id: 'rally', label: 'Broad Market Rally', description: 'Markets rally 10%; all holdings participate proportionally.', input: { priceChangePct: 10, marketCondition: 'rally', otherHoldings: 'proportional' } },
  { id: 'custom', label: 'Custom Scenario', description: 'Model an isolated price move in a single position.', input: { priceChangePct: -15, marketCondition: 'custom', otherHoldings: 'unchanged' } },
];

/** "What if" simulator. Backs POST /api/scenarios — inputs go out, an estimated impact comes back. */
@Injectable({ providedIn: 'root' })
export class ScenarioService {
  private readonly engine = inject(MarketEngine);

  getPresets(): ScenarioPreset[] {
    return SCENARIO_PRESETS;
  }

  runScenario(input: ScenarioInput): Observable<ScenarioResult> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() => {
        const positions = HOLDINGS.map((h) => {
          const q = this.engine.quoteSnapshot(h.symbol);
          return { symbol: h.symbol, shares: h.shares, price: q.price, value: q.price * h.shares, beta: getSecurity(h.symbol).sector };
        });
        const totalValueBefore = positions.reduce((s, p) => s + p.value, 0) + CASH_BALANCE;

        let newTotal = CASH_BALANCE;
        let targetNewValue = 0;
        const targetSector = getSecurity(input.symbol).sector;
        for (const p of positions) {
          const sec = getSecurity(p.symbol);
          let change = 0;
          if (p.symbol === input.symbol) {
            change = input.priceChangePct / 100;
          } else if (input.otherHoldings === 'proportional') {
            change = (input.priceChangePct / 100) * (sec.beta * 0.55);
          } else if (input.marketCondition === 'sectorSelloff' && sec.sector === targetSector) {
            change = (input.priceChangePct / 100) * 0.85;
          }
          const newValue = p.value * (1 + change);
          newTotal += newValue;
          if (p.symbol === input.symbol) targetNewValue = newValue;
        }

        const impactAbs = newTotal - totalValueBefore;
        const impactPct = (impactAbs / totalValueBefore) * 100;
        const worst = positions.reduce((min, p) => {
          const sec = getSecurity(p.symbol);
          const change =
            p.symbol === input.symbol
              ? input.priceChangePct
              : input.otherHoldings === 'proportional'
                ? input.priceChangePct * (sec.beta * 0.55)
                : input.marketCondition === 'sectorSelloff' && sec.sector === targetSector
                  ? input.priceChangePct * 0.85
                  : 0;
          return change < min.change ? { symbol: p.symbol, change } : min;
        }, { symbol: input.symbol, change: 0 });

        return {
          estimatedPortfolioImpactPct: Math.round(impactPct * 100) / 100,
          estimatedPortfolioImpactAbs: Math.round(impactAbs),
          newPortfolioValue: Math.round(newTotal),
          affectedSymbolNewWeightPct: Math.round((targetNewValue / newTotal) * 10000) / 100,
          estimatedDrawdownPct: Math.round((impactPct - Math.abs(impactPct) * 0.48) * 100) / 100,
          worstPositionSymbol: worst.symbol,
          worstPositionImpactPct: Math.round(worst.change * 100) / 100,
        };
      }),
    );
  }
}
