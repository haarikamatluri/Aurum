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
 *   - Maintains AlertState independently from portfolio gain/loss display.
 *   - When real market data API is connected, call `processPriceUpdate(symbol, price)`.
 *   - Never fires the same threshold twice (deduplication built-in).
 *   - Handles direction changes correctly (up then down scenario).
 *   - Consolidated notifications for multi-threshold jumps.
 */
@Injectable({ providedIn: 'root' })
export class MonitoringService implements OnDestroy {
  private readonly portfolio = inject(PortfolioService);
  private readonly notifications = inject(NotificationService);

  private alertStates = new Map<string, AlertState>(
    Object.entries(this.loadAlertStates())
  );

  private pollInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Start polling — call this when real price data becomes available.
   * Replace the body of `fetchCurrentPrices()` with your API calls.
   *
   * @param intervalMs Poll interval in milliseconds (default: 5 minutes)
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
   * Process a price update for a single symbol.
   * Called by the real API adapter when a fresh price arrives.
   */
  processPriceUpdate(symbol: string, newPrice: number): void {
    const holding = this.portfolio.getHoldingBySymbol(symbol);
    if (!holding) return;

    // Update displayed price in portfolio
    this.portfolio.updatePrice(symbol, newPrice);

    // Get or init alert state
    let state = this.alertStates.get(holding.id);
    if (!state) {
      state = this.initAlertState(holding.id, symbol, holding.avgPurchasePrice, holding.market, holding.currency);
    }

    // Calculate current movement percentage from reference price
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
   *
   * Examples:
   *   movement = +16%  → level = +15
   *   movement = -17%  → level = -15
   *   movement = +4.9% → level =  0 (no alert)
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
    if (currentLevel === 0) return; // No threshold reached yet

    if (currentLevel > 0) {
      // Upward movement
      if (currentLevel > state.lastUpThreshold) {
        // Crossed one or more new upward thresholds
        const crossedLevels: number[] = [];
        for (let l = state.lastUpThreshold + THRESHOLD_STEP; l <= currentLevel; l += THRESHOLD_STEP) {
          crossedLevels.push(l);
        }
        this.fireAlert(holdingId, symbol, companyName, newPrice, state.referencePrice, crossedLevels, 'UP');
        state.lastUpThreshold = currentLevel;
        // Reset down threshold when moving up significantly
        if (currentLevel > 0) state.lastDownThreshold = 0;
      }
    } else {
      // Downward movement
      if (currentLevel < state.lastDownThreshold) {
        // Crossed one or more new downward thresholds
        const crossedLevels: number[] = [];
        for (let l = state.lastDownThreshold - THRESHOLD_STEP; l >= currentLevel; l -= THRESHOLD_STEP) {
          crossedLevels.push(l);
        }
        this.fireAlert(holdingId, symbol, companyName, newPrice, state.referencePrice, crossedLevels, 'DOWN');
        state.lastDownThreshold = currentLevel;
        // Reset up threshold when moving down significantly
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
    levels: number[],
    direction: 'UP' | 'DOWN'
  ): void {
    const thresholdPct = Math.abs(levels[levels.length - 1]);
    const directionWord = direction === 'UP' ? 'increased' : 'dropped';
    const levelStr = levels.map((l) => (l > 0 ? `+${l}%` : `${l}%`)).join(', ');

    let message: string;
    if (levels.length === 1) {
      message = `${symbol} ${directionWord} ${thresholdPct}% from your reference price of $${referencePrice.toFixed(2)}.`;
    } else {
      message = `${symbol} moved through multiple thresholds (${levelStr}).`;
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
   * Called by poll interval — fetch prices for all unique symbols.
   * Replace fetchCurrentPrices() with real API calls.
   */
  private async runPriceCycle(): Promise<void> {
    const holdings = this.portfolio.holdings();
    if (holdings.length === 0) return;

    const symbols = [...new Set(holdings.map((h) => h.symbol))];
    const prices = await this.fetchCurrentPrices(symbols);

    for (const [symbol, price] of Object.entries(prices)) {
      this.processPriceUpdate(symbol, price);
    }
  }

  /**
   * REPLACE THIS METHOD with real API calls when ready.
   *
   * Example integration:
   *   const res = await fetch(`/api/market/quotes?symbols=${symbols.join(',')}`);
   *   const data = await res.json();
   *   return data; // { AAPL: 195.40, TSLA: 250.00, ... }
   */
  private async fetchCurrentPrices(symbols: string[]): Promise<Record<string, number>> {
    // API not yet connected — return empty so components show "--"
    // TODO: Replace with real market data API call
    console.info('[MonitoringService] Price fetch not yet connected. Symbols:', symbols);
    return {};
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
