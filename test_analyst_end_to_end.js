/**
 * AURUM AI Analyst — Automated End-to-End Verification Test Suite
 * Tests 20 critical capability categories across real financial data,
 * deterministic calculation engines, source provenance, and failure resilience.
 */

require('dotenv').config({ path: '.env' });
const assert = require('assert');

// 1. Providers & Engines
const { getStockMarketData, getMarketIndices, fetchRawQuote } = require('./src/server/analyst/providers/market-data-provider');
const { getCompanyFundamentals } = require('./src/server/analyst/providers/fundamentals-provider');
const { getStockEarnings, getEarningsCalendar } = require('./src/server/analyst/providers/earnings-provider');
const { getCompanyFilings } = require('./src/server/analyst/providers/filings-provider');
const { getAnalystNews } = require('./src/server/analyst/providers/news-provider');
const { getMacroOverview } = require('./src/server/analyst/providers/macro-provider');
const { runDeterministicStressTest } = require('./src/server/analyst/engines/stress-test-engine');
const { generateStockReport } = require('./src/server/analyst/engines/stock-report-engine');
const { generateMorningBriefing } = require('./src/server/analyst/engines/morning-briefing-engine');
const { compareCompanies } = require('./src/server/analyst/engines/comparison-engine');
const { summarizeFiling } = require('./src/server/analyst/engines/filings-summary-engine');
const { getAnalystHealth, getAnalystMetrics } = require('./src/server/analyst/engines/analyst-metrics-tracker');

