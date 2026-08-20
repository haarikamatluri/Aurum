import { Transaction } from '../models/portfolio.model';

/** Static cost-basis book for the demo portfolio. Current prices are layered on top from MarketEngine. */
export const HOLDINGS: { symbol: string; shares: number; avgCost: number; targetWeightPct: number }[] = [
  { symbol: 'NVDA', shares: 168, avgCost: 96.4, targetWeightPct: 18 },
  { symbol: 'MSFT', shares: 62, avgCost: 342.1, targetWeightPct: 14 },
  { symbol: 'AAPL', shares: 95, avgCost: 178.35, targetWeightPct: 12 },
  { symbol: 'AMZN', shares: 74, avgCost: 145.6, targetWeightPct: 9 },
  { symbol: 'GOOGL', shares: 88, avgCost: 132.2, targetWeightPct: 8 },
  { symbol: 'META', shares: 22, avgCost: 401.8, targetWeightPct: 7 },
  { symbol: 'TSLA', shares: 30, avgCost: 210.15, targetWeightPct: 6 },
  { symbol: 'AMD', shares: 58, avgCost: 118.9, targetWeightPct: 6 },
  { symbol: 'JPM', shares: 40, avgCost: 178.5, targetWeightPct: 6 },
  { symbol: 'V', shares: 26, avgCost: 258.4, targetWeightPct: 4 },
  { symbol: 'UNH', shares: 14, avgCost: 498.2, targetWeightPct: 4 },
  { symbol: 'LLY', shares: 8, avgCost: 705.5, targetWeightPct: 3 },
  { symbol: 'XOM', shares: 45, avgCost: 108.75, targetWeightPct: 2 },
  { symbol: 'PG', shares: 30, avgCost: 155.2, targetWeightPct: 1 },
];

export const CASH_BALANCE = 8420.55;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const TRANSACTIONS: Transaction[] = [
  { id: 'tx-1', date: daysAgo(1), symbol: 'NVDA', action: 'Buy', quantity: 10, price: 172.1, fees: 0, total: 1721.0 },
  { id: 'tx-2', date: daysAgo(3), symbol: 'MSFT', action: 'Dividend', quantity: 62, price: 0.83, fees: 0, total: 51.46 },
  { id: 'tx-3', date: daysAgo(6), symbol: 'TSLA', action: 'Sell', quantity: 8, price: 245.3, fees: 1.5, total: 1960.9 },
  { id: 'tx-4', date: daysAgo(9), symbol: 'AMD', action: 'Buy', quantity: 20, price: 132.4, fees: 0, total: 2648.0 },
  { id: 'tx-5', date: daysAgo(14), symbol: 'AAPL', action: 'Buy', quantity: 15, price: 219.4, fees: 0, total: 3291.0 },
  { id: 'tx-6', date: daysAgo(18), symbol: 'JPM', action: 'Dividend', quantity: 40, price: 1.15, fees: 0, total: 46.0 },
  { id: 'tx-7', date: daysAgo(22), symbol: 'GOOGL', action: 'Buy', quantity: 25, price: 140.1, fees: 0, total: 3502.5 },
  { id: 'tx-8', date: daysAgo(30), symbol: 'META', action: 'Buy', quantity: 6, price: 389.2, fees: 0, total: 2335.2 },
  { id: 'tx-9', date: daysAgo(41), symbol: 'UNH', action: 'Buy', quantity: 4, price: 512.6, fees: 1.25, total: 2051.65 },
  { id: 'tx-10', date: daysAgo(55), symbol: 'XOM', action: 'Buy', quantity: 20, price: 112.4, fees: 0, total: 2248.0 },
  { id: 'tx-11', date: daysAgo(70), symbol: 'V', action: 'Dividend', quantity: 26, price: 0.59, fees: 0, total: 15.34 },
  { id: 'tx-12', date: daysAgo(88), symbol: 'PG', action: 'Buy', quantity: 30, price: 155.2, fees: 0, total: 4656.0 },
  { id: 'tx-13', date: daysAgo(120), symbol: 'LLY', action: 'Buy', quantity: 8, price: 705.5, fees: 2.0, total: 5646.0 },
  { id: 'tx-14', date: daysAgo(150), symbol: 'AMZN', action: 'Buy', quantity: 30, price: 138.9, fees: 0, total: 4167.0 },
  { id: 'tx-15', date: daysAgo(200), symbol: 'NVDA', action: 'Buy', quantity: 60, price: 82.15, fees: 0, total: 4929.0 },
];
