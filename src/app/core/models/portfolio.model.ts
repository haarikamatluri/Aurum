import { SeriesPoint } from './common.model';

export interface PortfolioSummary {
  totalValue: number;
  todayPnlAbs: number;
  todayPnlPct: number;
  totalReturnAbs: number;
  totalReturnPct: number;
  benchmarkTodayPct: number;
  benchmarkSymbol: string;
  riskScore: number;
  cashBalance: number;
  valueSparkline: SeriesPoint[];
}

export type AssetType = 'Equity' | 'ETF' | 'Cash' | 'Crypto' | 'Bond';

export interface Position {
  symbol: string;
  name: string;
  sector: string;
  assetType: AssetType;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  todayPnlAbs: number;
  todayPnlPct: number;
  totalPnlAbs: number;
  totalPnlPct: number;
  weightPct: number;
  riskContribution: number;
  targetWeightPct?: number;
}

export interface PerformancePoint {
  t: string;
  portfolioValue: number;
  portfolioReturnPct: number;
  benchmarkReturnPct: number;
}

export interface Contributor {
  symbol: string;
  name: string;
  contributionAbs: number;
  contributionPct: number;
}

export type AllocationDimension = 'sector' | 'stock' | 'assetType';

export interface AllocationSlice {
  key: string;
  label: string;
  valuePct: number;
  valueAbs: number;
  targetPct?: number;
  holdings?: string[];
}

export type TransactionAction = 'Buy' | 'Sell' | 'Dividend' | 'Transfer';

export interface Transaction {
  id: string;
  date: string;
  symbol: string;
  action: TransactionAction;
  quantity: number;
  price: number;
  fees: number;
  total: number;
  notes?: string;
}

export interface TransactionDraft {
  date: string;
  symbol: string;
  action: TransactionAction;
  quantity: number;
  price: number;
  fees: number;
  notes?: string;
}

export interface PortfolioMover {
  symbol: string;
  name: string;
  currentPrice: number;
  high52w: number;
  low52w: number;
  distanceFromHighPct: number;
  distanceFromLowPct: number;
  todayLow: number;
  todayHigh: number;
}
