if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch { /* dotenv not installed in prod build — fine */ }
}

const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 8080;
const DIST_DIR = path.join(__dirname, 'dist', 'portfolio-intelligence', 'browser');
const MONGODB_URI = (process.env.MONGODB_URI || '').trim();

const JWT_SECRET = (process.env.JWT_SECRET || 'dev-insecure-secret-change-me').trim();
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
if (JWT_SECRET === 'dev-insecure-secret-change-me') {
  console.warn('[auth] JWT_SECRET not set — using an insecure default. Set JWT_SECRET in production.');
}

app.use(express.json());
app.use(cookieParser());

// In-memory cache for market quotes and searches
const quoteCache = new Map();
const searchCache = new Map();
const QUOTE_TTL_MS = 60 * 1000;
const SEARCH_TTL_MS = 5 * 60 * 1000;

// In-memory fallback stores if MongoDB is not connected
let memoryUsers = [];
const memoryStores = new Map(); // userId -> { holdings, transactions, notifications, alertStates }
function getMemoryStore(userId) {
  if (!memoryStores.has(userId)) {
    memoryStores.set(userId, { holdings: [], transactions: [], notifications: [], alertStates: {} });
  }
  return memoryStores.get(userId);
}

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
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('holdings').createIndex({ userId: 1, symbol: 1 });
    await db.collection('transactions').createIndex({ userId: 1, holdingId: 1 });
    await db.collection('notifications').createIndex({ userId: 1, createdAt: -1 });
    await db.collection('alert_states').createIndex({ holdingId: 1, userId: 1 }, { unique: true });
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
// Auth Endpoints
// ============================================================================

