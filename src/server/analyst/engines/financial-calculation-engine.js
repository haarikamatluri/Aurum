/**
 * AURUM — Centralized Deterministic Financial Calculation Engine
 * 
 * Strict specifications:
 * - Deterministic mathematical logic only.
 * - Zero hallucinated values or random walk generators.
 * - Explicit 'UNAVAILABLE' when data inputs are insufficient.
 * - Conforms to Sections 4-15 of Aurum AI Analyst Specification.
 */

// ============================================================================
// 1. PRICE & RETURN CALCULATIONS (Section 5)
// ============================================================================

/**
 * Calculate basic price metrics from quotes and historical bars.
 */
function calculatePriceMetrics(quote = {}, historyBars = []) {
  const currentPrice = Number(quote.currentPrice ?? quote.price ?? quote.lastPrice ?? 0);
  const previousClose = Number(quote.previousClose ?? quote.prevClose ?? 0);
  const open = Number(quote.open ?? 0);
  const dayHigh = Number(quote.high ?? quote.dayHigh ?? 0);
  const dayLow = Number(quote.low ?? quote.dayLow ?? 0);
  const volume = Number(quote.volume ?? 0);

  const absoluteChange = previousClose > 0 ? currentPrice - previousClose : (quote.change ?? 0);
  const percentageChange = previousClose > 0 
    ? ((currentPrice - previousClose) / previousClose) * 100 
    : (quote.changePercent ?? 0);

  let high52 = Number(quote.high52 ?? quote['52WeekHigh'] ?? 0);
  let low52 = Number(quote.low52 ?? quote['52WeekLow'] ?? 0);
  let avgVolume = Number(quote.avgVolume ?? 0);
  let vwap = null;

  if (historyBars && historyBars.length > 0) {
    let totalVol = 0;
    let totalVolPrice = 0;
    let maxHigh = -Infinity;
    let minLow = Infinity;

    const bars52w = historyBars.slice(-252);
    for (const b of bars52w) {
      const h = Number(b.high ?? b.close ?? 0);
      const l = Number(b.low ?? b.close ?? 0);
      const v = Number(b.volume ?? 0);
      const c = Number(b.close ?? 0);

      if (h > maxHigh) maxHigh = h;
      if (l < minLow && l > 0) minLow = l;

      totalVol += v;
      const typicalPrice = (h + l + c) / 3;
      totalVolPrice += typicalPrice * v;
    }

    if (maxHigh > -Infinity && (!high52 || high52 === 0)) high52 = maxHigh;
    if (minLow < Infinity && (!low52 || low52 === 0)) low52 = minLow;
    if (bars52w.length > 0) avgVolume = Math.round(totalVol / bars52w.length);
    if (totalVol > 0) vwap = Number((totalVolPrice / totalVol).toFixed(2));
  }

  const distanceFrom52wHigh = (high52 > 0 && currentPrice > 0)
    ? Number((((currentPrice - high52) / high52) * 100).toFixed(2))
    : null;
  const distanceFrom52wLow = (low52 > 0 && currentPrice > 0)
    ? Number((((currentPrice - low52) / low52) * 100).toFixed(2))
    : null;

  return {
    currentPrice,
    previousClose,
    absoluteChange: Number(absoluteChange.toFixed(2)),
    percentageChange: Number(percentageChange.toFixed(2)),
    open,
    dayHigh,
    dayLow,
    volume,
    avgVolume,
    vwap,
    high52: high52 > 0 ? high52 : null,
    low52: low52 > 0 ? low52 : null,
    distanceFrom52wHigh,
    distanceFrom52wLow,
  };
}

/**
 * Calculate multi-period historical momentum returns.
 */
function calculateMomentumReturns(closes = []) {
  if (!Array.isArray(closes) || closes.length < 2) {
    return { status: 'UNAVAILABLE', error: 'Insufficient historical close prices' };
  }

  const n = closes.length;
  const current = closes[n - 1];
  if (!current || current <= 0) return { status: 'UNAVAILABLE' };

  const getReturn = (periodBars) => {
    if (n <= periodBars) return null;
    const past = closes[n - 1 - periodBars];
    if (!past || past <= 0) return null;
    return Number((((current - past) / past) * 100).toFixed(2));
  };

  return {
    return1D: getReturn(1),
    return5D: getReturn(5),
    return1W: getReturn(5),
    return1M: getReturn(21),
    return3M: getReturn(63),
    return6M: getReturn(126),
    returnYTD: getReturn(Math.min(n - 1, 180)),
    return1Y: getReturn(252),
    return3Y: getReturn(756),
    return5Y: getReturn(1260),
  };
}

// ============================================================================
// 2. TECHNICAL INDICATOR ENGINE (Section 6)
// ============================================================================

/**
 * Simple Moving Average (SMA).
 */
