// ============================================================================
// Aurum Unified Feature Engineering Engine v2
// High-confidence causal financial indicators & regime classification
// Guarantees: STRICT CAUSALITY (features at t strictly use information <= t)
// ============================================================================

const FEATURE_VERSION_V2 = 'features-v2.0.0';

/**
 * Feature Metadata Catalog
 */
const FEATURE_CATALOG_V2 = [
  // Momentum
  { name: 'returns1D', category: 'MOMENTUM', lookback: 1, formula: '((close[t] - close[t-1]) / close[t-1]) * 100' },
  { name: 'returns3D', category: 'MOMENTUM', lookback: 3, formula: '((close[t] - close[t-3]) / close[t-3]) * 100' },
  { name: 'returns5D', category: 'MOMENTUM', lookback: 5, formula: '((close[t] - close[t-5]) / close[t-5]) * 100' },
  { name: 'returns10D', category: 'MOMENTUM', lookback: 10, formula: '((close[t] - close[t-10]) / close[t-10]) * 100' },
  { name: 'returns20D', category: 'MOMENTUM', lookback: 20, formula: '((close[t] - close[t-20]) / close[t-20]) * 100' },

  // Trend & Moving Averages
  { name: 'trendDistanceSMA20', category: 'TREND', lookback: 20, formula: '((close[t] / SMA20) - 1) * 100' },
  { name: 'trendDistanceSMA50', category: 'TREND', lookback: 50, formula: '((close[t] / SMA50) - 1) * 100' },
  { name: 'emaSpread10_20', category: 'TREND', lookback: 20, formula: '((EMA10 / EMA20) - 1) * 100' },

  // Momentum Indicators
  { name: 'rsi14', category: 'MOMENTUM_INDICATOR', lookback: 15, formula: 'Wilder 14-period Relative Strength Index' },
  { name: 'rsi7', category: 'MOMENTUM_INDICATOR', lookback: 8, formula: '7-period Fast Relative Strength Index' },
  { name: 'macdHist', category: 'MOMENTUM_INDICATOR', lookback: 35, formula: 'MACD line (EMA12 - EMA26) - Signal line (EMA9)' },

  // Volatility
  { name: 'volatility5D', category: 'VOLATILITY', lookback: 5, formula: '5-day sample std of daily returns' },
  { name: 'volatility14D', category: 'VOLATILITY', lookback: 14, formula: '14-day sample std of daily returns' },
  { name: 'volatility20D', category: 'VOLATILITY', lookback: 20, formula: '20-day sample std of daily returns' },
  { name: 'atr14Percent', category: 'VOLATILITY', lookback: 15, formula: '(ATR14 / close[t]) * 100' },

  // Volume
  { name: 'volumeChange1D', category: 'VOLUME', lookback: 1, formula: '((volume[t] - volume[t-1]) / volume[t-1]) * 100' },
  { name: 'volumeZScore', category: 'VOLUME', lookback: 20, formula: '(volume[t] - mean(volume20)) / std(volume20)' },

  // Price Structure
  { name: 'dailyRange', category: 'PRICE_STRUCTURE', lookback: 0, formula: '((high - low) / close) * 100' },
  { name: 'bodySize', category: 'PRICE_STRUCTURE', lookback: 0, formula: '(abs(close - open) / close) * 100' },
  { name: 'upperWick', category: 'PRICE_STRUCTURE', lookback: 0, formula: '((high - max(open, close)) / close) * 100' },
  { name: 'lowerWick', category: 'PRICE_STRUCTURE', lookback: 0, formula: '((min(open, close) - low) / close) * 100' },
  { name: 'gapPercent', category: 'PRICE_STRUCTURE', lookback: 1, formula: '((open[t] - close[t-1]) / close[t-1]) * 100' }
];

const NUMERIC_FEATURE_NAMES = FEATURE_CATALOG_V2.map((f) => f.name);

// ----------------------------------------------------------------------------
// Mathematical & Financial Helpers
// ----------------------------------------------------------------------------

function computeReturn(candles, lookback) {
  const n = candles.length;
  if (n <= lookback) return 0.0;
  const current = candles[n - 1].close;
  const past = candles[n - 1 - lookback].close;
  if (!past || past <= 0) return 0.0;
  return Math.round((((current - past) / past) * 100) * 100) / 100;
}

function computeSMA(candles, period) {
  const n = candles.length;
  if (n < period) return candles[n - 1].close;
  const slice = candles.slice(-period);
  const sum = slice.reduce((acc, c) => acc + c.close, 0);
  return sum / period;
}

