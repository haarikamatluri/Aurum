import { describe, it, expect } from 'vitest';

const {
  calculateConfirmationBuffer,
  evaluateBreakoutCondition,
  evaluateBreakdownCondition,
  calculateScenarioTargets,
  determineScenarioStateMatrix
} = require('./scenario-rules');

const { calculatePossibleScenarios } = require('./scenario-engine');
const { calculateTransactionCosts } = require('./transaction-cost-model');
const { processNewsIntelligence, validateArticleUrl } = require('./news-intelligence');
const { evaluateScenarioPredictiveValue } = require('./scenario-backtester');

describe('AURUM Post-Audit Critical Validation & Regression Suite', () => {

  // PRIORITY 1 — AAPL BREAKOUT VALIDATION
  describe('Priority 1: Breakout Confirmation & Buffer Rules', () => {
    it('correctly rejects AAPL $0.05 price crossing as SUB_BUFFER_RESISTANCE_TEST', () => {
      // AAPL Price $345.54, Resistance $345.49, difference is only $0.05
      const currentPrice = 345.54;
      const resistance = 345.49;
      const atr14 = 6.16;

      const buffer = calculateConfirmationBuffer(resistance, atr14);
      // Buffer should be max(0.15 * 6.16 = 0.924, 0.0025 * 345.49 = 0.8637) = ~0.924
      expect(buffer).toBeCloseTo(0.924, 2);

      const evalResult = evaluateBreakoutCondition({
        currentPrice,
        resistance,
        prevClose: 344.00,
        volume: 60000000,
        avgVolume: 45000000,
        rsi14: 62.0,
        atr14,
        isCompletedCandle: true
      });

      expect(evalResult.isBreakout).toBe(false);
      expect(evalResult.status).toBe('CONDITIONAL');
      expect(evalResult.code).toBe('SUB_BUFFER_RESISTANCE_TEST');
      expect(evalResult.reason).toContain('remains within the required confirmation buffer');
      expect(evalResult.requiredPrice).toBeCloseTo(resistance + buffer, 2);
    });

    it('confirms breakout to ACTIVE only when price clears resistance + buffer with volume and momentum', () => {
      const resistance = 345.49;
      const atr14 = 6.16;
      const buffer = calculateConfirmationBuffer(resistance, atr14); // ~0.924
      const breakoutPrice = resistance + buffer + 0.50; // $346.91

      const evalResult = evaluateBreakoutCondition({
        currentPrice: breakoutPrice,
        resistance,
        prevClose: 344.00,
        volume: 60000000,
        avgVolume: 40000000, // 1.5x volume expansion (> 1.20x)
        rsi14: 64.0, // > 55.0
        atr14,
        isCompletedCandle: true
      });

      expect(evalResult.isBreakout).toBe(true);
      expect(evalResult.status).toBe('ACTIVE');
      expect(evalResult.code).toBe('CONFIRMED_BREAKOUT_ACTIVE');
    });

    it('rejects incomplete intraday candle probe even if price exceeds buffer', () => {
      const resistance = 345.49;
      const atr14 = 6.16;
      const buffer = calculateConfirmationBuffer(resistance, atr14);
      const highPrice = resistance + buffer + 1.0;

      const evalResult = evaluateBreakoutCondition({
        currentPrice: highPrice,
        resistance,
        prevClose: 344.00,
        volume: 50000000,
        avgVolume: 40000000,
        rsi14: 60.0,
        atr14,
        isCompletedCandle: false // Incomplete intraday bar
      });

      expect(evalResult.isBreakout).toBe(false);
      expect(evalResult.status).toBe('CONDITIONAL');
      expect(evalResult.code).toBe('INTRADAY_PROBE_UNCONFIRMED');
      expect(evalResult.reason).toContain('intraday wick probe');
    });

    it('rejects breakout with low volume expansion below 1.20x', () => {
      const resistance = 100.0;
      const atr14 = 2.0;
      const buffer = calculateConfirmationBuffer(resistance, atr14); // max(0.30, 0.25) = 0.30

      const evalResult = evaluateBreakoutCondition({
        currentPrice: 101.5, // Well above 100.30
        resistance,
        prevClose: 99.0,
        volume: 105000,
        avgVolume: 100000, // Only 1.05x (< 1.20x)
        rsi14: 60.0,
        atr14,
        isCompletedCandle: true
      });

      expect(evalResult.isBreakout).toBe(false);
      expect(evalResult.status).toBe('CONDITIONAL');
      expect(evalResult.code).toBe('UNCONFIRMED_LOW_VOLUME');
    });
  });

  // PRIORITY 3 — TRANSACTION COST ACCURACY
  describe('Priority 3: Institutional Transaction Cost Model', () => {
    it('accurately calculates Indian equity statutory tax schedule for delivery trades', () => {
      const cost = calculateTransactionCosts({
        market: 'IN',
        symbol: 'TCS',
        tradeType: 'DELIVERY',
        brokerType: 'DISCOUNT',
        entryPrice: 3500,
        exitPrice: 3600,
        shares: 100
      });

      expect(cost.market).toBe('IN');
      expect(cost.tradeType).toBe('DELIVERY');
      expect(cost.brokerage).toBe(0); // Zero delivery commission for discount broker
      // STT: 0.1% on buy (350000 * 0.001 = 350) + 0.1% on sell (360000 * 0.001 = 360) = 710
      expect(cost.stt).toBe(710);
      expect(cost.exchangeTurnoverCharge).toBeGreaterThan(20);
      expect(cost.gst).toBeGreaterThan(0);
      expect(cost.stampDuty).toBeCloseTo(52.5, 1); // 0.015% on buy (350000 * 0.00015 = 52.5)
      // Total cost % should be in realistic 0.25% - 0.40% range
      expect(cost.totalCostPct).toBeGreaterThan(0.25);
      expect(cost.totalCostPct).toBeLessThan(0.45);
    });

    it('accurately calculates US equity regulatory fees and slippage', () => {
      const cost = calculateTransactionCosts({
        market: 'US',
        symbol: 'AAPL',
        tradeType: 'DELIVERY',
        brokerType: 'DISCOUNT',
        entryPrice: 200,
        exitPrice: 210,
        shares: 100
      });

      expect(cost.market).toBe('US');
      expect(cost.secFee).toBeGreaterThan(0);
      expect(cost.finraTaf).toBeGreaterThan(0);
      expect(cost.brokerage).toBe(0); // Free retail US trading
      expect(cost.totalCostPct).toBeGreaterThan(0.02);
      expect(cost.totalCostPct).toBeLessThan(0.15);
    });
  });

  // PRIORITY 4 — NEWS SOURCE VERIFICATION
  describe('Priority 4: News Source & URL Verification', () => {
    it('detects stock quote overviews as UNVERIFIED rather than authentic articles', () => {
      const quoteUrlResult = validateArticleUrl('https://www.cnbc.com/quotes/AAPL');
      expect(quoteUrlResult.isValidArticle).toBe(false);
      expect(quoteUrlResult.isQuotePage).toBe(true);
      expect(quoteUrlResult.status).toBe('UNVERIFIED');

      const yahooQuote = validateArticleUrl('https://finance.yahoo.com/quote/TCS.NS');
      expect(yahooQuote.isQuotePage).toBe(true);
      expect(yahooQuote.status).toBe('UNVERIFIED');
    });

    it('authenticates canonical news story URLs from reputable publishers', () => {
      const validStory = validateArticleUrl('https://www.reuters.com/technology/apple-unveils-new-ai-chip-2026-10-24/');
      expect(validStory.isValidArticle).toBe(true);
      expect(validStory.isQuotePage).toBe(false);
      expect(validStory.status).toBe('ARTICLE_VALID');
    });

    it('processes news list and tags quote pages with UNVERIFIED sourceStatus', () => {
      const rawArticles = [
        {
          title: 'Apple Inc Stock Overview and Financials',
          url: 'https://www.cnbc.com/quotes/AAPL',
          publisher: 'CNBC',
          publishedAt: '2026-10-25T10:00:00Z',
          snippet: 'Latest stock price, real-time quotes, and financial news for Apple Inc.'
        },
        {
          title: 'Apple announces multi-billion dollar deal with cloud partner',
          url: 'https://www.reuters.com/technology/apple-deal-cloud-expansion-2026-10-25/',
          publisher: 'Reuters',
          publishedAt: '2026-10-25T11:00:00Z',
          snippet: 'Apple entered a multi-year cloud infrastructure partnership.'
        }
      ];

      const processed = processNewsIntelligence({
        symbol: 'AAPL',
        companyName: 'Apple Inc',
        news: rawArticles
      });

      expect(processed.length).toBe(2);
      // Quote page must be UNVERIFIED
      expect(processed[0].sourceStatus).toBe('UNVERIFIED');
      expect(processed[0].isQuotePage).toBe(true);
      // Canonical article must be SOURCE_AUTHENTICATED
      expect(processed[1].sourceStatus).toBe('SOURCE_AUTHENTICATED');
      expect(processed[1].isQuotePage).toBe(false);
      expect(processed[1].claimStatus).toBe('CLAIM_INDEPENDENTLY_CORROBORATED');
    });
  });

  // PRIORITY 5 & 2 & 7 — RECONCILED SCENARIO ENGINE & BACKTESTER
  describe('Priority 5 & 2 & 7: Reconciled Canonical Rules & Walk-Forward Audit', () => {
    it('produces identical measured-move targets in scenario engine and backtester math', () => {
      const support = 100;
      const resistance = 120;
      const range = 20;

      const targets = calculateScenarioTargets({
        currentPrice: 110,
        support,
        resistance,
        atr14: 3.5
      });

      expect(targets.bullishTarget).toBe(140);
      expect(targets.bearishTarget).toBe(80);
      expect(targets.rangeHeight).toBe(20);
    });

    it('executes walk-forward backtest disclosing dataset audit and gross vs net performance', () => {
      // 90 bars of simulated data with breakout
      const bars = [];
      let p = 500;
      for (let i = 0; i < 90; i++) {
        if (i < 40) {
          p = 500 + (i % 2 === 0 ? 10 : -10);
        } else if (i === 40) {
          p = 535; // Breakout bar
        } else if (i < 55) {
          p += 4; // Expansion to target
        } else {
          p = 560 + (i % 3 === 0 ? 5 : -5);
        }
        const d = new Date(Date.UTC(2026, 1, 1) + i * 86400000);
        bars.push({
          open: p - 1,
          high: p + 5,
          low: p - 4,
          close: p,
          volume: i >= 40 && i <= 43 ? 200000 : 80000,
          timestamp: d.toISOString()
        });
      }

      const result = evaluateScenarioPredictiveValue('TCS', bars, { lookback: 30 });

      expect(result.status).toBe('EVALUATED');
      expect(result.datasetAudit).toBeDefined();
      expect(result.datasetAudit.totalHistoricalCandles).toBe(90);
      expect(result.datasetAudit.warmupPeriodSessions).toBe(30);
      expect(result.datasetAudit.evaluationPeriodSessions).toBe(60);
      expect(result.datasetAudit.overlappingSignalHandling).toBe('STRICT_SINGLE_ACTIVE_TRADE_PER_DIRECTION');

      expect(result.performance).toBeDefined();
      expect(result.performance.grossWinRatePct).toBeDefined();
      expect(result.performance.netWinRatePct).toBeDefined();
      expect(result.performance.grossProfitFactor).toBeDefined();
      expect(result.performance.netProfitFactor).toBeDefined();

      expect(result.transactionCostModel).toBeDefined();
      expect(result.transactionCostModel.market).toBe('IN');
      expect(result.transactionCostModel.averageRoundTripCostPct).toBeGreaterThan(0);
    });

    it('ensures AAPL scenario calculation marks bullish scenario CONDITIONAL with sub-buffer statusReason', () => {
      // Simulated quote where AAPL price is $345.54 and resistance is $345.49
      const quote = {
        price: 345.54,
        resistance: 345.49,
        support: 330.00,
        atr14: 6.16,
        changePercent: 0.15,
        volume: 55000000,
        timestamp: '2026-10-30T15:30:00Z',
        isCompletedCandle: true
      };

      // Mock 60 bars
      const bars = [];
      for (let i = 0; i < 60; i++) {
        bars.push({
          open: 340,
          high: 344,
          low: 335,
          close: 340,
          volume: 45000000,
          time: `2026-09-${String(i % 30 + 1).padStart(2, '0')}`
        });
      }

      const scenariosResult = calculatePossibleScenarios({
        symbol: 'AAPL',
        quote,
        marketData: quote,
        historyBars: bars,
        recentNews: []
      });

      const bullishScenario = scenariosResult.scenarios.bullish;
      expect(bullishScenario.status).toBe('CONDITIONAL');
      expect(bullishScenario.breakoutCode).toBe('SUB_BUFFER_RESISTANCE_TEST');
      expect(bullishScenario.statusReason).toContain('remains within the required confirmation buffer');
      expect(bullishScenario.requiredConfirmationPrice).toBeGreaterThan(345.54);
    });
  });
});
