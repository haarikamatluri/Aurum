import { Injectable, signal, computed } from '@angular/core';
import {
  Holding,
  StockTransaction,
  PortfolioSummary,
  AddHoldingRequest,
  StockSearchResult,
  MarketRegion,
} from '../models/portfolio.model';

const STORAGE_KEY_HOLDINGS = 'money.holdings';
const STORAGE_KEY_TRANSACTIONS = 'money.transactions';

// ============================================================================
// Curated Stocks Database (US & Indian Markets) - Instant offline autocomplete
// ============================================================================
const US_STOCKS: StockSearchResult[] = [
  { symbol: 'AAPL', companyName: 'Apple Inc.', exchange: 'NASDAQ', market: 'US', currency: 'USD' },
  { symbol: 'MSFT', companyName: 'Microsoft Corporation', exchange: 'NASDAQ', market: 'US', currency: 'USD' },
  { symbol: 'NVDA', companyName: 'NVIDIA Corporation', exchange: 'NASDAQ', market: 'US', currency: 'USD' },
  { symbol: 'GOOGL', companyName: 'Alphabet Inc.', exchange: 'NASDAQ', market: 'US', currency: 'USD' },
  { symbol: 'AMZN', companyName: 'Amazon.com Inc.', exchange: 'NASDAQ', market: 'US', currency: 'USD' },
  { symbol: 'META', companyName: 'Meta Platforms Inc.', exchange: 'NASDAQ', market: 'US', currency: 'USD' },
  { symbol: 'TSLA', companyName: 'Tesla Inc.', exchange: 'NASDAQ', market: 'US', currency: 'USD' },
  { symbol: 'BRK.B', companyName: 'Berkshire Hathaway Inc.', exchange: 'NYSE', market: 'US', currency: 'USD' },
  { symbol: 'JPM', companyName: 'JPMorgan Chase & Co.', exchange: 'NYSE', market: 'US', currency: 'USD' },
  { symbol: 'V', companyName: 'Visa Inc.', exchange: 'NYSE', market: 'US', currency: 'USD' },
  { symbol: 'JNJ', companyName: 'Johnson & Johnson', exchange: 'NYSE', market: 'US', currency: 'USD' },
  { symbol: 'WMT', companyName: 'Walmart Inc.', exchange: 'NYSE', market: 'US', currency: 'USD' },
  { symbol: 'MA', companyName: 'Mastercard Incorporated', exchange: 'NYSE', market: 'US', currency: 'USD' },
  { symbol: 'NFLX', companyName: 'Netflix Inc.', exchange: 'NASDAQ', market: 'US', currency: 'USD' },
  { symbol: 'AMD', companyName: 'Advanced Micro Devices Inc.', exchange: 'NASDAQ', market: 'US', currency: 'USD' },
  { symbol: 'CRM', companyName: 'Salesforce Inc.', exchange: 'NYSE', market: 'US', currency: 'USD' },
  { symbol: 'ADBE', companyName: 'Adobe Inc.', exchange: 'NASDAQ', market: 'US', currency: 'USD' },
  { symbol: 'COST', companyName: 'Costco Wholesale Corporation', exchange: 'NASDAQ', market: 'US', currency: 'USD' },
  { symbol: 'ORCL', companyName: 'Oracle Corporation', exchange: 'NYSE', market: 'US', currency: 'USD' },
  { symbol: 'PLTR', companyName: 'Palantir Technologies Inc.', exchange: 'NYSE', market: 'US', currency: 'USD' },
  { symbol: 'AVGO', companyName: 'Broadcom Inc.', exchange: 'NASDAQ', market: 'US', currency: 'USD' },
  { symbol: 'UBER', companyName: 'Uber Technologies Inc.', exchange: 'NYSE', market: 'US', currency: 'USD' },
  { symbol: 'DIS', companyName: 'The Walt Disney Company', exchange: 'NYSE', market: 'US', currency: 'USD' },
  { symbol: 'INTC', companyName: 'Intel Corporation', exchange: 'NASDAQ', market: 'US', currency: 'USD' },
  { symbol: 'QCOM', companyName: 'QUALCOMM Incorporated', exchange: 'NASDAQ', market: 'US', currency: 'USD' },
  { symbol: 'COIN', companyName: 'Coinbase Global Inc.', exchange: 'NASDAQ', market: 'US', currency: 'USD' },
];