function toInitials(name) {
  return (name || '')
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function publicUser(u) {
  if (!u) return null;
  const { passwordHash, googleId, _id, ...rest } = u;
  return rest;
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

async function findUserByEmail(email) {
  if (isMongoConnected && db) return db.collection('users').findOne({ email });
  return memoryUsers.find((u) => u.email === email) || null;
}

async function findUserById(id) {
  if (isMongoConnected && db) return db.collection('users').findOne({ id });
  return memoryUsers.find((u) => u.id === id) || null;
}

async function insertUser(user) {
  if (isMongoConnected && db) {
    await db.collection('users').insertOne({ ...user });
    return user;
  }
  memoryUsers.push(user);
  return user;
}

async function updateUserRecord(id, patch) {
  if (isMongoConnected && db) {
    await db.collection('users').updateOne({ id }, { $set: patch });
    return findUserById(id);
  }
  const u = memoryUsers.find((x) => x.id === id);
  if (u) Object.assign(u, patch);
  return u || null;
}

function requireAuth(req, res, next) {
  const token = req.cookies ? req.cookies.token : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).sub;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// GET /api/auth/config — tells the frontend whether Google Sign-In is available
app.get('/api/auth/config', (req, res) => {
  res.json({ googleEnabled: !!googleClient, googleClientId: GOOGLE_CLIENT_ID || null });
});

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      email,
      name,
      passwordHash,
      googleId: null,
      avatarInitials: toInitials(name),
      accountTier: 'Free',
      provider: 'password',
      createdAt: new Date().toISOString(),
    };
    await insertUser(user);
    setAuthCookie(res, signToken(user.id));
    return res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await findUserByEmail(email);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    setAuthCookie(res, signToken(user.id));
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/google — verifies a Google Identity Services ID token
app.post('/api/auth/google', async (req, res) => {
  if (!googleClient) {
    return res.status(501).json({ error: 'Google sign-in is not configured' });
  }
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'credential is required' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.error('[Google Auth] Token verification failed:', verifyErr.message);
      return res.status(401).json({ error: `Invalid Google credential: ${verifyErr.message}` });
    }

    const email = (payload.email || '').toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Google account has no email' });
    }

    let user = await findUserByEmail(email);
    if (user) {
      if (!user.googleId) {
        user = await updateUserRecord(user.id, { googleId: payload.sub });
      }
    } else {
      user = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        email,
        name: payload.name || email,
        passwordHash: null,
        googleId: payload.sub,
        avatarInitials: toInitials(payload.name || email),
        accountTier: 'Free',
        provider: 'google',
        createdAt: new Date().toISOString(),
      };
      await insertUser(user);
    }

    setAuthCookie(res, signToken(user.id));
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ success: true });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/me
app.patch('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    const updated = await updateUserRecord(req.userId, { name, avatarInitials: toInitials(name) });
    if (!updated) return res.status(401).json({ error: 'Not authenticated' });
    return res.json({ user: publicUser(updated) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// All portfolio/notifications/monitoring data is per-user from here on.
app.use('/api/portfolio', requireAuth);
app.use('/api/notifications', requireAuth);
app.use('/api/monitoring', requireAuth);

// ============================================================================
// Portfolio REST Endpoints (MongoDB Persistent)
// ============================================================================

// GET /api/portfolio/holdings
app.get('/api/portfolio/holdings', async (req, res) => {
  try {
    if (isMongoConnected && db) {
      const holdings = await db.collection('holdings').find({ userId: req.userId }).toArray();
      const clean = holdings.map(({ _id, ...rest }) => rest);
      return res.json({ holdings: clean });
    }
    return res.json({ holdings: getMemoryStore(req.userId).holdings });
  } catch (err) {
    return res.status(500).json({ error: err.message, holdings: getMemoryStore(req.userId).holdings });
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
      const existing = await db.collection('holdings').findOne({ symbol: sym, userId: req.userId });

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

        await db.collection('holdings').updateOne({ symbol: sym, userId: req.userId }, { $set: updated });
        savedHolding = updated;
      } else {
        const id = `holding-${Date.now()}`;
        const newHolding = {
          id,
          userId: req.userId,
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
        userId: req.userId,
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
      const store = getMemoryStore(req.userId);
      const existing = store.holdings.find((h) => h.symbol === sym);
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
        store.holdings.unshift(newHolding);
        savedHolding = newHolding;
      }
      store.transactions.unshift({
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

// PUT /api/portfolio/holdings/:id (Edit holding shares and purchase price)
app.put('/api/portfolio/holdings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { shares, avgPurchasePrice, companyName } = req.body;
    const sh = Number(shares);
    const pr = Number(avgPurchasePrice);
    if (!sh || sh <= 0 || !pr || pr <= 0) {
      return res.status(400).json({ error: 'Valid shares and avgPurchasePrice are required' });
    }

    const now = new Date().toISOString();
    let savedHolding = null;

    if (isMongoConnected && db) {
      const existing = await db.collection('holdings').findOne({ id, userId: req.userId });
      if (!existing) {
        return res.status(404).json({ error: 'Holding not found' });
      }

      const totalInvested = sh * pr;
      const currentValue = existing.currentPrice ? sh * existing.currentPrice : null;
      const profitLoss = currentValue !== null ? currentValue - totalInvested : null;
      const profitLossPct = existing.currentPrice ? ((existing.currentPrice - pr) / pr) * 100 : null;

      const updated = {
        ...existing,
        shares: sh,
        avgPurchasePrice: pr,
        totalInvested,
        currentValue,
        profitLoss,
        profitLossPct,
        companyName: companyName || existing.companyName,
        updatedAt: now,
      };
      delete updated._id;

      await db.collection('holdings').updateOne({ id, userId: req.userId }, { $set: updated });
      await db.collection('alert_states').updateOne(
        { holdingId: id, userId: req.userId },
        { $set: { referencePrice: pr, lastUpThreshold: 0, lastDownThreshold: 0, updatedAt: now } }
      );
      savedHolding = updated;
    } else {
      const store = getMemoryStore(req.userId);
      const existing = store.holdings.find((h) => h.id === id);
      if (!existing) {
        return res.status(404).json({ error: 'Holding not found' });
      }
      existing.shares = sh;
      existing.avgPurchasePrice = pr;
      existing.totalInvested = sh * pr;
      if (existing.currentPrice) {
        existing.currentValue = sh * existing.currentPrice;
        existing.profitLoss = existing.currentValue - existing.totalInvested;
        existing.profitLossPct = ((existing.currentPrice - pr) / pr) * 100;
      }
      if (companyName) existing.companyName = companyName;
      existing.updatedAt = now;

      if (store.alertStates[id]) {
        store.alertStates[id].referencePrice = pr;
        store.alertStates[id].lastUpThreshold = 0;
        store.alertStates[id].lastDownThreshold = 0;
      }
      savedHolding = existing;
    }

    return res.json({ holding: savedHolding });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/portfolio/holdings/:id
app.delete('/api/portfolio/holdings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMongoConnected && db) {
      await db.collection('holdings').deleteOne({ id, userId: req.userId });
      await db.collection('transactions').deleteMany({ holdingId: id, userId: req.userId });
      await db.collection('alert_states').deleteOne({ holdingId: id, userId: req.userId });
    } else {
      const store = getMemoryStore(req.userId);
      store.holdings = store.holdings.filter((h) => h.id !== id);
      store.transactions = store.transactions.filter((t) => t.holdingId !== id);
      delete store.alertStates[id];
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
      const txs = await db.collection('transactions').find({ userId: req.userId }).sort({ createdAt: -1 }).toArray();
      const clean = txs.map(({ _id, ...rest }) => rest);
      return res.json({ transactions: clean });
    }
    return res.json({ transactions: getMemoryStore(req.userId).transactions });
  } catch (err) {
    return res.status(500).json({ error: err.message, transactions: getMemoryStore(req.userId).transactions });
  }
});

// ============================================================================
// Notifications & Alerts REST Endpoints (MongoDB Persistent)
// ============================================================================

// GET /api/notifications
app.get('/api/notifications', async (req, res) => {
  try {
    if (isMongoConnected && db) {
      const notifs = await db.collection('notifications').find({ userId: req.userId }).sort({ createdAt: -1 }).limit(100).toArray();
      const clean = notifs.map(({ _id, ...rest }) => rest);
      return res.json({ notifications: clean });
    }
    return res.json({ notifications: getMemoryStore(req.userId).notifications });
  } catch (err) {
    return res.status(500).json({ error: err.message, notifications: getMemoryStore(req.userId).notifications });
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
        { id: notif.id, userId: req.userId },
        { $set: notif },
        { upsert: true }
      );
    } else {
      const store = getMemoryStore(req.userId);
      const idx = store.notifications.findIndex((n) => n.id === notif.id);
      if (idx >= 0) {
        store.notifications[idx] = notif;
      } else {
        store.notifications.unshift(notif);
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
      await db.collection('notifications').updateOne({ id, userId: req.userId }, { $set: { isRead: true } });
    } else {
      const n = getMemoryStore(req.userId).notifications.find((x) => x.id === id);
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
      await db.collection('notifications').updateMany({ userId: req.userId }, { $set: { isRead: true } });
    } else {
      getMemoryStore(req.userId).notifications.forEach((n) => (n.isRead = true));
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
      const list = await db.collection('alert_states').find({ userId: req.userId }).toArray();
      const map = {};
      list.forEach(({ _id, holdingId, ...rest }) => {
        map[holdingId] = { holdingId, ...rest };
      });
      return res.json({ alertStates: map });
    }
    return res.json({ alertStates: getMemoryStore(req.userId).alertStates });
  } catch (err) {
    return res.status(500).json({ error: err.message, alertStates: getMemoryStore(req.userId).alertStates });
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
        { holdingId: state.holdingId, userId: req.userId },
        { $set: state },
        { upsert: true }
      );
    } else {
      getMemoryStore(req.userId).alertStates[state.holdingId] = state;
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
