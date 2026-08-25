const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 8080;
const DIST_DIR = path.join(__dirname, 'dist', 'portfolio-intelligence', 'browser');
const MONGODB_URI = process.env.MONGODB_URI || '';

app.use(express.json());

// In-memory cache for market quotes and searches
const quoteCache = new Map();
const searchCache = new Map();
const QUOTE_TTL_MS = 60 * 1000;
const SEARCH_TTL_MS = 5 * 60 * 1000;

// In-memory fallback stores if MongoDB is not connected
let memoryHoldings = [];
let memoryTransactions = [];
let memoryNotifications = [];
let memoryAlertStates = {};

// MongoDB Client Initialization
let mongoClient = null;
let db = null;
let isMongoConnected = false;

async function initMongoDB() {
  if (!MONGODB_URI) {
    console.info('[MongoDB] MONGODB_URI not provided. Running with in-memory / local storage mode.');
    return;
  }

  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db('portfolio_intelligence');
    isMongoConnected = true;
    console.log('[MongoDB] Successfully connected to MongoDB Atlas / Cloud database');

    // Create indexes for efficient querying
    await db.collection('holdings').createIndex({ symbol: 1 });
    await db.collection('transactions').createIndex({ holdingId: 1 });
    await db.collection('notifications').createIndex({ createdAt: -1 });
    await db.collection('alert_states').createIndex({ holdingId: 1 }, { unique: true });
  } catch (err) {
    console.error('[MongoDB] Connection error:', err.message);
    isMongoConnected = false;
  }
}

initMongoDB();

// Health & DB status endpoints
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    mongoConnected: isMongoConnected,
    uptime: process.uptime(),
  });
});

app.get('/api/db/status', (req, res) => {
  res.json({
    connected: isMongoConnected,
    database: isMongoConnected ? 'portfolio_intelligence' : null,
  });
});

// ============================================================================
// Portfolio REST Endpoints (MongoDB Persistent)
// ============================================================================

// GET /api/portfolio/holdings
app.get('/api/portfolio/holdings', async (req, res) => {
  try {
    if (isMongoConnected && db) {
      const holdings = await db.collection('holdings').find({}).toArray();
      const clean = holdings.map(({ _id, ...rest }) => rest);
      return res.json({ holdings: clean });
    }
    return res.json({ holdings: memoryHoldings });
  } catch (err) {
    return res.status(500).json({ error: err.message, holdings: memoryHoldings });
  }
});

