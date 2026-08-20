import { Injectable, inject, signal } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';
import {
  AiInsight,
  AiMode,
  ChatMessage,
  Conversation,
} from '../models/ai.model';
import { MarketEngine } from '../mock/market-engine';
import { HOLDINGS, CASH_BALANCE } from '../mock/portfolio.mock';
import { getSecurity, SECURITIES } from '../mock/securities.data';
import { RiskService } from './risk.service';

const THINKING_DELAY = 900;

export const SUGGESTED_QUESTIONS: Record<AiMode, string[]> = {
  market: ["What's happening in the market today?", 'What changed since yesterday?', 'What should I watch today?', 'How are semiconductors trading?'],
  portfolio: ['Why is my portfolio down today?', 'What are my biggest risks?', 'What changed since yesterday?', 'What should I watch today?'],
  stock: ['Analyze NVDA', 'Compare NVDA with AMD', 'What is driving TSLA today?', 'Is AAPL overbought?'],
  risk: ['What are my biggest risks?', 'How concentrated is my portfolio?', 'What happens if tech sells off 15%?', 'Is my drawdown within tolerance?'],
  scenario: ['What happens if NVDA falls 10%?', 'Model a market correction', 'What if I sell half my TSLA?', 'How would a rate shock affect me?'],
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Conversational AI orchestrator. In production this calls POST /api/ai/chat, which fronts
 * an LLM orchestrator that itself calls the portfolio/market/risk/prediction services. Here
 * the same "tool calls" are simulated locally against MarketEngine so responses stay
 * consistent with the rest of the (mock) app.
 */
@Injectable({ providedIn: 'root' })
export class AiAnalystService {
  private readonly engine = inject(MarketEngine);
  private readonly riskService = inject(RiskService);

  private readonly conversationsSignal = signal<Conversation[]>(this.seedConversations());
  readonly conversations = this.conversationsSignal.asReadonly();

  private readonly insightsSignal = signal<AiInsight[]>([
    {
      id: 'insight-1',
      title: 'Technology exposure has drifted upward',
      body: 'Your technology exposure increased from 48% to 54% over the past 30 days, primarily due to NVDA appreciation. This is now 12 points above your target allocation.',
      timestamp: nowIso(),
      dismissed: false,
    },
  ]);
  readonly insights = this.insightsSignal.asReadonly();

  dismissInsight(id: string): void {
    this.insightsSignal.update((list) => list.map((i) => (i.id === id ? { ...i, dismissed: true } : i)));
  }

  private seedConversations(): Conversation[] {
    const yesterday = new Date(Date.now() - 26 * 3_600_000).toISOString();
    const older = new Date(Date.now() - 3 * 86_400_000).toISOString();
    return [
      {
        id: 'conv-yesterday',
        title: 'NVDA analysis',
        mode: 'stock',
        createdAt: yesterday,
        messages: [
          { id: uid(), role: 'user', text: 'Analyze NVDA', timestamp: yesterday },
          {
            id: uid(), role: 'assistant', timestamp: yesterday,
            text: 'NVDA closed higher on continued data-center demand strength. Momentum remains constructive but your position is now a significant share of total risk.',
            facts: [{ label: 'Sector', value: 'Technology · Semiconductors' }],
            modelSignals: [{ label: '5D positive-return probability', value: '61%', confidence: 'Medium' }],
          },
        ],
      },
      {
        id: 'conv-older',
        title: 'Market outlook',
        mode: 'market',
        createdAt: older,
        messages: [
          { id: uid(), role: 'user', text: 'What is the market outlook this week?', timestamp: older },
          {
            id: uid(), role: 'assistant', timestamp: older,
            text: 'Major indices traded in a narrow range with rate expectations as the dominant driver. Volatility (VIX) stayed subdued.',
          },
        ],
      },
    ];
  }

  getConversations(): Observable<Conversation[]> {
    return of(this.conversationsSignal()).pipe(delay(200));
  }

  startConversation(mode: AiMode): Conversation {
    const conv: Conversation = { id: `conv-${uid()}`, title: 'New conversation', mode, createdAt: nowIso(), messages: [] };
    this.conversationsSignal.update((list) => [conv, ...list]);
    return conv;
  }

  /** Records the user's message immediately, then resolves with the assistant's reply after a "thinking" delay. */
  sendMessage(conversationId: string, text: string, mode: AiMode, symbol?: string): Observable<ChatMessage> {
    const userMsg: ChatMessage = { id: uid(), role: 'user', text, timestamp: nowIso() };
    this.appendMessage(conversationId, userMsg);
    this.maybeRetitleConversation(conversationId, text);

    const reply = this.routeIntent(text, mode, symbol);
    return of(reply).pipe(
      delay(THINKING_DELAY),
      map((msg) => {
        this.appendMessage(conversationId, msg);
        return msg;
      }),
    );
  }

  private appendMessage(conversationId: string, msg: ChatMessage): void {
    this.conversationsSignal.update((list) =>
      list.map((c) => (c.id === conversationId ? { ...c, messages: [...c.messages, msg] } : c)),
    );
  }

  private maybeRetitleConversation(conversationId: string, firstText: string): void {
    this.conversationsSignal.update((list) =>
      list.map((c) => (c.id === conversationId && c.title === 'New conversation' ? { ...c, title: firstText.slice(0, 48) } : c)),
    );
  }

  // ---- Intent router -----------------------------------------------------

  private routeIntent(raw: string, mode: AiMode, contextSymbol?: string): ChatMessage {
    const text = raw.toLowerCase();
    const mentionedSymbol = contextSymbol ?? this.findSymbolMention(text);

    if (mentionedSymbol && (text.includes('analy') || text.includes('compare') || mode === 'stock')) {
      return this.stockAnalysisResponse(mentionedSymbol);
    }
    if (text.includes('risk') || mode === 'risk') {
      return this.riskResponse();
    }
    if ((text.includes('why') && (text.includes('down') || text.includes('up') || text.includes('red') || text.includes('green'))) || mode === 'portfolio') {
      return this.portfolioExplanationResponse();
    }
    if (text.includes('what if') || text.includes('scenario') || text.includes('fall') || text.includes('drop') || mode === 'scenario') {
      return this.scenarioPointerResponse(mentionedSymbol);
    }
    if (text.includes('market') || text.includes('happening') || text.includes('today') || mode === 'market') {
      return this.marketUpdateResponse();
    }
    if (mentionedSymbol) {
      return this.stockAnalysisResponse(mentionedSymbol);
    }
    return this.fallbackResponse();
  }

  private findSymbolMention(text: string): string | undefined {
    const upper = text.toUpperCase();
    return SECURITIES.find((s) => new RegExp(`\\b${s.symbol}\\b`).test(upper))?.symbol;
  }

  private portfolioTotal(): number {
    return HOLDINGS.reduce((s, h) => s + this.engine.quoteSnapshot(h.symbol).price * h.shares, 0) + CASH_BALANCE;
  }

  private stockAnalysisResponse(symbol: string): ChatMessage {
    const q = this.engine.quoteSnapshot(symbol);
    const sec = getSecurity(symbol);
    const holding = HOLDINGS.find((h) => h.symbol === symbol);
    const total = this.portfolioTotal();
    const weightPct = holding ? (q.price * holding.shares / total) * 100 : 0;
    const direction = q.changePct >= 0 ? 'up' : 'down';
    const probability = Math.max(35, Math.min(75, Math.round(58 + q.changePct * 3)));

    return {
      id: uid(),
      role: 'assistant',
      timestamp: nowIso(),
      text: `${symbol} is ${direction} ${Math.abs(q.changePct).toFixed(2)}% today at $${q.price.toFixed(2)}, trading within its recent range for the ${sec.industry.toLowerCase()} group.`,
      interpretation: holding
        ? `${symbol} makes up ${weightPct.toFixed(1)}% of your portfolio, so today's move contributed meaningfully to your daily P&L. Momentum looks ${direction === 'up' ? 'constructive' : 'soft'}, but concentration means additional exposure would raise portfolio-level risk.`
        : `${symbol} is not currently in your portfolio. Momentum looks ${direction === 'up' ? 'constructive' : 'soft'} relative to its 52-week range.`,
      facts: [
        { label: 'Price', value: `$${q.price.toFixed(2)}` },
        { label: 'Today’s change', value: `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%` },
        { label: '52W range', value: `$${q.low52w.toFixed(2)} – $${q.high52w.toFixed(2)}` },
      ],
      calculations: holding
        ? [{ label: 'Portfolio weight', value: `${weightPct.toFixed(1)}%`, formula: `(${symbol} market value) / (total portfolio value)` }]
        : undefined,
      modelSignals: [{ label: '5-day positive-return probability', value: `${probability}%`, confidence: 'Medium' }],
      stockCards: [
        { symbol, name: sec.name, price: q.price, changePct: q.changePct, portfolioWeightPct: holding ? weightPct : undefined, modelProbabilityPct: probability },
      ],
      portfolioImpact: holding
        ? { impactAbs: (q.price - q.prevClose) * holding.shares, impactPct: ((q.price - q.prevClose) * holding.shares / total) * 100, note: `Based on your ${holding.shares}-share position.` }
        : undefined,
      sources: [{ label: 'Market Data API', detail: `Simulated real-time quote for ${symbol}` }, { label: 'Prediction Engine', detail: 'Momentum-Volatility Ensemble v2.3 (mock)' }],
      suggestedFollowUps: [`What happens if ${symbol} falls another 10%?`, `Compare ${symbol} with its sector peers`, `How much of my portfolio is exposed to ${sec.sector}?`],
    };
  }

  private portfolioExplanationResponse(): ChatMessage {
    const positions = HOLDINGS.map((h) => {
      const q = this.engine.quoteSnapshot(h.symbol);
      return { symbol: h.symbol, name: getSecurity(h.symbol).name, pnl: (q.price - q.prevClose) * h.shares, pct: q.changePct };
    }).sort((a, b) => a.pnl - b.pnl);
    const total = this.portfolioTotal();
    const todayPnl = positions.reduce((s, p) => s + p.pnl, 0);
    const worst = positions[0];
    const best = positions[positions.length - 1];
    const spx = this.engine.allIndexSnapshots().find((i) => i.symbol === 'SPX');
    const direction = todayPnl >= 0 ? 'up' : 'down';

    return {
      id: uid(),
      role: 'assistant',
      timestamp: nowIso(),
      text: `Your portfolio is ${direction} $${Math.abs(todayPnl).toFixed(2)} (${((todayPnl / total) * 100).toFixed(2)}%) today.`,
      interpretation: `${worst.name} (${worst.symbol}) is your largest detractor, while ${best.name} (${best.symbol}) is your top contributor. Relative to the S&P 500's ${spx?.changePct.toFixed(2)}%, your portfolio is ${((todayPnl / total) * 100 - (spx?.changePct ?? 0) >= 0 ? 'outperforming' : 'underperforming')} the benchmark today, largely due to sector positioning.`,
      calculations: [
        { label: "Today's P&L", value: `${todayPnl >= 0 ? '+' : ''}$${todayPnl.toFixed(2)}`, formula: 'Sum of (price change × shares) across positions' },
        { label: 'vs. S&P 500', value: `${((todayPnl / total) * 100 - (spx?.changePct ?? 0)).toFixed(2)} pts`, formula: 'Portfolio return % − benchmark return %' },
      ],
      stockCards: [
        { symbol: worst.symbol, name: worst.name, price: this.engine.quoteSnapshot(worst.symbol).price, changePct: worst.pct },
        { symbol: best.symbol, name: best.name, price: this.engine.quoteSnapshot(best.symbol).price, changePct: best.pct },
      ],
      sources: [{ label: 'Portfolio Service', detail: 'Simulated position-level P&L attribution' }],
      suggestedFollowUps: ['What are my biggest risks?', `Why did ${worst.symbol} fall today?`, 'How does this compare to yesterday?'],
    };
  }

  private riskResponse(): ChatMessage {
    return {
      id: uid(),
      role: 'assistant',
      timestamp: nowIso(),
      text: 'Your overall portfolio risk score is 62/100 (Moderate-High), driven primarily by concentration and sector exposure.',
      interpretation: 'Concentration is your largest risk factor — your top 3 positions represent a disproportionate share of total risk. Reducing position size in your largest technology holding or adding diversifying sectors would lower overall portfolio risk the fastest.',
      facts: [
        { label: 'Concentration score', value: '78 / 100' },
        { label: 'Sector exposure score', value: '72 / 100' },
        { label: 'Max drawdown (trailing 12mo)', value: '-14.2%' },
      ],
      modelSignals: [{ label: 'Stress test: Technology selloff (-15%)', value: 'Portfolio impact ≈ -8.7%', confidence: 'Medium' }],
      sources: [{ label: 'Risk Service', detail: 'Simulated concentration, correlation & volatility scoring' }],
      suggestedFollowUps: ['What happens if tech sells off 15%?', 'How concentrated is my portfolio?', 'What should I watch today?'],
    };
  }

  private scenarioPointerResponse(symbol?: string): ChatMessage {
    const sym = symbol ?? 'NVDA';
    const q = this.engine.quoteSnapshot(sym);
    const holding = HOLDINGS.find((h) => h.symbol === sym);
    const total = this.portfolioTotal();
    const impact = holding ? (q.price * holding.shares * -0.1) / total * 100 : 0;
    return {
      id: uid(),
      role: 'assistant',
      timestamp: nowIso(),
      text: `If ${sym} fell 10% from today's price with other holdings unchanged, I estimate a portfolio impact of roughly ${impact.toFixed(2)}%.`,
      interpretation: 'This is a simplified point estimate. For a full interactive breakdown — including new position weight and estimated drawdown — open the Scenario Simulator.',
      calculations: holding ? [{ label: 'Estimated portfolio impact', value: `${impact.toFixed(2)}%`, formula: `(${sym} value × -10%) / total portfolio value` }] : undefined,
      modelSignals: [{ label: 'Expected volatility', value: q.beta > 1.5 ? 'High' : 'Moderate', confidence: 'Low' }],
      actions: [{ label: 'Open Scenario Simulator', kind: 'navigate', payload: '/scenarios' }],
      sources: [{ label: 'Scenario Engine', detail: 'Simplified beta-weighted impact estimate (mock)' }],
      suggestedFollowUps: [`Model a full market correction`, `What if I sell half my ${sym}?`, 'How would a rate shock affect me?'],
    };
  }

  private marketUpdateResponse(): ChatMessage {
    const indices = this.engine.allIndexSnapshots();
    const spx = indices.find((i) => i.symbol === 'SPX')!;
    const ndq = indices.find((i) => i.symbol === 'IXIC')!;
    const vix = indices.find((i) => i.symbol === 'VIX')!;
    return {
      id: uid(),
      role: 'assistant',
      timestamp: nowIso(),
      text: `The S&P 500 is ${spx.changePct >= 0 ? 'up' : 'down'} ${Math.abs(spx.changePct).toFixed(2)}% and the Nasdaq is ${ndq.changePct >= 0 ? 'up' : 'down'} ${Math.abs(ndq.changePct).toFixed(2)}% today.`,
      interpretation: `Volatility (VIX) is ${vix.changePct >= 0 ? 'higher' : 'lower'} at ${vix.value.toFixed(1)}, suggesting ${vix.changePct >= 0 ? 'elevated' : 'reduced'} near-term uncertainty. Technology and semiconductor names are leading breadth, which is consistent with the drivers behind your portfolio's move today.`,
      facts: [
        { label: 'S&P 500', value: `${spx.value.toFixed(2)} (${spx.changePct >= 0 ? '+' : ''}${spx.changePct.toFixed(2)}%)` },
        { label: 'NASDAQ', value: `${ndq.value.toFixed(2)} (${ndq.changePct >= 0 ? '+' : ''}${ndq.changePct.toFixed(2)}%)` },
        { label: 'VIX', value: `${vix.value.toFixed(2)} (${vix.changePct >= 0 ? '+' : ''}${vix.changePct.toFixed(2)}%)` },
      ],
      sources: [{ label: 'Market Data API', detail: 'Simulated index snapshot' }],
      suggestedFollowUps: ['Why is my portfolio down today?', 'What should I watch today?', 'Analyze NVDA'],
    };
  }

  private fallbackResponse(): ChatMessage {
    return {
      id: uid(),
      role: 'assistant',
      timestamp: nowIso(),
      text: "I can help with your portfolio, individual stocks, risk, or market conditions. Try asking something like “Why is my portfolio down today?” or “Analyze NVDA.”",
      suggestedFollowUps: SUGGESTED_QUESTIONS.portfolio,
    };
  }
}
