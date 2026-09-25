import { Injectable, inject } from '@angular/core';
import { VoiceContextService } from './voice-context.service';
import { PortfolioService } from '../portfolio.service';
import { TradingService } from '../trading.service';

export interface ResolvedEntities {
  symbol?: string;
  secondarySymbol?: string;
  quantity?: number;
  price?: number;
  market?: 'ALL' | 'US' | 'IN';
  timeframe?: '1D' | '1W' | '1M' | '3M' | '1Y' | 'All';
  tab?: 'overview' | 'deep-dive' | 'evidence' | 'valuation' | 'catalysts';
  orderId?: string;
  side?: 'BUY' | 'SELL';
  action?: string;
  targetUIElement?: string;
  isContextual: boolean;
  isRepetition: boolean;
  inferredPreviousCapability?: string;
  ambiguityPrompt?: string;
}

export const EXTENSIVE_TICKER_MAP: Record<string, string> = {
  tcs: 'TCS',
  'tata consultancy': 'TCS',
  'tata consultancy services': 'TCS',
  tata: 'TCS',
  reliance: 'RELIANCE',
  ril: 'RELIANCE',
  'reliance industries': 'RELIANCE',
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
  alphabet: 'GOOGL',
  amzn: 'AMZN',
  amazon: 'AMZN',
  meta: 'META',
  facebook: 'META',
  tsla: 'TSLA',
  tesla: 'TSLA',
  hdfc: 'HDFCBANK',
  'hdfc bank': 'HDFCBANK',
  icici: 'ICICIBANK',
  'icici bank': 'ICICIBANK',
  tatamotors: 'TATAMOTORS',
  'tata motors': 'TATAMOTORS',
  wipro: 'WIPRO',
  sbin: 'SBIN',
  sbi: 'SBIN',
  'state bank': 'SBIN',
  'state bank of india': 'SBIN',
  itc: 'ITC',
  amd: 'AMD',
  pltr: 'PLTR',
  palantir: 'PLTR',
  nifty: 'NIFTY50',
  'nifty 50': 'NIFTY50',
  sensex: 'SENSEX',
  spy: 'SPY'
};

@Injectable({
  providedIn: 'root'
})
export class EntityResolverService {
  private readonly contextService = inject(VoiceContextService);
  private readonly portfolioService = inject(PortfolioService);
  private readonly tradingService = inject(TradingService);

