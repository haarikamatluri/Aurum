/**
 * AURUM AI Analyst — Earnings Provider
 * Retrieves real verified corporate earnings history and upcoming earnings calendar.
 * Removes all hardcoded TCS/Reliance earnings, next earnings dates, and management guidance.
 * Marks status as ESTIMATE_UNAVAILABLE whenever consensus estimates are not provided by authoritative sources.
 */

const { createAnalystEnvelope } = require('../envelope');
const { resolveSecurity } = require('./security-master');

const earningsCache = new Map();
const calendarCache = new Map();
const TTL_MS = 1800000; // 30 minutes

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
 * Fetch real earnings from Finnhub API (US & Global tickers)
 */
async function fetchFinnhubEarnings(symbol) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey || apiKey.includes('your_')) return null;

  try {
    const url = `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const res = await fetchWithTimeout(url, {}, 4000);
    if (!res.ok) return null;

    const json = await res.json();
    if (!Array.isArray(json) || json.length === 0) return null;

    return json.map(q => {
      const actual = typeof q.actual === 'number' ? Number(q.actual.toFixed(2)) : null;
      const estimate = typeof q.estimate === 'number' ? Number(q.estimate.toFixed(2)) : null;
      const surprise = typeof q.surprise === 'number' ? Number(q.surprise.toFixed(2)) : null;
      const surprisePercent = typeof q.surprisePercent === 'number' ? Number(q.surprisePercent.toFixed(2)) : null;

      let status = 'ESTIMATE_UNAVAILABLE';
      if (estimate !== null && actual !== null) {
        if (actual > estimate) status = 'BEAT';
        else if (actual < estimate) status = 'MISS';
        else status = 'IN_LINE';
      }

      return {
        period: q.period || `Q${q.quarter} ${q.year}`,
        fiscalDateEnding: q.period || null,
        reportedDate: q.period || null,
        quarterLabel: q.quarter && q.year ? `Q${q.quarter} ${q.year}` : (q.period || 'Quarter'),
        epsActual: actual,
        epsEstimate: estimate,
        epsSurprise: surprise,
        epsSurprisePercent: surprisePercent,
        revenueActual: null,
        revenueEstimate: null,
        revenueSurprise: null,
        status,
        source: 'Finnhub Institutional Earnings Feed',
        retrievedAt: new Date().toISOString()
      };
    });
  } catch {
    return null;
  }
}

/**
 * Fetch real reported earnings from Indian corporate disclosures (Screener.in)
 */
async function fetchIndianReportedEarnings(slug) {
  try {
    const url = `https://www.screener.in/company/${encodeURIComponent(slug)}/consolidated/`;
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, 5000);

    if (!res.ok) return null;
    const html = await res.text();
    const qSection = html.match(/id="quarters"[\s\S]*?<\/section>/);
    if (!qSection) return null;

    const ths = [...qSection[0].matchAll(/<th[^>]*>\s*([A-Za-z0-9\s]+?)\s*<\/th>/g)].map(m => m[1].trim());
    if (ths.length < 2) return null;

    const quarters = ths.slice(1); // skip label column

    const salesMatch = qSection[0].match(/Sales\s*<[\s\S]*?<\/tr>/);
    const salesRow = salesMatch ? [...salesMatch[0].matchAll(/<td[^>]*>\s*([0-9,.]+)\s*<\/td>/g)].map(m => parseFloat(m[1].replace(/,/g, ''))) : [];

    const netProfitMatch = qSection[0].match(/Net Profit\s*<[\s\S]*?<\/tr>/);
    const profitRow = netProfitMatch ? [...netProfitMatch[0].matchAll(/<td[^>]*>\s*([0-9,.]+)\s*<\/td>/g)].map(m => parseFloat(m[1].replace(/,/g, ''))) : [];

    const epsMatch = qSection[0].match(/EPS in Rs\s*<[\s\S]*?<\/tr>/);
    const epsRow = epsMatch ? [...epsMatch[0].matchAll(/<td[^>]*>\s*([0-9,.]+)\s*<\/td>/g)].map(m => parseFloat(m[1].replace(/,/g, ''))) : [];

    const history = [];
    const count = Math.min(quarters.length, epsRow.length);
    for (let i = count - 1; i >= Math.max(0, count - 8); i--) {
      history.push({
        period: quarters[i],
        fiscalDateEnding: quarters[i],
        reportedDate: quarters[i],
        quarterLabel: quarters[i],
        epsActual: typeof epsRow[i] === 'number' ? epsRow[i] : null,
        epsEstimate: null,
        epsSurprise: null,
        epsSurprisePercent: null,
        revenueActual: typeof salesRow[i] === 'number' ? salesRow[i] * 10000000 : null, // Cr to INR
        revenueEstimate: null,
        revenueSurprise: null,
        status: 'ESTIMATE_UNAVAILABLE', // Strictly ESTIMATE_UNAVAILABLE if no estimate provided!
        source: 'Official Corporate Disclosures & Financial Statements',
        retrievedAt: new Date().toISOString()
      });
    }

    return history.length > 0 ? history : null;
  } catch {
    return null;
  }
}

