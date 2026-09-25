/**
 * AURUM AI Analyst — Main Express Router
 * Mounts all `/api/analyst/*` production endpoints.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const { getStockMarketData, getMarketIndices, fetchRawQuote } = require('./providers/market-data-provider');
const { getCompanyFundamentals } = require('./providers/fundamentals-provider');
const { getStockEarnings, getEarningsCalendar } = require('./providers/earnings-provider');
const { getCompanyFilings } = require('./providers/filings-provider');
const { getAnalystNews } = require('./providers/news-provider');
const { getMacroOverview } = require('./providers/macro-provider');

const { generateStockReport } = require('./engines/stock-report-engine');
const { generateMorningBriefing } = require('./engines/morning-briefing-engine');
const { runDeterministicStressTest } = require('./engines/stress-test-engine');
const { compareCompanies } = require('./engines/comparison-engine');
const { summarizeFiling } = require('./engines/filings-summary-engine');
const { recordRequest, recordError, getAnalystMetrics, getAnalystHealth } = require('./engines/analyst-metrics-tracker');
const { createAnalystEnvelope } = require('./envelope');

// In-memory persistent stores (with MongoDB hooks when connected)
const savedReportsStore = new Map();
const analystAlertsStore = new Map();

/**
 * Configure router dependencies (e.g. Gemini backend caller, MongoDB client, Auth).
 */