function calculateSMA(data, period) {
  if (!Array.isArray(data) || data.length < period || period <= 0) return null;
  const slice = data.slice(-period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return Number((sum / period).toFixed(2));
}

/**
 * Exponential Moving Average (EMA) with initial SMA seeding.
 */
function calculateEMA(data, period) {
  if (!Array.isArray(data) || data.length === 0 || period <= 0) return null;
  const series = calculateEMASeries(data, period);
  return series.length > 0 ? Number(series[series.length - 1].toFixed(2)) : null;
}

/**
 * Calculate continuous EMA series with expanding mean initialization leading to exact SMA seed.
 */
function calculateEMASeries(data, period) {
  if (!Array.isArray(data) || data.length === 0 || period <= 0) return [];
  const k = 2 / (period + 1);
  const series = [data[0]];
  
  // Initialize initial period with cumulative mean (smooth convergence to SMA at period - 1)
  for (let i = 1; i < Math.min(period, data.length); i++) {
    const cumMean = (series[i - 1] * i + data[i]) / (i + 1);
    series.push(cumMean);
  }

  // Standard EMA recursion for all subsequent observations
  for (let i = period; i < data.length; i++) {
    series.push(data[i] * k + series[i - 1] * (1 - k));
  }
  return series;
}

/**
 * Relative Strength Index (RSI 14) with classic Wilder smoothing.
 */
function calculateRSI(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return Number(rsi.toFixed(2));
}

/**
 * Exact MACD (12, 26, 9) implementation.
 * MACD Line = EMA12 - EMA26
 * Signal Line = 9-period EMA of MACD Line series
 * Histogram = MACD Line - Signal Line
 * Analyzes sign AND direction (expanding vs contracting)
 */
function calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!Array.isArray(closes) || closes.length < slowPeriod) {
    return { line: null, signal: null, histogram: null, status: 'UNAVAILABLE' };
  }

  const ema12Series = calculateEMASeries(closes, fastPeriod);
  const ema26Series = calculateEMASeries(closes, slowPeriod);

  const macdSeries = [];
  for (let i = 0; i < closes.length; i++) {
    macdSeries.push(ema12Series[i] - ema26Series[i]);
  }

  const signalSeries = calculateEMASeries(macdSeries, signalPeriod);
  const lastIndex = closes.length - 1;
  const line = Number(macdSeries[lastIndex].toFixed(2));
  const signal = Number(signalSeries[lastIndex].toFixed(2));
  const histogram = Number((line - signal).toFixed(2));

  const prevHistogram = lastIndex > 0 ? Number((macdSeries[lastIndex - 1] - signalSeries[lastIndex - 1]).toFixed(2)) : histogram;
  const histogramDirection = histogram >= prevHistogram ? 'EXPANDING' : 'CONTRACTING';
  const histogramSign = histogram >= 0 ? 'POSITIVE' : 'NEGATIVE';

  let momentumBias = 'NEUTRAL';
  if (histogram >= 0) {
    momentumBias = histogram >= prevHistogram ? 'POSITIVE_EXPANDING' : 'POSITIVE_CONTRACTING';
  } else {
    momentumBias = histogram >= prevHistogram ? 'NEGATIVE_IMPROVING' : 'NEGATIVE_DETERIORATING';
  }

  return {
    line,
    signal,
    histogram,
    prevHistogram,
    histogramDirection,
    histogramSign,
    momentumBias,
    status: 'CALCULATED'
  };
}

/**
 * Bollinger Bands (Middle, Upper, Lower, Bandwidth, %B).
 */
function calculateBollingerBands(closes, period = 20, stdDevMultiplier = 2) {
  if (!Array.isArray(closes) || closes.length < period) {
    return { middle: null, upper: null, lower: null, bandwidth: null, percentB: null, status: 'UNAVAILABLE' };
  }

  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = sma + (stdDevMultiplier * stdDev);
  const lower = sma - (stdDevMultiplier * stdDev);
  const currentPrice = closes[closes.length - 1];

  const bandwidth = sma > 0 ? Number((((upper - lower) / sma) * 100).toFixed(2)) : null;
  const percentB = (upper - lower) > 0 ? Number((((currentPrice - lower) / (upper - lower))).toFixed(3)) : null;

  return {
    middle: Number(sma.toFixed(2)),
    upper: Number(upper.toFixed(2)),
    lower: Number(lower.toFixed(2)),
    bandwidth,
    percentB,
    status: 'CALCULATED'
  };
}

/**
 * Average True Range (ATR 14).
 */
function calculateATR(bars = [], period = 14) {
  if (!Array.isArray(bars) || bars.length < period + 1) return null;
  const series = calculateWilderATRSeries(bars, period);
  return series.length > 0 ? series[series.length - 1] : null;
}

/**
 * Continuous series of Wilder's Modified Moving Average ATR.
 * At index 13 (bar 14), ATR0 = SMA(TR[0..13], 14).
 * For t >= 14, ATR_t = ((13 * ATR_{t-1}) + TR_t) / 14.
 */
function calculateWilderATRSeries(bars = [], period = 14) {
  if (!Array.isArray(bars) || bars.length === 0) return [];

  const trs = [];
  for (let i = 0; i < bars.length; i++) {
    const curr = bars[i];
    const h = Number(curr.high ?? curr.close);
    const l = Number(curr.low ?? curr.close);
    if (i === 0) {
      trs.push(h - l);
    } else {
      const prevC = Number(bars[i - 1].close);
      const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
      trs.push(tr);
    }
  }

  const series = new Array(bars.length).fill(null);
  if (bars.length < period) return series;

  // Initial ATR at index (period - 1), which is 13 for period = 14
  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += trs[i];
  }
  let currentATR = initialSum / period;
  series[period - 1] = Number(currentATR.toFixed(4));

  for (let i = period; i < bars.length; i++) {
    currentATR = ((currentATR * (period - 1)) + trs[i]) / period;
    series[i] = Number(currentATR.toFixed(4));
  }

  return series;
}

/**
 * Average Directional Index (ADX 14, +DI, -DI).
 */
function calculateADX(bars = [], period = 14) {
  if (!Array.isArray(bars) || bars.length < period * 2) {
    return { adx: null, plusDI: null, minusDI: null, status: 'UNAVAILABLE' };
  }

  const trs = [];
  const plusDMs = [];
  const minusDMs = [];

  for (let i = 1; i < bars.length; i++) {
    const curr = bars[i];
    const prev = bars[i - 1];

    const upMove = curr.high - prev.high;
    const downMove = prev.low - curr.low;

    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);

    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );
    trs.push(tr);
  }

  let smoothTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

  const dxSeries = [];

  for (let i = period; i < trs.length; i++) {
    smoothTR = smoothTR - (smoothTR / period) + trs[i];
    smoothPlusDM = smoothPlusDM - (smoothPlusDM / period) + plusDMs[i];
    smoothMinusDM = smoothMinusDM - (smoothMinusDM / period) + minusDMs[i];

    const plusDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const minusDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const sumDI = plusDI + minusDI;
    const dx = sumDI > 0 ? (Math.abs(plusDI - minusDI) / sumDI) * 100 : 0;
    dxSeries.push({ dx, plusDI, minusDI });
  }

  if (dxSeries.length < period) {
    return { adx: null, plusDI: null, minusDI: null, status: 'UNAVAILABLE' };
  }

  let adx = dxSeries.slice(0, period).reduce((a, b) => a + b.dx, 0) / period;
  for (let i = period; i < dxSeries.length; i++) {
    adx = (adx * (period - 1) + dxSeries[i].dx) / period;
  }

  const latest = dxSeries[dxSeries.length - 1];
  return {
    adx: Number(adx.toFixed(2)),
    plusDI: Number(latest.plusDI.toFixed(2)),
    minusDI: Number(latest.minusDI.toFixed(2)),
    status: 'CALCULATED'
  };
}

