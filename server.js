const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const DIST_DIR = path.join(__dirname, 'dist', 'portfolio-intelligence', 'browser');

// In-memory quote cache (60 seconds TTL)
const quoteCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

// Health check endpoint for Railway & monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

// Helper to fetch live quote from Yahoo Finance API
async function fetchYahooQuote(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) return null;
    const json = await res.json();
    const meta = json.chart?.result?.[0]?.meta;
    if (meta && typeof meta.regularMarketPrice === 'number') {
      return {
        price: meta.regularMarketPrice,
        currency: meta.currency,
        previousClose: meta.chartPreviousClose,
        marketTime: meta.regularMarketTime,
        ticker,
      };
    }
  } catch (err) {
    console.error(`[Quotes API] Error fetching ${ticker}:`, err.message);
  }
  return null;
}

// Real-time market quotes proxy endpoint for US & Indian stocks
app.get('/api/market/quotes', async (req, res) => {
  const symbolsParam = req.query.symbols;
  if (!symbolsParam || typeof symbolsParam !== 'string') {
    return res.status(400).json({ error: 'symbols query parameter is required' });
  }

  const items = symbolsParam.split(',').map((item) => {
    const parts = item.trim().split(':');
    const symbol = parts[0].toUpperCase();
    const market = parts[1] ? parts[1].toUpperCase() : undefined;
    return { symbol, market };
  }).filter((i) => i.symbol.length > 0);

  const now = Date.now();
  const results = {};

  await Promise.all(
    items.map(async ({ symbol, market }) => {
      const cacheKey = `${symbol}:${market || 'AUTO'}`;
      const cached = quoteCache.get(cacheKey);

      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        results[symbol] = cached.data;
        return;
      }

      // Build candidate tickers based on market
      const isIndia = market === 'IN' || symbol.endsWith('.NS') || symbol.endsWith('.BO');
      const candidates = isIndia
        ? (symbol.endsWith('.NS') || symbol.endsWith('.BO') ? [symbol] : [`${symbol}.NS`, `${symbol}.BO`, symbol])
        : [`${symbol}`, `${symbol}.NS`];

      let quote = null;
      for (const ticker of candidates) {
        quote = await fetchYahooQuote(ticker);
        if (quote) break;
      }

      if (quote) {
        const payload = {
          price: quote.price,
          currency: quote.currency,
          previousClose: quote.previousClose,
          ticker: quote.ticker,
        };
        quoteCache.set(cacheKey, { data: payload, timestamp: now });
        results[symbol] = payload;
      }
    })
  );

  res.setHeader('Cache-Control', 'public, max-age=30');
  return res.json({ quotes: results, timestamp: new Date().toISOString() });
});

// Serve static files from Angular build output
app.use(express.static(DIST_DIR, {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Catch-all handler for Angular SPA client-side routing
app.use((req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Portfolio Intelligence is listening on port ${PORT} (0.0.0.0:${PORT})`);
});