// POST /api/portfolio/holdings (Add or update holding with weighted average cost)
app.post('/api/portfolio/holdings', async (req, res) => {
  try {
    const { symbol, companyName, exchange, market, currency, shares, purchasePrice, purchaseDate } = req.body;
    if (!symbol || !shares || !purchasePrice) {
      return res.status(400).json({ error: 'symbol, shares, and purchasePrice are required' });
    }

    const now = new Date().toISOString();
    const sym = symbol.toUpperCase();
    const sh = Number(shares);
    const pr = Number(purchasePrice);
    const txId = `tx-${Date.now()}`;

    let savedHolding = null;

    if (isMongoConnected && db) {
      const existing = await db.collection('holdings').findOne({ symbol: sym });

      if (existing) {
        const newTotalShares = existing.shares + sh;
        const newTotalInvested = existing.totalInvested + (sh * pr);
        const newAvgPrice = newTotalInvested / newTotalShares;

        const updated = {
          ...existing,
          shares: newTotalShares,
          avgPurchasePrice: newAvgPrice,
          totalInvested: newTotalInvested,
          updatedAt: now,
        };
        delete updated._id;

        await db.collection('holdings').updateOne({ symbol: sym }, { $set: updated });
        savedHolding = updated;
      } else {
        const id = `holding-${Date.now()}`;
        const newHolding = {
          id,
          symbol: sym,
          companyName: companyName || sym,
          exchange: exchange || (market === 'IN' ? 'NSE' : 'NASDAQ'),
          market: market || 'IN',
          currency: currency || (market === 'IN' ? 'INR' : 'USD'),
          shares: sh,
          avgPurchasePrice: pr,
          totalInvested: sh * pr,
          currentPrice: null,
          currentValue: null,
          profitLoss: null,
          profitLossPct: null,
          addedAt: now,
          updatedAt: now,
        };
        await db.collection('holdings').insertOne({ ...newHolding });
        savedHolding = newHolding;
      }

      // Record transaction
      const tx = {
        id: txId,
        holdingId: savedHolding.id,
        symbol: sym,
        type: 'BUY',
        shares: sh,
        price: pr,
        currency: currency || (market === 'IN' ? 'INR' : 'USD'),
        date: purchaseDate || now.split('T')[0],
        createdAt: now,
      };
      await db.collection('transactions').insertOne({ ...tx });
    } else {
      // In-memory fallback
      const existing = memoryHoldings.find((h) => h.symbol === sym);
      if (existing) {
        const newTotalShares = existing.shares + sh;
        const newTotalInvested = existing.totalInvested + (sh * pr);
        const newAvgPrice = newTotalInvested / newTotalShares;
        existing.shares = newTotalShares;
        existing.avgPurchasePrice = newAvgPrice;
        existing.totalInvested = newTotalInvested;
        existing.updatedAt = now;
        savedHolding = existing;
      } else {
        const newHolding = {
          id: `holding-${Date.now()}`,
          symbol: sym,
          companyName: companyName || sym,
          exchange: exchange || (market === 'IN' ? 'NSE' : 'NASDAQ'),
          market: market || 'IN',
          currency: currency || (market === 'IN' ? 'INR' : 'USD'),
          shares: sh,
          avgPurchasePrice: pr,
          totalInvested: sh * pr,
          currentPrice: null,
          currentValue: null,
          profitLoss: null,
          profitLossPct: null,
          addedAt: now,
          updatedAt: now,
        };
        memoryHoldings.unshift(newHolding);
        savedHolding = newHolding;
      }
      memoryTransactions.unshift({
        id: txId,
        holdingId: savedHolding.id,
        symbol: sym,
        type: 'BUY',
        shares: sh,
        price: pr,
        currency: currency || (market === 'IN' ? 'INR' : 'USD'),
        date: purchaseDate || now.split('T')[0],
        createdAt: now,
      });
    }

    return res.status(201).json({ holding: savedHolding });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/portfolio/holdings/:id
app.delete('/api/portfolio/holdings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMongoConnected && db) {
      await db.collection('holdings').deleteOne({ id });
      await db.collection('transactions').deleteMany({ holdingId: id });
      await db.collection('alert_states').deleteOne({ holdingId: id });
    } else {
      memoryHoldings = memoryHoldings.filter((h) => h.id !== id);
      memoryTransactions = memoryTransactions.filter((t) => t.holdingId !== id);
      delete memoryAlertStates[id];
    }
    return res.json({ success: true, id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/portfolio/transactions
app.get('/api/portfolio/transactions', async (req, res) => {
  try {
    if (isMongoConnected && db) {
      const txs = await db.collection('transactions').find({}).sort({ createdAt: -1 }).toArray();
      const clean = txs.map(({ _id, ...rest }) => rest);
      return res.json({ transactions: clean });
    }
    return res.json({ transactions: memoryTransactions });
  } catch (err) {
    return res.status(500).json({ error: err.message, transactions: memoryTransactions });
  }
});

// ============================================================================
// Notifications & Alerts REST Endpoints (MongoDB Persistent)
// ============================================================================

// GET /api/notifications
app.get('/api/notifications', async (req, res) => {
  try {
    if (isMongoConnected && db) {
      const notifs = await db.collection('notifications').find({}).sort({ createdAt: -1 }).limit(100).toArray();
      const clean = notifs.map(({ _id, ...rest }) => rest);
      return res.json({ notifications: clean });
    }
    return res.json({ notifications: memoryNotifications });
  } catch (err) {
    return res.status(500).json({ error: err.message, notifications: memoryNotifications });
  }
});

// POST /api/notifications
app.post('/api/notifications', async (req, res) => {
  try {
    const notif = req.body;
    if (!notif.id || !notif.message) {
      return res.status(400).json({ error: 'id and message are required' });
    }

    if (isMongoConnected && db) {
      await db.collection('notifications').updateOne(
        { id: notif.id },
        { $set: notif },
        { upsert: true }
      );
    } else {
      const idx = memoryNotifications.findIndex((n) => n.id === notif.id);
      if (idx >= 0) {
        memoryNotifications[idx] = notif;
      } else {
        memoryNotifications.unshift(notif);
      }
    }
    return res.status(201).json({ notification: notif });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read
app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMongoConnected && db) {
      await db.collection('notifications').updateOne({ id }, { $set: { isRead: true } });
    } else {
      const n = memoryNotifications.find((x) => x.id === id);
      if (n) n.isRead = true;
    }
    return res.json({ success: true, id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read-all
app.post('/api/notifications/read-all', async (req, res) => {
  try {
    if (isMongoConnected && db) {
      await db.collection('notifications').updateMany({}, { $set: { isRead: true } });
    } else {
      memoryNotifications.forEach((n) => (n.isRead = true));
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/monitoring/alert-states
app.get('/api/monitoring/alert-states', async (req, res) => {
  try {
    if (isMongoConnected && db) {
      const list = await db.collection('alert_states').find({}).toArray();
      const map = {};
      list.forEach(({ _id, holdingId, ...rest }) => {
        map[holdingId] = { holdingId, ...rest };
      });
      return res.json({ alertStates: map });
    }
    return res.json({ alertStates: memoryAlertStates });
  } catch (err) {
    return res.status(500).json({ error: err.message, alertStates: memoryAlertStates });
  }
});

// POST /api/monitoring/alert-states
app.post('/api/monitoring/alert-states', async (req, res) => {
  try {
    const state = req.body;
    if (!state.holdingId) {
      return res.status(400).json({ error: 'holdingId is required' });
    }

    if (isMongoConnected && db) {
      await db.collection('alert_states').updateOne(
        { holdingId: state.holdingId },
        { $set: state },
        { upsert: true }
      );
    } else {
      memoryAlertStates[state.holdingId] = state;
    }
    return res.json({ success: true, state });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Market Quotes & Live Search Endpoints
// ============================================================================

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
    // ignore individual ticker error
  }
  return null;
}

app.get('/api/market/search', async (req, res) => {
  const query = (req.query.q || '').toString().trim();
  const market = (req.query.market || 'IN').toString().toUpperCase();

  if (!query || query.length < 1) {
    return res.json({ results: [] });
  }

  const cacheKey = `${query}:${market}`;
  const cached = searchCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < SEARCH_TTL_MS) {
    return res.json({ results: cached.data });
  }

  const isIndia = market === 'IN';
  const queries = isIndia
    ? [query, `${query}.NS`, `${query}.BO`, `${query} Ltd`]
    : [query];

  const results = [];
  const seen = new Set();

  for (const q of queries) {
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0`;
      const apiRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!apiRes.ok) continue;
      const json = await apiRes.json();
      const quotes = json.quotes || [];

      for (const item of quotes) {
        if (!item.symbol) continue;
        const sym = item.symbol.toUpperCase();
        const isNse = sym.endsWith('.NS') || item.exchange === 'NSI';
        const isBse = sym.endsWith('.BO') || item.exchange === 'BSE';

        if (isIndia) {
          if (!isNse && !isBse && item.exchange !== 'NSI' && item.exchange !== 'BSE') continue;
          const cleanSymbol = sym.replace(/\.(NS|BO)$/, '');
          if (seen.has(cleanSymbol)) continue;
          seen.add(cleanSymbol);
          results.push({
            symbol: cleanSymbol,
            companyName: item.shortname || item.longname || cleanSymbol,
            exchange: isBse && !isNse ? 'BSE' : 'NSE',
            market: 'IN',
            currency: 'INR',
          });
        } else {
          if (isNse || isBse) continue;
          const cleanSymbol = sym;
          if (seen.has(cleanSymbol)) continue;
          seen.add(cleanSymbol);
          results.push({
            symbol: cleanSymbol,
            companyName: item.shortname || item.longname || cleanSymbol,
            exchange: item.exchange || 'NASDAQ',
            market: 'US',
            currency: 'USD',
          });
        }
      }
    } catch (err) {
      // ignore
    }
  }

  const finalResults = results.slice(0, 12);
  searchCache.set(cacheKey, { data: finalResults, timestamp: now });
  return res.json({ results: finalResults });
});

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

      if (cached && now - cached.timestamp < QUOTE_TTL_MS) {
        results[symbol] = cached.data;
        return;
      }

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