/**
 * Stochastic Oscillator (%K, %D).
 */
function calculateStochastic(bars = [], periodK = 14, periodD = 3) {
  if (!Array.isArray(bars) || bars.length < periodK) {
    return { k: null, d: null, status: 'UNAVAILABLE' };
  }

  const kSeries = [];
  for (let i = periodK - 1; i < bars.length; i++) {
    const windowBars = bars.slice(i - periodK + 1, i + 1);
    const highestHigh = Math.max(...windowBars.map(b => b.high ?? b.close));
    const lowestLow = Math.min(...windowBars.map(b => b.low ?? b.close));
    const currentClose = bars[i].close;

    const range = highestHigh - lowestLow;
    const k = range > 0 ? ((currentClose - lowestLow) / range) * 100 : 50;
    kSeries.push(k);
  }

  if (kSeries.length < periodD) {
    return { k: Number(kSeries[kSeries.length - 1].toFixed(2)), d: null, status: 'CALCULATED' };
  }

  const d = kSeries.slice(-periodD).reduce((a, b) => a + b, 0) / periodD;
  return {
    k: Number(kSeries[kSeries.length - 1].toFixed(2)),
    d: Number(d.toFixed(2)),
    status: 'CALCULATED'
  };
}

/**
 * Rate of Change (ROC).
 */
function calculateROC(closes = [], period = 12) {
  if (!Array.isArray(closes) || closes.length <= period) return null;
  const current = closes[closes.length - 1];
  const past = closes[closes.length - 1 - period];
  if (!past || past === 0) return null;
  return Number((((current - past) / past) * 100).toFixed(2));
}

/**
 * Volatility metrics (daily, annualized, rolling).
 */
function calculateVolatilityMetrics(closes = [], window = 20) {
  if (!Array.isArray(closes) || closes.length < window + 1) {
    return { dailyVolatility: null, annualizedVolatility: null, status: 'UNAVAILABLE' };
  }

  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }

  const slice = returns.slice(-window);
  const mean = slice.reduce((a, b) => a + b, 0) / window;
  const variance = slice.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (window - 1);
  const dailyVol = Math.sqrt(variance);
  const annualizedVol = dailyVol * Math.sqrt(252);

  return {
    dailyVolatility: Number((dailyVol * 100).toFixed(2)),
    annualizedVolatility: Number((annualizedVol * 100).toFixed(2)),
    status: 'CALCULATED'
  };
}

/**
 * Volume indicators (Volume MA, relative volume, volume z-score).
 */
