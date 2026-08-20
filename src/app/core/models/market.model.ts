import { SeriesPoint } from './common.model';

export type MarketSessionStatus = 'OPEN' | 'CLOSED' | 'PRE-MARKET' | 'AFTER-HOURS';

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  changeAbs: number;
  changePct: number;
  sparkline: SeriesPoint[];
}

export interface MarketStatus {
  status: MarketSessionStatus;
  nextEvent: string;
  timezone: string;
}

export interface SectorPerformance {
  sector: string;
  changePct: number;
  marketCapWeightPct: number;
}

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  changeAbs: number;
  changePct: number;
  volume: number;
  avgVolume: number;
}
