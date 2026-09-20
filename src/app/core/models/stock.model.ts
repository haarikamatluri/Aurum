import { Candle, Sentiment } from './common.model';

export interface StockProfile {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  description: string;
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  changeAbs: number;
  changePct: number;
  open: number;
  prevClose: number;
  dayLow: number;
  dayHigh: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  high52w: number;
  low52w: number;
  peRatio: number;
  eps: number;
  beta: number;
  dividendYieldPct: number;
}

export interface WatchlistQuote extends StockQuote {
  rsi: number;
  trend: Sentiment;
  predictionPct: number;
  hasAlert: boolean;
  volumeState: 'Low' | 'Normal' | 'High';
}

export interface MovingAverageIndicator {
  period: number;
  value: number;
  type: 'SMA' | 'EMA';
}

export interface TechnicalIndicators {
  rsi: { value: number; label: string };
  macd: { value: number; signalLine: number; histogram: number; label: Sentiment };
  trend: { label: string; sentiment: Sentiment };
  volatility: { annualizedPct: number; label: 'Low' | 'Moderate' | 'High' };
  relativeStrength: { label: string; sentiment: Sentiment };
  movingAverages: MovingAverageIndicator[];
  bollinger: { upper: number; middle: number; lower: number };
  support: number;
  resistance: number;
}

export interface Fundamentals {
  marketCap: number;
  peRatio: number;
  forwardPe: number;
  eps: number;
  epsGrowthPct: number;
  revenueTtm: number;
  revenueGrowthPct: number;
  grossMarginPct: number;
  operatingMarginPct: number;
  netMarginPct: number;
  debtToEquity: number;
  freeCashFlow: number;
  dividendYieldPct: number;
  payoutRatioPct: number;
  roe: number;
  beta: number;
}

export interface CorporateEvent {
  id: string;
  date: string;
  type: 'Earnings' | 'Dividend' | 'Split' | 'Conference';
  title: string;
  description: string;
}

export interface PriceHistoryResponse {
  symbol: string;
  candles: Candle[];
}