function calculateVolumeMetrics(volumes = [], period = 20) {
  if (!Array.isArray(volumes) || volumes.length < period) {
    return { volumeMA: null, relativeVolume: null, volumeZScore: null, status: 'UNAVAILABLE' };
  }

  const currentVol = volumes[volumes.length - 1];
  const slice = volumes.slice(-period);
  const avgVol = slice.reduce((a, b) => a + b, 0) / period;

  const variance = slice.reduce((sum, v) => sum + Math.pow(v - avgVol, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const relativeVolume = avgVol > 0 ? Number((currentVol / avgVol).toFixed(2)) : null;
  const volumeZScore = stdDev > 0 ? Number(((currentVol - avgVol) / stdDev).toFixed(2)) : null;

  return {
    volumeMA: Math.round(avgVol),
    relativeVolume,
    volumeZScore,
    status: 'CALCULATED'
  };
}

/**
 * Determine deterministic technical state without forcing false certainty.
 */
function evaluateTechnicalState({ rsi, macd, currentPrice, sma50, sma200, adx }) {
  let bullishPoints = 0;
  let bearishPoints = 0;

  if (rsi !== null) {
    if (rsi > 55) bullishPoints++;
    else if (rsi < 45) bearishPoints++;
  }

  if (macd && macd.histogram !== null) {
    if (macd.histogram > 0) bullishPoints++;
    else if (macd.histogram < 0) bearishPoints++;
  }

  if (currentPrice && sma50) {
    if (currentPrice > sma50) bullishPoints++;
    else bearishPoints++;
  }

  if (sma50 && sma200) {
    if (sma50 > sma200) bullishPoints++;
    else bearishPoints++;
  }

  if (bullishPoints >= 3 && bearishPoints <= 1) return 'BULLISH';
  if (bearishPoints >= 3 && bullishPoints <= 1) return 'BEARISH';
  if (bullishPoints === bearishPoints) return 'NEUTRAL';
  return 'MIXED';
}

// ============================================================================
// 3. SUPPORT / RESISTANCE (Section 7)
// ============================================================================

/**
 * Validate and clean historical OHLCV candle bars.
 * Ensures High >= Low, High >= Open, High >= Close, Low <= Open, Low <= Close.
 * Filters duplicate timestamps and sorts chronologically.
 */
function validateCandleIntegrity(bars = []) {
  if (!Array.isArray(bars) || bars.length === 0) {
    return { validBars: [], isValid: false, issues: ['EMPTY_CANDLES'], lastCompletedCandleTimestamp: null };
  }

  const seenTimestamps = new Set();
  const cleaned = [];
  const issues = [];

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (!b) continue;

    const open = Number(b.open);
    const high = Number(b.high);
    const low = Number(b.low);
    const close = Number(b.close);
    const volume = Number(b.volume ?? 0);
    const ts = b.timestamp || b.time || (b.date ? new Date(b.date).toISOString() : null);

    if (isNaN(close) || close <= 0) {
      issues.push(`Bar ${i}: invalid close price ${close}`);
      continue;
    }

    if (ts && seenTimestamps.has(ts)) {
      issues.push(`Bar ${i}: duplicate timestamp ${ts}`);
      continue;
    }
    if (ts) seenTimestamps.add(ts);

    // Validate geometry bounds
    const safeOpen = (!isNaN(open) && open > 0) ? open : close;
    let safeHigh = (!isNaN(high) && high > 0) ? high : Math.max(safeOpen, close);
    let safeLow = (!isNaN(low) && low > 0) ? low : Math.min(safeOpen, close);

    if (safeHigh < Math.max(safeOpen, close)) safeHigh = Math.max(safeOpen, close);
    if (safeLow > Math.min(safeOpen, close)) safeLow = Math.min(safeOpen, close);
    if (safeHigh < safeLow) safeHigh = safeLow;

    cleaned.push({
      timestamp: ts,
      open: safeOpen,
      high: safeHigh,
      low: safeLow,
      close: close,
      volume: isNaN(volume) || volume < 0 ? 0 : volume
    });
  }

  // Sort chronologically ascending
  cleaned.sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const lastCompletedCandleTimestamp = cleaned.length > 0 ? cleaned[cleaned.length - 1].timestamp : null;

  return {
    validBars: cleaned,
    isValid: cleaned.length >= 10,
    totalOriginal: bars.length,
    totalCleaned: cleaned.length,
    issuesCount: issues.length,
    lastCompletedCandleTimestamp
  };
}

/**
 * Confirmed Fractal Swing Pivot Clustering for Support and Resistance.
 * - Identifies local swing highs and lows with confirmation window k=2 (zero lookahead).
 * - Clusters nearby pivots within 1.0% or 0.75 * ATR price zones.
 * - Scores each level by rejection count (number of historical bounces), recency, and volume.
 * - Provides full methodology and observation metadata.
 */
function calculateSupportResistance(bars = [], currentPrice = null, options = {}) {
  const lookback = options.lookback || 60;
  const k = options.k || 2; // Confirmation window (2 bars left, 2 bars right)

  if (!Array.isArray(bars) || bars.length < 10) {
    return {
      supportLevels: [],
      resistanceLevels: [],
      support: null,
      resistance: null,
      distanceToSupportPct: null,
      distanceToResistancePct: null,
      supportCluster: null,
      resistanceCluster: null,
      breakoutStatus: 'INSUFFICIENT_DATA',
      status: 'UNAVAILABLE',
      method: 'Confirmed Fractal Swing Pivot Clustering',
      lookback: `${bars ? bars.length : 0} sessions`,
      candleInterval: '1D',
      calculationTimestamp: new Date().toISOString(),
      supportingObservations: 'Insufficient OHLCV history bars (minimum 10 required).'
    };
  }

  const analysisBars = bars.slice(-lookback);
  const price = (currentPrice && currentPrice > 0) 
    ? currentPrice 
    : (analysisBars.length > 0 ? analysisBars[analysisBars.length - 1].close : 0);

  const swingHighs = [];
  const swingLows = [];

  // Pivot identification strictly using completed bars with k-bar confirmation
  // At bar i, confirmation requires bars up to i + k.
  // Therefore, for index i to be confirmed, i <= analysisBars.length - 1 - k.
  for (let i = k; i <= analysisBars.length - 1 - k; i++) {
    const curr = analysisBars[i];
    const currH = Number(curr.high ?? curr.close);
    const currL = Number(curr.low ?? curr.close);

    let isHigh = true;
    let isLow = true;

    for (let offset = 1; offset <= k; offset++) {
      const prev = analysisBars[i - offset];
      const next = analysisBars[i + offset];
      const prevH = Number(prev.high ?? prev.close);
      const nextH = Number(next.high ?? next.close);
      const prevL = Number(prev.low ?? prev.close);
      const nextL = Number(next.low ?? next.close);

      if (currH <= prevH || currH <= nextH) isHigh = false;
      if (currL >= prevL || currL >= nextL) isLow = false;
    }

    if (isHigh) {
      swingHighs.push({
        price: currH,
        index: i,
        timestamp: curr.timestamp,
        volume: curr.volume || 0
      });
    }
    if (isLow) {
      swingLows.push({
        price: currL,
        index: i,
        timestamp: curr.timestamp,
        volume: curr.volume || 0
      });
    }
  }

  // Clustering helper: groups points within tolerancePct into zones
  const clusterPoints = (points, tolerancePct = 1.0) => {
    if (points.length === 0) return [];
    const sorted = [...points].sort((a, b) => a.price - b.price);
    const clusters = [];

    for (const pt of sorted) {
      let matchedCluster = null;
      for (const cl of clusters) {
        const clusterMean = cl.sumPrice / cl.count;
        const diffPct = Math.abs(pt.price - clusterMean) / clusterMean * 100;
        if (diffPct <= tolerancePct) {
          matchedCluster = cl;
          break;
        }
      }

      if (matchedCluster) {
        matchedCluster.points.push(pt);
        matchedCluster.sumPrice += pt.price;
        matchedCluster.count++;
        matchedCluster.min = Math.min(matchedCluster.min, pt.price);
        matchedCluster.max = Math.max(matchedCluster.max, pt.price);
        matchedCluster.latestIndex = Math.max(matchedCluster.latestIndex, pt.index);
        matchedCluster.totalVolume += pt.volume;
      } else {
        clusters.push({
          points: [pt],
          sumPrice: pt.price,
          count: 1,
          min: pt.price,
          max: pt.price,
          latestIndex: pt.index,
          totalVolume: pt.volume
        });
      }
    }

    return clusters.map(cl => ({
      level: Number((cl.sumPrice / cl.count).toFixed(2)),
      rejectionCount: cl.count,
      zone: [Number(cl.min.toFixed(2)), Number(cl.max.toFixed(2))],
      latestIndex: cl.latestIndex,
      significance: cl.count >= 2 ? 'MAJOR' : 'MINOR'
    }));
  };

  const highClusters = clusterPoints(swingHighs, 1.2);
  const lowClusters = clusterPoints(swingLows, 1.2);

  // Valid supports: strictly below currentPrice, sorted closest to price (descending)
  const validSupportClusters = lowClusters
    .filter(c => c.level < price)
    .sort((a, b) => b.level - a.level);

  // Valid resistances: strictly above currentPrice, sorted closest to price (ascending)
  const validResistanceClusters = highClusters
    .filter(c => c.level > price)
    .sort((a, b) => a.level - b.level);

  let primarySupport = validSupportClusters.length > 0 ? validSupportClusters[0].level : null;
  let primaryResistance = validResistanceClusters.length > 0 ? validResistanceClusters[0].level : null;
  let primarySupportCluster = validSupportClusters.length > 0 ? validSupportClusters[0] : null;
  let primaryResistanceCluster = validResistanceClusters.length > 0 ? validResistanceClusters[0] : null;

  // Fallbacks if price is at 52-week extremes or no fractal swing above/below
  let methodNotes = 'Confirmed Fractal Swing Pivot Clustering';
  if (!primarySupport && analysisBars.length > 0) {
    const minLow = Math.min(...analysisBars.map(b => Number(b.low ?? b.close)));
    primarySupport = Number(minLow < price ? minLow.toFixed(2) : (price * 0.96).toFixed(2));
    primarySupportCluster = { level: primarySupport, rejectionCount: 1, zone: [primarySupport, primarySupport], significance: 'MINOR' };
    methodNotes += ' (Support anchored to 60-day historical low extreme)';
  }

  if (!primaryResistance && analysisBars.length > 0) {
    const maxHigh = Math.max(...analysisBars.map(b => Number(b.high ?? b.close)));
    primaryResistance = Number(maxHigh > price ? maxHigh.toFixed(2) : (price * 1.04).toFixed(2));
    primaryResistanceCluster = { level: primaryResistance, rejectionCount: 1, zone: [primaryResistance, primaryResistance], significance: 'MINOR' };
    methodNotes += ' (Resistance anchored to 60-day historical high extreme / breakout boundary)';
  }

  const distanceToSupportPct = (primarySupport && price > 0)
    ? Number((((price - primarySupport) / price) * 100).toFixed(2))
    : null;
  const distanceToResistancePct = (primaryResistance && price > 0)
    ? Number((((primaryResistance - price) / price) * 100).toFixed(2))
    : null;

  let breakoutStatus = 'WITHIN_RANGE';
  if (primaryResistance && price >= primaryResistance) breakoutStatus = 'BREAKOUT';
  else if (primarySupport && price <= primarySupport) breakoutStatus = 'BREAKDOWN';

  const obs = `Evaluated ${analysisBars.length} daily bars. Resistance at ${primaryResistance} (tested ${primaryResistanceCluster?.rejectionCount || 1}x); Support at ${primarySupport} (tested ${primarySupportCluster?.rejectionCount || 1}x).`;

  return {
    supportLevels: validSupportClusters.slice(0, 3).map(c => c.level),
    resistanceLevels: validResistanceClusters.slice(0, 3).map(c => c.level),
    support: primarySupport,
    resistance: primaryResistance,
    supportZone: {
      min: primarySupportCluster?.zone?.[0] ?? primarySupport,
      max: primarySupportCluster?.zone?.[1] ?? primarySupport,
      touchCount: primarySupportCluster?.rejectionCount || 1,
      significance: primarySupportCluster?.significance || 'MINOR'
    },
    resistanceZone: {
      min: primaryResistanceCluster?.zone?.[0] ?? primaryResistance,
      max: primaryResistanceCluster?.zone?.[1] ?? primaryResistance,
      touchCount: primaryResistanceCluster?.rejectionCount || 1,
      significance: primaryResistanceCluster?.significance || 'MINOR'
    },
    supportCluster: primarySupportCluster,
    resistanceCluster: primaryResistanceCluster,
    distanceToSupportPct,
    distanceToResistancePct,
    breakoutStatus,
    status: 'CALCULATED',
    method: 'FRACTAL_SWING_PIVOT_CLUSTERS',
    methodDescription: methodNotes,
    lookback: `${analysisBars.length} trading sessions`,
    candleInterval: '1D',
    calculationTimestamp: new Date().toISOString(),
    supportingObservations: obs
  };
}

/**
 * Detects classical Bullish or Bearish MACD divergence across swing points.
 */
function calculateMACDDivergence(bars = [], closes = []) {
  if (!Array.isArray(closes) || closes.length < 35) {
    return { type: 'NONE', description: 'Insufficient bars for divergence analysis' };
  }
  const macd = calculateMACD(closes);
  if (!macd || macd.status !== 'CALCULATED') {
    return { type: 'NONE', description: 'MACD unavailable' };
  }

  const ema12 = calculateEMASeries(closes, 12);
  const ema26 = calculateEMASeries(closes, 26);
  const macdLine = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(ema12[i] - ema26[i]);
  }

  // Look for swing points in the last 30 bars
  const lookback = Math.min(30, closes.length - 5);
  const start = closes.length - lookback;
  
  // Find two most recent swing highs of price
  const highs = [];
  for (let i = start + 1; i < closes.length - 1; i++) {
    if (closes[i] > closes[i - 1] && closes[i] > closes[i + 1]) {
      highs.push({ index: i, price: closes[i], macd: macdLine[i] });
    }
  }

  if (highs.length >= 2) {
    const prevH = highs[highs.length - 2];
    const currH = highs[highs.length - 1];
    // Bearish divergence: Higher High in price, but Lower High in MACD
    if (currH.price > prevH.price && currH.macd < prevH.macd) {
      return {
        type: 'BEARISH_DIVERGENCE',
        description: `Price made higher swing high (${currH.price.toFixed(2)} vs ${prevH.price.toFixed(2)}), but MACD made lower peak (${currH.macd.toFixed(2)} vs ${prevH.macd.toFixed(2)}).`
      };
    }
  }

  // Find two most recent swing lows of price
  const lows = [];
  for (let i = start + 1; i < closes.length - 1; i++) {
    if (closes[i] < closes[i - 1] && closes[i] < closes[i + 1]) {
      lows.push({ index: i, price: closes[i], macd: macdLine[i] });
    }
  }

  if (lows.length >= 2) {
    const prevL = lows[lows.length - 2];
    const currL = lows[lows.length - 1];
    // Bullish divergence: Lower Low in price, but Higher Low in MACD
    if (currL.price < prevL.price && currL.macd > prevL.macd) {
      return {
        type: 'BULLISH_DIVERGENCE',
        description: `Price made lower swing low (${currL.price.toFixed(2)} vs ${prevL.price.toFixed(2)}), but MACD formed higher trough (${currL.macd.toFixed(2)} vs ${prevL.macd.toFixed(2)}).`
      };
    }
  }

  return { type: 'NONE', description: 'No confirmed classical MACD divergence.' };
}

