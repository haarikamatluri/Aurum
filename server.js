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
const rateLimit = require('express-rate-limit');
const webpush = require('web-push');
const { generateSecret, generateURI, verifySync } = require('otplib');
const QRCode = require('qrcode');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;
const DIST_DIR = path.join(__dirname, 'dist', 'portfolio-intelligence', 'browser');
const MONGODB_URI = (process.env.MONGODB_URI || '').trim();
const MONGODB_DB_NAME = (process.env.MONGODB_DB_NAME || 'portfolio_intelligence').trim();

const JWT_SECRET = (process.env.JWT_SECRET || 'dev-insecure-secret-change-me').trim();
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
if (JWT_SECRET === 'dev-insecure-secret-change-me') {
  console.warn('[auth] JWT_SECRET not set — using an insecure default. Set JWT_SECRET in production.');
}

app.use(express.json());
app.use(cookieParser());

// Security & Abuse Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const marketLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Market rate limit reached. Please slow down requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Web Push VAPID setup
let vapidPublicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
let vapidPrivateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
if (!vapidPublicKey || !vapidPrivateKey) {
  const genKeys = webpush.generateVAPIDKeys();
  vapidPublicKey = genKeys.publicKey;
  vapidPrivateKey = genKeys.privateKey;
}
try {
  webpush.setVapidDetails('mailto:support@aurum.local', vapidPublicKey, vapidPrivateKey);
} catch (err) {
  console.warn('[webpush] Failed to set VAPID details:', err.message);
}

const memoryPushSubscriptions = new Map(); // userId -> [subscription]

async function savePushSubscription(userId, subscription) {
  if (isMongoConnected && db) {
    await db.collection('push_subscriptions').updateOne(
      { userId, endpoint: subscription.endpoint },
      { $set: { userId, subscription, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    return;
  }
  const existing = memoryPushSubscriptions.get(userId) || [];
  if (!existing.some((s) => s.endpoint === subscription.endpoint)) {
    existing.push(subscription);
    memoryPushSubscriptions.set(userId, existing);
  }
}

async function sendPushToUser(userId, payload) {
  let subs = [];
  try {
    if (isMongoConnected && db) {
      const docs = await db.collection('push_subscriptions').find({ userId }).toArray();
      subs = docs.map((d) => d.subscription);
    } else {
      subs = memoryPushSubscriptions.get(userId) || [];
    }

    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(s, payloadStr).catch((err) => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            if (isMongoConnected && db) {
              db.collection('push_subscriptions').deleteOne({ 'subscription.endpoint': s.endpoint });
            }
          }
        })
      )
    );
  } catch (err) {
    console.warn('[Push] Error dispatching push notification:', err.message);
  }
}

// In-memory cache for market quotes, searches, and news
const quoteCache = new Map();
const searchCache = new Map();
const newsCache = new Map();
const QUOTE_TTL_MS = 60 * 1000;
const SEARCH_TTL_MS = 5 * 60 * 1000;
const NEWS_TTL_MS = 10 * 60 * 1000;

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
    db = mongoClient.db(MONGODB_DB_NAME);
    isMongoConnected = true;
    console.log(`[MongoDB] Successfully connected to MongoDB Atlas / Cloud database (${MONGODB_DB_NAME})`);

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
    database: isMongoConnected ? MONGODB_DB_NAME : null,
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
  const { passwordHash, googleId, _id, twoFactorSecret, ...rest } = u;
  return {
    ...rest,
    twoFactorEnabled: !!u.twoFactorEnabled,
    zerodhaConnected: !!u.zerodhaConnection?.connected,
    webullConnected: !!u.webullConnection?.connected,
  };
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
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

let memoryResets = [];

async function insertResetCode(record) {
  if (isMongoConnected && db) {
    await db.collection('password_resets').insertOne({ ...record });
    return record;
  }
  memoryResets.push(record);
  return record;
}

async function findLatestResetCode(email, code) {
  if (isMongoConnected && db) {
    return db.collection('password_resets').findOne({ email, code, used: false });
  }
  return memoryResets.find((r) => r.email === email && r.code === code && !r.used) || null;
}

