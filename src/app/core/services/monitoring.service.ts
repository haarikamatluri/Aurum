import { Injectable, inject, OnDestroy } from '@angular/core';
import { AlertState, MarketRegion, CurrencyCode } from '../models/portfolio.model';
import { MoneyNotification } from '../models/alert.model';
import { PortfolioService } from './portfolio.service';
import { NotificationService } from './notification.service';

const STORAGE_KEY_ALERT_STATES = 'money.alertStates';
const THRESHOLD_STEP = 5; // Every 5% triggers an alert

/**
 * Monitoring service — the 5% threshold engine.
 *
 * Architecture:
 *   - Automatically polls live market quotes every 5 minutes.
 *   - Queries real-time prices for US and Indian (NSE/BSE) stocks via /api/market/quotes.
 *   - Compares live price against purchase/reference price.
 *   - Fires alerts whenever a 5% threshold boundary (+5%, -5%, +10%, -10%, ...) is crossed.
 *   - Deduplicates alerts so the same threshold level is never fired twice.
 */
@Injectable({ providedIn: 'root' })
export class MonitoringService implements OnDestroy {
  private readonly portfolio = inject(PortfolioService);
  private readonly notifications = inject(NotificationService);

  private alertStates = new Map<string, AlertState>(
    Object.entries(this.loadAlertStates())
  );

  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Automatically start live price monitoring cycle upon app startup
    this.startMonitoring(5 * 60 * 1000);
    // Trigger an initial price fetch cycle immediately
    setTimeout(() => this.runPriceCycle(), 500);
  }

  /**
   * Start polling every intervalMs (default: 5 minutes).
   */
  startMonitoring(intervalMs = 5 * 60 * 1000): void {
    this.stopMonitoring();
    this.pollInterval = setInterval(() => this.runPriceCycle(), intervalMs);
  }

  stopMonitoring(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Manually trigger an immediate price refresh for all holdings.
   */
  async refreshPrices(): Promise<void> {
    await this.runPriceCycle();
  }

  /**
   * Process a price update for a single symbol.
   */
  processPriceUpdate(symbol: string, newPrice: number): void {
    const holding = this.portfolio.getHoldingBySymbol(symbol);
    if (!holding || typeof newPrice !== 'number' || isNaN(newPrice) || newPrice <= 0) return;

    // Update displayed price in portfolio
    this.portfolio.updatePrice(symbol, newPrice);

    // Get or init alert state
    let state = this.alertStates.get(holding.id);
    if (!state) {
      state = this.initAlertState(holding.id, symbol, holding.avgPurchasePrice, holding.market, holding.currency);
    }

    // Calculate current movement percentage from reference price (bought price)
    const movementPct = ((newPrice - state.referencePrice) / state.referencePrice) * 100;

    // Determine current threshold level (floor to nearest 5%)
    const currentLevel = this.computeThresholdLevel(movementPct);

    // Detect crossing
    this.detectAndFireAlerts(state, holding.id, symbol, holding.companyName, newPrice, currentLevel);

    // Update state
    state.lastCheckedPrice = newPrice;
    state.updatedAt = new Date().toISOString();
    this.alertStates.set(holding.id, state);
    this.saveAlertStates();
  }

  initAlertState(
    holdingId: string,
    symbol: string,
    referencePrice: number,
    market: MarketRegion = 'US',
    currency: CurrencyCode = 'USD'
  ): AlertState {
    const state: AlertState = {
      holdingId,
      symbol,
      market,
      currency,
      referencePrice,
      lastUpThreshold: 0,
      lastDownThreshold: 0,
      lastCheckedPrice: null,
      updatedAt: new Date().toISOString(),
    };
    this.alertStates.set(holdingId, state);
    this.saveAlertStates();
    return state;
  }

  /**
   * Update reference price when a holding's buy price is edited.
   */
  updateReferencePrice(holdingId: string, newReferencePrice: number): void {
    let state = this.alertStates.get(holdingId);
    if (state) {
      state.referencePrice = newReferencePrice;
      state.lastUpThreshold = 0;
      state.lastDownThreshold = 0;
      state.updatedAt = new Date().toISOString();
      this.alertStates.set(holdingId, state);
      this.saveAlertStates();
    }
  }

  /**
   * Remove alert state when a holding is deleted.
   */
  removeAlertState(holdingId: string): void {
    this.alertStates.delete(holdingId);
    this.saveAlertStates();
  }

  /**
   * Threshold algorithm:
   * - movement = ((currentPrice - referencePrice) / referencePrice) * 100
   * - thresholdLevel = floor(|movement| / 5) * 5 * sign(movement)
   */
  computeThresholdLevel(movementPct: number): number {
    if (Math.abs(movementPct) < THRESHOLD_STEP) return 0;
    const sign = movementPct > 0 ? 1 : -1;
    return sign * Math.floor(Math.abs(movementPct) / THRESHOLD_STEP) * THRESHOLD_STEP;
  }

  private detectAndFireAlerts(
    state: AlertState,
    holdingId: string,
    symbol: string,
    companyName: string,
    newPrice: number,
    currentLevel: number
  ): void {
    if (currentLevel === 0) return; // No 5% threshold reached yet

    if (currentLevel > 0) {
      // Upward movement
      if (currentLevel > state.lastUpThreshold) {
        const crossedLevels: number[] = [];
        for (let l = state.lastUpThreshold + THRESHOLD_STEP; l <= currentLevel; l += THRESHOLD_STEP) {
          crossedLevels.push(l);
        }
        this.fireAlert(holdingId, symbol, companyName, newPrice, state.referencePrice, state.currency, crossedLevels, 'UP');
        state.lastUpThreshold = currentLevel;
        if (currentLevel > 0) state.lastDownThreshold = 0;
      }
    } else {
      // Downward movement
      if (currentLevel < state.lastDownThreshold) {
        const crossedLevels: number[] = [];
        for (let l = state.lastDownThreshold - THRESHOLD_STEP; l >= currentLevel; l -= THRESHOLD_STEP) {
          crossedLevels.push(l);
        }
        this.fireAlert(holdingId, symbol, companyName, newPrice, state.referencePrice, state.currency, crossedLevels, 'DOWN');
        state.lastDownThreshold = currentLevel;
        if (currentLevel < 0) state.lastUpThreshold = 0;
      }
    }
  }

  private fireAlert(
    holdingId: string,
    symbol: string,
    companyName: string,
    price: number,
    referencePrice: number,
    currency: CurrencyCode,
    levels: number[],
    direction: 'UP' | 'DOWN'
  ): void {
    const thresholdPct = Math.abs(levels[levels.length - 1]);
    const directionWord = direction === 'UP' ? 'increased' : 'dropped';
    const levelStr = levels.map((l) => (l > 0 ? `+${l}%` : `${l}%`)).join(', ');
    const currSymbol = currency === 'INR' ? '₹' : '$';

    let message: string;
    if (levels.length === 1) {
      message = `${symbol} ${directionWord} ${thresholdPct}% from your reference price of ${currSymbol}${referencePrice.toFixed(2)}.`;
    } else {
      message = `${symbol} moved through multiple thresholds (${levelStr}) from ${currSymbol}${referencePrice.toFixed(2)}.`;
    }

    const notification: MoneyNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      holdingId,
      symbol,
      companyName,
      direction,
      thresholdPct: direction === 'UP' ? thresholdPct : -thresholdPct,
      price,
      referencePrice,
      message,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    this.notifications.addNotification(notification);
  }

  /**
   * Poll cycle — queries real-time quotes for all portfolio holdings.
   */
  private async runPriceCycle(): Promise<void> {
    const holdings = this.portfolio.holdings();
    if (holdings.length === 0) return;

    const prices = await this.fetchCurrentPrices(holdings);

    for (const [symbol, price] of Object.entries(prices)) {
      this.processPriceUpdate(symbol, price);
    }
  }

  /**
   * Fetches live market prices from the backend /api/market/quotes endpoint.
   */
  private async fetchCurrentPrices(
    holdings: { symbol: string; market: MarketRegion }[]
  ): Promise<Record<string, number>> {
    try {
      const queryParam = holdings
        .map((h) => `${encodeURIComponent(h.symbol)}:${h.market}`)
        .join(',');

      const res = await fetch(`/api/market/quotes?symbols=${queryParam}`);
      if (!res.ok) {
        console.warn('[MonitoringService] /api/market/quotes returned status', res.status);
        return {};
      }

      const json = await res.json();
      const quotes = json.quotes || {};
      const priceMap: Record<string, number> = {};

      for (const [sym, quoteData] of Object.entries<any>(quotes)) {
        if (quoteData && typeof quoteData.price === 'number') {
          priceMap[sym] = quoteData.price;
        }
      }

      return priceMap;
    } catch (err: any) {
      console.warn('[MonitoringService] Failed to fetch live prices:', err?.message || err);
      return {};
    }
  }

  // ---- persistence ----
  private loadAlertStates(): Record<string, AlertState> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ALERT_STATES);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  private saveAlertStates(): void {
    try {
      const obj: Record<string, AlertState> = {};
      this.alertStates.forEach((v, k) => (obj[k] = v));
      localStorage.setItem(STORAGE_KEY_ALERT_STATES, JSON.stringify(obj));
    } catch { /* ignore */ }
  }

  ngOnDestroy(): void {
    this.stopMonitoring();
  }
}
