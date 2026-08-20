import { Candle } from '../../core/models/common.model';

export interface IndicatorPoint {
  time: number;
  value: number;
}

/** Simple moving average over closing prices. */
export function sma(candles: Candle[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
    out.push({ time: Math.floor(new Date(candles[i].t).getTime() / 1000), value: sum / period });
  }
  return out;
}

/** Exponential moving average over closing prices. */
export function ema(candles: Candle[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  candles.forEach((c, i) => {
    if (i < period - 1) return;
    if (prev === null) {
      const seed = candles.slice(0, period).reduce((s, x) => s + x.close, 0) / period;
      prev = seed;
    } else {
      prev = c.close * k + prev * (1 - k);
    }
    out.push({ time: Math.floor(new Date(c.t).getTime() / 1000), value: prev });
  });
  return out;
}

export interface BollingerPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export function bollinger(candles: Candle[], period = 20, stdDevMultiplier = 2): BollingerPoint[] {
  const out: BollingerPoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const window = candles.slice(i - period + 1, i + 1).map((c) => c.close);
    const mean = window.reduce((s, v) => s + v, 0) / period;
    const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    out.push({
      time: Math.floor(new Date(candles[i].t).getTime() / 1000),
      upper: mean + sd * stdDevMultiplier,
      middle: mean,
      lower: mean - sd * stdDevMultiplier,
    });
  }
  return out;
}
