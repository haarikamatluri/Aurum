import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { PredictionOutlook } from '../models/prediction.model';
import { MarketEngine } from '../mock/market-engine';
import { randRange, seededRandom } from '../mock/rng';

const NETWORK_DELAY = 420;

/**
 * Model-estimate service — every value here is explicitly a probabilistic model output,
 * never a guaranteed forecast. Backs GET /api/predictions/{symbol}.
 */
@Injectable({ providedIn: 'root' })
export class PredictionService {
  private readonly engine = inject(MarketEngine);

  getOutlook(symbol: string, horizonDays = 5): Observable<PredictionOutlook> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() => {
        const q = this.engine.quoteSnapshot(symbol);
        const rand = seededRandom(symbol + '-prediction-' + new Date().toDateString());
        const bias = q.changePct > 0 ? 8 : -8;
        let positive = Math.round(randRange(rand, 42, 60) + bias);
        positive = Math.min(Math.max(positive, 20), 78);
        const negative = Math.round(randRange(rand, 12, 28));
        const neutral = 100 - positive - negative;
        const volLabel = q.beta > 1.5 ? 'High' : q.beta > 1 ? 'Moderate' : 'Low';
        return {
          symbol,
          horizonDays,
          positivePct: positive,
          neutralPct: Math.max(neutral, 5),
          negativePct: negative,
          expectedVolatility: volLabel,
          confidence: q.beta > 1.7 ? 'Medium' : 'Medium',
          modelName: 'Momentum-Volatility Ensemble v2.3',
          generatedAt: new Date().toISOString(),
          driverSummary: [
            `${symbol} recent price momentum is ${q.changePct >= 0 ? 'positive' : 'negative'} (${q.changePct.toFixed(2)}% today).`,
            `Implied volatility profile is ${volLabel.toLowerCase()} relative to sector peers.`,
            'Model weighs 60-day price momentum, relative volume, and sector breadth.',
          ],
        };
      }),
    );
  }
}
