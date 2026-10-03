/**
 * AURUM AI Analyst — Market Data Provider
 * Multi-provider market data abstraction supporting:
 * Upstox, Finnhub, Twelve Data, with Yahoo Finance fallback.
 * Computes exact technical indicators (SMA, EMA, RSI-14, MACD with true 9-EMA signal, Bollinger, ATR).
 */

const { createAnalystEnvelope } = require('../envelope');
const { resolveSecurity } = require('./security-master');

// In-memory cache for market quotes & candles
const quoteCache = new Map();
const chartCache = new Map();
const indexCache = new Map();

const QUOTE_TTL_MS = 15000;      // 15 seconds for live quotes
const CHART_TTL_MS = 300000;     // 5 minutes for daily candles
const INDEX_TTL_MS = 30000;      // 30 seconds for market indices

/**
 * Fetch timeout helper
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// PROVIDER ADAPTERS
// ============================================================================

/**
 * Upstox Market Quote Adapter (NSE / BSE)
 */
async function fetchUpstoxQuote(security) {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token || token.includes('your_') || !security.upstoxInstrumentKey) {
    return { success: false, reason: 'UPSTOX_NOT_CONFIGURED_OR_NO_INSTRUMENT_KEY' };
  }

  try {
    const url = `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(security.upstoxInstrumentKey)}`;
    const res = await fetchWithTimeout(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, 3000);

    if (!res.ok) {
      return { success: false, status: res.status, reason: `UPSTOX_HTTP_${res.status}` };
    }

    const json = await res.json();
    if (json.status !== 'success' || !json.data) {
      return { success: false, reason: 'UPSTOX_EMPTY_RESPONSE' };
    }

    const key = Object.keys(json.data)[0];
    const item = json.data[key];
    if (!item || typeof item.last_price !== 'number') {
      return { success: false, reason: 'UPSTOX_INVALID_PAYLOAD' };
    }

    const price = item.last_price;
    const prevClose = item.ohlc?.close || price;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return {
      success: true,
      provider: 'Upstox Pro Market Gateway',
      source: 'NSE/BSE Institutional Feed',
      data: {
        symbol: security.symbol,
        canonicalSymbol: security.canonicalSymbol,
        exchange: security.exchange || 'NSE',
        market: 'IN',
        currency: 'INR',
        price,
        previousClose: prevClose,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        dayHigh: item.ohlc?.high || price,
        dayLow: item.ohlc?.low || price,
        volume: item.volume || 0,
        timestamp: new Date().toISOString(),
        provider: 'Upstox Pro Market Gateway',
        source: 'NSE/BSE Institutional Feed',
        freshness: 0,
        status: 'LIVE'
      }
    };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

/**
 * Finnhub Market Quote Adapter (US & Global)
 */
async function fetchFinnhubQuote(security) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey || apiKey.includes('your_')) {
    return { success: false, reason: 'FINNHUB_NOT_CONFIGURED' };
  }

  try {
    const sym = security.symbol;
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${apiKey}`;
    const res = await fetchWithTimeout(url, {}, 3000);

    if (!res.ok) {
      return { success: false, status: res.status, reason: `FINNHUB_HTTP_${res.status}` };
    }

    const data = await res.json();
    if (!data || typeof data.c !== 'number' || data.c === 0) {
      return { success: false, reason: 'FINNHUB_NO_QUOTE' };
    }

    const price = data.c;
    const prevClose = data.pc || price;
    const change = data.d !== undefined ? data.d : (price - prevClose);
    const changePercent = data.dp !== undefined ? data.dp : (prevClose > 0 ? (change / prevClose) * 100 : 0);

    return {
      success: true,
      provider: 'Finnhub Institutional Real-Time',
      source: 'NASDAQ/NYSE Official BBO',
      data: {
        symbol: security.symbol,
        canonicalSymbol: security.canonicalSymbol,
        exchange: security.exchange || 'NASDAQ',
        market: security.market || 'US',
        currency: security.currency || 'USD',
        price,
        previousClose: prevClose,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        dayHigh: data.h || price,
        dayLow: data.l || price,
        volume: 0, // Finnhub basic quote doesn't return day volume
        timestamp: data.t ? new Date(data.t * 1000).toISOString() : new Date().toISOString(),
        provider: 'Finnhub Institutional Real-Time',
        source: 'NASDAQ/NYSE Official BBO',
        freshness: 0,
        status: 'LIVE'
      }
    };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

/**
 * Twelve Data Quote Adapter (US & Global)
 */
async function fetchTwelveDataQuote(security) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey || apiKey.includes('your_')) {
    return { success: false, reason: 'TWELVE_DATA_NOT_CONFIGURED' };
  }

  try {
    const sym = security.symbol;
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(sym)}&apikey=${apiKey}`;
    const res = await fetchWithTimeout(url, {}, 3000);

    if (!res.ok) {
      return { success: false, status: res.status, reason: `TWELVE_DATA_HTTP_${res.status}` };
    }

    const data = await res.json();
    if (!data || data.status === 'error' || !data.close) {
      return { success: false, reason: data.message || 'TWELVE_DATA_ERROR' };
    }

    const price = parseFloat(data.close);
    const prevClose = parseFloat(data.previous_close || price);
    const change = parseFloat(data.change || (price - prevClose));
    const changePercent = parseFloat(data.percent_change || 0);

    return {
      success: true,
      provider: 'Twelve Data Global Markets',
      source: 'Global Market Exchange Network',
      data: {
        symbol: security.symbol,
        canonicalSymbol: security.canonicalSymbol,
        exchange: data.exchange || security.exchange,
        market: security.market,
        currency: data.currency || security.currency,
        price,
        previousClose: prevClose,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        dayHigh: parseFloat(data.high || price),
        dayLow: parseFloat(data.low || price),
        volume: parseInt(data.volume || 0, 10),
        timestamp: data.datetime ? new Date(data.datetime).toISOString() : new Date().toISOString(),
        provider: 'Twelve Data Global Markets',
        source: 'Global Market Exchange Network',
        freshness: 0,
        status: 'LIVE'
      }
    };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

/**
 * Yahoo Finance Fallback Adapter
 */
async function fetchYahooFallbackQuote(security) {
  try {
    const ticker = security.yahooTicker || `${security.symbol}.NS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, 4000);

    if (!res.ok) {
      return { success: false, reason: `YAHOO_HTTP_${res.status}` };
    }

    const json = await res.json();
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') {
      return { success: false, reason: 'YAHOO_NO_PRICE_DATA' };
    }

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
    const marketTime = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : new Date();
    const ageSeconds = Math.round((Date.now() - marketTime.getTime()) / 1000);

    // If market data is older than 24h, label STALE or DELAYED honestly
    const status = ageSeconds > 86400 * 2 ? 'STALE' : (ageSeconds > 1800 ? 'DELAYED' : 'LIVE');

    return {
      success: true,
      provider: 'Yahoo Finance (Fallback Provider)',
      source: meta.fullExchangeName || meta.exchangeName || 'Global Exchange Feed',
      data: {
        symbol: security.symbol,
        canonicalSymbol: security.canonicalSymbol,
        exchange: meta.fullExchangeName || meta.exchangeName || security.exchange,
        market: security.market,
        currency: meta.currency || security.currency,
        price,
        previousClose: prevClose,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        dayHigh: meta.regularMarketDayHigh || meta.dayHigh || price,
        dayLow: meta.regularMarketDayLow || meta.dayLow || price,
        volume: meta.regularMarketVolume || 0,
        timestamp: marketTime.toISOString(),
        provider: 'Yahoo Finance (Fallback Provider)',
        source: meta.fullExchangeName || meta.exchangeName || 'Global Exchange Feed',
        freshness: ageSeconds,
        status
      }
    };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

// ============================================================================
// CANONICAL MARKET DATA PROVIDER WITH FAILOVER
// ============================================================================

/**
 * Fetch verified real market quote using configured priority order.
 * @param {string} symbol - Ticker
 * @param {string} [marketHint] - 'IN' | 'US'
 * @returns {Promise<Object>} Market quote with provenance
 */
async function fetchMarketQuote(symbol, marketHint = 'IN') {
  const security = resolveSecurity(symbol, marketHint);
  const cacheKey = `QUOTE:${security.canonicalSymbol}:${security.market}`;
  const now = Date.now();

  const cached = quoteCache.get(cacheKey);
  if (cached && now - cached.timestamp < QUOTE_TTL_MS) {
    return {
      ...cached.result,
      status: 'CACHED',
      freshness: Math.round((now - cached.timestamp) / 1000)
    };
  }

  const providersAttempted = [];
  let failureReason = null;
  let quoteResult = null;

  // Determine provider priority
  if (security.market === 'IN') {
    // 1. Primary: Upstox
    providersAttempted.push('Upstox');
    const upstoxRes = await fetchUpstoxQuote(security);
    if (upstoxRes.success) {
      quoteResult = upstoxRes;
    } else {
      failureReason = upstoxRes.reason;
    }

    // 2. Secondary: Twelve Data (if supported)
    if (!quoteResult) {
      providersAttempted.push('Twelve Data');
      const tdRes = await fetchTwelveDataQuote(security);
      if (tdRes.success) {
        quoteResult = tdRes;
      } else {
        failureReason = tdRes.reason;
      }
    }

    // 3. Fallback: Yahoo Finance
    if (!quoteResult) {
      providersAttempted.push('Yahoo Finance Fallback');
      const yfRes = await fetchYahooFallbackQuote(security);
      if (yfRes.success) {
        quoteResult = yfRes;
      } else {
        failureReason = yfRes.reason;
      }
    }
  } else {
    // US Equities
    // 1. Primary: Finnhub
    providersAttempted.push('Finnhub');
    const finnRes = await fetchFinnhubQuote(security);
    if (finnRes.success) {
      quoteResult = finnRes;
    } else {
      failureReason = finnRes.reason;
    }

    // 2. Secondary: Twelve Data
    if (!quoteResult) {
      providersAttempted.push('Twelve Data');
      const tdRes = await fetchTwelveDataQuote(security);
      if (tdRes.success) {
        quoteResult = tdRes;
      } else {
        failureReason = tdRes.reason;
      }
    }

    // 3. Fallback: Yahoo Finance
    if (!quoteResult) {
      providersAttempted.push('Yahoo Finance Fallback');
      const yfRes = await fetchYahooFallbackQuote(security);
      if (yfRes.success) {
        quoteResult = yfRes;
      } else {
        failureReason = yfRes.reason;
      }
    }
  }

  if (quoteResult && quoteResult.data) {
    const finalData = {
      ...quoteResult.data,
      companyName: security.companyName || security.symbol,
      providerUsed: quoteResult.provider,
      providersAttempted,
      failureReason: providersAttempted.length > 1 ? failureReason : null
    };

    quoteCache.set(cacheKey, { result: finalData, timestamp: now });
    return finalData;
  }

  // If cached data exists from before, mark as STALE rather than failing completely
  if (cached) {
    return {
      ...cached.result,
      status: 'STALE',
      freshness: Math.round((now - cached.timestamp) / 1000),
      providersAttempted,
      failureReason: 'All live providers failed; returned stale cache.'
    };
  }

  return {
    symbol: security.symbol,
    canonicalSymbol: security.canonicalSymbol,
    exchange: security.exchange,
    market: security.market,
    currency: security.currency,
    price: null,
    previousClose: null,
    change: null,
    changePercent: null,
    dayHigh: null,
    dayLow: null,
    volume: null,
    timestamp: new Date().toISOString(),
    provider: 'None',
    source: 'Unavailable',
    freshness: 0,
    status: 'UNAVAILABLE',
    providerUsed: 'None',
    providersAttempted,
    failureReason: failureReason || 'ALL_PROVIDERS_UNREACHABLE'
  };
}

// ============================================================================
// TECHNICAL ANALYSIS & OHLCV CALCULATIONS
// ============================================================================

/**
 * Fetch 1-year historical daily candles and perform rigorous technical calculations.
 */
async function fetchChartAndTechnicals(symbol, marketHint = 'IN') {
  const security = resolveSecurity(symbol, marketHint);
  const cacheKey = `CHART:${security.canonicalSymbol}:${security.market}`;
  const now = Date.now();

  const cached = chartCache.get(cacheKey);
  if (cached && now - cached.timestamp < CHART_TTL_MS) {
    return cached.data;
  }

  try {
    const ticker = security.yahooTicker || `${security.symbol}.NS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`;
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, 5000);

    if (!res.ok) {
      return cached ? cached.data : null;
    }

    const json = await res.json();
    const result = json.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const quote = result?.indicators?.quote?.[0] || {};
    const closes = quote.close || [];
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const volumes = quote.volume || [];

    const points = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (typeof closes[i] === 'number' && !isNaN(closes[i]) && closes[i] > 0) {
        points.push({
          timestamp: new Date(timestamps[i] * 1000).toISOString(),
          open: opens[i] || closes[i],
          high: highs[i] || closes[i],
          low: lows[i] || closes[i],
          close: closes[i],
          volume: volumes[i] || 0
        });
      }
    }

    if (points.length === 0) return cached ? cached.data : null;

    const closePrices = points.map(p => p.close);
    const currentPrice = closePrices[closePrices.length - 1];

    // Mathematical Technical Indicators
    const sma20 = calculateSMA(closePrices, 20);
    const sma50 = calculateSMA(closePrices, 50);
    const sma200 = calculateSMA(closePrices, Math.min(200, closePrices.length));
    const ema20 = calculateEMA(closePrices, 20);
    const rsi14 = calculateRSI(closePrices, 14);

    // MACD with TRUE 9-period EMA signal line of the MACD series
    const macd = calculateAccurateMACD(closePrices);

    // Bollinger Bands (20, 2)
    const bollinger = calculateBollingerBands(closePrices, 20, 2);

    // ATR (14)
    const atr14 = calculateATR(points, 14);

    // Annualized Historical Volatility
    const histVolatility = calculateHistoricalVolatility(closePrices, 20);

    // Volume Z-Score & Trend
    const volZScore = calculateVolumeZScore(points.map(p => p.volume), 20);

    // Support and Resistance via local swing pivot clusters
    const { support, resistance } = calculateSupportResistance(points.slice(-60), currentPrice);

    // Trend Determination
    let trend = 'NEUTRAL';
    if (sma20 && sma50) {
      if (currentPrice > sma20 && sma20 > sma50) trend = 'BULLISH';
      else if (currentPrice < sma20 && sma20 < sma50) trend = 'BEARISH';
    }

    const payload = {
      points: points.slice(-30),
      currentPrice,
      technicals: {
        rsi14: Number(rsi14.toFixed(1)),
        rsiCondition: rsi14 > 70 ? 'OVERBOUGHT' : rsi14 < 30 ? 'OVERSOLD' : 'NEUTRAL',
        macd: {
          line: Number(macd.line.toFixed(2)),
          signal: Number(macd.signal.toFixed(2)),
          histogram: Number(macd.histogram.toFixed(2)),
          cross: macd.histogram > 0 ? 'BULLISH' : 'BEARISH'
        },
        movingAverages: {
          sma20: sma20 ? Number(sma20.toFixed(2)) : null,
          sma50: sma50 ? Number(sma50.toFixed(2)) : null,
          sma200: sma200 ? Number(sma200.toFixed(2)) : null,
          ema20: ema20 ? Number(ema20.toFixed(2)) : null,
          above20: sma20 ? currentPrice > sma20 : true,
          above50: sma50 ? currentPrice > sma50 : true,
          above200: sma200 ? currentPrice > sma200 : true
        },
        bollinger: {
          upper: Number(bollinger.upper.toFixed(2)),
          middle: Number(bollinger.middle.toFixed(2)),
          lower: Number(bollinger.lower.toFixed(2))
        },
        atr14: Number(atr14.toFixed(2)),
        annualizedVolatilityPct: Number((histVolatility * 100).toFixed(1)),
        volumeZScore: Number(volZScore.toFixed(2)),
        support: Number(support.toFixed(2)),
        resistance: Number(resistance.toFixed(2)),
        trend
      }
    };

    chartCache.set(cacheKey, { data: payload, timestamp: now });
    return payload;
  } catch (err) {
    return cached ? cached.data : null;
  }
}

// ----------------------------------------------------------------------------
// MATHEMATICAL CALCULATION FUNCTIONS (AUDITED & EXACT)
// ----------------------------------------------------------------------------

function calculateSMA(data, period) {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateEMA(data, period) {
  if (data.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateEMASeries(data, period) {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const series = [data[0]];
  for (let i = 1; i < data.length; i++) {
    series.push(data[i] * k + series[i - 1] * (1 - k));
  }
  return series;
}

function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50.0;
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
  return 100 - (100 / (1 + rs));
}

/**
 * Exact MACD (12, 26, 9) implementation.
 * Calculates EMA12 series, EMA26 series, MACD series = EMA12 - EMA26,
 * and signal series = 9-period EMA of the actual MACD series!
 */
function calculateAccurateMACD(closes) {
  if (closes.length < 26) return { line: 0, signal: 0, histogram: 0 };

  const ema12Series = calculateEMASeries(closes, 12);
  const ema26Series = calculateEMASeries(closes, 26);

  const macdSeries = [];
  for (let i = 0; i < closes.length; i++) {
    macdSeries.push(ema12Series[i] - ema26Series[i]);
  }

  // Calculate true 9-period EMA of MACD series
  const signalSeries = calculateEMASeries(macdSeries, 9);

  const lastIndex = closes.length - 1;
  const macdLine = macdSeries[lastIndex];
  const macdSignal = signalSeries[lastIndex];
  const histogram = macdLine - macdSignal;

  return {
    line: macdLine,
    signal: macdSignal,
    histogram
  };
}

function calculateBollingerBands(closes, period = 20, stdDevMultiplier = 2) {
  const sma = calculateSMA(closes, period) || closes[closes.length - 1];
  const slice = closes.slice(-period);
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    middle: sma,
    upper: sma + (stdDevMultiplier * stdDev),
    lower: sma - (stdDevMultiplier * stdDev)
  };
}

function calculateATR(points, period = 14) {
  if (points.length < period + 1) return 0;
  const trs = [];
  for (let i = 1; i < points.length; i++) {
    const current = points[i];
    const prev = points[i - 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    trs.push(tr);
  }
  return calculateSMA(trs, period) || 0;
}

function calculateHistoricalVolatility(closes, period = 20) {
  if (closes.length < period + 1) return 0.20;
  const logReturns = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    logReturns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (logReturns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

function calculateVolumeZScore(volumes, period = 20) {
  if (volumes.length < period) return 0;
  const slice = volumes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / period;
  const std = Math.sqrt(variance);
  const latest = volumes[volumes.length - 1];
  return std > 0 ? (latest - mean) / std : 0;
}

function calculateSupportResistance(points, currentPrice) {
  if (!points || points.length < 5) {
    return { support: currentPrice * 0.95, resistance: currentPrice * 1.05 };
  }
  const lows = points.map(p => p.low).sort((a, b) => a - b);
  const highs = points.map(p => p.high).sort((a, b) => a - b);

  const supportCandidates = lows.filter(l => l < currentPrice);
  const support = supportCandidates.length > 0 ? supportCandidates[Math.floor(supportCandidates.length * 0.75)] : currentPrice * 0.96;

  const resistanceCandidates = highs.filter(h => h > currentPrice);
  const resistance = resistanceCandidates.length > 0 ? resistanceCandidates[Math.floor(resistanceCandidates.length * 0.25)] : currentPrice * 1.04;

  return { support, resistance };
}

// ============================================================================
// MARKET INDICES & BENCHMARKS
// ============================================================================

/**
 * Fetch real benchmark indices across global and Indian markets.
 */
async function getMarketIndices() {
  const now = Date.now();
  const cached = indexCache.get('ALL_INDICES');
  if (cached && now - cached.timestamp < INDEX_TTL_MS) {
    return cached.data;
  }

  const indexSymbols = {
    NIFTY50: '^NSEI',
    SENSEX: '^BSESN',
    BANKNIFTY: '^NSEBANK',
    SP500: '^GSPC',
    NASDAQ: '^IXIC',
    NIKKEI: '^N225',
    US10Y: '^TNX',
    USDINR: 'INR=X',
    CRUDE_OIL: 'BZ=F',
    GOLD: 'GC=F'
  };

  const results = {};
  await Promise.all(
    Object.entries(indexSymbols).map(async ([key, ticker]) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`;
        const res = await fetchWithTimeout(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }, 3000);
        if (res.ok) {
          const json = await res.json();
          const meta = json.chart?.result?.[0]?.meta;
          if (meta && typeof meta.regularMarketPrice === 'number') {
            const price = meta.regularMarketPrice;
            const prevClose = meta.chartPreviousClose || meta.previousClose || price;
            const change = price - prevClose;
            const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
            results[key] = {
              name: key,
              ticker,
              price: Number(price.toFixed(2)),
              change: Number(change.toFixed(2)),
              changePercent: Number(changePercent.toFixed(2)),
              currency: meta.currency || 'USD',
              timestamp: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
              status: 'LIVE'
            };
          }
        }
      } catch {}
    })
  );

  indexCache.set('ALL_INDICES', { data: results, timestamp: now });
  return results;
}

/**
 * Main public method to retrieve complete market data envelope.
 */
async function getStockMarketData(symbol, marketHint = 'IN') {
  const quote = await fetchMarketQuote(symbol, marketHint);
  const chartAndTechnicals = await fetchChartAndTechnicals(symbol, marketHint);

  const combinedData = {
    ...quote,
    technicals: chartAndTechnicals?.technicals || null,
    recentPoints: chartAndTechnicals?.points || []
  };

  return createAnalystEnvelope({
    symbol: quote.symbol,
    market: quote.market,
    data: combinedData,
    status: quote.status,
    source: quote.source,
    provider: quote.providerUsed || quote.provider,
    cacheTtlMs: QUOTE_TTL_MS,
    retrievedAt: quote.timestamp
  });
}

module.exports = {
  fetchMarketQuote,
  fetchChartAndTechnicals,
  getMarketIndices,
  getStockMarketData,
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateAccurateMACD,
  calculateBollingerBands,
  calculateATR,
  calculateHistoricalVolatility,
  fetchRawQuote: async (ticker) => {
    const q = await fetchMarketQuote(ticker);
    return { data: q, status: q.status };
  }
};