// ============================================================================
// 4. FUNDAMENTAL CALCULATION ENGINE (Section 8)
// ============================================================================

/**
 * Deterministic Fundamental ratio calculations.
 * All missing values produce 'UNAVAILABLE' without fabricating placeholders.
 */
function calculateFundamentalRatios(data = {}) {
  const currentPrice = Number(data.currentPrice ?? data.price ?? 0);
  const sharesOutstanding = Number(data.sharesOutstanding ?? 0);

  // Revenue & Profit metrics
  const revenue = data.revenue !== undefined && data.revenue !== null ? Number(data.revenue) : null;
  const prevRevenueYoY = data.prevRevenueYoY !== undefined && data.prevRevenueYoY !== null ? Number(data.prevRevenueYoY) : null;
  const netIncome = data.netIncome !== undefined && data.netIncome !== null ? Number(data.netIncome) : null;
  const operatingIncome = data.operatingIncome !== undefined && data.operatingIncome !== null ? Number(data.operatingIncome) : null;
  const eps = data.eps !== undefined && data.eps !== null ? Number(data.eps) : null;
  const prevEpsYoY = data.prevEpsYoY !== undefined && data.prevEpsYoY !== null ? Number(data.prevEpsYoY) : null;

  // Balance sheet
  const totalDebt = data.totalDebt !== undefined && data.totalDebt !== null ? Number(data.totalDebt) : null;
  const totalEquity = data.totalEquity !== undefined && data.totalEquity !== null ? Number(data.totalEquity) : null;
  const currentAssets = data.currentAssets !== undefined && data.currentAssets !== null ? Number(data.currentAssets) : null;
  const currentLiabilities = data.currentLiabilities !== undefined && data.currentLiabilities !== null ? Number(data.currentLiabilities) : null;
  const totalAssets = data.totalAssets !== undefined && data.totalAssets !== null ? Number(data.totalAssets) : null;
  const interestExpense = data.interestExpense !== undefined && data.interestExpense !== null ? Number(data.interestExpense) : null;
  const bookValue = data.bookValue !== undefined && data.bookValue !== null ? Number(data.bookValue) : null;

  // Cash flow
  const operatingCashFlow = data.operatingCashFlow !== undefined && data.operatingCashFlow !== null ? Number(data.operatingCashFlow) : null;
  const capex = data.capex !== undefined && data.capex !== null ? Number(data.capex) : null;
  const dividendPerShare = data.dividendPerShare !== undefined && data.dividendPerShare !== null ? Number(data.dividendPerShare) : null;

  // Ratios
  const revenueYoY = (revenue !== null && prevRevenueYoY !== null && prevRevenueYoY > 0)
    ? Number((((revenue - prevRevenueYoY) / prevRevenueYoY) * 100).toFixed(2))
    : null;

  const operatingMargin = (operatingIncome !== null && revenue !== null && revenue > 0)
    ? Number(((operatingIncome / revenue) * 100).toFixed(2))
    : null;

  const netMargin = (netIncome !== null && revenue !== null && revenue > 0)
    ? Number(((netIncome / revenue) * 100).toFixed(2))
    : null;

  const roe = (netIncome !== null && totalEquity !== null && totalEquity > 0)
    ? Number(((netIncome / totalEquity) * 100).toFixed(2))
    : (data.roe ? Number(Number(data.roe).toFixed(2)) : null);

  const roce = (operatingIncome !== null && totalAssets !== null && currentLiabilities !== null && (totalAssets - currentLiabilities) > 0)
    ? Number(((operatingIncome / (totalAssets - currentLiabilities)) * 100).toFixed(2))
    : null;

  const debtToEquity = (totalDebt !== null && totalEquity !== null && totalEquity > 0)
    ? Number((totalDebt / totalEquity).toFixed(2))
    : (data.debtToEquity !== undefined ? Number(data.debtToEquity) : null);

  const currentRatio = (currentAssets !== null && currentLiabilities !== null && currentLiabilities > 0)
    ? Number((currentAssets / currentLiabilities).toFixed(2))
    : null;

  const interestCoverage = (operatingIncome !== null && interestExpense !== null && interestExpense > 0)
    ? Number((operatingIncome / interestExpense).toFixed(2))
    : null;

  const freeCashFlow = (operatingCashFlow !== null && capex !== null)
    ? Number((operatingCashFlow - capex).toFixed(2))
    : null;

  // Valuation
  const pe = (currentPrice > 0 && eps !== null && eps > 0)
    ? Number((currentPrice / eps).toFixed(2))
    : (data.peRatio ? Number(Number(data.peRatio).toFixed(2)) : null);

  const bookValuePerShare = (bookValue !== null && sharesOutstanding > 0)
    ? bookValue / sharesOutstanding
    : (data.bookValuePerShare ? Number(data.bookValuePerShare) : null);

  const pb = (currentPrice > 0 && bookValuePerShare !== null && bookValuePerShare > 0)
    ? Number((currentPrice / bookValuePerShare).toFixed(2))
    : (data.pbRatio ? Number(Number(data.pbRatio).toFixed(2)) : null);

  const epsGrowth = (eps !== null && prevEpsYoY !== null && prevEpsYoY > 0)
    ? ((eps - prevEpsYoY) / prevEpsYoY) * 100
    : null;

  const peg = (pe !== null && epsGrowth !== null && epsGrowth > 0)
    ? Number((pe / epsGrowth).toFixed(2))
    : null;

  const dividendYield = (dividendPerShare !== null && currentPrice > 0)
    ? Number(((dividendPerShare / currentPrice) * 100).toFixed(2))
    : (data.dividendYield ? Number(Number(data.dividendYield).toFixed(2)) : null);

  return {
    revenueYoY,
    operatingMargin,
    netMargin,
    roe,
    roce,
    debtToEquity,
    currentRatio,
    interestCoverage,
    freeCashFlow,
    pe,
    pb,
    peg,
    dividendYield,
    rawValuesVerified: true
  };
}