function computeEMA(candles, period) {
  const n = candles.length;
  if (n === 0) return 0;
  const k = 2 / (period + 1);
  let ema = candles[0].close;
  for (let i = 1; i < n; i++) {
    ema = candles[i].close * k + ema * (1 - k);
  }
  return ema;
}

function computeRSI(candles, period) {
  const n = candles.length;
  if (n < period + 1) return 50.0;
  const slice = candles.slice(-(period + 1));
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i].close - slice[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return Math.round(Math.min(100, Math.max(0, rsi)) * 10) / 10;
}

function computeVolatility(candles, period) {
  const n = candles.length;
  if (n < period + 1) return 1.20;
  const slice = candles.slice(-(period + 1));
  const returns = [];

  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1].close;
    const curr = slice[i].close;
    returns.push(((curr - prev) / prev) * 100);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const std = Math.sqrt(Math.max(0, variance));
  return Math.round(std * 100) / 100;
}

function computeATR(candles, period = 14) {
  const n = candles.length;
  if (n < period + 1) return 0.0;
  const trs = [];

  for (let i = n - period; i < n; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const tr1 = curr.high - curr.low;
    const tr2 = Math.abs(curr.high - prev.close);
    const tr3 = Math.abs(curr.low - prev.close);
    trs.push(Math.max(tr1, tr2, tr3));
  }

  const atr = trs.reduce((a, b) => a + b, 0) / period;
  const currentClose = candles[n - 1].close;
  return Math.round(((atr / currentClose) * 100) * 100) / 100;
}

function computeMACD(candles) {
  const ema12 = computeEMA(candles, 12);
  const ema26 = computeEMA(candles, 26);
  const macdLine = ema12 - ema26;

  // Approximate signal line
  const ema9 = computeEMA(candles, 9);
  const signalLine = (ema9 / candles[candles.length - 1].close) * macdLine;
  const hist = macdLine - signalLine;
  return Math.round(hist * 100) / 100;
}

function computeVolumeMetrics(candles) {
  const n = candles.length;
  const current = candles[n - 1];
  const prev = n > 1 ? candles[n - 2] : current;

  const volChange = prev.volume > 0
    ? Math.round((((current.volume - prev.volume) / prev.volume) * 100) * 100) / 100
    : 0.0;

  const window = candles.slice(-20);
  const vols = window.map((c) => c.volume);
  const mean = vols.reduce((a, b) => a + b, 0) / vols.length;
  const variance = vols.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (vols.length - 1 || 1);
  const std = Math.sqrt(Math.max(0, variance));

  const volumeZScore = std > 0 ? Math.round(((current.volume - mean) / std) * 100) / 100 : 0.0;
  return { volumeChange1D: volChange, volumeZScore };
}

function computePriceStructure(candles) {
  const n = candles.length;
  const curr = candles[n - 1];
  const prev = n > 1 ? candles[n - 2] : curr;
  const close = curr.close || 1;

  const dailyRange = Math.round((((curr.high - curr.low) / close) * 100) * 100) / 100;
  const bodySize = Math.round(((Math.abs(curr.close - curr.open) / close) * 100) * 100) / 100;
  const upperWick = Math.round((((curr.high - Math.max(curr.open, curr.close)) / close) * 100) * 100) / 100;
  const lowerWick = Math.round((((Math.min(curr.open, curr.close) - curr.low) / close) * 100) * 100) / 100;
  const gapPercent = Math.round((((curr.open - prev.close) / prev.close) * 100) * 100) / 100;

  return { dailyRange, bodySize, upperWick, lowerWick, gapPercent };
}

function determineRegime(candles, features) {
  const n = candles.length;
  const curr = candles[n - 1];

  // 1. Trend Regime
  let trendRegime = 'SIDEWAYS';
  if (features.trendDistanceSMA20 > 1.0 && features.trendDistanceSMA50 > 1.5) {
    trendRegime = 'TRENDING_BULL';
  } else if (features.trendDistanceSMA20 < -1.0 && features.trendDistanceSMA50 < -1.5) {
    trendRegime = 'TRENDING_BEAR';
  }

  // 2. Volatility Regime
  let volatilityRegime = 'MEDIUM_VOLATILITY';
  if (features.volatility14D > 2.0) {
    volatilityRegime = 'HIGH_VOLATILITY';
  } else if (features.volatility14D < 0.9) {
    volatilityRegime = 'LOW_VOLATILITY';
  }

  // 3. Momentum Regime
  let momentumRegime = 'NEUTRAL_MOMENTUM';
  if (features.rsi14 >= 60 && features.macdHist > 0) {
    momentumRegime = 'STRONG_MOMENTUM';
  } else if (features.rsi14 <= 40 && features.macdHist < 0) {
    momentumRegime = 'WEAK_MOMENTUM';
  }

  return { trendRegime, volatilityRegime, momentumRegime };
}