const INDIA_STOCKS: StockSearchResult[] = [
  // Nifty 50 Heavyweights
  { symbol: 'RELIANCE', companyName: 'Reliance Industries Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'TCS', companyName: 'Tata Consultancy Services Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'HDFCBANK', companyName: 'HDFC Bank Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'INFY', companyName: 'Infosys Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'ICICIBANK', companyName: 'ICICI Bank Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'BHARTIARTL', companyName: 'Bharti Airtel Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'SBIN', companyName: 'State Bank of India', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'ITC', companyName: 'ITC Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'LT', companyName: 'Larsen & Toubro Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'TATAMOTORS', companyName: 'Tata Motors Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'WIPRO', companyName: 'Wipro Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'BAJFINANCE', companyName: 'Bajaj Finance Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'KOTAKBANK', companyName: 'Kotak Mahindra Bank Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'MARUTI', companyName: 'Maruti Suzuki India Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'ASIANPAINT', companyName: 'Asian Paints Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'TITAN', companyName: 'Titan Company Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'SUNPHARMA', companyName: 'Sun Pharmaceutical Industries Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'HINDUNILVR', companyName: 'Hindustan Unilever Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'AXISBANK', companyName: 'Axis Bank Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'NTPC', companyName: 'NTPC Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'ONGC', companyName: 'Oil & Natural Gas Corporation Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'POWERGRID', companyName: 'Power Grid Corporation of India Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'TECHM', companyName: 'Tech Mahindra Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'HCLTECH', companyName: 'HCL Technologies Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'BAJAJFINSV', companyName: 'Bajaj Finserv Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'NESTLEIND', companyName: 'Nestle India Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'ULTRACEMCO', companyName: 'UltraTech Cement Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'GRASIM', companyName: 'Grasim Industries Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'JSWSTEEL', companyName: 'JSW Steel Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'TATASTEEL', companyName: 'Tata Steel Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'ADANIENT', companyName: 'Adani Enterprises Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'ADANIPORTS', companyName: 'Adani Ports and Special Economic Zone Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'COALINDIA', companyName: 'Coal India Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'TATACONSUM', companyName: 'Tata Consumer Products Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'DRREDDY', companyName: 'Dr. Reddys Laboratories Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'CIPLA', companyName: 'Cipla Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'APOLLOHOSP', companyName: 'Apollo Hospitals Enterprise Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'EICHERMOT', companyName: 'Eicher Motors Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'HEROMOTOCO', companyName: 'Hero MotoCorp Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'DIVISLAB', companyName: 'Divis Laboratories Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'BPCL', companyName: 'Bharat Petroleum Corp Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'IOC', companyName: 'Indian Oil Corporation Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'SBILIFE', companyName: 'SBI Life Insurance Company Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'HDFCLIFE', companyName: 'HDFC Life Insurance Co Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },

  // High Growth, Defense, Railway, PSU, Energy & New Age
  { symbol: 'TATAPOWER', companyName: 'Tata Power Company Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'HAL', companyName: 'Hindustan Aeronautics Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'BEL', companyName: 'Bharat Electronics Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'IRFC', companyName: 'Indian Railway Finance Corp Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'RVNL', companyName: 'Rail Vikas Nigam Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'MAZDOCK', companyName: 'Mazagon Dock Shipbuilders Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'SUZLON', companyName: 'Suzlon Energy Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'BHEL', companyName: 'Bharat Heavy Electricals Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'VEDL', companyName: 'Vedanta Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'PAYTM', companyName: 'One 97 Communications (Paytm)', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'ZOMATO', companyName: 'Zomato Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'JIOFIN', companyName: 'Jio Financial Services Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'CDSL', companyName: 'Central Depository Services Ltd', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'BSE', companyName: 'BSE Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'TRENT', companyName: 'Trent Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'YESBANK', companyName: 'Yes Bank Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'IREDA', companyName: 'Indian Renewable Energy Dev Agency', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'NHPC', companyName: 'NHPC Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'SJVN', companyName: 'SJVN Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'GAIL', companyName: 'GAIL (India) Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'POLYCAB', companyName: 'Polycab India Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'HAVELLS', companyName: 'Havells India Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'ADANIPOWER', companyName: 'Adani Power Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'ADANIGREEN', companyName: 'Adani Green Energy Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'NYKAA', companyName: 'FSN E-Commerce Ventures (Nykaa)', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'DMART', companyName: 'Avenue Supermarts (DMart)', exchange: 'NSE', market: 'IN', currency: 'INR' },
  { symbol: 'AEQUS', companyName: 'Aequs Limited', exchange: 'NSE', market: 'IN', currency: 'INR' },
];

const ALL_STOCKS = [...US_STOCKS, ...INDIA_STOCKS];

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private readonly _holdings = signal<Holding[]>(this.loadHoldings());
  private readonly _transactions = signal<StockTransaction[]>(this.loadTransactions());

  readonly holdings = this._holdings.asReadonly();

  constructor() {
    this.syncFromDatabase();
  }

  /**
   * Asynchronously sync portfolio data from MongoDB backend
   */
  async syncFromDatabase(): Promise<void> {
    try {
      const [holdingsRes, txsRes] = await Promise.all([
        fetch('/api/portfolio/holdings'),
        fetch('/api/portfolio/transactions'),
      ]);

      if (holdingsRes.ok) {
        const data = await holdingsRes.json();
        const serverHoldings: Holding[] = data.holdings || [];
        if (serverHoldings.length > 0 || (this._holdings().length === 0)) {
          this._holdings.set(serverHoldings);
          this.saveHoldings();
        }
      }

      if (txsRes.ok) {
        const txData = await txsRes.json();
        const serverTxs: StockTransaction[] = txData.transactions || [];
        if (serverTxs.length > 0 || (this._transactions().length === 0)) {
          this._transactions.set(serverTxs);
          this.saveTransactions();
        }
      }
    } catch {
      // offline / local mode fallback
    }
  }

  /** Synchronous local fast-search across curated stocks */
  searchStocks(query: string, marketFilter?: MarketRegion): StockSearchResult[] {
    if (!query || query.trim().length < 1) return [];
    const q = query.trim().toUpperCase();
    const pool = marketFilter
      ? marketFilter === 'IN' ? INDIA_STOCKS : US_STOCKS
      : ALL_STOCKS;

    return pool.filter(
      (s) =>
        s.symbol.startsWith(q) ||
        s.symbol.includes(q) ||
        s.companyName.toUpperCase().includes(q)
    ).slice(0, 10);
  }

  /** Remote live search querying live market ticker databases (NSE/BSE & US) */
  async searchStocksRemote(query: string, marketFilter?: MarketRegion): Promise<StockSearchResult[]> {
    if (!query || query.trim().length < 1) return [];
    const q = query.trim();
    const market = marketFilter || 'IN';

    try {
      const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}&market=${market}`);
      if (res.ok) {
        const data = await res.json();
        const results: StockSearchResult[] = data.results || [];
        if (results.length > 0) {
          return results;
        }
      }
    } catch {
      // fallback to local search on network failure
    }

    return this.searchStocks(q, marketFilter);
  }

  /** Compute portfolio summary for a specific market filter or global. */
  getSummaryForMarket(market?: MarketRegion | 'ALL'): PortfolioSummary {
    const all = this._holdings();
    const h = (!market || market === 'ALL')
      ? all
      : all.filter((x) => x.market === market);

    const totalInvested = h.reduce((s, x) => s + x.totalInvested, 0);
    const hasCurrentPrices = h.length > 0 && h.every((x) => x.currentPrice !== null);
    const currentValue = hasCurrentPrices
      ? h.reduce((s, x) => s + (x.currentValue ?? 0), 0)
      : null;
    const totalGain = currentValue !== null ? currentValue - totalInvested : null;
    const totalGainPct = (totalGain !== null && totalInvested > 0)
      ? (totalGain / totalInvested) * 100
      : null;

    const currency = market === 'IN' ? 'INR' : 'USD';

    return {
      totalInvested,
      currentValue,
      totalGain,
      totalGainPct,
      holdingCount: h.length,
      currency,
    };
  }

  /**
   * Add a stock position. Persists to MongoDB backend and updates local signals.
   */
  addHolding(req: AddHoldingRequest): Holding {
    const now = new Date().toISOString();
    const existing = this.getHoldingBySymbol(req.symbol);
    const txId = `tx-${Date.now()}`;

    let resultHolding: Holding;

    if (existing) {
      const newTotalShares = existing.shares + req.shares;
      const newTotalInvested = existing.totalInvested + req.shares * req.purchasePrice;
      const newAvgPrice = newTotalInvested / newTotalShares;

      const updated: Holding = {
        ...existing,
        shares: newTotalShares,
        avgPurchasePrice: newAvgPrice,
        totalInvested: newTotalInvested,
        currentValue: existing.currentPrice ? newTotalShares * existing.currentPrice : null,
        profitLoss: existing.currentPrice ? (newTotalShares * existing.currentPrice) - newTotalInvested : null,
        profitLossPct: existing.currentPrice ? ((existing.currentPrice - newAvgPrice) / newAvgPrice) * 100 : null,
        updatedAt: now,
      };

      this._holdings.update((hs) => hs.map((h) => (h.id === existing.id ? updated : h)));
      this.saveHoldings();

      const tx: StockTransaction = {
        id: txId, holdingId: existing.id, type: 'BUY',
        shares: req.shares, price: req.purchasePrice,
        currency: req.currency,
        date: req.purchaseDate ?? now.split('T')[0], createdAt: now,
      };
      this._transactions.update((ts) => [tx, ...ts]);
      this.saveTransactions();

      resultHolding = updated;
    } else {
      const id = `holding-${Date.now()}`;
      const newHolding: Holding = {
        id,
        symbol: req.symbol.toUpperCase(),
        companyName: req.companyName,
        exchange: req.exchange,
        market: req.market,
        currency: req.currency,
        shares: req.shares,
        avgPurchasePrice: req.purchasePrice,
        totalInvested: req.shares * req.purchasePrice,
        currentPrice: null,
        currentValue: null,
        profitLoss: null,
        profitLossPct: null,
        addedAt: now,
        updatedAt: now,
      };

      this._holdings.update((hs) => [newHolding, ...hs]);
      this.saveHoldings();

      const tx: StockTransaction = {
        id: txId, holdingId: id, type: 'BUY',
        shares: req.shares, price: req.purchasePrice,
        currency: req.currency,
        date: req.purchaseDate ?? now.split('T')[0], createdAt: now,
      };
      this._transactions.update((ts) => [tx, ...ts]);
      this.saveTransactions();

      resultHolding = newHolding;
    }

    // Asynchronously save to MongoDB database
    fetch('/api/portfolio/holdings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }).catch((err) => {
      console.warn('[PortfolioService] Could not persist to MongoDB backend:', err.message);
    });

    return resultHolding;
  }

  /** Delete a holding and all associated transactions. */
  deleteHolding(holdingId: string): void {
    this._holdings.update((hs) => hs.filter((h) => h.id !== holdingId));
    this._transactions.update((ts) => ts.filter((t) => t.holdingId !== holdingId));
    this.saveHoldings();
    this.saveTransactions();

    // Asynchronously delete from MongoDB database
    fetch(`/api/portfolio/holdings/${encodeURIComponent(holdingId)}`, {
      method: 'DELETE',
    }).catch((err) => {
      console.warn('[PortfolioService] Could not delete from MongoDB backend:', err.message);
    });
  }

  /**
   * Update current price for a holding.
   */
  updatePrice(symbol: string, currentPrice: number): void {
    this._holdings.update((hs) =>
      hs.map((h) => {
        if (h.symbol !== symbol) return h;
        const currentValue = h.shares * currentPrice;
        const profitLoss = currentValue - h.totalInvested;
        const profitLossPct = ((currentPrice - h.avgPurchasePrice) / h.avgPurchasePrice) * 100;
        return { ...h, currentPrice, currentValue, profitLoss, profitLossPct, updatedAt: new Date().toISOString() };
      })
    );
    this.saveHoldings();
  }

  getHoldingById(id: string): Holding | undefined {
    return this._holdings().find((h) => h.id === id);
  }

  getHoldingBySymbol(symbol: string): Holding | undefined {
    return this._holdings().find((h) => h.symbol === symbol.toUpperCase());
  }

  getTransactionsForHolding(holdingId: string): StockTransaction[] {
    return this._transactions().filter((t) => t.holdingId === holdingId);
  }

  // ---- persistence ----
  private loadHoldings(): Holding[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HOLDINGS);
      const holdings: Holding[] = raw ? JSON.parse(raw) : [];
      return holdings.map((h) => ({
        ...h,
        market: h.market || (h.exchange === 'NSE' || h.exchange === 'BSE' ? 'IN' : 'US'),
        currency: h.currency || (h.exchange === 'NSE' || h.exchange === 'BSE' ? 'INR' : 'USD'),
      }));
    } catch { return []; }
  }

  private saveHoldings(): void {
    try { localStorage.setItem(STORAGE_KEY_HOLDINGS, JSON.stringify(this._holdings())); } catch { /* ignore */ }
  }

  private loadTransactions(): StockTransaction[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
      const txs: StockTransaction[] = raw ? JSON.parse(raw) : [];
      return txs.map((t) => ({
        ...t,
        currency: t.currency || 'USD',
      }));
    } catch { return []; }
  }

  private saveTransactions(): void {
    try { localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(this._transactions())); } catch { /* ignore */ }
  }
}
