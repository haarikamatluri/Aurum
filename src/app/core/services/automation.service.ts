import { Injectable, signal, computed, inject } from '@angular/core';
import { PortfolioService } from './portfolio.service';

export interface MarketGatewayState {
  primaryProvider: string;
  primaryStatus: 'CONNECTED' | 'DELAYED' | 'DISCONNECTED';
  secondaryProvider: string;
  secondaryStatus: 'STANDBY' | 'ACTIVE' | 'DISCONNECTED';
  activeProvider: string;
  lastTickTimestamp: number;
  totalTicksReceived: number;
  staleEventsCount: number;
  duplicateEventsCount: number;
  outOfOrderCount: number;
}

export interface MLModelMetrics {
  accuracy: number;
  sharpeRatio: number;
  winRate: number;
  maxDrawdownPct: number;
}

export interface MLModel {
  modelId: string;
  version: string;
  status: 'PRODUCTION' | 'STAGING' | 'DEPRECATED';
  trainingDate: string;
  datasetVersion: string;
  features: string[];
  metrics: MLModelMetrics;
}

export interface MLInferenceResult {
  symbol: string;
  modelId: string;
  modelVersion: string;
  prediction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  currentPrice: number;
  targetPrice: number;
  featuresSnapshot: Record<string, any>;
  featureTimestamp: string;
  generatedAt: string;
  latencyMs: number;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: string[];
  targetSymbols: string[];
  status: 'ACTIVE' | 'PAUSED';
}

export interface AutomationState {
  enabled: boolean;
  status: 'DISABLED' | 'ACTIVE' | 'PAUSED' | 'KILL_SWITCH';
  userConsent: boolean;
  consentedAt: string | null;
  activeStrategyId: string;
  maxPositionCap: number;
  maxDailyLossCap: number;
  allowedSymbols: string[];
  tradingHoursOnly: boolean;
  failClosedReason: string | null;
}

export interface PaperPosition {
  symbol: string;
  market: 'US' | 'IN';
  currency: 'USD' | 'INR';
  shares: number;
  avgPrice: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
}

export interface PaperOrder {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  currency: 'USD' | 'INR';
  status: string;
  strategyId: string;
  executedAt: string;
}

export interface PaperPortfolio {
  cashUSD: number;
  cashINR: number;
  positions: PaperPosition[];
  paperOrders: PaperOrder[];
}

export interface StrategyEvaluationResult {
  symbol: string;
  strategyId: string;
  strategyName: string;
  signalType: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  rationale: string;
  currentPrice: number;
  features: Record<string, any>;
  riskCheck: {
    passed: boolean;
    rejectionReason: string | null;
    checks: Record<string, any>;
  };
  evaluatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AutomationService {
  private readonly portfolioService = inject(PortfolioService);

  readonly gatewayState = signal<MarketGatewayState | null>(null);
  readonly models = signal<MLModel[]>([]);
  readonly strategies = signal<Strategy[]>([]);
  readonly automationState = signal<AutomationState | null>(null);
  readonly paperPortfolio = signal<PaperPortfolio | null>(null);
  readonly lastInference = signal<MLInferenceResult | null>(null);
  readonly lastEvaluation = signal<StrategyEvaluationResult | null>(null);
  readonly paperAuditTrail = signal<any[]>([]);

  readonly isAutomationActive = computed(() => this.automationState()?.enabled === true && this.automationState()?.status === 'ACTIVE');
  readonly isKillSwitchActive = computed(() => this.automationState()?.status === 'KILL_SWITCH');

  constructor() {
    this.refreshAllData();
  }

  async refreshAllData(): Promise<void> {
    await Promise.all([
      this.loadGatewayStatus(),
      this.loadModels(),
      this.loadStrategies(),
      this.loadAutomationStatus(),
      this.loadPaperPortfolio(),
      this.loadPaperAuditTrail()
    ]);
  }

  async loadGatewayStatus(): Promise<void> {
    try {
      const res = await fetch('/api/market/gateway-status');
      if (res.ok) {
        const data = await res.json();
        this.gatewayState.set(data.gateway);
      }
    } catch (err) {
      console.warn('[AutomationService] Failed to load gateway status:', err);
    }
  }

  async triggerFailover(targetProvider: string): Promise<void> {
    try {
      const res = await fetch('/api/market/failover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetProvider })
      });
      if (res.ok) {
        const data = await res.json();
        this.gatewayState.set(data.gateway);
      }
    } catch (err) {
      console.error('[AutomationService] Failover trigger error:', err);
    }
  }

