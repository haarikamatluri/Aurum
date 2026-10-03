/**
 * AURUM AI Analyst — Macro Provider
 * Retrieves real-time macroeconomic indicators, central bank benchmarks,
 * bond yields, currencies, commodities, and actual economic events.
 * Eliminates all hardcoded future dates and static fallback values.
 */

const { createAnalystEnvelope } = require('../envelope');
const { getMarketIndices } = require('./market-data-provider');

const macroCache = new Map();
const TTL_MS = 600000; // 10 minutes

/**
 * Fetch official economic indicator series from Alpha Vantage
 */
async function fetchEconomicIndicator(fn) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey || apiKey.includes('your_')) return null;

  try {
    const url = `https://www.alphavantage.co/query?function=${fn}&apikey=${apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const json = await res.json();
    if (Array.isArray(json.data) && json.data.length > 0) {
      return {
        name: json.name || fn,
        unit: json.unit || '',
        latest: json.data[0],
        previous: json.data[1] || null
      };
    }
  } catch {}
  return null;
}

/**
 * Fetch live economic events and central bank actions via Google News RSS economic feed
 */
async function fetchRealEconomicEvents() {
  try {
    const q = 'Federal Reserve interest rate OR RBI MPC monetary policy OR CPI inflation release';
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    }).finally(() => clearTimeout(timer));

    if (!res.ok) return [];
    const text = await res.text();
    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const events = [];

    for (const item of items.slice(0, 6)) {
      const titleMatch = item[1].match(/<title>(.*?)<\/title>/);
      const linkMatch = item[1].match(/<link>(.*?)<\/link>/);
      const pubDateMatch = item[1].match(/<pubDate>(.*?)<\/pubDate>/);
      const sourceMatch = item[1].match(/<source[^>]*>(.*?)<\/source>/);

      const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'") : '';
      const date = pubDateMatch ? new Date(pubDateMatch[1]).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      const source = sourceMatch ? sourceMatch[1] : 'Economic Press';
      const link = linkMatch ? linkMatch[1] : '#';

      if (title) {
        const titleLower = title.toLowerCase();
        let country = 'GLOBAL';
        if (titleLower.includes('rbi') || titleLower.includes('india') || titleLower.includes('nifty')) country = 'IN';
        if (titleLower.includes('fed') || titleLower.includes('us ') || titleLower.includes('powell') || titleLower.includes('treasury')) country = 'US';

        events.push({
          event: title,
          country,
          date,
          source,
          sourceUrl: link,
          actual: null,
          forecast: null, // Only show forecast when provider actually supplies one!
          previous: null
        });
      }
    }

    return events;
  } catch {
    return [];
  }
}

/**
 * Retrieve verified real macroeconomic overview
 */
async function getMacroOverview() {
  const now = Date.now();
  const cached = macroCache.get('OVERVIEW');
  if (cached && now - cached.timestamp < TTL_MS) {
    return createAnalystEnvelope({
      market: 'GLOBAL',
      data: cached.data,
      status: 'CACHED',
      source: 'Global Macroeconomic Benchmarks & Central Bank Disclosures',
      provider: 'Aurum Macro Gateway',
      cacheTtlMs: TTL_MS,
      retrievedAt: new Date(cached.timestamp).toISOString()
    });
  }

  const [indices, cpiData, yieldData, realEvents] = await Promise.all([
    getMarketIndices(),
    fetchEconomicIndicator('CPI'),
    fetchEconomicIndicator('TREASURY_YIELD'),
    fetchRealEconomicEvents()
  ]);

  // Transform Alpha Vantage indicator into structured events
  const indicatorEvents = [];
  if (cpiData && cpiData.latest) {
    indicatorEvents.push({
      event: 'U.S. Consumer Price Index (CPI)',
      country: 'US',
      date: cpiData.latest.date,
      source: 'U.S. Bureau of Labor Statistics (via Alpha Vantage)',
      actual: `${cpiData.latest.value} (Index Level)`,
      forecast: null,
      previous: cpiData.previous ? `${cpiData.previous.value}` : null
    });
  }

  if (yieldData && yieldData.latest) {
    indicatorEvents.push({
      event: 'U.S. 10-Year Treasury Yield Benchmark',
      country: 'US',
      date: yieldData.latest.date,
      source: 'Federal Reserve Bank of St. Louis (FRED)',
      actual: `${yieldData.latest.value}%`,
      forecast: null,
      previous: yieldData.previous ? `${yieldData.previous.value}%` : null
    });
  }

  const scheduledEvents = [...indicatorEvents, ...realEvents];

  const payload = {
    indices,
    bonds: {
      us10yYield: indices.US10Y?.price ? `${indices.US10Y.price.toFixed(2)}%` : (yieldData?.latest ? `${yieldData.latest.value}%` : 'UNAVAILABLE'),
      us10yChange: indices.US10Y?.change ? `${indices.US10Y.change >= 0 ? '+' : ''}${indices.US10Y.change.toFixed(2)} bps` : 'UNAVAILABLE'
    },
    currencies: {
      usdInr: indices.USDINR?.price ? `₹${indices.USDINR.price.toFixed(2)}` : 'UNAVAILABLE',
      usdInrChange: indices.USDINR?.changePercent ? `${indices.USDINR.changePercent >= 0 ? '+' : ''}${indices.USDINR.changePercent.toFixed(2)}%` : 'UNAVAILABLE'
    },
    commodities: {
      crudeOil: indices.CRUDE_OIL?.price ? `$${indices.CRUDE_OIL.price.toFixed(2)}/bbl` : 'UNAVAILABLE',
      gold: indices.GOLD?.price ? `$${indices.GOLD.price.toFixed(2)}/oz` : 'UNAVAILABLE'
    },
    scheduledEvents,
    timestamp: new Date().toISOString()
  };

  macroCache.set('OVERVIEW', { data: payload, timestamp: now });

  return createAnalystEnvelope({
    market: 'GLOBAL',
    data: payload,
    status: 'LIVE',
    source: 'Global Macroeconomic Benchmarks & Central Bank Disclosures',
    provider: 'Aurum Macro Gateway',
    sourceCount: scheduledEvents.length + Object.keys(indices).length,
    cacheTtlMs: TTL_MS,
    retrievedAt: new Date(now).toISOString()
  });
}

module.exports = {
  getMacroOverview
};
