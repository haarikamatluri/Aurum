// ============================================================================
// Money — Portfolio Domain Models
// Supports both US ($) and Indian (₹) Market Stocks
// ============================================================================

export type MarketRegion = 'US' | 'IN';
export type CurrencyCode = 'USD' | 'INR';

/** A single purchase transaction for a stock. */
export interface StockTransaction {
  id: string;
  holdingId: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  currency: CurrencyCode;
  date: string; // ISO date string
  createdAt: string;
}

/** A holding is a stock position in the user's portfolio. */
export interface Holding {
  id: string;
  symbol: string;
  companyName: string;
  exchange: string;
  market: MarketRegion;
  currency: CurrencyCode;
  shares: number;
  avgPurchasePrice: number;
  totalInvested: number;
  /** Current market price — null if API not yet connected. */
  currentPrice: number | null;
  currentValue: number | null;
  profitLoss: number | null;
  profitLossPct: number | null;
  addedAt: string;
  updatedAt: string;
}

/** Alert state for the 5% threshold engine — stored independently from portfolio performance. */
export interface AlertState {
  holdingId: string;
  symbol: string;
  market: MarketRegion;
  currency: CurrencyCode;
  referencePrice: number;       // The price thresholds are calculated against
  lastUpThreshold: number;      // Last upward threshold level fired (e.g. 5, 10, 15)
  lastDownThreshold: number;    // Last downward threshold level fired (e.g. -5, -10, -15)
  lastCheckedPrice: number | null;
  updatedAt: string;
}

/** Portfolio-level summary calculated from all holdings. */
export interface PortfolioSummary {
  totalInvested: number;
  currentValue: number | null;
  totalGain: number | null;
  totalGainPct: number | null;
  holdingCount: number;
  currency: CurrencyCode;
}

/** Used when adding a new stock. */
export interface AddHoldingRequest {
  symbol: string;
  companyName: string;
  exchange: string;
  market: MarketRegion;
  currency: CurrencyCode;
  shares: number;
  purchasePrice: number;
  purchaseDate?: string;
}

/** Used when searching for stocks in the add modal. */
export interface StockSearchResult {
  symbol: string;
  companyName: string;
  exchange: string;
  market: MarketRegion;
  currency: CurrencyCode;
}
