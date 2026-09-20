/**
 * Shared primitive types used across every domain model.
 * Keeping these separate avoids circular imports between feature models.
 */

/** Standard time ranges used by every chart control in the app. */
export type TimeRange = '1D' | '5D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'ALL';

/** A value paired with its change, always carrying the raw number (never color-only). */
export interface ChangeValue {
  value: number;
  changeAbs: number;
  changePct: number;
}

/** A single point on a time series chart. */
export interface SeriesPoint {
  /** ISO-8601 timestamp */
  t: string;
  v: number;
}

/** OHLCV candle used by price charts. */
export interface Candle {
  t: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Async resource wrapper so every component can render loading / error / empty / ready uniformly. */
export interface Resource<T> {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: T | null;
  error: string | null;
  lastUpdated: string | null;
}

export function resourceLoading<T>(previous?: T | null): Resource<T> {
  return { status: 'loading', data: previous ?? null, error: null, lastUpdated: null };
}

export function resourceSuccess<T>(data: T): Resource<T> {
  return { status: 'success', data, error: null, lastUpdated: new Date().toISOString() };
}

export function resourceError<T>(message: string): Resource<T> {
  return { status: 'error', data: null, error: message, lastUpdated: null };
}

/** Marks any payload as originating from the mock/demo data layer. */
export interface DemoMeta {
  isDemo: true;
  simulatedAsOf: string;
}

export type Sentiment = 'bullish' | 'bearish' | 'neutral';
export type Severity = 'critical' | 'warning' | 'info' | 'success';