/**
 * Computes the full v2 feature vector for a single chronological slice up to index t
 * STRICTLY CAUSAL: Uses only candles[0 ... t]
 */
function extractFeaturesAtTimestamp(candlesHistoryUpToT) {
  const n = candlesHistoryUpToT.length;
  if (n < 20) {
    throw new Error(`Insufficient history for v2 feature calculation: minimum 20 bars needed, got ${n}`);
  }

  const curr = candlesHistoryUpToT[n - 1];

  // Momentum
  const returns1D = computeReturn(candlesHistoryUpToT, 1);
  const returns3D = computeReturn(candlesHistoryUpToT, 3);
  const returns5D = computeReturn(candlesHistoryUpToT, 5);
  const returns10D = computeReturn(candlesHistoryUpToT, 10);
  const returns20D = computeReturn(candlesHistoryUpToT, 20);

  // Trend
  const sma20 = computeSMA(candlesHistoryUpToT, 20);
  const sma50 = n >= 50 ? computeSMA(candlesHistoryUpToT, 50) : sma20;
  const ema10 = computeEMA(candlesHistoryUpToT, 10);
  const ema20 = computeEMA(candlesHistoryUpToT, 20);

  const trendDistanceSMA20 = Math.round((((curr.close / sma20) - 1) * 100) * 100) / 100;
  const trendDistanceSMA50 = Math.round((((curr.close / sma50) - 1) * 100) * 100) / 100;
  const emaSpread10_20 = Math.round((((ema10 / ema20) - 1) * 100) * 100) / 100;

  // Indicators
  const rsi14 = computeRSI(candlesHistoryUpToT, 14);
  const rsi7 = computeRSI(candlesHistoryUpToT, 7);
  const macdHist = computeMACD(candlesHistoryUpToT);

  // Volatility
  const volatility5D = computeVolatility(candlesHistoryUpToT, 5);
  const volatility14D = computeVolatility(candlesHistoryUpToT, 14);
  const volatility20D = computeVolatility(candlesHistoryUpToT, 20);
  const atr14Percent = computeATR(candlesHistoryUpToT, 14);

  // Volume
  const volMetrics = computeVolumeMetrics(candlesHistoryUpToT);

  // Price Structure
  const structure = computePriceStructure(candlesHistoryUpToT);

  const numericFeatures = {
    returns1D,
    returns3D,
    returns5D,
    returns10D,
    returns20D,
    trendDistanceSMA20,
    trendDistanceSMA50,
    emaSpread10_20,
    rsi14,
    rsi7,
    macdHist,
    volatility5D,
    volatility14D,
    volatility20D,
    atr14Percent,
    volumeChange1D: volMetrics.volumeChange1D,
    volumeZScore: volMetrics.volumeZScore,
    dailyRange: structure.dailyRange,
    bodySize: structure.bodySize,
    upperWick: structure.upperWick,
    lowerWick: structure.lowerWick,
    gapPercent: structure.gapPercent
  };

  const regimes = determineRegime(candlesHistoryUpToT, numericFeatures);

  return {
    date: curr.date,
    close: curr.close,
    ...numericFeatures,
    ...regimes,
    featureVersion: FEATURE_VERSION_V2
  };
}

/**
 * Batch feature generator for an entire series.
 * Warmup: skips the first minWarmup bars so indicators have sufficient history.
 */
function generateBatchFeaturesV2(candles, minWarmup = 20) {
  const results = [];
  for (let t = minWarmup; t < candles.length; t++) {
    // Pass strictly candles up to t (inclusive)
    const history = candles.slice(0, t + 1);
    const feats = extractFeaturesAtTimestamp(history);
    results.push(feats);
  }
  return results;
}

module.exports = {
  FEATURE_VERSION_V2,
  FEATURE_CATALOG_V2,
  NUMERIC_FEATURE_NAMES,
  extractFeaturesAtTimestamp,
  generateBatchFeaturesV2,
  determineRegime
};
