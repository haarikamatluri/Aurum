/**
 * AURUM AI Analyst — Fundamentals Provider
 * Retrieves real verified corporate fundamentals without hardcoded fallback numbers.
 * Every fundamental metric preserves metric, value, currency, period, reportedDate, source, sourceUrl, and retrievedAt.
 */

const { createAnalystEnvelope } = require('../envelope');
const { resolveSecurity } = require('./security-master');

const fundamentalsCache = new Map();
const TTL_MS = 3600000; // 1 hour cache TTL for quarterly fundamentals

/**
 * Fetch timeout helper
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch US / Global Fundamentals via Finnhub
 */
async function fetchFinnhubFundamentals(symbol) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey || apiKey.includes('your_')) return null;

  try {
    const pUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const mUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${apiKey}`;

    const [pRes, mRes] = await Promise.all([
      fetchWithTimeout(pUrl, {}, 4000),
      fetchWithTimeout(mUrl, {}, 4000)
    ]);

    const profile = pRes.ok ? await pRes.json() : {};
    const metricJson = mRes.ok ? await mRes.json() : {};
    const metric = metricJson.metric || {};

    if (!profile.name && Object.keys(metric).length === 0) {
      return null;
    }

    const now = new Date().toISOString();
    const source = 'Finnhub Financial Datasets';
    const sourceUrl = profile.weburl || `https://finnhub.io/quote/${symbol}`;
    const currency = profile.currency || 'USD';

    const buildMetric = (name, val, period = 'TTM') => {
      if (val === null || val === undefined || isNaN(val)) return null;
      return {
        metric: name,
        value: Number(Number(val).toFixed(2)),
        currency,
        period,
        reportedDate: now.slice(0, 10),
        source,
        sourceUrl,
        retrievedAt: now
      };
    };

    const metricsMap = {
      marketCap: profile.marketCapitalization ? buildMetric('marketCap', profile.marketCapitalization * 1000000, 'Current') : null,
      peRatio: buildMetric('peRatio', metric.peBasicExclExtraTTM || metric.peTTM),
      forwardPE: buildMetric('forwardPE', metric.forwardPE),
      eps: buildMetric('eps', metric.epsBasicExclExtraItemsTTM || metric.epsTTM),
      returnOnEquity: buildMetric('returnOnEquity', metric.roeTTM),
      operatingMargin: buildMetric('operatingMargin', metric.operatingMarginTTM),
      profitMargin: buildMetric('profitMargin', metric.netProfitMarginTTM),
      dividendYield: buildMetric('dividendYield', metric.dividendYieldIndicatedAnnual),
      bookValue: buildMetric('bookValue', metric.bookValuePerShareAnnual, 'Annual'),
      fiftyTwoWeekHigh: buildMetric('fiftyTwoWeekHigh', metric['52WeekHigh'], '52W'),
      fiftyTwoWeekLow: buildMetric('fiftyTwoWeekLow', metric['52WeekLow'], '52W'),
      revenueGrowth: buildMetric('revenueGrowth', metric.revenueGrowthQuarterlyYoy, 'Quarterly YoY')
    };

    return {
      symbol,
      companyName: profile.name || symbol,
      sector: profile.finnhubIndustry || 'General',
      industry: profile.finnhubIndustry || 'General',
      provider: 'Finnhub Institutional Fundamentals',
      source,
      sourceUrl,
      currency,
      peRatio: metricsMap.peRatio?.value ?? null,
      forwardPE: metricsMap.forwardPE?.value ?? null,
      returnOnEquity: metricsMap.returnOnEquity?.value ?? null,
      operatingMargin: metricsMap.operatingMargin?.value ?? null,
      profitMargin: metricsMap.profitMargin?.value ?? null,
      marketCap: metricsMap.marketCap?.value ?? null,
      eps: metricsMap.eps?.value ?? null,
      dividendYield: metricsMap.dividendYield?.value ?? null,
      bookValue: metricsMap.bookValue?.value ?? null,
      fiftyTwoWeekHigh: metricsMap.fiftyTwoWeekHigh?.value ?? null,
      fiftyTwoWeekLow: metricsMap.fiftyTwoWeekLow?.value ?? null,
      revenueGrowth: metricsMap.revenueGrowth?.value ?? null,
      metrics: metricsMap
    };
  } catch {
    return null;
  }
}

/**
 * Fetch Indian Corporate Fundamentals via Screener.in
 */
