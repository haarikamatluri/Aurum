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

@Injectable({ providedIn: 'root' })
export class BrokerSyncService {
  private readonly portfolioService = inject(PortfolioService);

  readonly zerodhaStatus = signal<BrokerConnectionStatus>({ connected: false, isSandbox: true });
  readonly webullStatus = signal<BrokerConnectionStatus>({ connected: false, isSandbox: true });

  readonly isSyncing = signal<boolean>(false);
  readonly previewHoldings = signal<BrokerHolding[]>([]);
  readonly activeBroker = signal<'zerodha' | 'webull' | null>(null);

  async checkStatuses(): Promise<void> {
    try {
      const [zRes, wRes] = await Promise.all([
        fetch('/api/broker/zerodha/holdings'),
        fetch('/api/broker/webull/holdings'),
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
    } catch {
      // ignore
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
