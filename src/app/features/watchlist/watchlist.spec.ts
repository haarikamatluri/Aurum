import '@angular/compiler';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { Router } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { Watchlist } from './watchlist';
import { WatchlistService } from '../../core/services/watchlist.service';

describe('Watchlist', () => {
  let component: Watchlist;

  beforeEach(() => {
    const injector = Injector.create({
      providers: [
        {
          provide: WatchlistService,
          useValue: {
            symbols: signal(['TCS', 'AAPL']),
            addSymbol: () => Promise.resolve(),
            removeSymbol: () => Promise.resolve()
          }
        },
        {
          provide: Router,
          useValue: {
            navigate: () => Promise.resolve(true)
          }
        }
      ]
    });

    component = runInInjectionContext(injector, () => new Watchlist());
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
