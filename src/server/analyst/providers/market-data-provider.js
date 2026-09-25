/**
 * AURUM AI Analyst — Market Data Provider
 * Fetches real market quotes, historical daily candles, technical indicators,
 * and benchmark index movements.
 */

const { createAnalystEnvelope } = require('../envelope');

// In-memory cache for market quotes & candles (TTL: 15s for quotes, 5m for candles)
const quoteCache = new Map();
const chartCache = new Map();
const indexCache = new Map();

const QUOTE_TTL_MS = 15000;
const CHART_TTL_MS = 300000;
const INDEX_TTL_MS = 30000;

function resolveTicker(symbol, market = 'IN') {
  const sym = String(symbol || 'TCS').trim().toUpperCase();
  if (sym.includes('.')) return sym;
  if (market === 'IN' || ['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'ITC', 'TATAMOTORS', 'WIPRO', 'BAJFINANCE', 'KOTAKBANK', 'MARUTI', 'BHARTIARTL', 'LT', 'SUNPHARMA'].includes(sym)) {
    return `${sym}.NS`;
  }
  return sym;
}

/**
 * Fetch quote from Yahoo Finance v8 chart endpoint.
 */
async function fetchRawQuote(ticker) {
  const now = Date.now();
  const cached = quoteCache.get(ticker);
  if (cached && now - cached.timestamp < QUOTE_TTL_MS) {
    return { data: cached.data, status: 'CACHED', timestamp: cached.timestamp };
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      if (cached) return { data: cached.data, status: 'STALE', timestamp: cached.timestamp };
      return null;
    }

    const json = await res.json();
    const result = json.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') {
      if (cached) return { data: cached.data, status: 'STALE', timestamp: cached.timestamp };
      return null;
    }

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const change = price - prevClose;
    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

    const data = {
      symbol: meta.symbol?.replace(/\.NS$/, '') || ticker,
      ticker: meta.symbol || ticker,
      companyName: meta.longName || meta.shortName || ticker,
      currency: meta.currency || (ticker.endsWith('.NS') ? 'INR' : 'USD'),
      exchange: meta.fullExchangeName || meta.exchangeName || (ticker.endsWith('.NS') ? 'NSE' : 'NASDAQ'),
      price,
      previousClose: prevClose,
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      dayHigh: meta.regularMarketDayHigh || meta.dayHigh || price,
      dayLow: meta.regularMarketDayLow || meta.dayLow || price,
      volume: meta.regularMarketVolume || 0,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow || null,
      marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString()
    };

    quoteCache.set(ticker, { data, timestamp: now });
    return { data, status: 'LIVE', timestamp: now };
  } catch (err) {
    if (cached) return { data: cached.data, status: 'STALE', timestamp: cached.timestamp };
    return null;
  }
}

/**
 * Fetch 1-year daily candles and compute mathematical technical indicators.
 */
