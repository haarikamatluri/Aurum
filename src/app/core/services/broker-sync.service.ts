import { Injectable, inject, signal } from '@angular/core';
import { PortfolioService } from './portfolio.service';
import { AddHoldingRequest } from '../models/portfolio.model';

export interface BrokerHolding {
  symbol: string;
  companyName: string;
  exchange: 'NSE' | 'BSE' | 'NASDAQ' | 'NYSE';
  market: 'IN' | 'US';
  currency: 'INR' | 'USD';
  shares: number;
  purchasePrice: number;
  purchaseDate?: string;
  selected?: boolean;
}

export interface BrokerConnectionStatus {
  connected: boolean;
  isSandbox: boolean;
  maskedKey?: string;
  accountId?: string;
  connectedAt?: string;
}

export interface BrokerPosition {
  id: string;
  brokerId: string;
  symbol: string;
  exchange: string;
  quantity: number;
  buyAveragePrice: number;
  currentPrice: number;
  unrealizedPL: number;
  unrealizedPLPct: number;
  productType: string;
  currency: 'INR' | 'USD';
}

export interface BrokerBalance {
  brokerId: string;
  brokerName: string;
  currency: 'INR' | 'USD';
  availableCash: number;
  investedAmount: number;
  usedMargin: number;
  totalCollateral: number;
}

export interface BrokerOrderHistoryItem {
  orderId: string;
  brokerId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP';
  status: 'OPEN' | 'PENDING' | 'COMPLETE' | 'CANCELLED' | 'REJECTED';
  timestamp: string;
  currency: 'INR' | 'USD';
}

export interface ReconciliationReport {
  status: 'RECONCILED' | 'MISMATCH_DETECTED';
  reconciledAt: string;
  matchedCount: number;
  mismatchCount: number;
  details: Array<{
    symbol: string;
    aurumQuantity: number;
    aurumAvgPrice: number;
    brokerQuantity: number;
    brokerAvgPrice: number;
    status: 'MATCHED' | 'QUANTITY_MISMATCH' | 'PRICE_DRIFT';
    discrepancy: string | null;
  }>;
}

@Injectable({ providedIn: 'root' })
export class BrokerSyncService {
  private readonly portfolioService = inject(PortfolioService);

  readonly zerodhaStatus = signal<BrokerConnectionStatus>({ connected: false, isSandbox: true });
  readonly webullStatus = signal<BrokerConnectionStatus>({ connected: false, isSandbox: true });
  readonly upstoxStatus = signal<BrokerConnectionStatus>({ connected: false, isSandbox: true });
  readonly ibkrStatus = signal<BrokerConnectionStatus>({ connected: false, isSandbox: true });

  readonly balances = signal<BrokerBalance[]>([]);
  readonly positions = signal<BrokerPosition[]>([]);
  readonly orderHistory = signal<BrokerOrderHistoryItem[]>([]);
  readonly reconciliationReport = signal<ReconciliationReport | null>(null);
  readonly lastSyncedAt = signal<string | null>(null);

  readonly isSyncing = signal<boolean>(false);
  readonly previewHoldings = signal<BrokerHolding[]>([]);
  readonly activeBroker = signal<'zerodha' | 'webull' | 'upstox' | 'ibkr' | null>(null);

  async checkStatuses(): Promise<void> {
    try {
      const [zRes, wRes, statusRes] = await Promise.all([
        fetch('/api/broker/zerodha/holdings'),
        fetch('/api/broker/webull/holdings'),
        fetch('/api/broker/status')
      ]);
      if (zRes.ok) {
        const zData = await zRes.json();
        this.zerodhaStatus.set({
          connected: !!zData.connected,
          isSandbox: zData.isSandbox ?? true,
        });
      }
      if (wRes.ok) {
        const wData = await wRes.json();
        this.webullStatus.set({
          connected: !!wData.connected,
          isSandbox: wData.isSandbox ?? true,
        });
      }
      if (statusRes.ok) {
        const stData = await statusRes.json();
        if (stData.lastSynchronizedAt) this.lastSyncedAt.set(stData.lastSynchronizedAt);
      }
    } catch {
      // ignore
    }
  }