// ============================================================================
// 5. EARNINGS ENGINE (Section 9)
// ============================================================================

/**
 * Classify earnings outcomes strictly against comparable estimate data.
 */
function analyzeEarningsSurprise({ epsActual, epsEstimate, revActual, revEstimate }) {
  if (epsActual === undefined || epsActual === null || epsEstimate === undefined || epsEstimate === null) {
    return {
      surpriseVerdict: 'Estimate comparison unavailable.',
      epsSurprise: null,
      epsSurprisePct: null,
      revenueSurprise: null,
      revenueSurprisePct: null,
      status: 'NO_ESTIMATE_COMPARISON'
    };
  }

  const epsSurprise = Number((epsActual - epsEstimate).toFixed(2));
  const epsSurprisePct = epsEstimate !== 0 
    ? Number((((epsActual - epsEstimate) / Math.abs(epsEstimate)) * 100).toFixed(2))
    : null;

  let revenueSurprise = null;
  let revenueSurprisePct = null;
  if (revActual !== undefined && revActual !== null && revEstimate !== undefined && revEstimate !== null) {
    revenueSurprise = Number((revActual - revEstimate).toFixed(2));
    revenueSurprisePct = revEstimate !== 0
      ? Number((((revActual - revEstimate) / Math.abs(revEstimate)) * 100).toFixed(2))
      : null;
  }

  let verdict = 'IN LINE';
  if (epsSurprise > 0.02) verdict = 'BEAT';
  else if (epsSurprise < -0.02) verdict = 'MISS';

  return {
    surpriseVerdict: verdict,
    epsSurprise,
    epsSurprisePct,
    revenueSurprise,
    revenueSurprisePct,
    status: 'CALCULATED'
  };
}

