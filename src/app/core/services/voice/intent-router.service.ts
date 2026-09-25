import { Injectable, inject } from '@angular/core';
import { VoiceContextService } from './voice-context.service';

export type CommandIntent =
  | 'NAVIGATION'
  | 'STOCK_QUERY'
  | 'PORTFOLIO_QUERY'
  | 'NEWS_QUERY'
  | 'RESEARCH_QUERY'
  | 'WATCHLIST'
  | 'ALERT'
  | 'CHART'
  | 'BROKER'
  | 'ORDER_PREVIEW'
  | 'ORDER_CANCEL'
  | 'STRATEGY'
  | 'ML'
  | 'AUTOMATION'
  | 'PAPER_TRADING'
  | 'SETTINGS'
  | 'VOICE_CONTROL'
  | 'COMPARISON'
  | 'MARKET_QUERY'
  | 'GENERAL_QA';

export interface ParsedCommand {
  rawText: string;
  intent: CommandIntent;
  confidence: number;
  isDeterministicLocal: boolean;
  entities: {
    symbol?: string;
    secondarySymbol?: string;
    quantity?: number;
    price?: number;
    side?: 'BUY' | 'SELL';
    route?: string;
    action?: string;
    timeframe?: string;
  };
  contextSnapshot: any;
}

const COMMON_SYMBOLS_MAP: Record<string, string> = {
  tcs: 'TCS',
  'tata consultancy': 'TCS',
  reliance: 'RELIANCE',
  ril: 'RELIANCE',
  nvda: 'NVDA',
  nvidia: 'NVDA',
  aapl: 'AAPL',
  apple: 'AAPL',
  msft: 'MSFT',
  microsoft: 'MSFT',
  infy: 'INFY',
  infosys: 'INFY',
  googl: 'GOOGL',
  google: 'GOOGL',
  amzn: 'AMZN',
  amazon: 'AMZN',
  tsla: 'TSLA',
  tesla: 'TSLA',
  hdfc: 'HDFCBANK',
  'hdfc bank': 'HDFCBANK',
  icici: 'ICICIBANK',
  'icici bank': 'ICICIBANK',
  'tata motors': 'TATAMOTORS',
  tatamotors: 'TATAMOTORS',
  meta: 'META',
  facebook: 'META',
  amd: 'AMD',
  wipro: 'WIPRO',
  sbi: 'SBIN',
  'state bank': 'SBIN',
  itc: 'ITC',
  nifty: 'NIFTY50',
  sensex: 'SENSEX',
  spy: 'SPY'
};

@Injectable({
  providedIn: 'root'
})
export class IntentRouterService {
  private readonly contextService = inject(VoiceContextService);

