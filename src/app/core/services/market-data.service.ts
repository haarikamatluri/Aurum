import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { MarketIndex, MarketQuote, MarketStatus, SectorPerformance } from '../models/market.model';
import { MarketEngine } from '../mock/market-engine';
import { SECTORS, SECURITIES } from '../mock/securities.data';
import { seededRandom, randRange } from '../mock/rng';

const NETWORK_DELAY = 300;

/** Market-wide data: indices, session status, and sector breadth. Backs GET /api/market/*. */
@Injectable({ providedIn: 'root' })
export class MarketDataService {
  private readonly engine = inject(MarketEngine);

  getMarketStatus(): Observable<MarketStatus> {
    return of({
      status: this.engine.marketStatus,
      nextEvent: 'Closes 4:00 PM ET',
      timezone: 'America/New_York',
    }).pipe(delay(120));
  }

  getIndices(): Observable<MarketIndex[]> {
    return of(null).pipe(delay(NETWORK_DELAY), map(() => this.engine.allIndexSnapshots()));
  }

  index$(symbol: string) {
    return this.engine.index$(symbol);
  }

  getQuote(symbol: string): Observable<MarketQuote> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() => {
        const q = this.engine.quoteSnapshot(symbol);
        return {
          symbol: q.symbol,
          name: q.name,
          price: q.price,
          changeAbs: q.changeAbs,
          changePct: q.changePct,
          volume: q.volume,
          avgVolume: q.avgVolume,
        };
      }),
    );
  }

  getSectorPerformance(): Observable<SectorPerformance[]> {
    return of(null).pipe(
      delay(NETWORK_DELAY),
      map(() => {
        const rand = seededRandom('sector-perf-' + new Date().toDateString());
        return SECTORS.map((sector) => ({
          sector,
          changePct: Math.round(randRange(rand, -2.4, 3.1) * 100) / 100,
          marketCapWeightPct: Math.round(
            (SECURITIES.filter((s) => s.sector === sector).length / SECURITIES.length) * 10000,
          ) / 100,
        }));
      }),
    );
  }
}