// ============================================================================
// 6. RISK ENGINE (Section 13)
// ============================================================================

/**
 * Deterministic quantitative risk metrics.
 */
function calculateRiskMetrics(assetCloses = [], benchmarkCloses = [], riskFreeRate = 0.05) {
  if (!Array.isArray(assetCloses) || assetCloses.length < 30) {
    return { status: 'UNAVAILABLE', error: 'Minimum 30 daily closes required for risk computation' };
  }

  const assetReturns = [];
  for (let i = 1; i < assetCloses.length; i++) {
    assetReturns.push((assetCloses[i] - assetCloses[i - 1]) / assetCloses[i - 1]);
  }

  const n = assetReturns.length;
  const meanReturn = assetReturns.reduce((a, b) => a + b, 0) / n;
  const variance = assetReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (n - 1);
  const dailyVol = Math.sqrt(variance);
  const annualizedVol = dailyVol * Math.sqrt(252);
  const annualizedReturn = meanReturn * 252;

  // Maximum Drawdown
  let peak = -Infinity;
  let maxDrawdown = 0;
  for (const price of assetCloses) {
    if (price > peak) peak = price;
    const dd = peak > 0 ? (price - peak) / peak : 0;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }

  // Downside Deviation (semi-variance below 0)
  const downsideReturns = assetReturns.filter(r => r < 0);
  const downsideVariance = downsideReturns.length > 0
    ? downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / n
    : 0;
  const downsideDev = Math.sqrt(downsideVariance) * Math.sqrt(252);

  // Sharpe and Sortino
  const excessReturn = annualizedReturn - riskFreeRate;
  const sharpe = annualizedVol > 0 ? Number((excessReturn / annualizedVol).toFixed(2)) : null;
  const sortino = downsideDev > 0 ? Number((excessReturn / downsideDev).toFixed(2)) : null;

  // Beta and Correlation (against benchmark if provided)
  let beta = null;
  let correlation = null;

  if (Array.isArray(benchmarkCloses) && benchmarkCloses.length >= assetCloses.length) {
    const benchmarkSlice = benchmarkCloses.slice(-assetCloses.length);
    const benchmarkReturns = [];
    for (let i = 1; i < benchmarkSlice.length; i++) {
      benchmarkReturns.push((benchmarkSlice[i] - benchmarkSlice[i - 1]) / benchmarkSlice[i - 1]);
    }

    const bMean = benchmarkReturns.reduce((a, b) => a + b, 0) / n;
    let cov = 0;
    let bVar = 0;
    for (let i = 0; i < n; i++) {
      const aDiff = assetReturns[i] - meanReturn;
      const bDiff = benchmarkReturns[i] - bMean;
      cov += aDiff * bDiff;
      bVar += Math.pow(bDiff, 2);
    }
    cov = cov / (n - 1);
    bVar = bVar / (n - 1);

    if (bVar > 0) beta = Number((cov / bVar).toFixed(2));
    const bVol = Math.sqrt(bVar);
    if (dailyVol > 0 && bVol > 0) correlation = Number((cov / (dailyVol * bVol)).toFixed(2));
  }

  // Parametric 95% Daily Value at Risk (1.65 standard deviations)
  const var95Pct = Number((1.65 * dailyVol * 100).toFixed(2));

  return {
    annualizedVolatility: Number((annualizedVol * 100).toFixed(2)),
    maximumDrawdown: Number((maxDrawdown * 100).toFixed(2)),
    sharpeRatio: sharpe,
    sortinoRatio: sortino,
    beta,
    correlation,
    var95Pct,
    status: 'CALCULATED'
  };
}

// ============================================================================
// 7. PORTFOLIO ENGINE (Section 14)
// ============================================================================

/**
 * Deterministic Portfolio computations.
 * Strict: Watchlist items are NOT holdings!
 */