  async loadPhase2BrokerData(): Promise<void> {
    try {
      const [bRes, pRes, oRes, rRes] = await Promise.all([
        fetch('/api/broker/balances'),
        fetch('/api/broker/positions'),
        fetch('/api/broker/order-history'),
        fetch('/api/broker/reconciliation')
      ]);

      if (bRes.ok) {
        const data = await bRes.json();
        if (data.balances) this.balances.set(data.balances);
      }
      if (pRes.ok) {
        const data = await pRes.json();
        if (data.positions) this.positions.set(data.positions);
      }
      if (oRes.ok) {
        const data = await oRes.json();
        if (data.orders) this.orderHistory.set(data.orders);
      }
      if (rRes.ok) {
        const data = await rRes.json();
        this.reconciliationReport.set(data);
      }
    } catch (err) {
      console.warn('[BrokerSync] Error loading Phase 2 broker data:', err);
    }
  }

  async syncAllBrokers(): Promise<void> {
    this.isSyncing.set(true);
    try {
      const res = await fetch('/api/broker/sync', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        this.lastSyncedAt.set(data.syncedAt || new Date().toISOString());
        await this.loadPhase2BrokerData();
      }
    } finally {
      this.isSyncing.set(false);
    }
  }

  async connectZerodha(params: { apiKey?: string; apiSecret?: string; requestToken?: string; isSandbox: boolean }): Promise<BrokerHolding[]> {
    this.isSyncing.set(true);
    try {
      const res = await fetch('/api/broker/zerodha/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error('Zerodha connection failed');

      const holdingsRes = await fetch('/api/broker/zerodha/holdings');
      const data = await holdingsRes.json();
      const list: BrokerHolding[] = (data.holdings || []).map((h: BrokerHolding) => ({ ...h, selected: true }));

      this.zerodhaStatus.set({ connected: true, isSandbox: params.isSandbox });
      this.activeBroker.set('zerodha');
      this.previewHoldings.set(list);
      await this.loadPhase2BrokerData();
      this.isSyncing.set(false);
      return list;
    } catch (err) {
      this.isSyncing.set(false);
      throw err;
    }
  }

  async disconnectZerodha(): Promise<void> {
    await fetch('/api/broker/zerodha/disconnect', { method: 'POST' });
    this.zerodhaStatus.set({ connected: false, isSandbox: true });
  }

  async connectWebull(params: { appKey?: string; appSecret?: string; accountId?: string; isSandbox: boolean }): Promise<BrokerHolding[]> {
    this.isSyncing.set(true);
    try {
      const res = await fetch('/api/broker/webull/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error('Webull connection failed');

      const holdingsRes = await fetch('/api/broker/webull/holdings');
      const data = await holdingsRes.json();
      const list: BrokerHolding[] = (data.holdings || []).map((h: BrokerHolding) => ({ ...h, selected: true }));

      this.webullStatus.set({ connected: true, isSandbox: params.isSandbox });
      this.activeBroker.set('webull');
      this.previewHoldings.set(list);
      await this.loadPhase2BrokerData();
      this.isSyncing.set(false);
      return list;
    } catch (err) {
      this.isSyncing.set(false);
      throw err;
    }
  }

  async disconnectWebull(): Promise<void> {
    await fetch('/api/broker/webull/disconnect', { method: 'POST' });
    this.webullStatus.set({ connected: false, isSandbox: true });
  }

  async importSelectedHoldings(items: BrokerHolding[]): Promise<number> {
    const selected = items.filter((h) => h.selected !== false);
    if (selected.length === 0) return 0;

    const reqs: AddHoldingRequest[] = selected.map((h) => ({
      symbol: h.symbol,
      companyName: h.companyName,
      exchange: h.exchange,
      market: h.market,
      currency: h.currency,
      shares: h.shares,
      purchasePrice: h.purchasePrice,
      purchaseDate: h.purchaseDate || new Date().toISOString().split('T')[0],
    }));

    this.portfolioService.addHoldingsBulk(reqs);
    this.previewHoldings.set([]);
    this.activeBroker.set(null);
    return selected.length;
  }
}
