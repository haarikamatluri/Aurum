import { Injectable, signal, computed } from '@angular/core';

export interface WatchlistItem {
  symbol: string;
  addedAt: string;
}

const STORAGE_KEY = 'aurum_watchlist_symbols';

@Injectable({ providedIn: 'root' })
export class WatchlistService {
  private readonly watchlistSymbols = signal<Set<string>>(this.loadWatchlist());

  readonly symbols = computed(() => Array.from(this.watchlistSymbols()));

  constructor() {
    this.syncFromBackend();
  }

  isWatchlisted(symbol: string): boolean {
    if (!symbol) return false;
    return this.watchlistSymbols().has(symbol.trim().toUpperCase());
  }

  async toggleWatchlist(symbol: string): Promise<boolean> {
    const sym = symbol.trim().toUpperCase();
    const current = new Set(this.watchlistSymbols());
    let nowInWatchlist = false;

    if (current.has(sym)) {
      current.delete(sym);
      nowInWatchlist = false;
      this.removeFromBackend(sym);
    } else {
      current.add(sym);
      nowInWatchlist = true;
      this.addToBackend(sym);
    }

    this.watchlistSymbols.set(current);
    this.saveWatchlist(current);
    return nowInWatchlist;
  }

  async addSymbol(symbol: string): Promise<void> {
    const sym = symbol.trim().toUpperCase();
    const current = new Set(this.watchlistSymbols());
    if (!current.has(sym)) {
      current.add(sym);
      this.watchlistSymbols.set(current);
      this.saveWatchlist(current);
      this.addToBackend(sym);
    }
  }

  async removeSymbol(symbol: string): Promise<void> {
    const sym = symbol.trim().toUpperCase();
    const current = new Set(this.watchlistSymbols());
    if (current.has(sym)) {
      current.delete(sym);
      this.watchlistSymbols.set(current);
      this.saveWatchlist(current);
      this.removeFromBackend(sym);
    }
  }

  private loadWatchlist(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr: string[] = JSON.parse(raw);
        return new Set(arr.map((s) => s.toUpperCase()));
      }
    } catch {
      /* ignore */
    }
    return new Set(['TCS', 'NVDA', 'RELIANCE', 'AAPL']);
  }

  private saveWatchlist(set: Set<string>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    } catch {
      /* ignore */
    }
  }

  private async syncFromBackend(): Promise<void> {
    try {
      const res = await fetch('/api/watchlist');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.watchlist)) {
          const remoteSyms = new Set<string>(data.watchlist.map((w: any) => (typeof w === 'string' ? w : w.symbol).toUpperCase()));
          this.watchlistSymbols.set(remoteSyms);
          this.saveWatchlist(remoteSyms);
        }
      }
    } catch {
      /* ignore backend failure, fallback to localStorage */
    }
  }

  private async addToBackend(symbol: string): Promise<void> {
    try {
      await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
    } catch {
      /* ignore */
    }
  }

  private async removeFromBackend(symbol: string): Promise<void> {
    try {
      await fetch(`/api/watchlist/${encodeURIComponent(symbol)}`, {
        method: 'DELETE',
      });
    } catch {
      /* ignore */
    }
  }
}