  async loadModels(): Promise<void> {
    try {
      const res = await fetch('/api/ml/models');
      if (res.ok) {
        const data = await res.json();
        this.models.set(data.models || []);
      }
    } catch (err) {
      console.warn('[AutomationService] Failed to load ML models:', err);
    }
  }

  async predictML(symbol: string, modelId?: string): Promise<MLInferenceResult | null> {
    try {
      const res = await fetch('/api/ml/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, modelId })
      });
      if (res.ok) {
        const result: MLInferenceResult = await res.json();
        this.lastInference.set(result);
        return result;
      }
    } catch (err) {
      console.error('[AutomationService] ML Predict error:', err);
    }
    return null;
  }

  async loadStrategies(): Promise<void> {
    try {
      const res = await fetch('/api/strategies');
      if (res.ok) {
        const data = await res.json();
        this.strategies.set(data.strategies || []);
      }
    } catch (err) {
      console.warn('[AutomationService] Failed to load strategies:', err);
    }
  }

  async loadAutomationStatus(): Promise<void> {
    try {
      const res = await fetch('/api/automation/status');
      if (res.ok) {
        const data = await res.json();
        this.automationState.set(data.automation);
      }
    } catch (err) {
      console.warn('[AutomationService] Failed to load automation status:', err);
    }
  }

  async toggleAutomation(enabled: boolean, userConsent: boolean, riskLimits?: any, strategyId?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/automation/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, userConsent, riskLimits, strategyId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.automationState.set(data.automation);
        await this.loadPaperAuditTrail();
        return true;
      } else {
        throw new Error(data.error || 'Failed to toggle automation');
      }
    } catch (err: any) {
      console.error('[AutomationService] Toggle automation error:', err);
      throw err;
    }
  }

  async triggerAutomationKillSwitch(reason = 'User Manual Halt', active = true): Promise<void> {
    try {
      const res = await fetch('/api/automation/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active, reason })
      });
      if (res.ok) {
        const data = await res.json();
        this.automationState.set(data.automation);
        await this.loadPaperAuditTrail();
      }
    } catch (err) {
      console.error('[AutomationService] Kill switch error:', err);
    }
  }

  async evaluateStrategy(symbol: string, strategyId?: string): Promise<StrategyEvaluationResult | null> {
    try {
      const res = await fetch('/api/strategies/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, strategyId })
      });
      if (res.ok) {
        const data: StrategyEvaluationResult = await res.json();
        this.lastEvaluation.set(data);
        return data;
      }
    } catch (err) {
      console.error('[AutomationService] Evaluate strategy error:', err);
    }
    return null;
  }

  async loadPaperPortfolio(): Promise<void> {
    try {
      const res = await fetch('/api/paper-trading/portfolio');
      if (res.ok) {
        const data = await res.json();
        this.paperPortfolio.set(data.portfolio);
      }
    } catch (err) {
      console.warn('[AutomationService] Failed to load paper portfolio:', err);
    }
  }

  async executePaperSignal(symbol: string, side: 'BUY' | 'SELL', quantity: number, price: number, manualOverride = false): Promise<any> {
    try {
      const res = await fetch('/api/paper-trading/execute-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, side, quantity, price, manualOverride })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await this.loadPaperPortfolio();
        await this.loadPaperAuditTrail();
        return data.order;
      } else {
        throw new Error(data.error || 'Paper trade execution failed');
      }
    } catch (err: any) {
      console.error('[AutomationService] Execute paper signal error:', err);
      throw err;
    }
  }

  async loadPaperAuditTrail(): Promise<void> {
    try {
      const res = await fetch('/api/paper-trading/audit-trail');
      if (res.ok) {
        const data = await res.json();
        this.paperAuditTrail.set(data.auditTrail || []);
      }
    } catch (err) {
      console.warn('[AutomationService] Failed to load paper audit trail:', err);
    }
  }
}