async function markResetCodeUsed(id) {
  if (isMongoConnected && db) {
    await db.collection('password_resets').updateOne({ id }, { $set: { used: true } });
    return;
  }
  const r = memoryResets.find((x) => x.id === id);
  if (r) r.used = true;
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
app.post('/api/auth/signup', authLimiter, async (req, res) => {
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
      twoFactorEnabled: false,
      twoFactorSecret: null,
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
app.post('/api/auth/login', authLimiter, async (req, res) => {
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

    // Check if Two-Factor Authentication is enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const tempToken = jwt.sign({ sub: user.id, is2FaChallenge: true }, JWT_SECRET, { expiresIn: '5m' });
      return res.json({ twoFactorRequired: true, tempToken });
    }

    setAuthCookie(res, signToken(user.id));
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login-2fa (Verifies TOTP code during 2FA login challenge)
app.post('/api/auth/login-2fa', authLimiter, async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ error: 'tempToken and 6-digit code are required' });
    }
    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: '2FA session expired. Please sign in again.' });
    }
    if (!decoded.is2FaChallenge) {
      return res.status(401).json({ error: 'Invalid 2FA challenge' });
    }

    const user = await findUserById(decoded.sub);
    if (!user || !user.twoFactorSecret) {
      return res.status(401).json({ error: 'User not found or 2FA not configured' });
    }

    const check = verifySync({ token: code.trim(), secret: user.twoFactorSecret });
    if (!check || !check.valid) {
      return res.status(400).json({ error: 'Invalid 6-digit code. Please check your Authenticator app.' });
    }

    setAuthCookie(res, signToken(user.id));
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/2fa/generate (Protected - generates secret and QR code)
app.post('/api/auth/2fa/generate', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const secret = generateSecret();
    const otpauth = generateURI({ issuer: 'Aurum Portfolio', label: user.email, secret });
    const qrCode = await QRCode.toDataURL(otpauth);
    return res.json({ secret, qrCode });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/2fa/verify (Protected - verifies 6-digit code and activates 2FA)
app.post('/api/auth/2fa/verify', requireAuth, async (req, res) => {
  try {
    const { secret, code } = req.body;
    if (!secret || !code) return res.status(400).json({ error: 'Secret and code are required' });
    const check = verifySync({ token: code.trim(), secret });
    if (!check || !check.valid) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your Authenticator app.' });
    }
    await updateUserRecord(req.userId, { twoFactorEnabled: true, twoFactorSecret: secret });
    return res.json({ success: true, message: 'Two-Factor Authentication activated successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/2fa/disable (Protected - disables 2FA with password check)
app.post('/api/auth/2fa/disable', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    const user = await findUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.passwordHash) {
      const ok = await bcrypt.compare(password || '', user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Incorrect password' });
    }
    await updateUserRecord(req.userId, { twoFactorEnabled: false, twoFactorSecret: null });
    return res.json({ success: true, message: 'Two-Factor Authentication disabled' });
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

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address' });
    }

    // Generate a 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const resetRecord = {
      id: `reset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      email,
      code,
      used: false,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
      createdAt: new Date().toISOString(),
    };

    await insertResetCode(resetRecord);

    console.log(`[Password Reset] Generated 6-digit code for ${email}: ${code}`);
    return res.json({
      success: true,
      message: 'A 6-digit password reset code has been generated. It expires in 15 minutes.',
      code,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const code = (req.body.code || '').trim();
    const newPassword = req.body.newPassword || '';

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, verification code, and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    const resetRecord = await findLatestResetCode(email, code);
    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    if (new Date() > new Date(resetRecord.expiresAt)) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await updateUserRecord(user.id, { passwordHash, provider: user.provider || 'password' });
    await markResetCodeUsed(resetRecord.id);

    return res.json({
      success: true,
      message: 'Password updated successfully. You can now sign in with your new password.',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
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

// All portfolio/notifications/monitoring/broker data is per-user from here on.
app.use('/api/portfolio', requireAuth);
app.use('/api/notifications', requireAuth);
app.use('/api/monitoring', requireAuth);
app.use('/api/broker', requireAuth);

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

// POST /api/portfolio/holdings/bulk (Bulk add or update holdings from Excel/CSV import)
app.post('/api/portfolio/holdings/bulk', async (req, res) => {
  try {
    const { holdings: items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Array of holdings is required' });
    }

    const now = new Date().toISOString();
    const savedHoldings = [];

    for (const item of items) {
      const { symbol, companyName, exchange, market, currency, shares, purchasePrice, purchaseDate } = item;
      if (!symbol || !shares || !purchasePrice) continue;

      const sym = symbol.toUpperCase();
      const sh = Number(shares);
      const pr = Number(purchasePrice);
      if (isNaN(sh) || sh <= 0 || isNaN(pr) || pr <= 0) continue;

      const txId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
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
          const id = `holding-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
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
            id: `holding-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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
      savedHoldings.push(savedHolding);
    }

    return res.status(201).json({ success: true, count: savedHoldings.length, holdings: savedHoldings });
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
    // Dispatch Web Push Notification asynchronously to active subscriptions
    sendPushToUser(req.userId, {
      title: notif.title || (notif.type === 'SUCCESS' ? '🚀 Portfolio Target Met' : notif.type === 'ALERT' ? '⚠️ Portfolio Movement Alert' : 'Aurum Alert'),
      body: notif.message,
      tag: notif.id,
      data: { holdingId: notif.holdingId, symbol: notif.symbol, url: '/dashboard' }
    }).catch(() => {});

    return res.status(201).json({ notification: notif });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read
app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
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
app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
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

// GET /api/notifications/vapid-public-key (Public/Protected for push subscription)
app.get('/api/notifications/vapid-public-key', (req, res) => {
  return res.json({ publicKey: vapidPublicKey });
});

// POST /api/notifications/push-subscription (Registers browser PushSubscription)
app.post('/api/notifications/push-subscription', requireAuth, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Valid subscription object required' });
    }
    await savePushSubscription(req.userId, subscription);
    return res.json({ success: true, message: 'Push subscription registered successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/test-push (Dispatches immediate test push)
app.post('/api/notifications/test-push', requireAuth, async (req, res) => {
  try {
    await sendPushToUser(req.userId, {
      title: 'Aurum Portfolio Intelligence',
      body: 'Web push notifications are fully active! You will receive instant 5% movement alerts even when Aurum is in the background.',
      tag: 'test-push-' + Date.now(),
      data: { url: '/dashboard' }
    });
    return res.json({ success: true, message: 'Test notification dispatched to your registered devices' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/monitoring/alert-states
app.get('/api/monitoring/alert-states', requireAuth, async (req, res) => {
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
app.post('/api/monitoring/alert-states', requireAuth, async (req, res) => {
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
// Broker Integrations (Zerodha Kite & Webull)
// ============================================================================

const ZERODHA_MOCK_HOLDINGS = [
  { symbol: 'RELIANCE', companyName: 'Reliance Industries Ltd', exchange: 'NSE', market: 'IN', currency: 'INR', shares: 25, purchasePrice: 2840.50, purchaseDate: '2024-01-15' },
  { symbol: 'TCS', companyName: 'Tata Consultancy Services', exchange: 'NSE', market: 'IN', currency: 'INR', shares: 15, purchasePrice: 3890.00, purchaseDate: '2024-02-10' },
  { symbol: 'HDFCBANK', companyName: 'HDFC Bank Ltd', exchange: 'NSE', market: 'IN', currency: 'INR', shares: 40, purchasePrice: 1610.25, purchaseDate: '2024-03-01' },
  { symbol: 'INFY', companyName: 'Infosys Limited', exchange: 'NSE', market: 'IN', currency: 'INR', shares: 35, purchasePrice: 1520.80, purchaseDate: '2024-01-20' },
  { symbol: 'ICICIBANK', companyName: 'ICICI Bank Ltd', exchange: 'NSE', market: 'IN', currency: 'INR', shares: 50, purchasePrice: 1040.00, purchaseDate: '2024-04-12' },
];

const WEBULL_MOCK_HOLDINGS = [
  { symbol: 'NVDA', companyName: 'NVIDIA Corporation', exchange: 'NASDAQ', market: 'US', currency: 'USD', shares: 20, purchasePrice: 112.50, purchaseDate: '2024-05-10' },
  { symbol: 'AAPL', companyName: 'Apple Inc.', exchange: 'NASDAQ', market: 'US', currency: 'USD', shares: 30, purchasePrice: 188.20, purchaseDate: '2024-02-14' },
  { symbol: 'MSFT', companyName: 'Microsoft Corporation', exchange: 'NASDAQ', market: 'US', currency: 'USD', shares: 12, purchasePrice: 415.00, purchaseDate: '2024-03-22' },
  { symbol: 'TSLA', companyName: 'Tesla, Inc.', exchange: 'NASDAQ', market: 'US', currency: 'USD', shares: 25, purchasePrice: 195.40, purchaseDate: '2024-06-05' },
  { symbol: 'AMZN', companyName: 'Amazon.com, Inc.', exchange: 'NASDAQ', market: 'US', currency: 'USD', shares: 18, purchasePrice: 178.60, purchaseDate: '2024-04-18' },
];

// POST /api/broker/zerodha/connect
app.post('/api/broker/zerodha/connect', requireAuth, async (req, res) => {
  try {
    const { apiKey, apiSecret, requestToken, isSandbox } = req.body;
    const finalApiKey = (apiKey || process.env.KITE_API_KEY || '').trim();
    const finalApiSecret = (apiSecret || process.env.KITE_API_SECRET || '').trim();
    let accessToken = null;
    let kiteUserId = null;

    // Real Kite Connect API Authentication
    if (isSandbox === false && finalApiKey && finalApiSecret && requestToken) {
      try {
        const checksum = crypto.createHash('sha256').update(finalApiKey + requestToken + finalApiSecret).digest('hex');
        const tokenRes = await fetch('https://api.kite.trade/session/token', {
          method: 'POST',
          headers: {
            'X-Kite-Version': '3',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            api_key: finalApiKey,
            request_token: requestToken,
            checksum: checksum
          })
        });
        const tokenData = await tokenRes.json();
        if (tokenData.status === 'success' && tokenData.data?.access_token) {
          accessToken = tokenData.data.access_token;
          kiteUserId = tokenData.data.user_id;
        } else {
          console.warn('[Zerodha Kite] Session token response:', tokenData);
        }
      } catch (kErr) {
        console.warn('[Zerodha Kite] Real token exchange error:', kErr.message);
      }
    }

    const connection = {
      connected: true,
      broker: 'zerodha',
      isSandbox: isSandbox !== false && !accessToken,
      apiKey: finalApiKey || null,
      accessToken: accessToken || null,
      kiteUserId: kiteUserId || null,
      maskedKey: finalApiKey ? `${finalApiKey.slice(0, 4)}••••` : 'DEMO_KITE',
      connectedAt: new Date().toISOString(),
    };

    await updateUserRecord(req.userId, { zerodhaConnection: connection });
    return res.json({ success: true, connection: { ...connection, apiKey: undefined, accessToken: undefined } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/broker/zerodha/holdings
app.get('/api/broker/zerodha/holdings', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.userId);
    const conn = user?.zerodhaConnection;
    const finalApiKey = conn?.apiKey || process.env.KITE_API_KEY || null;

    // If connected with real Kite API access_token, fetch live holdings from Zerodha
    if (conn && conn.accessToken && finalApiKey) {
      try {
        const kiteRes = await fetch('https://api.kite.trade/portfolio/holdings', {
          headers: {
            'X-Kite-Version': '3',
            'Authorization': `token ${finalApiKey}:${conn.accessToken}`
          }
        });
        const kiteJson = await kiteRes.json();
        if (kiteJson.status === 'success' && Array.isArray(kiteJson.data)) {
          const liveHoldings = kiteJson.data.map((h) => ({
            symbol: h.tradingsymbol,
            companyName: h.tradingsymbol,
            exchange: h.exchange || 'NSE',
            market: 'IN',
            currency: 'INR',
            shares: Number(h.quantity || 0),
            purchasePrice: Number(h.average_price || 0),
            purchaseDate: new Date().toISOString().slice(0, 10),
          }));
          return res.json({
            broker: 'zerodha',
            connected: true,
            isSandbox: false,
            holdings: liveHoldings,
            fetchedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('[Zerodha Kite] Live holdings fetch failed, using fallback:', err.message);
      }
    }

    return res.json({
      broker: 'zerodha',
      connected: !!conn?.connected,
      isSandbox: conn?.isSandbox ?? true,
      holdings: ZERODHA_MOCK_HOLDINGS,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/broker/zerodha/disconnect
app.post('/api/broker/zerodha/disconnect', requireAuth, async (req, res) => {
  try {
    await updateUserRecord(req.userId, { zerodhaConnection: null });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/broker/webull/connect
app.post('/api/broker/webull/connect', requireAuth, async (req, res) => {
  try {
    const { appKey, appSecret, accountId, isSandbox } = req.body;
    const finalAppKey = (appKey || process.env.WEBULL_APP_KEY || '').trim();
    const finalAccountId = (accountId || process.env.WEBULL_ACCOUNT_ID || 'DEMO_ACC_4491').trim();
    const connection = {
      connected: true,
      broker: 'webull',
      isSandbox: isSandbox !== false,
      maskedKey: finalAppKey ? `${finalAppKey.slice(0, 4)}••••` : 'DEMO_WEBULL',
      accountId: finalAccountId,
      connectedAt: new Date().toISOString(),
    };
    await updateUserRecord(req.userId, { webullConnection: connection });
    return res.json({ success: true, connection });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/broker/webull/holdings
app.get('/api/broker/webull/holdings', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.userId);
    return res.json({
      broker: 'webull',
      connected: !!user?.webullConnection?.connected,
      isSandbox: user?.webullConnection?.isSandbox ?? true,
      holdings: WEBULL_MOCK_HOLDINGS,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/broker/webull/disconnect
app.post('/api/broker/webull/disconnect', requireAuth, async (req, res) => {
  try {
    await updateUserRecord(req.userId, { webullConnection: null });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Server-Sent Events (SSE) Live Price Streaming
// ============================================================================
const sseClients = new Set();

app.get('/api/market/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const client = { id: Date.now(), res };
  sseClients.add(client);

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    sseClients.delete(client);
  });
});

// Broadcast periodic ticks every 10s to connected SSE clients
setInterval(() => {
  if (sseClients.size === 0) return;
  const updates = [];
  for (const [key, val] of quoteCache.entries()) {
    if (val && val.data) {
      updates.push({ symbol: key.split(':')[0], ...val.data });
    }
  }
  if (updates.length > 0) {
    const payload = `data: ${JSON.stringify({ type: 'PRICE_TICK', quotes: updates, timestamp: new Date().toISOString() })}\n\n`;
    for (const client of sseClients) {
      try {
        client.res.write(payload);
      } catch {
        sseClients.delete(client);
      }
    }
  }
}, 10000);

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

app.get('/api/market/search', marketLimiter, async (req, res) => {
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

app.get('/api/market/news', marketLimiter, async (req, res) => {
  const symbol = (req.query.symbol || '').toString().trim().toUpperCase();
  const companyName = (req.query.company || '').toString().trim();
  const market = (req.query.market || 'IN').toString().toUpperCase();

  if (!symbol) {
    return res.status(400).json({ error: 'symbol parameter is required' });
  }

  const cacheKey = `${symbol}:${market}`;
  const cached = newsCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < NEWS_TTL_MS) {
    return res.json({ symbol, news: cached.data });
  }

  const articles = [];
  const seenTitles = new Set();

  // 1. Fetch from Google News RSS for live headlines
  try {
    const searchQuery = market === 'IN'
      ? `${companyName || symbol} stock NSE`
      : `${companyName || symbol} stock`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=en-US&gl=US&ceid=US:en`;
    const rssRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    if (rssRes.ok) {
      const text = await rssRes.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let m;
      while ((m = itemRegex.exec(text)) !== null && articles.length < 8) {
        const raw = m[1];
        const titleMatch = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i.exec(raw);
        const linkMatch = /<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i.exec(raw);
        const pubDateMatch = /<pubDate>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/pubDate>/i.exec(raw);
        const sourceMatch = /<source[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/source>/i.exec(raw);

        let title = (titleMatch ? titleMatch[1] : '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
        let source = sourceMatch ? sourceMatch[1] : '';
        if (!source && title.includes(' - ')) {
          const parts = title.split(' - ');
          source = parts.pop();
          title = parts.join(' - ');
        }
        if (title && !title.includes('Google News') && !seenTitles.has(title.toLowerCase())) {
          seenTitles.add(title.toLowerCase());
          articles.push({
            title,
            link: linkMatch ? linkMatch[1] : '',
            publisher: source || 'Financial News',
            pubDate: pubDateMatch ? pubDateMatch[1] : new Date().toISOString()
          });
        }
      }
    }
  } catch (err) {
    console.warn('[market/news] Google RSS fetch error:', err.message);
  }

  // 2. If fewer than 4 articles, try Yahoo search news
  if (articles.length < 4) {
    try {
      const yQuery = market === 'IN' ? `${symbol}.NS` : symbol;
      const yUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(yQuery)}&quotesCount=1&newsCount=6`;
      const yRes = await fetch(yUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      if (yRes.ok) {
        const yJson = await yRes.json();
        const yNews = yJson.news || [];
        for (const item of yNews) {
          if (item.title && !seenTitles.has(item.title.toLowerCase())) {
            seenTitles.add(item.title.toLowerCase());
            articles.push({
              title: item.title,
              link: item.link || '',
              publisher: item.publisher || 'Yahoo Finance',
              pubDate: item.providerPublishTime ? new Date(item.providerPublishTime * 1000).toISOString() : new Date().toISOString()
            });
            if (articles.length >= 8) break;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  newsCache.set(cacheKey, { data: articles, timestamp: now });
  return res.json({ symbol, news: articles });
});

app.get('/api/market/quotes', marketLimiter, async (req, res) => {
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
