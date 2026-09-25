import { Injectable, signal, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PortfolioService } from '../portfolio.service';

export interface VoiceWorkingMemory {
  currentRoute: string;
  previousRoute: string | null;
  currentSymbol: string | null;
  previousSymbol: string | null;
  currentMarket: 'ALL' | 'US' | 'IN';
  currentTab: string | null;
  currentChart: string | null;
  currentTimeframe: string;
  currentPortfolio: {
    totalValueINR: number;
    totalInvestedINR: number;
    totalGainLossINR: number;
    totalGainLossPct: number;
    holdingsCount: number;
    topMover: { symbol: string; changePct: number } | null;
    biggestLoser: { symbol: string; changePct: number } | null;
  };
  currentOrder: any | null;
  currentAlert: any | null;
  lastCapability: string | null;
  lastAction: string | null;
  lastResult: any | null;
  lastQuery: string | null;
  activeTask: string | null;
  pendingConfirmation: any | null;
  recentEntities: Record<string, any>;
  recentCapabilities: string[];
  conversationTimestamp: number;
}

export interface CommandContextSnapshot extends VoiceWorkingMemory {
  // Aliases for compatibility
  route: string;
  symbol: string | null;
  portfolio: VoiceWorkingMemory['currentPortfolio'];
  lastCommand: string | null;
  lastIntent: string | null;
  activeOrderSymbol: string | null;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class VoiceContextService {
  private readonly router = inject(Router);
  private readonly portfolioService = inject(PortfolioService);

  readonly currentRoute = signal<string>('/money');
  readonly previousRoute = signal<string | null>(null);
  readonly currentSymbol = signal<string | null>('TCS');
  readonly previousSymbol = signal<string | null>(null);
  readonly currentMarket = signal<'ALL' | 'US' | 'IN'>('ALL');
  readonly currentTab = signal<string | null>('overview');
  readonly currentTimeframe = signal<string>('1D');
  readonly lastCapability = signal<string | null>(null);
  readonly lastAction = signal<string | null>(null);
  readonly lastResult = signal<any | null>(null);
  readonly lastQuery = signal<string | null>(null);
  readonly activeOrderSymbol = signal<string | null>(null);
  readonly pendingConfirmation = signal<any | null>(null);
  readonly recentCapabilities = signal<string[]>([]);
  readonly recentEntities = signal<Record<string, any>>({});
  readonly recentHistory = signal<Array<{ role: 'user' | 'assistant'; text: string; timestamp: Date; intent?: string; capability?: string }>>([]);

  constructor() {
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((event) => {
      const prev = this.currentRoute();
      const curr = event.urlAfterRedirects || event.url;
      if (prev !== curr) {
        this.previousRoute.set(prev);
        this.currentRoute.set(curr);
        this.extractParamsFromUrl(curr);
      }
    });

    // Default symbol from portfolio holdings
    const holdings = this.portfolioService.holdings();
    if (holdings.length > 0) {
      this.currentSymbol.set(holdings[0].symbol);
    }
  }

  private extractParamsFromUrl(url: string) {
    const stockMatch = url.match(/\/stocks\/([a-zA-Z0-9_\-\.]+)/i);
    const analystMatch = url.match(/\/ai-analyst\/([a-zA-Z0-9_\-\.]+)(?:\/([a-zA-Z\-]+))?/i);
    if (stockMatch && stockMatch[1]) {
      this.setCurrentSymbol(stockMatch[1]);
    } else if (analystMatch && analystMatch[1]) {
      this.setCurrentSymbol(analystMatch[1]);
      if (analystMatch[2]) {
        this.currentTab.set(analystMatch[2]);
      }
    }
  }

  setCurrentSymbol(symbol: string | null) {
    if (!symbol) return;
    const clean = symbol.toUpperCase();
    const curr = this.currentSymbol();
    if (curr && curr !== clean) {
      this.previousSymbol.set(curr);
    }
    this.currentSymbol.set(clean);
    this.recentEntities.update((e) => ({ ...e, symbol: clean }));
  }

  setTimeframe(tf: string) {
    this.currentTimeframe.set(tf);
    this.recentEntities.update((e) => ({ ...e, timeframe: tf }));
  }

  setMarket(m: 'ALL' | 'US' | 'IN') {
    this.currentMarket.set(m);
    this.recentEntities.update((e) => ({ ...e, market: m }));
  }

  setTab(tab: string) {
    this.currentTab.set(tab);
    this.recentEntities.update((e) => ({ ...e, tab }));
  }

  setActiveOrderSymbol(symbol: string | null) {
    this.activeOrderSymbol.set(symbol);
    if (symbol) {
      this.recentEntities.update((e) => ({ ...e, activeOrderSymbol: symbol }));
    }
  }

  recordCapabilityExecution(capabilityId: string, actionName: string, query: string, result?: any) {
    this.lastCapability.set(capabilityId);
    this.lastAction.set(actionName);
    this.lastQuery.set(query);
    if (result !== undefined) {
      this.lastResult.set(result);
    }
    this.recentCapabilities.update((list) => [...list.slice(-10), capabilityId]);
  }

  recordInteraction(role: 'user' | 'assistant', text: string, intent?: string, capability?: string) {
    const item = { role, text, timestamp: new Date(), intent, capability };
    this.recentHistory.update((hist) => [...hist.slice(-20), item]);
    if (role === 'user') {
      this.lastQuery.set(text);
      if (capability) this.lastCapability.set(capability);
    }
  }

  getSnapshot(): CommandContextSnapshot {
    const summary = this.portfolioService.getSummaryForMarket(this.currentMarket());
    const holdings = this.portfolioService.holdings();

    let topMover: { symbol: string; changePct: number } | null = null;
    let biggestLoser: { symbol: string; changePct: number } | null = null;

    if (holdings.length > 0) {
      const sorted = [...holdings].sort((a, b) => (b.profitLossPct || 0) - (a.profitLossPct || 0));
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];

      if (top) topMover = { symbol: top.symbol, changePct: top.profitLossPct || 0 };
      if (bottom && bottom !== top) biggestLoser = { symbol: bottom.symbol, changePct: bottom.profitLossPct || 0 };
    }

    const portfolioData = {
      totalValueINR: summary.currentValue !== null ? summary.currentValue : summary.totalInvested,
      totalInvestedINR: summary.totalInvested || 0,
      totalGainLossINR: summary.totalGain !== null ? summary.totalGain : 0,
      totalGainLossPct: summary.totalGainPct !== null ? summary.totalGainPct : 0,
      holdingsCount: holdings.length,
      topMover,
      biggestLoser
    };

    return {
      currentRoute: this.currentRoute(),
      previousRoute: this.previousRoute(),
      currentSymbol: this.currentSymbol(),
      previousSymbol: this.previousSymbol(),
      currentMarket: this.currentMarket(),
      currentTab: this.currentTab(),
      currentChart: null,
      currentTimeframe: this.currentTimeframe(),
      currentPortfolio: portfolioData,
      currentOrder: null,
      currentAlert: null,
      lastCapability: this.lastCapability(),
      lastAction: this.lastAction(),
      lastResult: this.lastResult(),
      lastQuery: this.lastQuery(),
      activeTask: null,
      pendingConfirmation: this.pendingConfirmation(),
      recentEntities: this.recentEntities(),
      recentCapabilities: this.recentCapabilities(),
      conversationTimestamp: Date.now(),
      // Legacy compatibility mappings
      route: this.currentRoute(),
      symbol: this.currentSymbol(),
      portfolio: portfolioData,
      lastCommand: this.lastQuery(),
      lastIntent: this.lastCapability(),
      activeOrderSymbol: this.activeOrderSymbol(),
      timestamp: new Date().toISOString()
    };
  }
}