function createAnalystRouter({ geminiBackendCaller, isMongoConnected, db, optionalAuth }) {
  const authMiddleware = optionalAuth || ((req, res, next) => next());

  // 1. Health & Metrics
  router.get('/health', (req, res) => {
    return res.json(getAnalystHealth());
  });

  router.get('/metrics', (req, res) => {
    return res.json(getAnalystMetrics());
  });

  // 2. Morning Briefing
  router.get('/morning-brief', authMiddleware, async (req, res) => {
    const start = Date.now();
    try {
      const userId = req.userId || 'demo-user';
      let userHoldings = [];
      let watchlistSymbols = ['TCS', 'NVDA', 'RELIANCE', 'AAPL'];

      // Retrieve user holdings from database/memory
      if (isMongoConnected && db) {
        try {
          const docs = await db.collection('holdings').find({ userId }).toArray();
          if (docs && docs.length > 0) userHoldings = docs;
          const wDoc = await db.collection('watchlists').findOne({ userId });
          if (wDoc?.symbols && wDoc.symbols.length > 0) watchlistSymbols = wDoc.symbols;
        } catch {}
      }

      const forceRefresh = req.query.refresh === 'true';
      const envelope = await generateMorningBriefing({
        portfolioHoldings: userHoldings,
        watchlistSymbols,
        geminiCaller: geminiBackendCaller,
        forceRefresh
      });

      recordRequest('/api/analyst/morning-brief', Date.now() - start, envelope.status === 'CACHED');
      return res.json(envelope);
    } catch (err) {
      recordError();
      return res.status(500).json({ error: err.message });
    }
  });

  // 3. Stock Report Engine
  router.get('/stock/:symbol/report', authMiddleware, async (req, res) => {
    const start = Date.now();
    try {
      const symbol = req.params.symbol;
      const market = req.query.market || 'IN';
      const forceRefresh = req.query.refresh === 'true';

      // Check if user owns holding
      let portfolioContext = null;
      if (req.query.shares && req.query.avgCost) {
        portfolioContext = {
          shares: Number(req.query.shares),
          avgCost: Number(req.query.avgCost)
        };
      }

      const envelope = await generateStockReport({
        symbol,
        market,
        portfolioContext,
        geminiCaller: geminiBackendCaller,
        forceRefresh
      });

      recordRequest('/api/analyst/stock/:symbol/report', Date.now() - start, envelope.status === 'CACHED');
      return res.json(envelope);
    } catch (err) {
      recordError();
      return res.status(500).json({ error: err.message });
    }
  });

  // 4. Filings
  router.get('/filings/:symbol', async (req, res) => {
    const start = Date.now();
    try {
      const symbol = req.params.symbol;
      const market = req.query.market || 'IN';
      const envelope = await getCompanyFilings(symbol, market);
      recordRequest('/api/analyst/filings/:symbol', Date.now() - start, envelope.status === 'CACHED');
      return res.json(envelope);
    } catch (err) {
      recordError();
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/filings/:symbol/summary', async (req, res) => {
    const start = Date.now();
    try {
      const symbol = req.params.symbol;
      const filingId = req.query.filingId;
      const market = req.query.market || 'IN';
      const envelope = await summarizeFiling({
        symbol,
        filingId,
        market,
        geminiCaller: geminiBackendCaller
      });
      recordRequest('/api/analyst/filings/:symbol', Date.now() - start);
      return res.json(envelope);
    } catch (err) {
      recordError();
      return res.status(500).json({ error: err.message });
    }
  });

  // 5. Earnings
  router.get('/earnings/calendar', async (req, res) => {
    const start = Date.now();
    try {
      const timeframe = req.query.timeframe || 'this_month';
      const market = req.query.market || 'ALL';
      const envelope = await getEarningsCalendar(timeframe, market);
      recordRequest('/api/analyst/earnings/calendar', Date.now() - start, envelope.status === 'CACHED');
      return res.json(envelope);
    } catch (err) {
      recordError();
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/earnings/:symbol', async (req, res) => {
    const start = Date.now();
    try {
      const symbol = req.params.symbol;
      const market = req.query.market || 'IN';
      const envelope = await getStockEarnings(symbol, market);
      recordRequest('/api/analyst/earnings/:symbol', Date.now() - start, envelope.status === 'CACHED');
      return res.json(envelope);
    } catch (err) {
      recordError();
      return res.status(500).json({ error: err.message });
    }
  });

  // 6. Deterministic Stress Test
  router.post('/stress-test', authMiddleware, async (req, res) => {
    const start = Date.now();
    try {
      const {
        scenario = 'market_crash_10',
        holdings = [],
        customShockPercent,
        assetShocks = {},
        selectedPositions = []
      } = req.body || {};

      let activeHoldings = holdings;
      if (!Array.isArray(activeHoldings) || activeHoldings.length === 0) {
        // Fallback to active user portfolio
        const userId = req.userId || 'demo-user';
        if (isMongoConnected && db) {
          try {
            const docs = await db.collection('holdings').find({ userId }).toArray();
            if (docs && docs.length > 0) activeHoldings = docs;
          } catch {}
        }
      }

      if (activeHoldings.length === 0) {
        // No dummy holdings.
      }

      const envelope = runDeterministicStressTest({
        holdings: activeHoldings,
        scenario,
        customShockPercent: typeof customShockPercent === 'number' ? customShockPercent : undefined,
        assetShocks,
        selectedSymbols: selectedPositions
      });

      recordRequest('/api/analyst/stress-test', Date.now() - start);
      return res.json(envelope);
    } catch (err) {
      recordError();
      return res.status(500).json({ error: err.message });
    }
  });

  // 7. Watchlist Intelligence
  router.get('/watchlist/intelligence', authMiddleware, async (req, res) => {
    const start = Date.now();
    try {
      const userId = req.userId || 'demo-user';
      let symbols = ['TCS', 'NVDA', 'RELIANCE', 'AAPL', 'INFY'];

      if (isMongoConnected && db) {
        try {
          const doc = await db.collection('watchlists').findOne({ userId });
          if (doc?.symbols && doc.symbols.length > 0) symbols = doc.symbols;
        } catch {}
      }

      if (req.query.symbols) {
        symbols = String(req.query.symbols).split(',').map(s => s.trim().toUpperCase());
      }

      const items = await Promise.all(symbols.map(async sym => {
        const isIndia = ['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'ITC'].includes(sym);
        const mktEnv = await getStockMarketData(sym, isIndia ? 'IN' : 'US');
        const d = mktEnv.data || {};
        return {
          symbol: sym,
          companyName: d.companyName || sym,
          price: d.price,
          currency: d.currency,
          change: d.change,
          changePercent: d.changePercent,
          volume: d.volume,
          rsi14: d.technicals?.rsi14 || null,
          trend: d.technicals?.trend || 'NEUTRAL',
          status: mktEnv.status
        };
      }));

      // Ranks
      const sortedByChange = [...items].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
      const sortedByVolume = [...items].sort((a, b) => (b.volume || 0) - (a.volume || 0));

      const payload = {
        totalWatchlistSymbols: items.length,
        items,
        rankings: {
          topGainer: sortedByChange[0] || null,
          largestLoser: sortedByChange[sortedByChange.length - 1] || null,
          highestVolume: sortedByVolume[0] || null
        }
      };

      const envelope = createAnalystEnvelope({
        data: payload,
        status: 'LIVE',
        source: 'Watchlist Intelligence Engine',
        provider: 'Watchlist Aggregator',
        sourceCount: items.length
      });

      recordRequest('/api/analyst/watchlist/intelligence', Date.now() - start);
      return res.json(envelope);
    } catch (err) {
      recordError();
      return res.status(500).json({ error: err.message });
    }
  });

  // 8. News Engine
  router.get('/news', async (req, res) => {
    const start = Date.now();
    try {
      const symbol = req.query.symbol;
      const market = req.query.market || 'IN';
      const sector = req.query.sector;
      const symbols = req.query.symbols ? String(req.query.symbols).split(',').map(s => s.trim().toUpperCase()) : [];
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;

      const envelope = await getAnalystNews({
        symbol,
        market,
        sector,
        symbols,
        limit
      });

      recordRequest('/api/analyst/news', Date.now() - start, envelope.status === 'CACHED');
      return res.json(envelope);
    } catch (err) {
      recordError();
      return res.status(500).json({ error: err.message });
    }
  });

  // 9. Portfolio Intelligence
  router.get('/portfolio-intelligence', authMiddleware, async (req, res) => {
    const start = Date.now();
    try {
      const userId = req.userId || 'demo-user';
      let holdings = [];

      if (isMongoConnected && db) {
        try {
          const docs = await db.collection('holdings').find({ userId }).toArray();
          if (docs && docs.length > 0) holdings = docs;
        } catch {}
      }

      if (holdings.length === 0) {
        // No dummy holdings.
      }

      let totalVal = 0;
      let totalInv = 0;
      let dailyPL = 0;
      const sectorExposure = {};

      const holdingBreakdown = await Promise.all(holdings.map(async h => {
        const sym = (h.symbol || '').toUpperCase();
        const ticker = sym.includes('.') ? sym : `${sym}.NS`;
        const qRes = await fetchRawQuote(ticker);
        const curPrice = qRes?.data?.price || Number(h.currentPrice || h.avgPurchasePrice || 100);
        const prevClose = qRes?.data?.previousClose || curPrice;
        const shares = Number(h.shares || h.quantity || 1);
        const avgCost = Number(h.avgPurchasePrice || h.averageCost || 100);

        const val = Number((shares * curPrice).toFixed(2));
        const inv = Number((shares * avgCost).toFixed(2));
        const pl = Number((val - inv).toFixed(2));
        const plPct = inv > 0 ? Number(((pl / inv) * 100).toFixed(2)) : 0;
        const dayChg = Number((shares * (curPrice - prevClose)).toFixed(2));

        totalVal += val;
        totalInv += inv;
        dailyPL += dayChg;

        const sec = h.sector || (['TCS', 'INFY', 'NVDA', 'AAPL'].includes(sym) ? 'Technology' : 'Diversified');
        sectorExposure[sec] = (sectorExposure[sec] || 0) + val;

        return {
          symbol: sym,
          companyName: h.companyName || sym,
          shares,
          averageCost: avgCost,
          currentPrice: curPrice,
          marketValue: val,
          profitLoss: pl,
          returnPercent: plPct,
          dayChange: dayChg,
          sector: sec
        };
      }));

      const sectorPctMap = {};
      for (const [sec, val] of Object.entries(sectorExposure)) {
        sectorPctMap[sec] = totalVal > 0 ? Number(((val / totalVal) * 100).toFixed(1)) : 0;
      }

      const totalPL = Number((totalVal - totalInv).toFixed(2));
      const totalReturnPct = totalInv > 0 ? Number(((totalPL / totalInv) * 100).toFixed(2)) : 0;

      const payload = {
        totalValue: Number(totalVal.toFixed(2)),
        totalInvested: Number(totalInv.toFixed(2)),
        totalProfitLoss: totalPL,
        totalReturnPercent: totalReturnPct,
        dailyProfitLoss: Number(dailyPL.toFixed(2)),
        positions: holdingBreakdown,
        sectorExposure: sectorPctMap,
        topLossContributor: [...holdingBreakdown].sort((a, b) => a.dayChange - b.dayChange)[0] || null,
        topGainContributor: [...holdingBreakdown].sort((a, b) => b.dayChange - a.dayChange)[0] || null
      };

      const envelope = createAnalystEnvelope({
        data: payload,
        status: 'LIVE',
        source: 'Aurum Deterministic Portfolio Intelligence Engine',
        provider: 'Portfolio Math Engine',
        sourceCount: holdings.length
      });

      recordRequest('/api/analyst/portfolio-intelligence', Date.now() - start);
      return res.json(envelope);
    } catch (err) {
      recordError();
      return res.status(500).json({ error: err.message });
    }
  });

  // 10. Market Intelligence
  router.get('/market-intelligence', async (req, res) => {
    const start = Date.now();
    try {
      const [indices, macroEnv, newsEnv] = await Promise.all([
        getMarketIndices(),
        getMacroOverview(),
        getAnalystNews({ market: 'IN', limit: 5 })
      ]);

      const payload = {
        indices,
        macro: macroEnv.data,
        headlines: newsEnv.data,
        timestamp: new Date().toISOString()
      };

      const envelope = createAnalystEnvelope({
        data: payload,
        status: 'LIVE',
        source: 'Global Market Intelligence Gateway',
        provider: 'Market Intelligence Engine',
        sourceCount: Object.keys(indices).length + (newsEnv.data?.length || 0)
      });

      recordRequest('/api/analyst/market-intelligence', Date.now() - start);
      return res.json(envelope);
    } catch (err) {
      recordError();
      return res.status(500).json({ error: err.message });
    }
  });

  // 11. Company Comparison
  router.get('/compare', async (req, res) => {
    const start = Date.now();
    try {
      const symA = req.query.a || 'TCS';
      const symB = req.query.b || 'INFY';
      const market = req.query.market || 'IN';

      const envelope = await compareCompanies(symA, symB, market);
      recordRequest('/api/analyst/compare', Date.now() - start);
      return res.json(envelope);
    } catch (err) {
      recordError();
      return res.status(500).json({ error: err.message });
    }
  });

  // 12. Saved Reports Persistence
  router.get('/reports/saved', authMiddleware, async (req, res) => {
    try {
      const userId = req.userId || 'demo-user';
      let reports = [];
      if (isMongoConnected && db) {
        reports = await db.collection('analyst_saved_reports').find({ userId }).sort({ createdAt: -1 }).toArray();
      } else {
        reports = savedReportsStore.get(userId) || [];
      }
      return res.json({ reports });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/reports/save', authMiddleware, async (req, res) => {
    try {
      const userId = req.userId || 'demo-user';
      const { report } = req.body || {};
      if (!report || !report.symbol) {
        return res.status(400).json({ error: 'report payload with symbol is required' });
      }

      const record = {
        id: `saved-${report.symbol}-${Date.now()}`,
        userId,
        symbol: report.symbol,
        reportId: report.reportId,
        generatedAt: report.generatedAt || new Date().toISOString(),
        dataTimestamp: report.dataTimestamp,
        reportVersion: report.reportVersion || '2.0.0',
        report,
        createdAt: new Date().toISOString()
      };

      if (isMongoConnected && db) {
        await db.collection('analyst_saved_reports').insertOne(record);
      } else {
        const existing = savedReportsStore.get(userId) || [];
        existing.unshift(record);
        savedReportsStore.set(userId, existing);
      }

      return res.json({ success: true, savedReport: record });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 13. Persistent Watchlist Alerts
  router.get('/alerts', authMiddleware, async (req, res) => {
    try {
      const userId = req.userId || 'demo-user';
      let alerts = [];
      if (isMongoConnected && db) {
        alerts = await db.collection('analyst_alerts').find({ userId }).toArray();
      } else {
        alerts = analystAlertsStore.get(userId) || [];
      }
      return res.json({ alerts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/alerts', authMiddleware, async (req, res) => {
    try {
      const userId = req.userId || 'demo-user';
      const { symbol, condition, threshold, type = 'PRICE_MOVE' } = req.body || {};
      if (!symbol) return res.status(400).json({ error: 'symbol is required' });

      const alert = {
        id: `alt-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        userId,
        symbol: symbol.toUpperCase(),
        type,
        condition: condition || 'ABOVE',
        threshold: Number(threshold) || 0,
        createdAt: new Date().toISOString(),
        status: 'ACTIVE'
      };

      if (isMongoConnected && db) {
        await db.collection('analyst_alerts').insertOne(alert);
      } else {
        const existing = analystAlertsStore.get(userId) || [];
        existing.push(alert);
        analystAlertsStore.set(userId, existing);
      }

      return res.json({ success: true, alert });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = {
  createAnalystRouter
};
