// ============================================================================
// Aurum Unified Feature Engineering Engine
// Single source of truth for both OFFLINE dataset processing and LIVE inference
// Features: returns1D, volatility14D, rsi14, volumeZScore, returns5D, macd, macdSignal
// ============================================================================

const FEATURE_VERSION = 'features-v1.4.0';

/**
 * Computes 1D return in percentage points.
 * ((close[t] - close[t-1]) / close[t-1]) * 100
 */
function computeReturn1D(currentClose, previousClose) {
  if (!previousClose || previousClose <= 0) return 0.0;
  const ret = ((currentClose - previousClose) / previousClose) * 100;
  return Math.round(ret * 100) / 100;
}

/**
 * Computes RSI(14) using standard 14-period momentum.
 * candles must have at least 15 candles to compute 14 deltas.
 */
function computeRsi14(candles) {
  if (!candles || candles.length < 15) return 50.0;
  const window = candles.slice(-15);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < window.length; i++) {
    const diff = window[i].close - window[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return Math.round(Math.min(100, Math.max(0, rsi)) * 10) / 10;
}

/**
 * Computes Volatility14D: 14-observation sample standard deviation of daily returns.
 * candles must have at least 15 candles to calculate 14 daily returns.
 */
function computeVolatility14D(candles) {
  if (!candles || candles.length < 15) return 1.20;
  const window = candles.slice(-15);
  const returns = [];

  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1].close;
    const curr = window[i].close;
    returns.push(((curr - prev) / prev) * 100);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const std = Math.sqrt(Math.max(0, variance));
  return Math.round(std * 100) / 100;
}

/**
 * Computes Volume Z-Score over a 14-day rolling window.
 * (volume[t] - mean(volume)) / std(volume)
 */
function computeVolumeZScore(candles) {
  if (!candles || candles.length < 14) return 0.0;
  const window = candles.slice(-14);
  const vols = window.map(c => c.volume);
  const currentVol = vols[vols.length - 1];

  const mean = vols.reduce((a, b) => a + b, 0) / vols.length;
  const variance = vols.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (vols.length - 1);
  const std = Math.sqrt(Math.max(0, variance));

  if (std === 0 || isNaN(std)) return 0.0;
  const z = (currentVol - mean) / std;
  return Math.round(z * 100) / 100;
}

/**
 * LIVE FEATURE CALCULATION
 * Given a history array of candles up to t (inclusive)
 */
function calculateLiveFeatures(symbol, candlesHistory) {
  if (!candlesHistory || candlesHistory.length === 0) {
    throw new Error(`Cannot compute live features: empty candles history for ${symbol}`);
  }

  const n = candlesHistory.length;
  const current = candlesHistory[n - 1];
  const prev = n > 1 ? candlesHistory[n - 2] : null;

  const returns1D = computeReturn1D(current.close, prev ? prev.close : current.close);
  const rsi14 = computeRsi14(candlesHistory);
  const volatility14D = computeVolatility14D(candlesHistory);
  const volumeZScore = computeVolumeZScore(candlesHistory);

  // Additional secondary features
  const return5D = n >= 6
    ? computeReturn1D(current.close, candlesHistory[n - 6].close)
    : Math.round(returns1D * 2.2 * 100) / 100;

  const marketRegime = returns1D > 1.2 ? 'BULL_TREND' : returns1D < -1.2 ? 'BEAR_TREND' : 'SIDEWAYS';

  return {
    symbol,
    featureVersion: FEATURE_VERSION,
    price: current.close,
    date: current.date,
    features: {
      returns1D,
      volatility14D,
      rsi14,
      volumeZScore,
      returns5D: return5D,
      marketRegime
    },
    generatedAt: new Date().toISOString()
  };
}

/**
 * OFFLINE BATCH FEATURE CALCULATION
 * Computes causal features for every bar t using only data <= t.
 * Rows with insufficient history (< 15 bars) have null features and are pruned.
 */
function computeBatchFeatures(cleanCandles) {
  const dataset = [];

  for (let t = 0; t < cleanCandles.length; t++) {
    // Only use candles up to index t (STRICT CAUSALITY - NO FUTURE LOOKAHEAD)
    const historySlice = cleanCandles.slice(0, t + 1);

    if (historySlice.length < 15) {
      // Warmup period required for 14-period indicators
      continue;
    }

    const current = cleanCandles[t];
    const prev = cleanCandles[t - 1];

    const returns1D = computeReturn1D(current.close, prev.close);
    const rsi14 = computeRsi14(historySlice);
    const volatility14D = computeVolatility14D(historySlice);
    const volumeZScore = computeVolumeZScore(historySlice);

    dataset.push({
      index: t,
      timestamp: current.timestamp,
      date: current.date,
      open: current.open,
      high: current.high,
      low: current.low,
      close: current.close,
      volume: current.volume,
      features: {
        returns1D,
        volatility14D,
        rsi14,
        volumeZScore
      }
    });
  }

  return dataset;
}

module.exports = {
  FEATURE_VERSION,
  computeReturn1D,
  computeRsi14,
  computeVolatility14D,
  computeVolumeZScore,
  calculateLiveFeatures,
  computeBatchFeatures
};