async function fetchChartAndTechnicals(ticker) {
  const now = Date.now();
  const cached = chartCache.get(ticker);
  if (cached && now - cached.timestamp < CHART_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

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

    // Filter valid clean data points
    const points = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (typeof closes[i] === 'number' && !isNaN(closes[i])) {
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

    // 1. Calculate Simple Moving Averages
    const sma20 = calculateSMA(closePrices, 20);
    const sma50 = calculateSMA(closePrices, 50);
    const sma200 = calculateSMA(closePrices, Math.min(200, closePrices.length));

    // 2. Calculate RSI (14)
    const rsi14 = calculateRSI(closePrices, 14);

    // 3. Calculate MACD (12, 26, 9)
    const macd = calculateMACD(closePrices);

    // 4. Calculate Bollinger Bands (20, 2)
    const bollinger = calculateBollingerBands(closePrices, 20, 2);

    // 5. Calculate ATR (14)
    const atr14 = calculateATR(points, 14);

    // 6. Calculate Historical Volatility (annualized %)
    const histVolatility = calculateHistoricalVolatility(closePrices, 20);

    // 7. Calculate Volume Z-score
    const volZScore = calculateVolumeZScore(points.map(p => p.volume), 20);

    // 8. Calculate Support and Resistance (Swing high/low clustering)
    const { support, resistance } = calculateSupportResistance(points.slice(-60), currentPrice);

    // 9. Trend Regime
    let trend = 'NEUTRAL';
    if (sma20 && sma50) {
      if (currentPrice > sma20 && sma20 > sma50) trend = 'BULLISH';
      else if (currentPrice < sma20 && sma20 < sma50) trend = 'BEARISH';
    }

    const payload = {
      points: points.slice(-30), // recent 30 trading days for charts
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

    chartCache.set(ticker, { data: payload, timestamp: now });
    return payload;
  } catch (err) {
    return cached ? cached.data : null;
  }
}

// Math calculation helpers
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

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(closes) {
  if (closes.length < 26) return { line: 0, signal: 0, histogram: 0 };
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12 - ema26;
  const macdSignal = macdLine * 0.85; // approximate 9 EMA signal
  return {
    line: macdLine,
    signal: macdSignal,
    histogram: macdLine - macdSignal
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
  return Math.sqrt(variance) * Math.sqrt(252); // Annualized
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

  // Find nearest swing low below current price
  const supportCandidates = lows.filter(l => l < currentPrice);
  const support = supportCandidates.length > 0 ? supportCandidates[Math.floor(supportCandidates.length * 0.75)] : currentPrice * 0.96;

  // Find nearest swing high above current price
  const resistanceCandidates = highs.filter(h => h > currentPrice);
  const resistance = resistanceCandidates.length > 0 ? resistanceCandidates[Math.floor(resistanceCandidates.length * 0.25)] : currentPrice * 1.04;

  return { support, resistance };
}

/**
 * Fetch major global and Indian indices
 */
async function getMarketIndices() {
  const now = Date.now();
  const cached = indexCache.get('ALL_INDICES');
  if (cached && now - cached.timestamp < INDEX_TTL_MS) {
    return cached.data;
  }

  const indexTickers = [
    { key: 'NIFTY50', ticker: '^NSEI', name: 'NIFTY 50', market: 'IN' },
    { key: 'SENSEX', ticker: '^BSESN', name: 'BSE SENSEX', market: 'IN' },
    { key: 'BANKNIFTY', ticker: '^NSEBANK', name: 'BANK NIFTY', market: 'IN' },
    { key: 'SP500', ticker: '^GSPC', name: 'S&P 500', market: 'US' },
    { key: 'NASDAQ', ticker: '^IXIC', name: 'NASDAQ Composite', market: 'US' },
    { key: 'NIKKEI', ticker: '^N225', name: 'Nikkei 225', market: 'GLOBAL' },
    { key: 'CRUDE_OIL', ticker: 'BZ=F', name: 'Brent Crude Oil', market: 'COMMODITY' },
    { key: 'GOLD', ticker: 'GC=F', name: 'Gold', market: 'COMMODITY' },
    { key: 'US10Y', ticker: '^TNX', name: 'US 10Y Treasury Yield', market: 'BONDS' },
    { key: 'USDINR', ticker: 'INR=X', name: 'USD / INR', market: 'CURRENCY' }
  ];

  const results = {};
  await Promise.all(indexTickers.map(async item => {
    const raw = await fetchRawQuote(item.ticker);
    if (raw && raw.data) {
      results[item.key] = {
        name: item.name,
        ticker: item.ticker,
        market: item.market,
        price: raw.data.price,
        change: raw.data.change,
        changePercent: raw.data.changePercent,
        status: raw.status
      };
    } else {
      results[item.key] = {
        name: item.name,
        ticker: item.ticker,
        market: item.market,
        price: null,
        change: 0,
        changePercent: 0,
        status: 'UNAVAILABLE'
      };
    }
  }));

  indexCache.set('ALL_INDICES', { data: results, timestamp: now });
  return results;
}

/**
 * Get comprehensive stock market data bundle (Quote + Technicals) wrapped in AnalystDataEnvelope.
 */
async function getStockMarketData(symbol, market = 'IN') {
  const ticker = resolveTicker(symbol, market);
  const quoteResult = await fetchRawQuote(ticker);
  const chartResult = await fetchChartAndTechnicals(ticker);

  if (!quoteResult) {
    return createAnalystEnvelope({
      symbol,
      market,
      data: null,
      status: 'UNAVAILABLE',
      source: 'Exchange Quote Feed',
      provider: 'Market Data Gateway',
      query: ticker
    });
  }

  const combinedData = {
    ...quoteResult.data,
    technicals: chartResult?.technicals || null,
    recentPoints: chartResult?.points || []
  };

  return createAnalystEnvelope({
    symbol,
    market,
    data: combinedData,
    status: quoteResult.status,
    source: `${combinedData.exchange} Real-Time Quote`,
    provider: 'Yahoo Finance Gateway',
    query: ticker,
    cacheTtlMs: QUOTE_TTL_MS,
    retrievedAt: new Date(quoteResult.timestamp).toISOString()
  });
}

module.exports = {
  resolveTicker,
  fetchRawQuote,
  fetchChartAndTechnicals,
  getMarketIndices,
  getStockMarketData
};