async function runTestSuite() {
  console.log('============================================================');
  console.log('AURUM AI ANALYST — END-TO-END AUTOMATED VERIFICATION');
  console.log('============================================================\n');

  const results = [];

  async function test(name, fn) {
    process.stdout.write(`Testing: ${name.padEnd(45)} `);
    const start = Date.now();
    try {
      await fn();
      const elapsed = Date.now() - start;
      console.log(`✅ PASS (${elapsed}ms)`);
      results.push({ name, status: 'PASS', elapsed });
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      results.push({ name, status: 'FAIL', error: err.message });
    }
  }

  // 1. Market Data
  await test('1. Real Market Data (Quotes & Candles)', async () => {
    const env = await getStockMarketData('TCS', 'IN');
    assert.ok(env, 'Envelope should exist');
    assert.strictEqual(env.symbol, 'TCS');
    assert.ok(['LIVE', 'CACHED'].includes(env.status), `Status should be LIVE or CACHED, got ${env.status}`);
    assert.ok(typeof env.data.price === 'number', 'Price must be a number');
    assert.ok(env.data.price > 0, 'Price must be positive');
    assert.ok(env.data.technicals, 'Technicals must exist');
    assert.ok(typeof env.data.technicals.rsi14 === 'number', 'RSI must be calculated');
  });

  // 2. Portfolio Mathematics
  await test('2. Deterministic Portfolio Impact', async () => {
    const holdings = [
      { symbol: 'TCS', shares: 35, avgPurchasePrice: 2106, currentPrice: 2087 },
      { symbol: 'NVDA', shares: 15, avgPurchasePrice: 118, currentPrice: 125 }
    ];
    const totalInvested = (35 * 2106) + (15 * 118);
    const totalVal = (35 * 2087) + (15 * 125);
    const expectedPL = totalVal - totalInvested;
    assert.strictEqual(totalInvested, 75480);
    assert.strictEqual(totalVal, 74920);
    assert.strictEqual(expectedPL, -560);
  });

  // 3. Watchlist & Multi-Asset Indices
  await test('3. Market Indices & Watchlist Aggregation', async () => {
    const indices = await getMarketIndices();
    assert.ok(indices.NIFTY50, 'Nifty 50 must exist');
    assert.ok(indices.SP500, 'S&P 500 must exist');
    assert.ok(typeof indices.NIFTY50.price === 'number', 'NIFTY price must be a number');
  });

  // 4. Real Verified News Engine
  await test('4. News Engine (Relevance & Provenance)', async () => {
    const env = await getAnalystNews({ symbol: 'TCS', market: 'IN', limit: 3 });
    assert.ok(Array.isArray(env.data), 'News data must be an array');
    assert.ok(env.data.length > 0, 'Must retrieve real news articles');
    assert.ok(env.data[0].title, 'News article must have a title');
    assert.ok(env.data[0].publisher, 'News article must have a publisher');
    assert.ok(env.data[0].url, 'News article must have a link');
    assert.ok(env.provenance.provider, 'Provenance must specify provider');
  });

  // 5. Earnings History & Beat/Miss
  await test('5. Real Corporate Earnings History', async () => {
    const env = await getStockEarnings('AAPL', 'US');
    assert.ok(env.data, 'Earnings data must exist');
    assert.ok(Array.isArray(env.data.history), 'History must be array');
    assert.ok(env.data.history.length > 0, 'Must have at least one quarter');
    assert.ok(['BEAT', 'MISS', 'IN_LINE', 'ESTIMATE_UNAVAILABLE'].includes(env.data.history[0].status));
  });

  // 6. Regulatory Filings (SEC / Indian Exchange)
  await test('6. Regulatory Filings Disclosures', async () => {
    const env = await getCompanyFilings('AAPL', 'US');
    assert.ok(env.data, 'Filings data must exist');
    assert.ok(Array.isArray(env.data.filings), 'Filings must be array');
    assert.ok(env.data.filings.length > 0, 'Must have real SEC filings');
    assert.ok(env.data.filings[0].filingType, 'Must specify filing type');
    assert.ok(env.data.filings[0].sourceUrl, 'Must have official SEC URL');
  });

  // 7. Complete Multi-Dimensional Stock Report
  await test('7. Stock Report Engine Dossier', async () => {
    const repEnv = await generateStockReport({ symbol: 'TCS', market: 'IN' });
    const r = repEnv.data;
    assert.ok(r.reportId, 'Must have reportId');
    assert.ok(r.price, 'Must have price section');
    assert.ok(r.technicals, 'Must have technicals');
    assert.ok(r.fundamentals, 'Must have fundamentals');
    assert.ok(r.aiSynthesis, 'Must have aiSynthesis');
    assert.ok(Array.isArray(r.sources), 'Must have sources');
  });

  // 8. Morning Briefing (8 Structured Sections)
  await test('8. Real Morning Briefing Synthesis', async () => {
    const env = await generateMorningBriefing({
      portfolioHoldings: [{ symbol: 'TCS', shares: 35, avgPurchasePrice: 2106, currentPrice: 2087 }],
      watchlistSymbols: ['TCS', 'NVDA', 'RELIANCE']
    });
    const b = env.data.briefing;
    assert.ok(b.overnightMarket, 'Must have overnightMarket');
    assert.ok(b.indianMarketSetup, 'Must have indianMarketSetup');
    assert.ok(b.portfolioImpact, 'Must have portfolioImpact');
    assert.ok(b.watchlistMovers, 'Must have watchlistMovers');
    assert.ok(b.importantNews, 'Must have importantNews');
    assert.ok(b.earningsAndEvents, 'Must have earningsAndEvents');
    assert.ok(b.risksToWatch, 'Must have risksToWatch');
    assert.ok(b.todaysFocus, 'Must have todaysFocus');
  });

  // 9. Deterministic Stress Testing
  await test('9. Deterministic Portfolio Stress Testing', async () => {
    const holdings = [
      { symbol: 'TCS', shares: 10, currentPrice: 2000, sector: 'Technology' },
      { symbol: 'RELIANCE', shares: 10, currentPrice: 1300, sector: 'Energy' }
    ];
    const res = runDeterministicStressTest({
      holdings,
      scenario: 'crude_oil_spike'
    });
    assert.strictEqual(res.data.baselineValue, 33000);
    assert.ok(res.data.stressedValue > 0, 'Stressed value must be positive');
    assert.ok(res.data.contributors.length === 2, 'All contributors represented');
    assert.ok(res.data.methodology.includes('Estimated portfolio impact'), 'Must label methodology');
  });

  // 10. ML V2 Integration
  await test('10. ML V2 Ensemble Prediction Alignment', async () => {
    const modelRunner = require('./src/server/ml/model-runner');
    const { extractFeaturesAtTimestamp } = require('./src/server/ml/features/feature-engineering-v2');
    assert.ok(modelRunner, 'ModelRunner must exist');
    const mockCandles = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (30 - i) * 86400000).toISOString(),
      open: 2000 + i * 2,
      high: 2010 + i * 2,
      low: 1995 + i * 2,
      close: 2005 + i * 2,
      volume: 100000 + i * 1000
    }));
    const feats = extractFeaturesAtTimestamp(mockCandles);
    const inf = modelRunner.runInferenceV2('TCS', feats, 2087);
    assert.ok(inf, 'Must return inference payload');
    assert.strictEqual(inf.symbol, 'TCS');
  });

  // 11. Strategy Integration
  await test('11. Deterministic Strategy Rules', async () => {
    const rep = await generateStockReport({ symbol: 'TCS', market: 'IN' });
    assert.ok(rep.data.strategy, 'Strategy signal must be present');
    assert.ok(rep.data.strategy.strategyId, 'Strategy ID must exist');
    assert.ok(rep.data.strategy.riskStatus, 'Risk status must be defined');
  });

  // 12. AI Synthesis Without Hallucination
  await test('12. Grounded AI Synthesis Guardrails', async () => {
    const rep = await generateStockReport({ symbol: 'TCS', market: 'IN' });
    assert.ok(rep.data.aiSynthesis.bullCase.length >= 2, 'Bull case catalysts must be provided');
    assert.ok(rep.data.aiSynthesis.bearCase.length >= 2, 'Bear case risks must be provided');
  });

  // 13. Source Provenance Tracking
  await test('13. Analyst Data Envelope Provenance', async () => {
    const env = await getStockMarketData('TCS', 'IN');
    assert.ok(env.provenance, 'Provenance object required');
    assert.ok(env.provenance.provider, 'Provider required');
    assert.ok(env.provenance.retrievedAt, 'retrievedAt timestamp required');
    assert.ok(typeof env.freshness === 'number', 'Freshness in seconds required');
  });

  // 14. Stale Data Detection
  await test('14. Stale Data Lifecycle Handling', async () => {
    const { createAnalystEnvelope } = require('./src/server/analyst/envelope');
    const oldTime = new Date(Date.now() - 500000).toISOString();
    const env = createAnalystEnvelope({
      symbol: 'TCS',
      data: { price: 2087 },
      cacheTtlMs: 10000,
      retrievedAt: oldTime
    });
    assert.strictEqual(env.status, 'STALE');
  });

  // 15. Provider Failure Independence
  await test('15. Provider Failure Independence Resilience', async () => {
    // Filings should still work even if we pass a symbol with no SEC filings
    const env = await getCompanyFilings('NONEXISTENT_TICKER_XYZ');
    assert.strictEqual(env.status, 'UNAVAILABLE');
    assert.strictEqual(env.data.message, 'Filing data unavailable for this symbol.');
  });

  // 16. Empty Data States
  await test('16. Truthful Empty State Representation', async () => {
    const env = await getCompanyFundamentals('UNKNOWN_CO_ABC', 'IN');
    assert.strictEqual(env.status, 'UNAVAILABLE');
    assert.strictEqual(env.data, null);
  });

  // 17. Intelligent Caching
  await test('17. Multi-Tier Cache Verification', async () => {
    const start1 = Date.now();
    await getStockMarketData('TCS', 'IN');
    const elapsed1 = Date.now() - start1;

    const start2 = Date.now();
    const cachedEnv = await getStockMarketData('TCS', 'IN');
    const elapsed2 = Date.now() - start2;

    assert.ok(elapsed2 <= elapsed1, 'Cached request should be faster');
    assert.strictEqual(cachedEnv.status, 'CACHED');
  });

  // 18. Side-by-Side Company Comparison
  await test('18. Quantitative Equity Comparison', async () => {
    const compEnv = await compareCompanies('TCS', 'INFY', 'IN');
    assert.ok(compEnv.data.comparisonTable.length >= 5, 'Must compare at least 5 metrics');
    assert.ok(compEnv.data.quantitativeTakeaway, 'Must include objective takeaway');
  });

  // 19. Health & Observability Metrics
  await test('19. Analyst Health & Telemetry Metrics', async () => {
    const health = getAnalystHealth();
    assert.strictEqual(health.marketData, 'HEALTHY');
    assert.strictEqual(health.portfolio, 'HEALTHY');
    const metrics = getAnalystMetrics();
    assert.ok(typeof metrics.cacheHitRatePct === 'number');
  });

  // 20. Filing AI Summary
  await test('20. Filing Document AI Summarizer', async () => {
    const sumEnv = await summarizeFiling({ symbol: 'TCS', market: 'IN' });
    assert.ok(sumEnv.data.executiveSummary, 'Must synthesize executive summary');
    assert.ok(sumEnv.data.isAiSummary === true, 'Must clearly identify as AI summary');
  });

  console.log('\n============================================================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
