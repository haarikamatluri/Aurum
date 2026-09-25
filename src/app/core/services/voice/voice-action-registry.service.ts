import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { PortfolioService } from '../portfolio.service';
import { NotificationService } from '../notification.service';
import { MonitoringService } from '../monitoring.service';
import { AutomationService } from '../automation.service';
import { TradingService } from '../trading.service';
import { VoiceContextService } from './voice-context.service';

export interface ActionResult {
  success: boolean;
  actionName: string;
  uiFeedback: string;
  spokenFeedback: string;
  data?: any;
  requiresConfirmation?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VoiceActionRegistry {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly portfolioService = inject(PortfolioService);
  private readonly notificationService = inject(NotificationService);
  private readonly monitoringService = inject(MonitoringService);
  private readonly automationService = inject(AutomationService);
  private readonly tradingService = inject(TradingService);
  private readonly contextService = inject(VoiceContextService);

  // =========================================================================
  // 1. NAVIGATION
  // =========================================================================
  async openDashboard(): Promise<ActionResult> {
    await this.router.navigate(['/money']);
    return {
      success: true,
      actionName: 'NAVIGATE_DASHBOARD',
      uiFeedback: 'Opened Portfolio Dashboard',
      spokenFeedback: 'Opening your portfolio.'
    };
  }

  async openStock(symbol: string): Promise<ActionResult> {
    const sym = symbol.toUpperCase();
    this.contextService.setCurrentSymbol(sym);
    await this.router.navigate(['/money/stocks', sym]);
    return {
      success: true,
      actionName: 'NAVIGATE_STOCK',
      uiFeedback: `Viewing ${sym}`,
      spokenFeedback: `Opening ${sym}.`,
      data: { symbol: sym }
    };
  }

  async openAiAnalyst(symbol?: string, tab = 'overview'): Promise<ActionResult> {
    const targetSymbol = symbol ? symbol.toUpperCase() : (this.contextService.currentSymbol() || 'TCS');
    this.contextService.setCurrentSymbol(targetSymbol);
    this.contextService.setTab(tab);
    await this.router.navigate(['/money/ai-analyst', targetSymbol, tab]);
    return {
      success: true,
      actionName: 'NAVIGATE_AI_ANALYST',
      uiFeedback: `AI Analyst for ${targetSymbol} (${tab})`,
      spokenFeedback: `Opening AI Analyst for ${targetSymbol}.`,
      data: { symbol: targetSymbol, tab }
    };
  }

  async openNotifications(): Promise<ActionResult> {
    await this.router.navigate(['/money/notifications']);
    return {
      success: true,
      actionName: 'NAVIGATE_NOTIFICATIONS',
      uiFeedback: 'Opened Alerts & Notifications',
      spokenFeedback: 'Opening alerts.'
    };
  }

  async openSettings(): Promise<ActionResult> {
    await this.router.navigate(['/money/settings']);
    return {
      success: true,
      actionName: 'NAVIGATE_SETTINGS',
      uiFeedback: 'Opened Settings',
      spokenFeedback: 'Opening settings.'
    };
  }

  async goBack(): Promise<ActionResult> {
    this.location.back();
    return {
      success: true,
      actionName: 'NAVIGATE_BACK',
      uiFeedback: 'Navigated Back',
      spokenFeedback: 'Going back.'
    };
  }

  // =========================================================================
  // 2. UI CONTROL
  // =========================================================================
  setTimeframe(timeframe: string): ActionResult {
    const tf = timeframe.toUpperCase();
    this.contextService.setTimeframe(tf);
    return {
      success: true,
      actionName: 'SET_TIMEFRAME',
      uiFeedback: `Chart timeframe set to ${tf}`,
      spokenFeedback: `Showing chart for ${tf}.`,
      data: { timeframe: tf }
    };
  }

  setMarketFilter(market: 'ALL' | 'US' | 'IN'): ActionResult {
    this.contextService.setMarket(market);
    const label = market === 'IN' ? 'Indian stocks' : market === 'US' ? 'US stocks' : 'all markets';
    return {
      success: true,
      actionName: 'SET_MARKET_FILTER',
      uiFeedback: `Market filter: ${market}`,
      spokenFeedback: `Filtering to ${label}.`,
      data: { market }
    };
  }

  switchTab(tab: string): ActionResult {
    const cleanTab = tab.toLowerCase();
    this.contextService.setTab(cleanTab);
    const sym = this.contextService.currentSymbol() || 'TCS';
    this.router.navigate(['/money/ai-analyst', sym, cleanTab]);
    return {
      success: true,
      actionName: 'SWITCH_TAB',
      uiFeedback: `Switched to ${cleanTab} tab`,
      spokenFeedback: `Opening the ${cleanTab} tab.`,
      data: { tab: cleanTab }
    };
  }

  expandChart(): ActionResult {
    return {
      success: true,
      actionName: 'EXPAND_CHART',
      uiFeedback: 'Chart Expanded',
      spokenFeedback: 'Chart expanded for high readability.'
    };
  }

  collapseDetails(): ActionResult {
    return {
      success: true,
      actionName: 'COLLAPSE_DETAILS',
      uiFeedback: 'Details Collapsed',
      spokenFeedback: 'Closed.'
    };
  }

  // =========================================================================
  // 3. PORTFOLIO DATA
  // =========================================================================
  getPortfolioSummary(): ActionResult {
    const summary = this.portfolioService.getSummaryForMarket('ALL');
    const holdings = this.portfolioService.holdings();

    const val = summary.currentValue !== null ? summary.currentValue : summary.totalInvested;
    const pl = summary.totalGain !== null ? summary.totalGain : 0;
    const plPct = summary.totalGainPct !== null ? summary.totalGainPct : 0;

    let moverText = '';
    if (holdings.length > 0) {
      const sorted = [...holdings].sort((a, b) => (b.profitLossPct || 0) - (a.profitLossPct || 0));
      const best = sorted[0];
      if (best) {
        moverText = ` ${best.symbol} is leading, up ${Math.abs(best.profitLossPct || 0).toFixed(1)}%.`;
      }
    }

    const spoken = `Your portfolio is valued at ₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}, ${plPct >= 0 ? 'up' : 'down'} ${Math.abs(plPct).toFixed(2)}% overall.${moverText}`;

    return {
      success: true,
      actionName: 'PORTFOLIO_SUMMARY',
      uiFeedback: `Portfolio Value: ₹${val.toLocaleString('en-IN')} (${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%)`,
      spokenFeedback: spoken,
      data: { totalValue: val, totalPL: pl, totalPLPct: plPct, holdingsCount: holdings.length }
    };
  }

  getBiggestLoser(): ActionResult {
    const holdings = this.portfolioService.holdings();
    if (holdings.length === 0) {
      return {
        success: true,
        actionName: 'BIGGEST_LOSER',
        uiFeedback: 'No active holdings in portfolio.',
        spokenFeedback: 'You currently have no active holdings in your portfolio.'
      };
    }

    const sorted = [...holdings].sort((a, b) => (a.profitLossPct || 0) - (b.profitLossPct || 0));
    const loser = sorted[0];

    if (!loser || (loser.profitLossPct || 0) >= 0) {
      return {
        success: true,
        actionName: 'BIGGEST_LOSER',
        uiFeedback: 'All portfolio positions are positive today.',
        spokenFeedback: 'All your portfolio positions are currently positive today.'
      };
    }

    const lossPct = Math.abs(loser.profitLossPct || 0).toFixed(2);
    const spoken = `${loser.symbol} is down ${lossPct}%, making it your largest decliner today.`;

    return {
      success: true,
      actionName: 'BIGGEST_LOSER',
      uiFeedback: `Top Decliner: ${loser.symbol} (${loser.profitLossPct?.toFixed(2)}%)`,
      spokenFeedback: spoken,
      data: loser
    };
  }

  getMarketExposure(): ActionResult {
    const holdings = this.portfolioService.holdings();
    let inrValue = 0;
    let usdValue = 0;

    for (const h of holdings) {
      const isIndian = h.currency === 'INR' || ['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'ICICIBANK', 'TATAMOTORS', 'WIPRO', 'SBIN', 'ITC'].includes(h.symbol);
      const val = (h.shares || 0) * (h.currentPrice || h.avgPurchasePrice || 0);
      if (isIndian) inrValue += val;
      else usdValue += val * 83; // approx conversion for ratio
    }

    const total = inrValue + usdValue || 1;
    const inrPct = Math.round((inrValue / total) * 100);
    const usdPct = 100 - inrPct;

    const spoken = `Your portfolio is ${inrPct}% allocated to Indian stocks and ${usdPct}% to US equities.`;
    return {
      success: true,
      actionName: 'MARKET_EXPOSURE',
      uiFeedback: `Exposure: Indian ${inrPct}% • US ${usdPct}%`,
      spokenFeedback: spoken,
      data: { inrPct, usdPct, inrValue, usdValue }
    };
  }

  getPortfolioImpact(symbol?: string): ActionResult {
    const sym = symbol ? symbol.toUpperCase() : (this.contextService.currentSymbol() || 'TCS');
    const holdings = this.portfolioService.holdings();
    const match = holdings.find((h) => h.symbol === sym);

    if (!match) {
      return {
        success: true,
        actionName: 'PORTFOLIO_IMPACT',
        uiFeedback: `${sym} is not in your active holdings`,
        spokenFeedback: `${sym} is not currently held in your portfolio, so its direct P&L impact is zero.`
      };
    }

    const pl = Math.round(match.profitLoss || 0);
    const spoken = `${sym} has contributed ₹${Math.abs(pl).toLocaleString('en-IN')} to your portfolio ${pl >= 0 ? 'gain' : 'loss'}.`;
    return {
      success: true,
      actionName: 'PORTFOLIO_IMPACT',
      uiFeedback: `${sym} P&L Contribution: ₹${pl.toLocaleString('en-IN')}`,
      spokenFeedback: spoken,
      data: { symbol: sym, profitLoss: pl }
    };
  }

  // =========================================================================
  // 4. ALERTS
  // =========================================================================
  async setPriceAlert(symbol: string, targetPrice: number): Promise<ActionResult> {
    const sym = symbol.toUpperCase();
    const isIndian = ['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'ICICIBANK', 'TATAMOTORS'].includes(sym);
    const currSym = isIndian ? '₹' : '$';

    this.notificationService.addNotification({
      id: `alert-voice-${Date.now()}`,
      holdingId: `holding-${sym}`,
      symbol: sym,
      companyName: sym,
      direction: 'DOWN',
      threshold: 5,
      thresholdsCrossed: [5],
      movementPercent: 5.2,
      price: targetPrice,
      referencePrice: targetPrice,
      message: `Price alert set for ${sym} at ${currSym}${targetPrice}`,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    return {
      success: true,
      actionName: 'CREATE_ALERT',
      uiFeedback: `Alert set for ${sym} at ${currSym}${targetPrice}`,
      spokenFeedback: `Price alert set for ${sym} at ${targetPrice} ${isIndian ? 'rupees' : 'dollars'}.`,
      data: { symbol: sym, price: targetPrice }
    };
  }

  listAlerts(): ActionResult {
    const notifs = this.notificationService.notifications();
    const count = notifs.length;
    const spoken = count === 0
      ? 'You have no active price alerts.'
      : `You have ${count} active alert${count > 1 ? 's' : ''}. I have opened your notifications center.`;

    this.router.navigate(['/money/notifications']);
    return {
      success: true,
      actionName: 'LIST_ALERTS',
      uiFeedback: `Active Alerts: ${count}`,
      spokenFeedback: spoken,
      data: { count, notifications: notifs }
    };
  }

  // =========================================================================
  // 5. ORDERS & FINANCIAL SAFETY (PRE-TRADE RISK PREVIEW)
  // =========================================================================
  async prepareOrderPreview(symbol: string, side: 'BUY' | 'SELL', quantity: number): Promise<ActionResult> {
    const sym = symbol.toUpperCase();
    const isIndian = ['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'ICICIBANK', 'TATAMOTORS'].includes(sym);
    const currSym = isIndian ? '₹' : '$';

    try {
      const preview = await this.tradingService.previewOrder({
        symbol: sym,
        side,
        quantity,
        orderType: 'MARKET',
        exchange: isIndian ? 'NSE' : 'NASDAQ',
        market: isIndian ? 'IN' : 'US',
        currency: isIndian ? 'INR' : 'USD'
      });

      return {
        success: true,
        actionName: 'ORDER_PREVIEW_READY',
        requiresConfirmation: true,
        uiFeedback: `Order Preview: ${side} ${quantity} ${sym} ~ ${currSym}${preview.totalCost.toLocaleString()}`,
        spokenFeedback: `Order preview ready for ${quantity} shares of ${sym} for approximately ${currSym}${Math.round(preview.totalCost)}. Please confirm on your screen.`,
        data: preview
      };
    } catch (err: any) {
      return {
        success: false,
        actionName: 'ORDER_PREVIEW_FAILED',
        uiFeedback: `Pre-Trade Risk Block: ${err.message}`,
        spokenFeedback: `Order could not be prepared. ${err.message}`,
        data: { error: err.message }
      };
    }
  }

  // =========================================================================
  // 6. AUTOMATION
  // =========================================================================
  async disableAutomation(): Promise<ActionResult> {
    await this.automationService.toggleAutomation(false, false);
    return {
      success: true,
      actionName: 'DISABLE_AUTOMATION',
      uiFeedback: 'Automation Stopped',
      spokenFeedback: 'Automated trading is now turned off.'
    };
  }

  unsupportedCapability(query: string): ActionResult {
    return {
      success: false,
      actionName: 'UNSUPPORTED_CAPABILITY',
      uiFeedback: 'Capability Not In Aurum',
      spokenFeedback: "I don't have a capability for that in Aurum. I can help you with portfolio tracking, market quotes, AI research, alerts, and strategy automation.",
      data: { query }
    };
  }
}