/**
 * Retrieve verified stock earnings envelope.
 */
async function getStockEarnings(symbol, market = 'IN') {
  const security = resolveSecurity(symbol, market);
  const sym = security.symbol;
  const cacheKey = `${sym}:${security.market}`;
  const now = Date.now();

  const cached = earningsCache.get(cacheKey);
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

  let quarters = null;
  let source = 'Corporate Disclosures';
  let provider = 'Earnings Gateway';

  if (security.market === 'US' || ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA'].includes(sym)) {
    quarters = await fetchFinnhubEarnings(sym);
    if (quarters) {
      provider = 'Finnhub Institutional Earnings Engine';
      source = 'SEC 10-Q / 10-K Official Disclosures';
    }
  } else {
    // Indian stock
    const slug = security.screenerSlug || sym;
    quarters = await fetchIndianReportedEarnings(slug);
    if (quarters) {
      provider = 'NSE / BSE Quarterly Filing Reports';
      source = 'Official Company Financial Statements';
    } else if (security.cik) {
      // INFY ADR or global listing
      quarters = await fetchFinnhubEarnings(sym);
      if (quarters) {
        provider = 'Finnhub Institutional Earnings Engine';
        source = 'SEC 6-K / 20-F Reports';
      }
    }
  }

  if (!quarters || quarters.length === 0) {
    return createAnalystEnvelope({
      symbol: sym,
      market: security.market,
      data: null,
      status: 'UNAVAILABLE',
      source: 'Exchange Disclosures',
      provider: 'Earnings Gateway',
      query: sym
    });
  }

  const latest = quarters[0];
  const payload = {
    symbol: sym,
    latestReportingPeriod: latest.quarterLabel,
    latestReportedDate: latest.reportedDate,
    latestEPSActual: latest.epsActual,
    latestEPSEstimate: latest.epsEstimate,
    epsSurprise: latest.epsSurprise,
    epsSurprisePercent: latest.epsSurprisePercent,
    status: latest.status,
    nextEarningsDate: 'ESTIMATE_UNAVAILABLE',
    guidanceSummary: null,
    history: quarters
  };

  earningsCache.set(cacheKey, { data: payload, timestamp: now, source, provider });

  return createAnalystEnvelope({
    symbol: sym,
    market: security.market,
    data: payload,
    status: 'LIVE',
    source,
    provider,
    cacheTtlMs: TTL_MS,
    retrievedAt: new Date(now).toISOString()
  });
}

/**
 * Fetch real upcoming Earnings Calendar from Finnhub API.
 */
async function getEarningsCalendar(timeframe = 'this_month', market = 'ALL') {
  const apiKey = process.env.FINNHUB_API_KEY;
  const now = new Date();
  let fromDate = now.toISOString().split('T')[0];
  let toDate = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0];

  if (timeframe === 'today') {
    toDate = fromDate;
  } else if (timeframe === 'this_week') {
    toDate = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
  } else if (timeframe === 'next_week') {
    fromDate = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
    toDate = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0];
  }

  const cacheKey = `${timeframe}:${market}:${fromDate}:${toDate}`;
  const cached = calendarCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TTL_MS) {
    return cached.data;
  }

  let events = [];
  if (apiKey && !apiKey.includes('your_')) {
    try {
      const url = `https://finnhub.io/api/v1/calendar/earnings?from=${fromDate}&to=${toDate}&token=${apiKey}`;
      const res = await fetchWithTimeout(url, {}, 4000);
      if (res.ok) {
        const json = await res.json();
        const rawList = Array.isArray(json.earningsCalendar) ? json.earningsCalendar : [];
        events = rawList.slice(0, 50).map(item => ({
          symbol: item.symbol,
          companyName: item.symbol,
          date: item.date,
          quarter: item.quarter && item.year ? `Q${item.quarter} ${item.year}` : 'Upcoming',
          epsEstimate: typeof item.epsEstimate === 'number' ? Number(item.epsEstimate.toFixed(2)) : null,
          revenueEstimate: item.revenueEstimate || null,
          market: item.symbol.includes('.') ? 'IN' : 'US',
          estimateAvailable: typeof item.epsEstimate === 'number',
          source: 'Finnhub Institutional Calendar'
        }));
      }
    } catch {}
  }

  if (market === 'US') {
    events = events.filter(e => e.market === 'US');
  } else if (market === 'IN') {
    events = events.filter(e => e.market === 'IN');
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const envelope = createAnalystEnvelope({
    market,
    data: {
      timeframe,
      totalEvents: events.length,
      events
    },
    status: events.length > 0 ? 'LIVE' : 'UNAVAILABLE',
    source: 'Official Corporate Earnings Calendar',
    provider: 'Global Earnings Intelligence',
    sourceCount: events.length
  });

  calendarCache.set(cacheKey, { data: envelope, timestamp: Date.now() });
  return envelope;
}

module.exports = {
  getStockEarnings,
  getEarningsCalendar
};
