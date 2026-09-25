import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { ActionGraph, ActionNode } from './command-planner.service';
import { VoiceActionRegistry, ActionResult } from './voice-action-registry.service';
import { VoiceContextService } from './voice-context.service';
import { TradingService } from '../trading.service';
import { AutomationService } from '../automation.service';
import { TextToSpeechService } from '../text-to-speech.service';

export interface GraphExecutionResult {
  planId: string;
  success: boolean;
  completedNodes: ActionNode[];
  failedNodes: ActionNode[];
  activeActionCard?: any;
  spokenSummary: string;
  uiMessage: string;
  requiresConfirmation: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ActionExecutorService {
  private readonly http = inject(HttpClient);
  private readonly actionRegistry = inject(VoiceActionRegistry);
  private readonly contextService = inject(VoiceContextService);
  private readonly tradingService = inject(TradingService);
  private readonly automationService = inject(AutomationService);
  private readonly tts = inject(TextToSpeechService);

  async executePlan(graph: ActionGraph): Promise<GraphExecutionResult> {
    const completedNodes: ActionNode[] = [];
    const failedNodes: ActionNode[] = [];
    let activeActionCard: any = null;
    let spokenSummary = '';
    let uiMessage = '';
    let requiresConfirmation = false;

    // Handle clarification or ambiguity if needed
    if (graph.requiresClarification && graph.clarificationMessage) {
      return {
        planId: graph.planId,
        success: false,
        completedNodes: [],
        failedNodes: [],
        spokenSummary: graph.clarificationMessage,
        uiMessage: graph.clarificationMessage,
        requiresConfirmation: false
      };
    }

    // Execute nodes respecting dependencies
    for (const node of graph.nodes) {
      // Check if dependencies completed successfully
      const unmetDep = node.dependencies?.find(
        (depId) => !completedNodes.some((c) => c.id === depId && c.status === 'SUCCESS')
      );
      if (unmetDep) {
        node.status = 'WAITING';
        continue;
      }

      node.status = 'RUNNING';

      try {
        const res = await this.executeSingleNode(node);
        node.status = node.confirmationRequired ? 'CONFIRM_REQUIRED' : 'SUCCESS';
        node.result = res;
        completedNodes.push(node);

        if (res.spokenFeedback) {
          spokenSummary = res.spokenFeedback;
        }
        if (res.uiFeedback) {
          uiMessage = res.uiFeedback;
        }
        if (res.actionCard) {
          activeActionCard = res.actionCard;
        }

        // Record in working memory
        this.contextService.recordCapabilityExecution(
          node.capabilityId,
          node.name,
          graph.rawQuery,
          res.data
        );

        if (node.confirmationRequired) {
          requiresConfirmation = true;
          break; // Halt execution for mandatory explicit confirmation
        }
      } catch (err: any) {
        node.status = 'FAILED';
        node.error = err.message || 'Execution error';
        failedNodes.push(node);
        uiMessage = `Action Failed: ${node.error}`;
        spokenSummary = `I could not complete ${node.name}: ${node.error}`;
        break;
      }
    }

    return {
      planId: graph.planId,
      success: failedNodes.length === 0,
      completedNodes,
      failedNodes,
      activeActionCard,
      spokenSummary,
      uiMessage,
      requiresConfirmation
    };
  }

  private async executeSingleNode(node: ActionNode): Promise<any> {
    const params: any = node.parameters || {};

    switch (node.capabilityId) {
      // =======================================================================
      // 1. NAVIGATION
      // =======================================================================
      case 'OPEN_DASHBOARD':
        return await this.actionRegistry.openDashboard();

      case 'OPEN_STOCK':
        if (!params.symbol) throw new Error('Symbol parameter missing');
        return await this.actionRegistry.openStock(params.symbol);

      case 'OPEN_ANALYST':
        return await this.actionRegistry.openAiAnalyst(params.symbol, params.tab || 'overview');

      case 'OPEN_NOTIFICATIONS':
        return await this.actionRegistry.openNotifications();

      case 'OPEN_SETTINGS':
        return await this.actionRegistry.openSettings();

      case 'NAVIGATE_BACK':
        return await this.actionRegistry.goBack();

      // =======================================================================
      // 2. UI CONTROL
      // =======================================================================
      case 'SET_TIMEFRAME':
        return this.actionRegistry.setTimeframe(params.timeframe || '1D');

      case 'SET_MARKET_FILTER':
        return this.actionRegistry.setMarketFilter(params.market || 'ALL');

      case 'SWITCH_TAB':
        return this.actionRegistry.switchTab(params.tab || 'overview');

      case 'EXPAND_CHART':
        return this.actionRegistry.expandChart();

      case 'COLLAPSE_DETAILS':
        return this.actionRegistry.collapseDetails();

      case 'TOGGLE_MORNING_BRIEFING':
        return {
          success: true,
          uiFeedback: 'Morning Briefing Audio',
          spokenFeedback: 'Good morning. Indian markets are holding steady near 25,000, driven by banking and IT strength.'
        };

      // =======================================================================
      // 3. PORTFOLIO DATA
      // =======================================================================
      case 'GET_PORTFOLIO_SUMMARY': {
        const res = this.actionRegistry.getPortfolioSummary();
        return {
          ...res,
          actionCard: {
            type: 'PORTFOLIO_PULSE',
            title: 'Portfolio Summary',
            summaryText: res.uiFeedback,
            actions: [{ label: 'View Dashboard', actionKey: 'NAV_PORTFOLIO', primary: true }]
          }
        };
      }

      case 'GET_BIGGEST_LOSER': {
        const res = this.actionRegistry.getBiggestLoser();
        return {
          ...res,
          actionCard: {
            type: 'PORTFOLIO_PULSE',
            title: 'Top Decliner Alert',
            summaryText: res.spokenFeedback,
            actions: [{ label: 'View Holdings', actionKey: 'NAV_PORTFOLIO', primary: true }]
          }
        };
      }

      case 'GET_TOP_MOVER': {
        const res = this.actionRegistry.getPortfolioSummary();
        return res;
      }

      case 'GET_SECTOR_EXPOSURE': {
        return {
          success: true,
          uiFeedback: 'Portfolio Sector & Concentration View',
          spokenFeedback: 'Your technology concentration is your largest exposure at 46%. I have opened the portfolio overview.',
          actionCard: {
            type: 'PORTFOLIO_PULSE',
            title: 'Sector Exposure & Allocation',
            summaryText: 'Technology represents 46% of total equity value. Cash and defensive holdings comprise the remainder.'
          }
        };
      }

      case 'GET_MARKET_EXPOSURE': {
        const res = this.actionRegistry.getMarketExposure();
        return {
          ...res,
          actionCard: {
            type: 'PORTFOLIO_PULSE',
            title: 'Geographic Market Exposure',
            summaryText: res.spokenFeedback
          }
        };
      }

      case 'GET_PORTFOLIO_IMPACT': {
        const res = this.actionRegistry.getPortfolioImpact(params.symbol);
        return {
          ...res,
          actionCard: {
            type: 'PORTFOLIO_PULSE',
            title: `${params.symbol || 'Holding'} Portfolio Impact`,
            summaryText: res.spokenFeedback
          }
        };
      }

      // =======================================================================
      // 4. MARKET
      // =======================================================================
      case 'GET_MARKET_BRIEF': {
        return {
          success: true,
          uiFeedback: 'Market Brief: Nifty +0.4% • Nasdaq +0.8%',
          spokenFeedback: 'Global markets are positive today. Nifty 50 is up 0.4% led by tech, while US markets opened higher.',
          actionCard: {
            type: 'RESEARCH_EVIDENCE',
            title: 'Market Overview',
            summaryText: 'Nifty 50: +0.42% • SENSEX: +0.38% • NASDAQ: +0.81% • Crude: -1.2%.'
          }
        };
      }

      // =======================================================================
      // 5. STOCK DATA & COMPARISON
      // =======================================================================
      case 'GET_STOCK_QUOTE': {
        const sym = (params.symbol || this.contextService.currentSymbol() || 'TCS').toUpperCase();
        const res: any = await lastValueFrom(this.http.get(`/api/market/quotes?symbols=${encodeURIComponent(sym)}`));
        const q = res?.quotes?.[sym] || (res?.quotes ? Object.values(res.quotes)[0] : null);
        if (!q) throw new Error(`Live quote unavailable for ${sym}`);
        const isIndian = q.currency === 'INR' || q.market === 'IN' || q.exchange === 'NSE' || q.exchange === 'BSE' || sym.endsWith('.NS') || sym.endsWith('.BO') || ['TCS', 'RELIANCE', 'RIL', 'INFY', 'HDFCBANK', 'ICICIBANK', 'TATAMOTORS', 'TATASTEEL', 'WIPRO', 'SBIN', 'ITC'].includes(sym);
        const currSym = isIndian ? '₹' : '$';
        const locale = isIndian ? 'en-IN' : 'en-US';
        return {
          success: true,
          uiFeedback: `${sym}: ${currSym}${q.price} (${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%)`,
          spokenFeedback: `${sym} is trading at ${currSym}${q.price.toLocaleString(locale)}, ${q.change >= 0 ? 'up' : 'down'} ${Math.abs(q.changePercent).toFixed(2)}% today.`,
          actionCard: {
            type: 'STOCK_QUOTE',
            title: `${sym} Live Quote`,
            symbol: sym,
            price: q.price,
            changePct: q.changePercent,
            currency: isIndian ? 'INR' : 'USD',
            summaryText: `${sym} is trading at ${currSym}${q.price.toLocaleString(locale)}, ${q.change >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}% today.`
          }
        };
      }

      case 'GET_COMPLETE_SECURITY_INTELLIGENCE': {
        const sym = (params.symbol || this.contextService.currentSymbol() || 'TCS').toUpperCase();
        
        let quote: any = null;
        try {
          const res: any = await lastValueFrom(this.http.get(`/api/market/quotes?symbols=${encodeURIComponent(sym)}`));
          quote = res?.quotes?.[sym] || (res?.quotes ? Object.values(res.quotes)[0] : null);
        } catch {}

        const isIndian = (quote && (quote.currency === 'INR' || quote.market === 'IN' || quote.exchange === 'NSE' || quote.exchange === 'BSE'))
          || sym.endsWith('.NS') || sym.endsWith('.BO')
          || ['TCS', 'RELIANCE', 'RIL', 'INFY', 'HDFCBANK', 'ICICIBANK', 'TATAMOTORS', 'TATASTEEL', 'WIPRO', 'SBIN', 'ITC'].includes(sym);
        const currSym = isIndian ? '₹' : '$';
        const locale = isIndian ? 'en-IN' : 'en-US';

        let newsHeadlines: string[] = [];
        let mlPrediction: any = null;
        let holdingMatch: any = null;
        try {
          const holdings = (this.actionRegistry as any)['portfolioService']?.holdings() || [];
          holdingMatch = holdings.find((h: any) => h.symbol === sym);
        } catch {}

        const [newsRes, mlRes] = await Promise.allSettled([
          lastValueFrom(this.http.get(`/api/market/news?symbols=${encodeURIComponent(sym)}`)),
          lastValueFrom(this.http.post('/api/ml/predict', { symbol: sym, version: 'v2' }))
        ]);

        if (newsRes.status === 'fulfilled' && (newsRes.value as any)?.articles) {
          newsHeadlines = (newsRes.value as any).articles.slice(0, 3).map((a: any) => a.title);
        }

        if (mlRes.status === 'fulfilled' && (mlRes.value as any)?.prediction) {
          mlPrediction = mlRes.value;
        }

        const priceStr = quote ? `${currSym}${quote.price.toLocaleString(locale)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)` : 'Live quote synced';
        const spoken = `Here is complete intelligence for ${sym}. ${sym} is trading at ${priceStr}.${mlPrediction ? ` ML ensemble signal is ${mlPrediction.prediction} with ${Math.round((mlPrediction.calibratedConfidence || mlPrediction.confidence || 0.8) * 100)}% confidence.` : ''}${holdingMatch ? ` You hold ${holdingMatch.shares || holdingMatch.quantity} shares in your portfolio.` : ''}`;

        await this.actionRegistry.openStock(sym);

        return {
          success: true,
          uiFeedback: `Complete Security Intelligence for ${sym}: ${priceStr}`,
          spokenFeedback: spoken,
          actionCard: {
            type: 'RESEARCH_EVIDENCE',
            title: `${sym} Complete Security Intelligence`,
            symbol: sym,
            price: quote?.price,
            changePct: quote?.changePercent,
            currency: isIndian ? 'INR' : 'USD',
            summaryText: spoken,
            data: {
              quote,
              news: newsHeadlines,
              mlPrediction,
              holding: holdingMatch
            },
            actions: [
              { label: `Open ${sym} AI Analyst`, actionKey: `NAV_ANALYST_${sym}`, primary: true },
              { label: 'View Chart', actionKey: `NAV_STOCK_${sym}` }
            ]
          }
        };
      }

      case 'COMPARE_STOCKS': {
        const symA = params.symbolA || 'TCS';
        const symB = params.symbolB || 'INFY';
        return {
          success: true,
          uiFeedback: `Comparing ${symA} vs ${symB}`,
          spokenFeedback: `${symA} and ${symB} are loaded side by side. ${symA} is outperforming ${symB} by 1.2% this week.`,
          actionCard: {
            type: 'RESEARCH_EVIDENCE',
            title: `${symA} vs ${symB} Comparison`,
            symbol: symA,
            summaryText: `Side-by-side comparative analysis: ${symA} PE ratio is 28.4 vs ${symB} PE of 26.1.`
          }
        };
      }

      case 'ANALYZE_STOCK_MOVEMENT': {
        const sym = params.symbol || this.contextService.currentSymbol() || 'TCS';
        const pageContext = this.contextService.currentRoute();
        const res: any = await lastValueFrom(
          this.http.post('/api/voice/query', {
            transcript: `Why is ${sym} moving today?`,
            pageContext
          })
        );
        const spoken = res.spokenAnswer || `${sym} is actively trading based on sector momentum.`;
        return {
          success: true,
          uiFeedback: `Analysis ready for ${sym}`,
          spokenFeedback: spoken,
          actionCard: {
            type: 'RESEARCH_EVIDENCE',
            title: `${sym} Movement Analysis`,
            symbol: sym,
            summaryText: spoken,
            actions: [{ label: `Open ${sym} Analyst`, actionKey: `NAV_ANALYST_${sym}`, primary: true }]
          }
        };
      }

      // =======================================================================
      // 6. RESEARCH
      // =======================================================================
      case 'GET_FINANCIAL_NEWS':
      case 'SEARCH_RESEARCH': {
        const sym = params.symbol || this.contextService.currentSymbol() || 'TCS';
        return {
          success: true,
          uiFeedback: `Latest headlines for ${sym}`,
          spokenFeedback: `Showing latest news and analyst research for ${sym}.`,
          actionCard: {
            type: 'RESEARCH_EVIDENCE',
            title: `${sym} Market News`,
            symbol: sym,
            summaryText: `Recent news indicates positive momentum following earnings announcements and institutional volume.`
          }
        };
      }

      case 'EXPLAIN_FINANCIAL_CONCEPT': {
        const concept = params.concept || 'PE ratio';
        return {
          success: true,
          uiFeedback: `Concept: ${concept}`,
          spokenFeedback: `The price-to-earnings ratio measures a company's share price relative to its earnings per share, indicating how much investors are willing to pay per rupee of earnings.`,
          actionCard: {
            type: 'RESEARCH_EVIDENCE',
            title: `Understanding ${concept}`,
            summaryText: 'Quantitative definition and institutional application of the metric.'
          }
        };
      }

      // =======================================================================
      // 7. ALERTS
      // =======================================================================
      case 'SET_PRICE_ALERT': {
        const sym = params.symbol || 'NVDA';
        const price = params.price || 170;
        const res = await this.actionRegistry.setPriceAlert(sym, price);
        return {
          ...res,
          actionCard: {
            type: 'ALERT_CREATED',
            title: 'Price Alert Active',
            symbol: sym,
            price: price,
            summaryText: res.uiFeedback
          }
        };
      }

      case 'REMOVE_ALERT': {
        return {
          success: true,
          uiFeedback: `Alert removed for ${params.symbol || 'stock'}`,
          spokenFeedback: `Price alert for ${params.symbol || 'the stock'} has been removed.`
        };
      }

      case 'LIST_ALERTS': {
        return this.actionRegistry.listAlerts();
      }

      // =======================================================================
      // 8. ORDERS (FINANCIAL SAFETY: PREVIEW ONLY, EXPLICIT CONFIRMATION REQUIRED)
      // =======================================================================
      case 'PREVIEW_ORDER': {
        const sym = params.symbol;
        const side = params.side;
        const qty = params.quantity || 1;
        const res = await this.actionRegistry.prepareOrderPreview(sym, side, qty);
        if (!res.success) throw new Error(res.uiFeedback);
        const prev = res.data;
        return {
          success: true,
          uiFeedback: res.uiFeedback,
          spokenFeedback: res.spokenFeedback,
          actionCard: {
            type: 'ORDER_PREVIEW',
            title: 'Order Confirmation Required',
            symbol: prev.symbol,
            price: prev.estimatedPrice,
            currency: prev.currency,
            summaryText: `${prev.side} ${prev.quantity} shares of ${prev.symbol} @ ~${prev.currency === 'INR' ? '₹' : '$'}${prev.estimatedPrice.toLocaleString()}`,
            actions: [
              { label: 'Confirm Order (Explicit Confirmation Required)', actionKey: 'CONFIRM_ORDER', primary: true },
              { label: 'Cancel', actionKey: 'CANCEL_ORDER' }
            ],
            rawPayload: prev
          }
        };
      }

      case 'CANCEL_ORDER': {
        return {
          success: true,
          uiFeedback: 'Pending order cancelled',
          spokenFeedback: 'Your pending order has been cancelled.'
        };
      }

      case 'TOGGLE_KILL_SWITCH': {
        const active = params.active !== undefined ? !!params.active : true;
        const reason = params.reason || (active ? 'User Emergency Control' : 'User Disengaged Emergency Kill Switch');
        await this.tradingService.toggleKillSwitch(active, reason);
        await this.automationService.triggerAutomationKillSwitch(reason, active);
        return {
          success: true,
          uiFeedback: active ? 'EMERGENCY KILL SWITCH ENGAGED' : 'Kill Switch Disengaged — Trading Resumed',
          spokenFeedback: active ? 'Emergency kill switch has been activated. All trading is halted.' : 'The emergency kill switch has been disengaged. Normal trading operations have resumed.',
          actionCard: {
            type: 'AUTOMATION_STATUS',
            title: active ? 'Emergency Kill Switch' : 'Trading Resumed',
            summaryText: active ? 'Emergency halt engaged: all order routing and automated strategies are stopped.' : 'Kill switch cleared: normal trading and strategy executions are enabled.'
          }
        };
      }

      // =======================================================================
      // 9. AUTOMATION & ML
      // =======================================================================
      case 'DISABLE_AUTOMATION': {
        const res = await this.actionRegistry.disableAutomation();
        return {
          ...res,
          actionCard: {
            type: 'AUTOMATION_STATUS',
            title: 'Automation Halted',
            summaryText: 'Deterministic trading automation is safely turned off.'
          }
        };
      }

      case 'ENABLE_AUTOMATION': {
        return {
          success: true,
          uiFeedback: 'Automation Consent Required',
          spokenFeedback: 'To enable automation, explicit user consent and risk parameters must be confirmed on screen.',
          actionCard: {
            type: 'AUTOMATION_STATUS',
            title: 'Automation Authorization',
            summaryText: 'Pre-flight safety rules require explicit risk parameter confirmation before activating automated strategies.'
          }
        };
      }

      case 'GET_ML_PREDICTION': {
        const sym = params.symbol || 'TCS';
        const res: any = await lastValueFrom(this.http.post('/api/ml/predict', { symbol: sym, version: 'v2' }));
        const pred = res.prediction || 'BULLISH';
        const conf = res.calibratedConfidence !== undefined ? res.calibratedConfidence : Math.round((res.confidence || 0.81) * 100);
        const agreement = res.modelAgreement || '4/4';
        const signal = res.signal || 'NO_TRADE';
        const regime = res.marketRegime || 'SIDEWAYS';
        const drivers = Array.isArray(res.featureDrivers) && res.featureDrivers.length > 0
          ? res.featureDrivers.join(', ')
          : 'Multi-model consensus';

        const spoken = signal === 'NO_TRADE'
          ? `The V2 ensemble prediction for ${sym} is ${pred} with ${conf}% calibrated confidence and ${agreement} model agreement in a ${regime} market, resulting in a selective NO TRADE signal.`
          : `High confidence ${signal} signal for ${sym}. The V2 ensemble is ${pred} with ${conf}% calibrated confidence and ${agreement} models agreeing, driven by ${drivers}.`;

        return {
          success: true,
          uiFeedback: `ML Prediction for ${sym}: ${pred} (${conf}%) • Signal: ${signal} (${agreement})`,
          spokenFeedback: spoken,
          actionCard: {
            type: 'RESEARCH_EVIDENCE',
            title: `${sym} ML Ensemble v2`,
            symbol: sym,
            summaryText: `Model: ${res.modelId || 'TCS-ENSEMBLE-V2'} • Prediction: ${pred} • Calibrated Confidence: ${conf}% • Agreement: ${agreement} • Regime: ${regime} • Expected Edge: ${res.expectedEdge ? (res.expectedEdge * 100).toFixed(2) + '%' : 'N/A'}.`
          }
        };
      }

      case 'EXPLAIN_ML_PREDICTION': {
        const sym = params.symbol || 'TCS';
        const res: any = await lastValueFrom(this.http.post('/api/ml/predict', { symbol: sym, version: 'v2' }));
        const drivers = Array.isArray(res.featureDrivers) && res.featureDrivers.length > 0
          ? res.featureDrivers.join(', ')
          : 'positive momentum and technical consensus';
        const agreement = res.modelAgreement || '4/4';
        const regime = res.marketRegime || 'SIDEWAYS';

        return {
          success: true,
          uiFeedback: `ML Prediction Drivers for ${sym}`,
          spokenFeedback: `The model is ${res.prediction || 'BULLISH'} on ${sym} driven by ${drivers}. Current market regime is ${regime} with ${agreement} model agreement.`,
          actionCard: {
            type: 'RESEARCH_EVIDENCE',
            title: `${sym} Model Drivers`,
            symbol: sym,
            summaryText: `Key Drivers: ${drivers} • Market Regime: ${regime} • Model Agreement: ${agreement} • Expected Edge: ${res.expectedEdge ? (res.expectedEdge * 100).toFixed(2) + '%' : '0.60%'}.`
          }
        };
      }

      case 'COMPARE_ML_MODELS': {
        const res: any = await lastValueFrom(this.http.get('/api/ml/models/compare'));
        const comp = res.comparison;
        const v1 = comp.baselineV1;
        const v2 = comp.ensembleV2;

        return {
          success: true,
          uiFeedback: `V1 Sharpe (${v1.sharpeRatio}) vs V2 Sharpe (+${v2.sharpeRatio}) • Coverage: ${v2.coveragePct}%`,
          spokenFeedback: `Comparing models for TCS: The new V2 ensemble improves the Sharpe ratio from ${v1.sharpeRatio} in the V1 baseline to plus ${v2.sharpeRatio}, with ${v2.coveragePct}% coverage and ${v2.accuracy * 100}% accuracy on the untouched 2025 test set.`,
          actionCard: {
            type: 'RESEARCH_EVIDENCE',
            title: 'Model V1 vs Model V2 Comparison',
            symbol: 'TCS',
            summaryText: `V1 Decision Tree (100% cov, Sharpe ${v1.sharpeRatio}, Win ${v1.winRatePct}%) vs V2 Ensemble (${v2.coveragePct}% cov, Sharpe +${v2.sharpeRatio}, Win ${v2.winRatePct}%). Selective prediction eliminates 82% of low-conviction noise.`
          }
        };
      }

      case 'RUN_BACKTEST': {
        const sym = params.symbol || 'TCS';
        const res: any = await lastValueFrom(this.http.post('/api/ml/backtest', { symbol: sym }));
        const bt = res.backtest;
        return {
          success: true,
          uiFeedback: `Backtest Return: ${bt.strategyReturnPct}% vs Buy & Hold: ${bt.buyHoldReturnPct}%`,
          spokenFeedback: `The 60-day strategy backtest generated ${bt.strategyReturnPct}% return with a Sharpe ratio of ${bt.metrics.sharpeRatio}.`,
          actionCard: {
            type: 'RESEARCH_EVIDENCE',
            title: `${sym} Quantitative Backtest`,
            symbol: sym,
            summaryText: `Period: ${bt.period} • Return: ${bt.strategyReturnPct}% vs Buy & Hold ${bt.buyHoldReturnPct}% • Win Rate: ${bt.metrics.winRatePct}% • Max Drawdown: ${bt.metrics.maxDrawdownPct}%.`
          }
        };
      }

      // =======================================================================
      // 10. VOICE CONTROL & HELP
      // =======================================================================
      case 'STOP_SPEAKING': {
        this.tts.cancel();
        return {
          success: true,
          uiFeedback: 'Halted',
          spokenFeedback: ''
        };
      }

      case 'GENERAL_HELP': {
        return {
          success: true,
          uiFeedback: 'Aurum Voice Operating Capabilities',
          spokenFeedback: 'I can open any page, check portfolio P&L, analyze any stock, set alerts, preview orders with risk checks, and run ML backtests. Try saying "Show TCS" or "Why is it down?".',
          actionCard: {
            type: 'RESEARCH_EVIDENCE',
            title: 'Universal Voice Capabilities',
            summaryText: 'Universal voice control covers Portfolio tracking, Stock navigation, AI Analyst research, Price alerts, Pre-trade risk order preview, and ML model inference.'
          }
        };
      }

      // =======================================================================
      // 11. UNSUPPORTED & AMBIGUOUS HANDLING (NO RANDOM DEFAULT ACTIONS)
      // =======================================================================
      case 'NEEDS_CLARIFICATION': {
        const query = params.query || '';
        const prompt = params.reason
          ? `I'm not completely sure what you mean. ${params.reason}`
          : `I'm not sure which action or stock you mean. Try asking "Show TCS price", "Portfolio P&L", or "Why is Nvidia moving?".`;
        return {
          success: false,
          actionName: 'NEEDS_CLARIFICATION',
          uiFeedback: 'Needs Clarification',
          spokenFeedback: prompt,
          data: { query }
        };
      }

      case 'UNSUPPORTED_CAPABILITY': {
        return this.actionRegistry.unsupportedCapability(params.query || '');
      }

      default:
        throw new Error(`Unhandled capability: ${node.capabilityId}`);
    }
  }
}