  resolveEntities(text: string): ResolvedEntities {
    const raw = text.trim();
    const lower = raw.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ').replace(/\s+/g, ' ');
    const context = this.contextService.getSnapshot();

    let isContextual = false;
    let isRepetition = false;
    let inferredPreviousCapability: string | undefined;
    const detectedSymbols: string[] = [];

    // 1. Repetition detection ("Do the same thing for Infosys", "Do the same for INFY", "Same for TCS")
    const repetitionMatch = lower.match(/(?:do\s+the\s+same(?:\s+thing)?\s+(?:for|to|with)|same\s+for)\s+([a-zA-Z\s]+)/i);
    if (repetitionMatch) {
      isRepetition = true;
      inferredPreviousCapability = context.lastCapability || 'OPEN_STOCK';
    }

    // 2. Direct dictionary matching
    for (const [key, sym] of Object.entries(EXTENSIVE_TICKER_MAP)) {
      const reg = new RegExp(`\\b${key}\\b`, 'i');
      if (reg.test(lower)) {
        if (!detectedSymbols.includes(sym)) detectedSymbols.push(sym);
      }
    }

    // 3. Standalone uppercase ticker match (e.g. TCS, AAPL, NVDA, INFY)
    const upperWords = raw.split(/\s+/).map((w) => w.replace(/[^A-Za-z]/g, ''));
    for (const w of upperWords) {
      if (w.length >= 2 && w.length <= 5 && w === w.toUpperCase() && !['AND', 'THE', 'FOR', 'ALL', 'BUY', 'NOT'].includes(w)) {
        if (!detectedSymbols.includes(w)) detectedSymbols.push(w);
      }
    }

    let symbol: string | undefined = detectedSymbols[0];
    let secondarySymbol: string | undefined = detectedSymbols[1];

    // 4. Comparative resolution: "Compare it with Infosys", "Compare TCS and INFY"
    if (/\bcompare\s+(?:it|that|this|the stock|the company)\s+(?:with|to|against)\b/i.test(lower) && context.currentSymbol) {
      secondarySymbol = detectedSymbols[0];
      symbol = context.currentSymbol;
      isContextual = true;
    }

    // 5. Contextual pronouns ("it", "that", "this", "the stock", "the company", "that one", "previous one")
    if (!symbol && (
      /\b(it|that|this|this stock|that stock|the stock|the company|that one|the previous one|current stock|previous stock)\b/i.test(lower) ||
      /\b(ml prediction|model prediction|how confident|run backtest|backtest it|strategy|why is it|why did it)\b/i.test(lower)
    )) {
      symbol = context.currentSymbol || undefined;
      isContextual = true;
    }

    // 6. Relative reference resolution ("biggest loser", "stock that lost the most", "top mover", "biggest winner")
    if (!symbol && /\b(biggest loser|stock that lost the most|worst stock|top decliner|what's hurting|hurting my portfolio|losing positions)\b/i.test(lower)) {
      const loser = context.currentPortfolio?.biggestLoser || context.portfolio?.biggestLoser;
      if (loser) {
        symbol = loser.symbol;
        isContextual = true;
      }
    } else if (!symbol && /\b(top mover|biggest winner|best stock|highest gainer|leading position)\b/i.test(lower)) {
      const top = context.currentPortfolio?.topMover || context.portfolio?.topMover;
      if (top) {
        symbol = top.symbol;
        isContextual = true;
      }
    }

    // 7. Contextual destination ("Take me there", "Go there", "Open it")
    if (!symbol && /\b(take me there|go there|open it)\b/i.test(lower)) {
      symbol = context.currentSymbol || undefined;
      isContextual = true;
    }

    // 8. Quantity extraction (handles "Buy 2 TCS", "Sell 5 NVDA", "invest in 10 units")
    let quantity: number | undefined;
    const qtyMatch = lower.match(/\b(?:buy|sell|purchase|invest\s+in|order)?\s*(\d+)\s*(?:shares?|units?|stocks?|lots?)?\b/i);
    if (qtyMatch) {
      const candidate = parseInt(qtyMatch[1], 10);
      const isPrice = new RegExp(`(?:at|price|target|above|below|crosses|level)\\s*[$₹]?\\s*${candidate}`, 'i').test(lower);
      const isTimeframe = new RegExp(`${candidate}\\s*(?:d|w|m|y|month|day|year|week)`, 'i').test(lower);
      if (!isPrice && !isTimeframe && candidate > 0) {
        quantity = candidate;
      }
    }

    // 9. Price extraction ("at 4000", "crosses 4000", "drops below 160", "target 2500")
    let price: number | undefined;
    const priceMatch = lower.match(/(?:at|price|target|above|below|crosses|level)\s*[$₹]?\s*(\d+(?:\.\d+)?)/i);
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
    }

    // 10. Side extraction (BUY or SELL)
    let side: 'BUY' | 'SELL' | undefined;
    if (/\b(buy|purchase|acquire|invest in)\b/i.test(lower)) side = 'BUY';
    else if (/\b(sell|exit|liquidate|dispose)\b/i.test(lower)) side = 'SELL';

    // 11. Market filter resolution
    let market: 'ALL' | 'US' | 'IN' | undefined;
    if (/\b(us stocks?|american stocks?|nasdaq|nyse|united states|us market)\b/i.test(lower)) market = 'US';
    else if (/\b(indian stocks?|india|nse|bse|rupee|indian market)\b/i.test(lower)) market = 'IN';
    else if (/\b(all markets?|global markets?|everything)\b/i.test(lower)) market = 'ALL';

    // 12. Timeframe resolution ("last three months", "3m", "1 year", "monthly", etc.)
    let timeframe: '1D' | '1W' | '1M' | '3M' | '1Y' | 'All' | undefined;
    if (/\b(1d|1 day|one day|today|daily)\b/i.test(lower)) timeframe = '1D';
    else if (/\b(1w|1 week|one week|weekly)\b/i.test(lower)) timeframe = '1W';
    else if (/\b(1m|1 month|one month|monthly)\b/i.test(lower)) timeframe = '1M';
    else if (/\b(3m|3 months?|three months?|last three months|quarter)\b/i.test(lower)) timeframe = '3M';
    else if (/\b(1y|1 year|one year|annual|yearly)\b/i.test(lower)) timeframe = '1Y';
    else if (/\b(all time|max|entire history)\b/i.test(lower)) timeframe = 'All';

    // 13. UI tab resolution
    let tab: 'overview' | 'deep-dive' | 'evidence' | 'valuation' | 'catalysts' | undefined;
    if (/\b(deep dive|in-depth|technical analysis)\b/i.test(lower)) tab = 'deep-dive';
    else if (/\b(evidence|sources|claims|proof|citations)\b/i.test(lower)) tab = 'evidence';
    else if (/\b(valuation|pe ratio|fair value|multiples|metrics)\b/i.test(lower)) tab = 'valuation';
    else if (/\b(catalysts|events|earnings|news catalysts)\b/i.test(lower)) tab = 'catalysts';
    else if (/\b(overview|summary)\b/i.test(lower)) tab = 'overview';

    // 14. UI element reference extraction ("this chart", "the table", "that alert", "the sidebar")
    let targetUIElement: string | undefined;
    if (/\b(chart|graph)\b/i.test(lower)) targetUIElement = 'CHART';
    else if (/\b(table|holdings table)\b/i.test(lower)) targetUIElement = 'TABLE';
    else if (/\b(alert|notification)\b/i.test(lower)) targetUIElement = 'ALERT';
    else if (/\b(sidebar|details panel)\b/i.test(lower)) targetUIElement = 'DETAILS';

    // 15. Ambiguity checks (Financial safety)
    let ambiguityPrompt: string | undefined;

    // Check A: "Cancel my order" when multiple open orders exist
    if (/\bcancel\s+(?:my\s+|the\s+)?(?:pending\s+)?order\b/i.test(lower)) {
      const pendingOrders = this.tradingService.orders().filter((o) => o.status === 'OPEN' || o.status === 'SUBMITTED');
      if (pendingOrders.length > 1 && !symbol) {
        const orderSymbols = Array.from(new Set(pendingOrders.map((o) => o.symbol))).join(', ');
        ambiguityPrompt = `You have active orders for ${orderSymbols}. Which one should I cancel?`;
      } else if (pendingOrders.length === 1 && !symbol) {
        symbol = pendingOrders[0].symbol;
      }
    }

    // Check B: "Buy some TCS" or "Buy TCS" without quantity
    if (side && symbol && !quantity && /\b(some|a few|shares)\b/i.test(lower)) {
      ambiguityPrompt = `How many ${symbol} shares would you like to ${side.toLowerCase()}?`;
    }

    // Check C: "Set an alert for TCS" without price
    if (/\b(set an alert|create an alert|alert me for)\b/i.test(lower) && symbol && !price) {
      ambiguityPrompt = `What price should trigger the alert for ${symbol}?`;
    }

    return {
      symbol,
      secondarySymbol,
      quantity,
      price,
      market,
      timeframe,
      tab,
      side,
      targetUIElement,
      isContextual,
      isRepetition,
      inferredPreviousCapability,
      ambiguityPrompt
    };
  }
}
