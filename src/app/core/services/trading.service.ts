import { Injectable, inject, signal } from '@angular/core';
import { PortfolioService } from './portfolio.service';

export interface OrderPreview {
  symbol: string;
  side: 'BUY' | 'SELL';
  exchange: 'NSE' | 'BSE' | 'NASDAQ' | 'NYSE';
  market: 'IN' | 'US';
  currency: 'INR' | 'USD';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP';
  limitPrice: number | null;
  estimatedPrice: number;
  estimatedValue: number;
  estimatedFees: number;
  totalCost: number;
  requiresExplicitConfirmation: boolean;
  riskCheck: {
    passed: boolean;
    code: string;
    reason: string;
  };
}

export interface ExecutedOrder {
  orderId: string;
  userId: string;
  symbol: string;
  companyName: string;
  side: 'BUY' | 'SELL';
  exchange: string;
  market: string;
  currency: 'INR' | 'USD';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT';
  price: number;
  status: 'CREATED' | 'VALIDATING' | 'SUBMITTED' | 'OPEN' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'FAILED';
  filledQuantity: number;
  filledPrice: number;
  executedAt: string;
  idempotencyKey?: string;
}

export interface TradingAuditLog {
  id: string;
  timestamp: string;
  eventType: string;
  userId: string;
  symbol?: string;
  side?: string;
  quantity?: number;
  orderType?: string;
  price?: number;
  currency?: string;
  status?: string;
  riskDecision?: any;
}

@Injectable({ providedIn: 'root' })
export class TradingService {
  private readonly portfolioService = inject(PortfolioService);

  readonly killSwitchActive = signal<boolean>(false);
  readonly killSwitchReason = signal<string>('');
  readonly isSubmitting = signal<boolean>(false);
  readonly activePreview = signal<OrderPreview | null>(null);
  readonly orders = signal<ExecutedOrder[]>([]);
  readonly auditLogs = signal<TradingAuditLog[]>([]);

  async checkKillSwitch(): Promise<boolean> {
    try {
      const res = await fetch('/api/trading/kill-switch');
      if (res.ok) {
        const data = await res.json();
        this.killSwitchActive.set(!!data.active);
        this.killSwitchReason.set(data.reason || '');
        return !!data.active;
      }
    } catch {
      // ignore
    }
    return false;
  }

  async toggleKillSwitch(active: boolean, reason?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/trading/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active, reason: reason || 'User Emergency Control' })
      });
      if (res.ok) {
        const data = await res.json();
        this.killSwitchActive.set(!!data.active);
        this.killSwitchReason.set(data.reason || '');
        return !!data.active;
      }
    } catch {
      // ignore
    }
    return false;
  }

  async previewOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType?: 'MARKET' | 'LIMIT';
    price?: number;
    exchange?: string;
    market?: 'IN' | 'US';
    currency?: 'INR' | 'USD';
  }): Promise<OrderPreview> {
    const res = await fetch('/api/orders/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Failed to generate order ticket preview.');
    const data = await res.json();
    this.activePreview.set(data.preview);
    return data.preview;
  }

  async executeConfirmedOrder(preview: OrderPreview): Promise<ExecutedOrder> {
    this.isSubmitting.set(true);
    const idempotencyKey = `idemp-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          idempotencyKey,
          symbol: preview.symbol,
          side: preview.side,
          quantity: preview.quantity,
          orderType: preview.orderType,
          price: preview.limitPrice || preview.estimatedPrice,
          exchange: preview.exchange,
          market: preview.market,
          currency: preview.currency
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Order execution failed.');
      }

      if (data.order && data.order.side === 'BUY') {
        this.portfolioService.addHolding({
          symbol: data.order.symbol,
          companyName: data.order.symbol,
          exchange: data.order.market === 'IN' ? 'NSE' : 'NASDAQ',
          market: data.order.market || 'US',
          currency: data.order.currency || 'USD',
          shares: data.order.quantity,
          purchasePrice: data.order.price
        });
      }
      this.activePreview.set(null);
      await this.loadOrders();
      return data.order;
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST'
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Cancellation failed.');
    }
    await this.loadOrders();
  }

  async loadOrders(): Promise<void> {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        if (data.orders) this.orders.set(data.orders);
      }
    } catch {
      // ignore
    }
  }

  async loadAuditLogs(): Promise<void> {
    try {
      const res = await fetch('/api/trading/audit-logs');
      if (res.ok) {
        const data = await res.json();
        if (data.auditLogs) this.auditLogs.set(data.auditLogs);
      }
    } catch {
      // ignore
    }
  }
}
