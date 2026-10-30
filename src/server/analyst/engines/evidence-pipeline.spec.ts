import { describe, it, expect } from 'vitest';
declare const require: any;
const { EvidenceLedger, buildEvidenceLedger, evaluateFreshness } = require('./evidence-ledger');
const { ClaimValidator, VALIDATION_STATUSES } = require('./claim-validator');
const { buildWatchConditions, evaluateCondition, WATCH_STATUSES } = require('./watch-engine');
const { PredictionEngine } = require('./prediction-engine');
const { processAnalystQuery } = require('./analyst-orchestrator');

describe('AI Analyst Evidence Integrity & Pipeline Tests (Cases A through Q)', () => {

  // Case A: Valid market evidence produces a traceable, correctly classified item
  it('CASE A: Valid market evidence produces a traceable, correctly classified item', () => {
    const ledger = buildEvidenceLedger({
      symbol: 'TCS',
      security: { symbol: 'TCS', market: 'IN', currency: 'INR' },
      quote: {
        price: 3450.25,
        currency: 'INR',
        change: 35.5,
        changePercent: 1.04,
        dayHigh: 3480.0,
        dayLow: 3420.0,
        volume: 1200500,
        provider: 'Upstox Pro Market Gateway',
        timestamp: new Date().toISOString(),
        status: 'LIVE'
      }
    });

    const priceEntry = ledger.getById('EVIDENCE-001');
    expect(priceEntry).toBeDefined();
    expect(priceEntry.symbol).toBe('TCS');
    expect(priceEntry.category).toBe('MARKET_DATA');
    expect(priceEntry.metric).toBe('Current Market Price');
    expect(priceEntry.value).toBe(3450.25);
    expect(priceEntry.unit).toBe('INR');
    expect(priceEntry.providerRole).toBe('PRIMARY');
    expect(priceEntry.status).toBe('VERIFIED');
    expect(priceEntry.observedAt).toBeDefined();
  });

  // Case B: A nonexistent evidence ID is rejected
  it('CASE B: A nonexistent evidence ID is rejected', () => {
    const ledger = new EvidenceLedger('TCS');
    ledger.add({
      category: 'MARKET_DATA',
      metric: 'Current Market Price',
      value: 3450.25,
      unit: 'INR',
      source: 'Upstox Pro Market Gateway',
      observedAt: new Date().toISOString()
    });

    const claim = {
      factor: 'Momentum',
      claim: 'Price is 3450.25',
      evidenceId: 'EVIDENCE-999' // Non-existent ID
    };

    const validated = ClaimValidator.validate({
      supportingEvidence: [claim]
    }, ledger, 'TCS');

    expect(validated.supportingEvidence[0].status).toBe(VALIDATION_STATUSES.UNVERIFIED);
    expect(validated.claimValidation.rejections[0].reasonCode).toBe('UNKNOWN_EVIDENCE_ID');
    expect(validated.claimValidation.supportingClaimsVerified).toBe(0);
  });

  // Case C: A valid evidence ID attached to an unrelated claim does not automatically pass
  it('CASE C: A valid evidence ID attached to an unrelated claim does not automatically pass', () => {
    const ledger = new EvidenceLedger('TCS');
    const rsiId = ledger.add({
      category: 'TECHNICAL_ANALYSIS',
      metric: 'Relative Strength Index (RSI 14)',
      value: 28.5,
      unit: 'points',
      source: 'Daily OHLCV Chart Calculation',
      observedAt: new Date().toISOString()
    });

    // Claim about PE ratio but attaching RSI evidence ID
    const unrelatedClaim = {
      factor: 'Valuation',
      claim: 'Company P/E valuation multiple is highly attractive at 15x',
      evidenceId: rsiId
    };

    const validated = ClaimValidator.validate({
      supportingEvidence: [unrelatedClaim]
    }, ledger, 'TCS');

    expect(validated.supportingEvidence[0].status).toBe(VALIDATION_STATUSES.PARTIALLY_SUPPORTED);
    expect(validated.claimValidation.rejections[0].reasonCode).toBe('METRIC_SEMANTIC_MISMATCH');
  });

  // Case D: A fabricated price or percentage is rejected
  it('CASE D: A fabricated price or percentage is rejected', () => {
    const ledger = new EvidenceLedger('TCS');
    const priceId = ledger.add({
      category: 'MARKET_DATA',
      metric: 'Current Market Price',
      value: 3450.25,
      unit: 'INR',
      source: 'Upstox Pro Market Gateway',
      observedAt: new Date().toISOString()
    });

    // Fabricated price: claims 4999.00 when evidence is 3450.25
    const fabricatedClaim = {
      factor: 'Current Valuation',
      claim: 'Current market price is 4999.00 INR representing an all-time high',
      evidenceId: priceId
    };

    const validated = ClaimValidator.validate({
      supportingEvidence: [fabricatedClaim]
    }, ledger, 'TCS');

    expect(validated.supportingEvidence[0].status).toBe(VALIDATION_STATUSES.CONFLICTING);
    expect(validated.claimValidation.rejections[0].reasonCode).toBe('NUMERIC_VALUE_CONFLICT');
  });

  // Case E: A stale market quote cannot be presented as fresh live data
  it('CASE E: A stale market quote cannot be presented as fresh live data', () => {
    const staleDate = new Date(Date.now() - 86400 * 5 * 1000).toISOString(); // 5 days old
    const freshness = evaluateFreshness('MARKET_DATA', staleDate, new Date().toISOString());
    expect(freshness).toBe('STALE');

    const ledger = new EvidenceLedger('TCS');
    const staleId = ledger.add({
      category: 'MARKET_DATA',
      metric: 'Current Market Price',
      value: 3450.25,
      unit: 'INR',
      source: 'Upstox Pro Market Gateway',
      observedAt: staleDate
    });

    const staleEntry = ledger.getById(staleId);
    expect(staleEntry.status).toBe('STALE');
    expect(staleEntry.freshness).toBe('STALE');

    const validated = ClaimValidator.validate({
      supportingEvidence: [{
        factor: 'Price Baseline',
        claim: 'Current market price is 3450.25',
        evidenceId: staleId
      }]
    }, ledger, 'TCS');

    expect(validated.supportingEvidence[0].status).toBe(VALIDATION_STATUSES.STALE);
  });

  // Case F: Missing source URLs do not produce fake citations
  it('CASE F: Missing source URLs do not produce fake citations', () => {
    const ledger = new EvidenceLedger('TCS');
    const evId = ledger.add({
      category: 'FUNDAMENTALS',
      metric: 'Price-to-Earnings (P/E Ratio)',
      value: 28.5,
      unit: 'x',
      source: 'Corporate Financial Disclosures',
      sourceUrl: '#', // placeholder URL should be stripped
      observedAt: new Date().toISOString()
    });

    const entry = ledger.getById(evId);
    expect(entry.sourceUrl).toBeNull(); // sanitized to null
    expect(entry.source).not.toBe('Evidence Ledger'); // not generic placeholder
  });

  // Case G: Supporting and contrary factors display different factual content when evidence differs
  it('CASE G: Supporting and contrary factors display different factual content when evidence differs', () => {
    const ledger = new EvidenceLedger('TCS');
    const rsiId = ledger.add({
      category: 'TECHNICAL_ANALYSIS',
      metric: 'Relative Strength Index (RSI 14)',
      value: 28.5,
      unit: 'points',
      source: 'Daily OHLCV Chart Calculation',
      observedAt: new Date().toISOString()
    });
    const peId = ledger.add({
      category: 'FUNDAMENTALS',
      metric: 'Price-to-Earnings (P/E Ratio)',
      value: 48.0,
      unit: 'x',
      source: 'Corporate Financial Disclosures',
      observedAt: new Date().toISOString()
    });

    const prediction = PredictionEngine.evaluate({
      symbol: 'TCS',
      market: 'IN',
      quote: { price: 3450.25, currency: 'INR', status: 'LIVE' },
      technicals: { rsi14: 28.5, trend: 'NEUTRAL' },
      fundamentals: { peRatio: 48.0 },
      ledger
    });

    expect(prediction.supportingEvidence.length).toBeGreaterThan(0);
    expect(prediction.contradictingEvidence.length).toBeGreaterThan(0);

    const supItem = prediction.supportingEvidence[0];
    const conItem = prediction.contradictingEvidence[0];

    expect(supItem.factor).not.toBe(conItem.factor);
    expect(supItem.claim).not.toBe(conItem.claim);
    expect(supItem.evidenceId).toBe(rsiId);
    expect(conItem.evidenceId).toBe(peId);
  });

  // Case H: Empty evidence produces a clear insufficient-evidence state
  it('CASE H: Empty evidence produces a clear insufficient-evidence state', () => {
    const prediction = PredictionEngine.evaluate({
      symbol: 'TCS',
      market: 'IN',
      quote: { price: null, status: 'UNAVAILABLE' },
      technicals: {},
      fundamentals: {}
    });

    expect(prediction.predictionDirection).toBe('INSUFFICIENT_EVIDENCE');
    expect(prediction.supportingEvidence).toEqual([]);
    expect(prediction.contradictingEvidence).toEqual([]);
    expect(prediction.confidence).toBe(0);
    expect(prediction.score).toBeNull();
  });

  // Case I: A fallback provider is identified correctly
  it('CASE I: A fallback provider is identified correctly', () => {
    const ledger = buildEvidenceLedger({
      symbol: 'TCS',
      security: { symbol: 'TCS', market: 'IN', currency: 'INR' },
      quote: {
        price: 3450.25,
        currency: 'INR',
        providerUsed: 'Yahoo Finance (Fallback Provider)',
        providersAttempted: ['Upstox', 'Twelve Data', 'Yahoo Finance Fallback'],
        failureReason: 'Upstox token unconfigured',
        timestamp: new Date().toISOString(),
        status: 'LIVE'
      }
    });

    const priceEntry = ledger.getById('EVIDENCE-001');
    expect(priceEntry.providerRole).toBe('FALLBACK');
    expect(priceEntry.fallbackReason).toContain('Upstox token unconfigured');
    expect(priceEntry.source).toContain('Fallback: Yahoo Finance');
  });

  // Case J: An uncertain factor is not rendered as an active monitoring rule
  it('CASE J: An uncertain factor is not rendered as an active monitoring rule', () => {
    const watchRules = buildWatchConditions({
      symbol: 'TCS',
      currency: 'INR',
      quote: { price: 3450.25 },
      technicals: { support: 3350, resistance: 3600 }
    });

    // All watch rules must have measurable metric, operator, and conditionText
    for (const rule of watchRules) {
      expect(rule.metric).toBeDefined();
      expect(['price', 'rsi', 'volume', 'pe_ratio']).toContain(rule.metric);
      expect(['above', 'below', 'crosses_above', 'crosses_below', 'equals']).toContain(rule.operator);
      expect(typeof rule.conditionText).toBe('string');
      expect(rule.conditionText.length).toBeGreaterThan(0);
      expect(rule.status).not.toBe('UNCERTAIN');
    }
  });

  // Case K: A configured watch rule triggers only when its actual condition is met
  it('CASE K: A configured watch rule triggers only when its actual condition is met', () => {
    // Current price is 3300, which is below support of 3350 -> Should be TRIGGERED
    const triggeredRules = buildWatchConditions({
      symbol: 'TCS',
      currency: 'INR',
      quote: { price: 3300.0 },
      technicals: { support: 3350.0 }
    });
    const supportRule = triggeredRules.find((r: any) => r.title.includes('Support'));
    expect(supportRule.isTriggered).toBe(true);
    expect(supportRule.status).toBe(WATCH_STATUSES.ACTIVE_TRIGGERED);

    // Current price is 3450, above support -> Should NOT be triggered
    const untriggeredRules = buildWatchConditions({
      symbol: 'TCS',
      currency: 'INR',
      quote: { price: 3450.0 },
      technicals: { support: 3350.0 }
    });
    const untriggeredSupport = untriggeredRules.find((r: any) => r.title.includes('Support'));
    expect(untriggeredSupport.isTriggered).toBe(false);
    expect(untriggeredSupport.status).toBe(WATCH_STATUSES.ACTIVE_UNTRIGGERED);
  });

  // Case L: A watch rule with missing inputs does not falsely report successful evaluation
  it('CASE L: A watch rule with missing inputs does not falsely report successful evaluation', () => {
    const missingInputRules = buildWatchConditions({
      symbol: 'TCS',
      currency: 'INR',
      quote: { price: null }, // Price unavailable
      technicals: { support: 3350.0 }
    });
    const rule = missingInputRules.find((r: any) => r.title.includes('Support'));
    expect(rule.status).toBe(WATCH_STATUSES.INPUT_UNAVAILABLE);
    expect(rule.isTriggered).toBe(false);
    expect(rule.currentValue).toBeNull();
  });

  // Case M: Portfolio P&L calculations match independently calculated expected results
  it('CASE M: Portfolio P&L calculations match independently calculated expected results', () => {
    const shares = 50;
    const avgCost = 3200.0;
    const currentPrice = 3450.0;

    const expectedMarketValue = 50 * 3450.0; // 172500
    const expectedCostBasis = 50 * 3200.0;   // 160000
    const expectedPnL = expectedMarketValue - expectedCostBasis; // 12500
    const expectedPnLPct = (expectedPnL / expectedCostBasis) * 100; // 7.8125%

    const ledger = buildEvidenceLedger({
      symbol: 'TCS',
      security: { symbol: 'TCS', market: 'IN', currency: 'INR' },
      quote: { price: currentPrice, currency: 'INR', change: 25.0, changePercent: 0.73 },
      portfolio: { shares, avgCost }
    });

    const portfolioEntry = ledger.getByCategory('PORTFOLIO').find((e: any) => e.metric === 'User Position Holding');
    expect(portfolioEntry).toBeDefined();
    expect(portfolioEntry.status).toBe('VERIFIED');
    expect(portfolioEntry.calculationInputs.marketValue).toBe(expectedMarketValue);
    expect(portfolioEntry.calculationInputs.costBasis).toBe(expectedCostBasis);
    expect(portfolioEntry.calculationInputs.unrealizedPnL).toBe(expectedPnL);
    expect(portfolioEntry.calculationInputs.unrealizedPnLPct).toBe(Number(expectedPnLPct.toFixed(2)));
  });

  // Case N: Currency mismatches and missing prices are handled safely
  it('CASE N: Currency mismatches and missing prices are handled safely', () => {
    // Missing price must not use avgCost as substitute
    const ledger = buildEvidenceLedger({
      symbol: 'TCS',
      security: { symbol: 'TCS', market: 'IN', currency: 'INR' },
      quote: { price: null }, // missing price
      portfolio: { shares: 100, avgCost: 3200.0 }
    });

    const portfolioEntry = ledger.getByCategory('PORTFOLIO').find((e: any) => e.metric === 'User Position Holding');
    expect(portfolioEntry.status).toBe('UNAVAILABLE');
    expect(portfolioEntry.value).toBeNull();
    expect(portfolioEntry.details).toContain('live market price is unavailable');
  });

  // Case Q: API contracts remain compatible with existing supported consumers
  it('CASE Q: API contracts remain compatible with existing supported consumers', async () => {
    const envelope = await processAnalystQuery({
      question: 'Analyze TCS',
      symbol: 'TCS',
      market: 'IN',
      geminiCaller: null // deterministic engine test
    });

    expect(envelope.success).toBe(true);
    expect(envelope.symbol).toBe('TCS');
    expect(envelope.data).toBeDefined();

    const d = envelope.data;
    // Core envelope fields
    expect(d.answer).toBeDefined();
    expect(Array.isArray(d.evidence)).toBe(true);
    expect(Array.isArray(d.evidenceLedger)).toBe(true);
    expect(d.security).toBeDefined();
    expect(d.prediction).toBeDefined();
    expect(Array.isArray(d.watch)).toBe(true);
    expect(Array.isArray(d.watchConditions)).toBe(true);
    expect(d.claimValidation).toBeDefined();
    expect(d.claimValidation.status).toBeDefined();
  });
});
