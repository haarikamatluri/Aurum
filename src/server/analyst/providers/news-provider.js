/**
 * AURUM AI Analyst — News Provider
 * Retrieves real-time multi-source verified news from Brave Search API & Google RSS.
 * Ranks news items by symbol relevance, source quality, and recency.
 */

const { createAnalystEnvelope } = require('../envelope');
const newsCache = new Map();
const TTL_MS = 300000; // 5 mins

/**
 * Fetch raw news from Brave Search API.
 */
async function fetchBraveNews(query) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return [];

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey
      }
    });

    if (!res.ok) return [];
    const json = await res.json();
    const results = json.web?.results || [];

    return results.map(r => ({
      title: r.title,
      url: r.url,
      publisher: r.profile?.name || extractDomain(r.url),
      snippet: r.description || r.title,
      publishedAt: r.page_age || new Date().toISOString()
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch raw news from Google News RSS.
 */
async function fetchGoogleRssNews(query) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) return [];
    const text = await res.text();
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const articles = [];
    let m;

    while ((m = itemRegex.exec(text)) !== null && articles.length < 10) {
      const raw = m[1];
      const titleMatch = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i.exec(raw);
      const linkMatch = /<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i.exec(raw);
      const pubDateMatch = /<pubDate>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/pubDate>/i.exec(raw);
      const sourceMatch = /<source[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/source>/i.exec(raw);
      const descMatch = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i.exec(raw);

      let title = (titleMatch ? titleMatch[1] : '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
      let source = sourceMatch ? sourceMatch[1] : '';
      if (!source && title.includes(' - ')) {
        const parts = title.split(' - ');
        source = parts.pop();
        title = parts.join(' - ');
      }

      let snippet = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim() : title;

      if (title && !title.includes('Google News')) {
        articles.push({
          title,
          url: linkMatch ? linkMatch[1] : '',
          publisher: source || 'Financial Press',
          snippet: snippet.length > 25 ? snippet : title,
          publishedAt: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString()
        });
      }
    }

    return articles;
  } catch {
    return [];
  }
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Financial Media';
  }
}

/**
 * Score relevance of news item based on exact symbol presence, title prominence, and quality.
 */
function scoreArticle(article, symbol) {
  let score = 50;
  const sym = String(symbol || '').toUpperCase();
  const titleLower = article.title.toLowerCase();
  const symLower = sym.toLowerCase();

  // Symbol in title: +30
  if (titleLower.includes(symLower)) score += 30;

  // Reputable financial publishers: +20
  const highQualityPublishers = [
    'reuters', 'bloomberg', 'cnbc', 'financial times', 'wall street journal',
    'moneycontrol', 'economic times', 'livemint', 'business standard', 'groww'
  ];
  const pubLower = (article.publisher || '').toLowerCase();
  if (highQualityPublishers.some(p => pubLower.includes(p))) {
    score += 20;
  }

  // Recency bonus (within 24h: +15, within 48h: +10)
  try {
    const ageMs = Date.now() - new Date(article.publishedAt).getTime();
    if (ageMs < 86400000) score += 15;
    else if (ageMs < 172800000) score += 10;
  } catch {}

  return score;
}

/**
 * Get verified news items for a symbol, market, sector, or list of symbols.
 */
async function getAnalystNews({ symbol, market = 'IN', symbols = [], sector, limit = 10 }) {
  const querySymbol = symbol ? String(symbol).toUpperCase() : null;
  const cacheKey = `${querySymbol || 'MULTI'}:${market}:${sector || 'ALL'}:${symbols.join(',')}`;
  const now = Date.now();
  const cached = newsCache.get(cacheKey);

  if (cached && now - cached.timestamp < TTL_MS) {
    return createAnalystEnvelope({
      symbol: querySymbol,
      market,
      data: cached.data,
      status: 'CACHED',
      source: 'Verified Financial News Aggregator',
      provider: 'Brave & Google Financial News',
      cacheTtlMs: TTL_MS,
      sourceCount: cached.data.length,
      retrievedAt: new Date(cached.timestamp).toISOString()
    });
  }

  // Build targeted search queries
  let searchQueries = [];
  if (querySymbol) {
    const isIndian = market === 'IN' || ['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'ICICIBANK', 'TATAMOTORS'].includes(querySymbol);
    searchQueries = isIndian
      ? [`${querySymbol} stock news NSE India`, `${querySymbol} quarterly results analysis`]
      : [`${querySymbol} stock news analysis`, `${querySymbol} company updates`];
  } else if (symbols.length > 0) {
    const symList = symbols.slice(0, 4).join(' OR ');
    searchQueries = [`(${symList}) stock market news`];
  } else if (sector) {
    searchQueries = [`${sector} sector stocks market news ${market === 'IN' ? 'India' : 'US'}`];
  } else {
    searchQueries = [market === 'IN' ? 'Indian stock market Nifty news' : 'US stock market S&P 500 news'];
  }

  const allArticles = [];
  const seenTitles = new Set();

  for (const q of searchQueries) {
    const [braveItems, rssItems] = await Promise.all([
      fetchBraveNews(q),
      fetchGoogleRssNews(q)
    ]);

    const combined = [...braveItems, ...rssItems];
    for (const a of combined) {
      const normalizedTitle = a.title.toLowerCase().trim();
      if (!seenTitles.has(normalizedTitle) && a.title.length > 10) {
        seenTitles.add(normalizedTitle);
        allArticles.push({
          ...a,
          symbol: querySymbol || 'MARKET',
          relevance: scoreArticle(a, querySymbol),
          retrievedAt: new Date(now).toISOString()
        });
      }
    }
  }

  // Sort by relevance score descending
  allArticles.sort((a, b) => b.relevance - a.relevance);
  const finalItems = allArticles.slice(0, limit);

  newsCache.set(cacheKey, { data: finalItems, timestamp: now });

  return createAnalystEnvelope({
    symbol: querySymbol,
    market,
    data: finalItems,
    status: 'LIVE',
    source: 'Verified Financial News Aggregator',
    provider: 'Brave & Google Financial News',
    cacheTtlMs: TTL_MS,
    sourceCount: finalItems.length,
    retrievedAt: new Date(now).toISOString()
  });
}

module.exports = {
  getAnalystNews
};