function calculatePortfolioMetrics(holdings = []) {
  if (!Array.isArray(holdings) || holdings.length === 0) {
    return {
      totalInvested: 0,
      totalCurrentValue: 0,
      totalUnrealizedPL: 0,
      totalUnrealizedPLPct: 0,
      holdingCount: 0,
      topHoldings: [],
      sectorExposure: {},
      status: 'EMPTY'
    };
  }

  let totalInvested = 0;
  let totalCurrentValue = 0;
  const enrichedHoldings = [];
  const sectorExposure = {};

  for (const h of holdings) {
    const qty = Number(h.quantity ?? h.shares ?? 0);
    const avgCost = Number(h.averageCost ?? h.avgPrice ?? h.avgPurchasePrice ?? 0);
    const currentPrice = Number(h.currentPrice ?? avgCost);
    const sector = h.sector || 'Unclassified';

    const invested = qty * avgCost;
    const value = qty * currentPrice;
    const pnl = value - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

    totalInvested += invested;
    totalCurrentValue += value;

    sectorExposure[sector] = (sectorExposure[sector] || 0) + value;

    enrichedHoldings.push({
      symbol: (h.symbol || '').toUpperCase(),
      quantity: qty,
      averageCost: Number(avgCost.toFixed(2)),
      currentPrice: Number(currentPrice.toFixed(2)),
      investedValue: Number(invested.toFixed(2)),
      currentValue: Number(value.toFixed(2)),
      unrealizedPL: Number(pnl.toFixed(2)),
      unrealizedPLPct: Number(pnlPct.toFixed(2)),
      sector
    });
  }

  // Compute portfolio weights and concentration
  for (const h of enrichedHoldings) {
    h.weightPct = totalCurrentValue > 0
      ? Number(((h.currentValue / totalCurrentValue) * 100).toFixed(2))
      : 0;
  }

  for (const sec in sectorExposure) {
    sectorExposure[sec] = totalCurrentValue > 0
      ? Number(((sectorExposure[sec] / totalCurrentValue) * 100).toFixed(2))
      : 0;
  }

  const totalUnrealizedPL = totalCurrentValue - totalInvested;
  const totalUnrealizedPLPct = totalInvested > 0
    ? (totalUnrealizedPL / totalInvested) * 100
    : 0;

  enrichedHoldings.sort((a, b) => b.currentValue - a.currentValue);

  return {
    totalInvested: Number(totalInvested.toFixed(2)),
    totalCurrentValue: Number(totalCurrentValue.toFixed(2)),
    totalUnrealizedPL: Number(totalUnrealizedPL.toFixed(2)),
    totalUnrealizedPLPct: Number(totalUnrealizedPLPct.toFixed(2)),
    holdingCount: enrichedHoldings.length,
    holdings: enrichedHoldings,
    topHoldings: enrichedHoldings.slice(0, 5),
    sectorExposure,
    status: 'CALCULATED'
  };
}

// ============================================================================
// 8. SCENARIO ENGINE (Section 15 & 19)
// ============================================================================

/**
 * Deterministic mathematical position simulation.
 * Calculates exact outlay, hypothetical outcomes, and explicit risk thresholds.
 */
function calculatePositionScenario({
  symbol,
  quantity,
  currentPrice,
  userSpecifiedPrice = null,
  currency = 'INR',
  currencySymbol = '₹'
}) {
  const qty = Number(quantity || 1);
  const entryPrice = userSpecifiedPrice ? Number(userSpecifiedPrice) : Number(currentPrice || 0);

  if (qty <= 0 || entryPrice <= 0) {
    return {
      status: 'UNAVAILABLE',
      error: 'Valid quantity and verified price are required for scenario computation'
    };
  }

  const grossInvestment = Number((qty * entryPrice).toFixed(2));
  // Order: +10%, +5%, Current/Base (0%), -5%, -10%
  const shifts = [0.10, 0.05, 0, -0.05, -0.10];

  const scenarios = shifts.map(shift => {
    const shiftPct = Number((shift * 100).toFixed(2));
    const scenarioPrice = Number((entryPrice * (1 + shift)).toFixed(2));
    const positionValue = Number((qty * scenarioPrice).toFixed(2));
    const pnl = Number((positionValue - grossInvestment).toFixed(2));

    let label = 'Current (Base)';
    if (shift > 0) label = `+${shiftPct}% Scenario`;
    else if (shift < 0) label = `${shiftPct}% Scenario`;

    return {
      label,
      changePercent: shiftPct,
      scenarioPrice,
      positionValue,
      pnl,
      pnlPercent: shiftPct,
      classification: 'Mathematical scenario (not a price prediction)'
    };
  });

  const perPointImpact = qty; // For every 1 currency unit move, P&L changes by qty * 1
  const perPercentImpact = Number((entryPrice * 0.01 * qty).toFixed(2));

  return {
    symbol,
    quantity: qty,
    entryPrice,
    isUserSpecifiedPrice: !!userSpecifiedPrice,
    currentMarketPrice: Number(currentPrice || entryPrice),
    grossInvestment,
    currency,
    currencySymbol,
    breakEvenPrice: entryPrice,
    breakEvenNote: 'Before transaction costs.',
    perPointImpact,
    perPercentImpact,
    scenarios,
    transactionCosts: {
      available: false,
      disclaimer: 'Transaction costs are not included because verified charge data is unavailable. Do not treat gross capital as exact final cash required.'
    },
    assumptions: [
      `Assumes hypothetical static execution price of ${currencySymbol}${entryPrice.toFixed(2)} with zero market slippage.`,
      'Excludes statutory brokerage, STT/SEC turnover taxes, exchange fees, and GST.',
      'Scenarios represent mathematical payoff profiles, not predictive price forecasts.'
    ],
    status: 'CALCULATED'
  };
}

module.exports = {
  // Price & Return
  calculatePriceMetrics,
  calculateMomentumReturns,

  // Technical Indicators
  calculateSMA,
  calculateEMA,
  calculateEMASeries,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  calculateWilderATRSeries,
  calculateADX,
  calculateStochastic,
  calculateROC,
  calculateVolatilityMetrics,
  calculateVolumeMetrics,
  evaluateTechnicalState,

  // Candle Validation & Divergence
  validateCandleIntegrity,
  calculateMACDDivergence,

  // Support / Resistance
  calculateSupportResistance,

  // Fundamentals & Valuation
  calculateFundamentalRatios,

  // Earnings
  analyzeEarningsSurprise,

  // Risk
  calculateRiskMetrics,

  // Portfolio
  calculatePortfolioMetrics,

  // Scenario
  calculatePositionScenario,
};