  parseIntent(text: string): ParsedCommand {
    const raw = text.trim();
    const clean = raw.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ').replace(/\s+/g, ' ').trim();
    const lower = clean;
    const context = this.contextService.getSnapshot();

    // 1. VOICE CONTROL (Highest Priority Interruption / Control)
    if (/^(stop|shut up|be quiet|silence|cancel|pause|halt|terminate|stop speaking)$/i.test(lower)) {
      return {
        rawText: raw,
        intent: 'VOICE_CONTROL',
        confidence: 1.0,
        isDeterministicLocal: true,
        entities: { action: 'STOP' },
        contextSnapshot: context
      };
    }
    if (/^(resume|continue|unpause)$/i.test(lower)) {
      return {
        rawText: raw,
        intent: 'VOICE_CONTROL',
        confidence: 1.0,
        isDeterministicLocal: true,
        entities: { action: 'RESUME' },
        contextSnapshot: context
      };
    }
    if (/^(mute|unmute)$/i.test(lower)) {
      return {
        rawText: raw,
        intent: 'VOICE_CONTROL',
        confidence: 1.0,
        isDeterministicLocal: true,
        entities: { action: 'MUTE' },
        contextSnapshot: context
      };
    }
    if (lower === 'go back' || lower === 'navigate back' || lower === 'back') {
      return {
        rawText: raw,
        intent: 'NAVIGATION',
        confidence: 1.0,
        isDeterministicLocal: true,
        entities: { action: 'BACK' },
        contextSnapshot: context
      };
    }

    // 2. EXTRACT ENTITIES (Symbol, Quantities, Prices)
    const detectedSymbols: string[] = [];
    for (const [key, sym] of Object.entries(COMMON_SYMBOLS_MAP)) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(lower)) {
        if (!detectedSymbols.includes(sym)) detectedSymbols.push(sym);
      }
    }

    // Direct Ticker Regex match (e.g. 2-5 uppercase letters or word like TCS, NVDA)
    const tickerMatch = lower.match(/\b([a-z]{2,5})\b/g);
    if (tickerMatch) {
      for (const t of tickerMatch) {
        const upper = t.toUpperCase();
        if (['TCS', 'NVDA', 'AAPL', 'MSFT', 'INFY', 'AMZN', 'GOOGL', 'TSLA', 'META', 'AMD'].includes(upper)) {
          if (!detectedSymbols.includes(upper)) detectedSymbols.push(upper);
        }
      }
    }

    let primarySymbol = detectedSymbols[0] || null;
    const secondarySymbol = detectedSymbols[1] || null;

    // Pronoun resolution from context ("it", "that", "this stock", "the current stock")
    if (!primarySymbol && /\b(it|this|that|current stock|the company)\b/i.test(lower)) {
      primarySymbol = context.symbol;
    }

    // Extract quantity (e.g., "buy 2 TCS", "sell 10 shares")
    let quantity: number | undefined;
    const qtyMatch = lower.match(/\b(\d+)\s*(shares?|units?|stocks?|lots?)?\b/);
    if (qtyMatch && !lower.includes('at ' + qtyMatch[1])) {
      quantity = parseInt(qtyMatch[1], 10);
    }

    // Extract price threshold (e.g., "at 170", "below 3400", "above 2100.50")
    let price: number | undefined;
    const priceMatch = lower.match(/(?:at|above|below|target|price)\s*[$₹]?\s*(\d+(?:\.\d+)?)/i);
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
    }

    // 3. TRADING SAFETY: ORDER PREVIEWS (Never direct execution!)
    if (/\b(buy|purchase|invest in|acquire)\b/i.test(lower)) {
      return {
        rawText: raw,
        intent: 'ORDER_PREVIEW',
        confidence: 0.95,
        isDeterministicLocal: true,
        entities: {
          symbol: primarySymbol || context.symbol || 'TCS',
          quantity: quantity || 1,
          side: 'BUY'
        },
        contextSnapshot: context
      };
    }
    if (/\b(sell|exit position|liquidate)\b/i.test(lower)) {
      return {
        rawText: raw,
        intent: 'ORDER_PREVIEW',
        confidence: 0.95,
        isDeterministicLocal: true,
        entities: {
          symbol: primarySymbol || context.symbol || 'TCS',
          quantity: quantity || 1,
          side: 'SELL'
        },
        contextSnapshot: context
      };
    }
    if (/\b(cancel order|cancel pending|cancel that)\b/i.test(lower)) {
      return {
        rawText: raw,
        intent: 'ORDER_CANCEL',
        confidence: 0.9,
        isDeterministicLocal: true,
        entities: {
          symbol: primarySymbol || context.symbol || undefined
        },
        contextSnapshot: context
      };
    }

    // 4. AUTOMATION CONTROLS
    if (/\b(turn off automation|disable automation|stop automation|stop bot|stop auto trading)\b/i.test(lower)) {
      return {
        rawText: raw,
        intent: 'AUTOMATION',
        confidence: 0.98,
        isDeterministicLocal: true,
        entities: { action: 'DISABLE' },
        contextSnapshot: context
      };
    }
    if (/\b(turn on automation|enable automation|start automation|activate bot)\b/i.test(lower)) {
      return {
        rawText: raw,
        intent: 'AUTOMATION',
        confidence: 0.98,
        isDeterministicLocal: true,
        entities: { action: 'OPEN_MODAL' },
        contextSnapshot: context
      };
    }

    // 5. ALERT CREATION
    if (/\b(alert|set alert|notify me|price alert|set a price alert)\b/i.test(lower)) {
      return {
        rawText: raw,
        intent: 'ALERT',
        confidence: 0.95,
        isDeterministicLocal: true,
        entities: {
          symbol: primarySymbol || context.symbol || 'NVDA',
          price: price || 170
        },
        contextSnapshot: context
      };
    }

    // 6. COMPARISON QUERIES
    if (/\b(compare|versus|vs|how does .* compare)\b/i.test(lower)) {
      return {
        rawText: raw,
        intent: 'COMPARISON',
        confidence: 0.92,
        isDeterministicLocal: false,
        entities: {
          symbol: primarySymbol || context.symbol || 'TCS',
          secondarySymbol: secondarySymbol || (primarySymbol !== 'INFY' ? 'INFY' : 'NVDA')
        },
        contextSnapshot: context
      };
    }

    // 7. RESEARCH & DEEP WHY QUERIES
    if (/\b(why is|why are|what's driving|what is driving|what happened to|find why|news for|reasons for)\b/i.test(lower)) {
      return {
        rawText: raw,
        intent: 'RESEARCH_QUERY',
        confidence: 0.95,
        isDeterministicLocal: false,
        entities: {
          symbol: primarySymbol || context.symbol || 'TCS'
        },
        contextSnapshot: context
      };
    }

    // 8. PORTFOLIO QUERIES
    if (/\b(portfolio|my return|p&l|p\/l|profit|loss|biggest loser|top mover|hurting my portfolio|what's moving my portfolio|holdings)\b/i.test(lower)) {
      return {
        rawText: raw,
        intent: 'PORTFOLIO_QUERY',
        confidence: 0.95,
        isDeterministicLocal: true,
        entities: {
          action: lower.includes('loser') || lower.includes('hurting') ? 'BIGGEST_LOSER' : (lower.includes('top') || lower.includes('best') ? 'TOP_MOVER' : 'SUMMARY')
        },
        contextSnapshot: context
      };
    }

    // 9. MARKET OVERVIEW / GENERAL MARKET
    if (/\b(market doing|market summary|market brief|how is the market|market status|morning bell|indices)\b/i.test(lower)) {
      return {
        rawText: raw,
        intent: 'MARKET_QUERY',
        confidence: 0.92,
        isDeterministicLocal: false,
        entities: {},
        contextSnapshot: context
      };
    }

    // 10. STOCK LOOKUP / NAVIGATION
    if (/\b(show|open|inspect|chart|view|check price of|quote for)\b/i.test(lower) && primarySymbol) {
      return {
        rawText: raw,
        intent: 'STOCK_QUERY',
        confidence: 0.96,
        isDeterministicLocal: true,
        entities: {
          symbol: primarySymbol
        },
        contextSnapshot: context
      };
    }

    // 11. NAVIGATION TO MAIN VIEWS
    if (/\b(open|go to|show|view)\b/i.test(lower)) {
      if (lower.includes('dashboard') || lower.includes('home') || lower.includes('portfolio overview')) {
        return { rawText: raw, intent: 'NAVIGATION', confidence: 0.98, isDeterministicLocal: true, entities: { route: '/money' }, contextSnapshot: context };
      }
      if (lower.includes('analyst') || lower.includes('ai analyst') || lower.includes('research')) {
        return { rawText: raw, intent: 'NAVIGATION', confidence: 0.98, isDeterministicLocal: true, entities: { route: '/money/ai-analyst' }, contextSnapshot: context };
      }
      if (lower.includes('watchlist')) {
        return { rawText: raw, intent: 'WATCHLIST', confidence: 0.98, isDeterministicLocal: true, entities: { route: '/money' }, contextSnapshot: context };
      }
      if (lower.includes('notification') || lower.includes('alert')) {
        return { rawText: raw, intent: 'NAVIGATION', confidence: 0.98, isDeterministicLocal: true, entities: { route: '/money/notifications' }, contextSnapshot: context };
      }
      if (lower.includes('setting') || lower.includes('preferences')) {
        return { rawText: raw, intent: 'NAVIGATION', confidence: 0.98, isDeterministicLocal: true, entities: { route: '/money/settings' }, contextSnapshot: context };
      }
      if (lower.includes('broker') || lower.includes('zerodha') || lower.includes('webull')) {
        return { rawText: raw, intent: 'BROKER', confidence: 0.95, isDeterministicLocal: true, entities: { action: 'OPEN_SYNC' }, contextSnapshot: context };
      }
    }

    // 12. GENERAL QA / FALLBACK TO GEMINI
    return {
      rawText: raw,
      intent: 'GENERAL_QA',
      confidence: 0.7,
      isDeterministicLocal: false,
      entities: {
        symbol: primarySymbol || context.symbol || undefined
      },
      contextSnapshot: context
    };
  }
}