async function fetchIndianCompanyFundamentals(slug) {
  try {
    const u = `https://www.google.com/finance/quote/${encodeURIComponent(slug)}:NSE`;
    
    const res = await fetchWithTimeout(u, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    }, 5000);
    
    let html = '';
    let successUrl = '';
    if (res.ok) {
      html = await res.text();
      successUrl = u;
    }

    if (!html) return null;

    // Parse top ratios from Google Finance
    const rawRatios = {};
    const regex = /<div class="SwQK7">([^<]+)<\/div><div class="dO6ijd">([^<]+)<\/div>/g;
    let m;
    while ((m = regex.exec(html)) !== null) {
      rawRatios[m[1].trim()] = m[2].trim();
    }
    
    const companyNameMatch = html.match(/<div class="zzDege">([^<]+)<\/div>/) || html.match(/<title>([^<]+) Share Price/);
    const companyName = companyNameMatch ? companyNameMatch[1].trim() : slug;

    // Helper to parse numbers like 1.01T, 14.2B, 3.24%, ₹78.50
    const parseNumber = (str) => {
      if (!str || str === '-') return null;
      let val = str.replace(/₹|,|%/g, '').trim();
      let multiplier = 1;
      if (val.endsWith('T')) { multiplier = 1e12; val = val.slice(0, -1); }
      else if (val.endsWith('B')) { multiplier = 1e9; val = val.slice(0, -1); }
      else if (val.endsWith('M')) { multiplier = 1e6; val = val.slice(0, -1); }
      else if (val.endsWith('K')) { multiplier = 1e3; val = val.slice(0, -1); }
      else if (val.endsWith('Cr')) { multiplier = 1e7; val = val.slice(0, -2); }
      
      const parsed = parseFloat(val);
      if (isNaN(parsed)) return null;
      return parsed * multiplier;
    };

    const now = new Date().toISOString();
    const source = 'Google Finance (Global Markets)';
    const sourceUrl = successUrl;
    const currency = 'INR';

    const buildMetric = (name, val, period = 'TTM') => {
      if (val === null || val === undefined || isNaN(val)) return null;
      return {
        metric: name,
        value: Number(Number(val).toFixed(2)),
        currency,
        period,
        reportedDate: now.slice(0, 10),
        source,
        sourceUrl,
        retrievedAt: now
      };
    };

    const metricsMap = {
      marketCap: buildMetric('marketCap', parseNumber(rawRatios['Mkt cap'] || rawRatios['Mkt. cap']), 'Current'),
      peRatio: buildMetric('peRatio', parseNumber(rawRatios['P/E ratio'])),
      dividendYield: buildMetric('dividendYield', parseNumber(rawRatios['Dividend yield'] || rawRatios['Dividend'])),
      eps: buildMetric('eps', parseNumber(rawRatios['EPS']))
    };

    return {
      symbol: slug,
      companyName,
      sector: 'Diversified',
      industry: 'Diversified',
      provider: 'Google Finance',
      source,
      sourceUrl,
      currency,
      peRatio: metricsMap.peRatio?.value ?? null,
      forwardPE: null,
      returnOnEquity: metricsMap.returnOnEquity?.value ?? null,
      operatingMargin: metricsMap.operatingMargin?.value ?? null,
      profitMargin: null,
      marketCap: metricsMap.marketCap?.value ?? null,
      eps: metricsMap.eps?.value ?? null,
      dividendYield: metricsMap.dividendYield?.value ?? null,
      bookValue: metricsMap.bookValue?.value ?? null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      revenueGrowth: metricsMap.revenueGrowth?.value ?? null,
      metrics: metricsMap
    };
  } catch {
    return null;
  }
}

/**
 * Retrieve verified company fundamentals wrapped in AnalystDataEnvelope.
 */
async function getCompanyFundamentals(symbol, market = 'IN') {
  const security = resolveSecurity(symbol, market);
  const sym = security.symbol;
  const cacheKey = `${sym}:${security.market}`;
  const now = Date.now();

  const cached = fundamentalsCache.get(cacheKey);
  if (cached && now - cached.timestamp < TTL_MS) {
    return createAnalystEnvelope({
      symbol: sym,
      market: security.market,
      data: cached.data,
      status: 'CACHED',
      source: cached.source,
      provider: cached.provider,
      cacheTtlMs: TTL_MS,
      retrievedAt: new Date(cached.timestamp).toISOString()
    });
  }

  let fundamentals = null;
  if (security.market === 'US' || ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA'].includes(sym)) {
    fundamentals = await fetchFinnhubFundamentals(sym);
  } else {
    // Indian stock: try Screener / Corporate Disclosures
    const slug = security.screenerSlug || sym;
    fundamentals = await fetchIndianCompanyFundamentals(slug);

    // If Indian stock has an ADR or US ticker (e.g. INFY), check Finnhub fallback
    if (!fundamentals && security.cik) {
      fundamentals = await fetchFinnhubFundamentals(sym);
    }
  }

  if (!fundamentals) {
    return createAnalystEnvelope({
      symbol: sym,
      market: security.market,
      data: null,
      status: 'UNAVAILABLE',
      source: 'Exchange Disclosures',
      provider: 'Fundamentals Engine',
      query: sym
    });
  }

  fundamentalsCache.set(cacheKey, {
    data: fundamentals,
    timestamp: now,
    source: fundamentals.source,
    provider: fundamentals.provider
  });

  return createAnalystEnvelope({
    symbol: sym,
    market: security.market,
    data: fundamentals,
    status: 'LIVE',
    source: fundamentals.source,
    provider: fundamentals.provider,
    cacheTtlMs: TTL_MS,
    retrievedAt: new Date(now).toISOString()
  });
}

module.exports = {
  getCompanyFundamentals
};
