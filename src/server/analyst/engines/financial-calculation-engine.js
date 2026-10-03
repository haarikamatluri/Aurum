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
 * Exponential Moving Average (EMA).
 */
function calculateEMA(data, period) {
  if (!Array.isArray(data) || data.length === 0 || period <= 0) return null;
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return Number(ema.toFixed(2));
}

/**
 * Calculate continuous EMA series.
 */
function calculateEMASeries(data, period) {
  if (!Array.isArray(data) || data.length === 0 || period <= 0) return [];
  const k = 2 / (period + 1);
  const series = [data[0]];
  for (let i = 1; i < data.length; i++) {
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
 * Signal Line = 9-period EMA of MACD Line series (NEVER fake macd * 0.85!)
 * Histogram = MACD Line - Signal Line
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

  return { line, signal, histogram, status: 'CALCULATED' };
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

  const trs = [];
  for (let i = 1; i < bars.length; i++) {
    const curr = bars[i];
    const prev = bars[i - 1];
    const h = Number(curr.high ?? curr.close);
    const l = Number(curr.low ?? curr.close);
    const prevC = Number(prev.close);

    const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    trs.push(tr);
  }

  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return Number(atr.toFixed(2));
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
 * Deterministic Support and Resistance level detection from OHLCV bars.
 */
function calculateSupportResistance(bars = [], currentPrice = null) {
  if (!Array.isArray(bars) || bars.length < 10) {
    return {
      supportLevels: [],
      resistanceLevels: [],
      support: null,
      resistance: null,
      distanceToSupportPct: null,
      distanceToResistancePct: null,
      breakoutStatus: 'NEUTRAL',
      status: 'UNAVAILABLE'
    };
  }

  const swingHighs = [];
  const swingLows = [];

  for (let i = 2; i < bars.length - 2; i++) {
    const prev2 = bars[i - 2];
    const prev1 = bars[i - 1];
    const curr = bars[i];
    const next1 = bars[i + 1];
    const next2 = bars[i + 2];

    const h = Number(curr.high ?? curr.close);
    const l = Number(curr.low ?? curr.close);

    if (h > prev2.high && h > prev1.high && h > next1.high && h > next2.high) {
      swingHighs.push(h);
    }
    if (l < prev2.low && l < prev1.low && l < next1.low && l < next2.low) {
      swingLows.push(l);
    }
  }

  const price = currentPrice || (bars.length > 0 ? bars[bars.length - 1].close : 0);

  // Filter supports strictly below current price and resistance strictly above
  const validSupports = swingLows.filter(l => l < price).sort((a, b) => b - a);
  const validResistances = swingHighs.filter(h => h > price).sort((a, b) => a - b);

  const primarySupport = validSupports.length > 0 ? Number(validSupports[0].toFixed(2)) : null;
  const primaryResistance = validResistances.length > 0 ? Number(validResistances[0].toFixed(2)) : null;

  const distanceToSupportPct = (primarySupport && price > 0)
    ? Number((((price - primarySupport) / price) * 100).toFixed(2))
    : null;
  const distanceToResistancePct = (primaryResistance && price > 0)
    ? Number((((primaryResistance - price) / price) * 100).toFixed(2))
    : null;

  let breakoutStatus = 'WITHIN_RANGE';
  if (primaryResistance && price >= primaryResistance) breakoutStatus = 'BREAKOUT';
  else if (primarySupport && price <= primarySupport) breakoutStatus = 'BREAKDOWN';

  return {
    supportLevels: validSupports.slice(0, 3).map(s => Number(s.toFixed(2))),
    resistanceLevels: validResistances.slice(0, 3).map(r => Number(r.toFixed(2))),
    support: primarySupport,
    resistance: primaryResistance,
    distanceToSupportPct,
    distanceToResistancePct,
    breakoutStatus,
    status: 'CALCULATED'
  };
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
  calculateADX,
  calculateStochastic,
  calculateROC,
  calculateVolatilityMetrics,
  calculateVolumeMetrics,
  evaluateTechnicalState,

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
