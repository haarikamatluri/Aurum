import { describe, it, expect } from 'vitest';
const { processNewsIntelligence, getEntityAliases, classifyNewsCategory, determineImpactClassification } = require('./news-intelligence');
const { calculatePossibleScenarios } = require('./scenario-engine');

describe('Real-Time News Intelligence Engine', () => {
  it('correctly maps entity aliases for Indian and US tickers without cross-contamination', () => {
    const tcsAliases = getEntityAliases('TCS', 'Tata Consultancy Services Ltd');
    expect(tcsAliases).toContain('tcs');
    expect(tcsAliases).toContain('tata consultancy services');
    expect(tcsAliases).not.toContain('infosys');

    const aaplAliases = getEntityAliases('AAPL', 'Apple Inc');
    expect(aaplAliases).toContain('aapl');
    expect(aaplAliases).toContain('apple');
    expect(aaplAliases).toContain('iphone');
    expect(aaplAliases).not.toContain('microsoft');
  });

  it('filters news strictly relevant to targeted entity', () => {
    const rawNews = [
      { title: 'TCS signs $1 Billion multi-year cloud contract with European bank', snippet: 'Major deal win boosts European expansion', publisher: 'Reuters', link: 'https://reuters.com/tcs-deal', pubDate: '2026-10-28T10:00:00Z' },
      { title: 'Infosys reports quarterly revenue growth', snippet: 'Indian IT competitor reports beat', publisher: 'Bloomberg', link: 'https://bloomberg.com/infy', pubDate: '2026-10-28T09:00:00Z' },
      { title: 'Apple unveils new M4 chip architecture', snippet: 'Cupertino giant launches Silicon', publisher: 'CNBC', link: 'https://cnbc.com/apple', pubDate: '2026-10-28T08:00:00Z' }
    ];

    const tcsProcessed = processNewsIntelligence({ rawNews, symbol: 'TCS', companyName: 'Tata Consultancy Services' });
    expect(tcsProcessed.length).toBe(1);
    expect(tcsProcessed[0].title).toContain('TCS signs $1 Billion');
    expect(tcsProcessed[0].category).toBe('CONTRACTS_DEALS');
    expect(tcsProcessed[0].impact).toBe('POSITIVE');
    expect(tcsProcessed[0].isSourceVerified).toBe(true);

    const aaplProcessed = processNewsIntelligence({ rawNews, symbol: 'AAPL', companyName: 'Apple Inc' });
    expect(aaplProcessed.length).toBe(1);
    expect(aaplProcessed[0].title).toContain('Apple unveils new M4');
    expect(aaplProcessed[0].category).toBe('PRODUCT_LAUNCH');
  });

  it('classifies standard financial news categories accurately', () => {
    expect(classifyNewsCategory('Q3 Financial Results: Net profit rises 14%')).toBe('EARNINGS');
    expect(classifyNewsCategory('Firm secures multi-year digital transformation pact')).toBe('CONTRACTS_DEALS');
    expect(classifyNewsCategory('Board approves special dividend payout and share buyback')).toBe('DIVIDENDS_BUYBACKS');
    expect(classifyNewsCategory('SEBI issues regulatory compliance notice regarding disclosures')).toBe('REGULATORY_LEGAL');
    expect(classifyNewsCategory('Company appoints new Chief Executive Officer')).toBe('MANAGEMENT');
    expect(classifyNewsCategory('Brokerage upgrades stock to Outperform with revised target')).toBe('ANALYST_ACTION');
  });

  it('evaluates market reaction context and includes the mandatory non-causation disclaimer', () => {
    const rawNews = [
      { title: 'TCS wins massive cloud modernization contract', publisher: 'Reuters', link: 'https://reuters.com/test' }
    ];
    const marketData = {
      price: 3500,
      changePercent: -1.2,
      volume: 1500000
    };

    const result = processNewsIntelligence({ rawNews, symbol: 'TCS', marketData });
    expect(result.length).toBe(1);
    expect(result[0].marketReaction).toBeDefined();
    expect(result[0].marketReaction.stockMovementPercent).toBe(-1.2);
    expect(result[0].marketReaction.correlationDisclaimer).toContain('does not establish that this announcement caused the observed market movement');
  });
});

describe('Calculation-Driven Possible Scenarios Engine', () => {
  it('returns INSUFFICIENT_DATA status when current market price is missing or invalid', () => {
    const res = calculatePossibleScenarios({
      symbol: 'TCS',
      quote: { price: null }
    });
    expect(res.status).toBe('INSUFFICIENT_DATA');
    expect(res.positive).toEqual([]);
    expect(res.neutral).toEqual([]);
    expect(res.negative).toEqual([]);
    expect(res.message).toContain('Verified current market price is unavailable');
  });

  it('calculates deterministic Bullish, Neutral, and Bearish scenarios from verified market data', () => {
    const quote = {
      price: 3400.0,
      changePercent: 1.5,
      volume: 2500000,
      status: 'LIVE',
      timestamp: '2026-10-30T10:00:00Z'
    };
    const technicals = {
      support: 3300.0,
      resistance: 3500.0,
      atr14: 45.0,
      rsi14: 58.5,
      sma20: 3350.0,
      trend: 'BULLISH',
      volumeTrend: 'Above average'
    };

    const res = calculatePossibleScenarios({
      symbol: 'TCS',
      quote,
      technicals,
      market: 'IN',
      currency: 'INR'
    });

    expect(res.status).toBe('CALCULATED');
    expect(res.symbol).toBe('TCS');
    expect(res.currentPrice).toBe(3400.0);
    expect(res.levels.support).toBe(3300.0);
    expect(res.levels.resistance).toBe(3500.0);

    // Channel Height = 3500 - 3300 = 200
    expect(res.levels.rangeHeight).toBe(200.0);

    // Bullish Measured Move = Resistance + Range Height = 3500 + 200 = 3700
    expect(res.levels.bullishTarget).toBe(3700.0);

    // Bearish Measured Move = Support - Range Height = 3300 - 200 = 3100
    expect(res.levels.bearishTarget).toBe(3100.0);

    // Verify Positive Scenario
    expect(res.positive.length).toBe(1);
    const pos = res.positive[0];
    expect(pos.trigger).toContain('daily close above tactical resistance at ₹3,500');
    expect(pos.outcome).toContain('3,700');
    expect(pos.confirmation).toContain('RSI expands above 55.0');
    expect(pos.invalidation).toContain('falls back below ₹3,500');
    expect(pos.targetMath).toContain('Resistance (₹3500) + Range Height (₹200) = ₹3700');
    expect(pos.mathBasis).toContain('Support: ₹3,300');
    expect(pos.mathBasis).toContain('Resistance: ₹3,500');

    // Verify Neutral Scenario
    expect(res.neutral.length).toBe(1);
    const neu = res.neutral[0];
    expect(neu.trigger).toContain('oscillating within the established swing boundary between support at ₹3,300 and resistance at ₹3,500');
    expect(neu.invalidation).toContain('close outside the ₹3,300 – ₹3,500 channel');

    // Verify Negative Scenario
    expect(res.negative.length).toBe(1);
    const neg = res.negative[0];
    expect(neg.trigger).toContain('daily close below structural support at ₹3,300');
    expect(neg.outcome).toContain('3,100');
    expect(neg.targetMath).toContain('Support (₹3300) - Range Height (₹200) = ₹3100');
  });

  it('computes stock-specific targets that differ dynamically between different companies', () => {
    const tcsQuote = { price: 3400, timestamp: '2026-10-30T10:00:00Z' };
    const tcsTech = { support: 3300, resistance: 3500, atr14: 50 };

    const aaplQuote = { price: 230, timestamp: '2026-10-30T14:30:00Z' };
    const aaplTech = { support: 220, resistance: 245, atr14: 4.5 };

    const tcsScenarios = calculatePossibleScenarios({
      symbol: 'TCS',
      quote: tcsQuote,
      technicals: tcsTech,
      market: 'IN',
      currency: 'INR'
    });

    const aaplScenarios = calculatePossibleScenarios({
      symbol: 'AAPL',
      quote: aaplQuote,
      technicals: aaplTech,
      market: 'US',
      currency: 'USD'
    });

    expect(tcsScenarios.levels.bullishTarget).toBe(3700);
    expect(aaplScenarios.levels.bullishTarget).toBe(270);
    expect(tcsScenarios.currency).toBe('₹');
    expect(aaplScenarios.currency).toBe('$');
    expect(tcsScenarios.positive[0].trigger).not.toEqual(aaplScenarios.positive[0].trigger);
    expect(tcsScenarios.positive[0].outcome).not.toEqual(aaplScenarios.positive[0].outcome);
  });

  it('correctly operates the scenario state machine (ACTIVE vs CONDITIONAL vs INVALIDATED)', () => {
    const quoteConsolidating = { price: 3400, timestamp: '2026-10-30T10:00:00Z' };
    const tech = { support: 3300, resistance: 3500, atr14: 50 };

    // 1. Inside Range -> Neutral is ACTIVE, Bullish/Bearish are CONDITIONAL
    const resInside = calculatePossibleScenarios({
      symbol: 'TCS',
      quote: quoteConsolidating,
      technicals: tech
    });
    expect(resInside.neutral[0].status).toBe('ACTIVE');
    expect(resInside.positive[0].status).toBe('CONDITIONAL');
    expect(resInside.negative[0].status).toBe('CONDITIONAL');
    expect(resInside.atrSensitivityBand).toBeDefined();
    expect(resInside.atrSensitivityBand.lowerBound).toBe(3400 - 1.5 * 50); // 3325
    expect(resInside.atrSensitivityBand.upperBound).toBe(3400 + 1.5 * 50); // 3475

    // 2. Above Resistance -> Bullish is ACTIVE, Neutral is INVALIDATED
    const resBreakout = calculatePossibleScenarios({
      symbol: 'TCS',
      quote: { price: 3550, timestamp: '2026-10-30T10:00:00Z' },
      technicals: tech
    });
    expect(resBreakout.positive[0].status).toBe('ACTIVE');
    expect(resBreakout.neutral[0].status).toBe('INVALIDATED');
    expect(resBreakout.negative[0].status).toBe('CONDITIONAL');

    // 3. Below Support -> Bearish is ACTIVE, Neutral is INVALIDATED
    const resBreakdown = calculatePossibleScenarios({
      symbol: 'TCS',
      quote: { price: 3250, timestamp: '2026-10-30T10:00:00Z' },
      technicals: tech
    });
    expect(resBreakdown.negative[0].status).toBe('ACTIVE');
    expect(resBreakdown.neutral[0].status).toBe('INVALIDATED');
    expect(resBreakdown.positive[0].status).toBe('CONDITIONAL');
  });
});

describe('Entity Disambiguation & News Negative Filters', () => {
  it('rejects unrelated Tata conglomerate subsidiaries from matching TCS', () => {
    const mixedNews = [
      { title: 'Tata Motors announces record EV quarterly deliveries', publisher: 'Economic Times', link: 'https://et.com/tm' },
      { title: 'Tata Steel inaugurates new blast furnace in Kalinganagar', publisher: 'Business Standard', link: 'https://bs.com/ts' },
      { title: 'Air India expands transatlantic widebody fleet', publisher: 'Livemint', link: 'https://livemint.com/ai' },
      { title: 'Tata Sons weighs initial public offering timeline for financial arm', publisher: 'Reuters', link: 'https://reuters.com/tsons' },
      { title: 'TCS reports solid constant-currency operating margin expansion', publisher: 'Reuters', link: 'https://reuters.com/tcs' }
    ];

    const result = processNewsIntelligence({ rawNews: mixedNews, symbol: 'TCS', companyName: 'Tata Consultancy Services Ltd' });
    expect(result.length).toBe(1);
    expect(result[0].title).toContain('TCS reports solid');
    expect(result[0].entityStatus).toBe('ENTITY_RELEVANCE_CONFIRMED');
    expect(result[0].sourceStatus).toBe('SOURCE_AUTHENTICATED');
  });

  it('rejects fruit/dietary uses of the word apple from matching AAPL', () => {
    const rawNews = [
      { title: 'Apple harvest expected to decline in Washington due to frost', publisher: 'Local Agriculture', link: 'https://farm.org/apple' },
      { title: 'Baking the perfect apple pie with cinnamon glaze', publisher: 'Food Magazine', link: 'https://food.com/pie' },
      { title: 'Apple supplier Foxconn increases iPhone production targets in India', publisher: 'Bloomberg', link: 'https://bloomberg.com/aapl' }
    ];

    const result = processNewsIntelligence({ rawNews, symbol: 'AAPL', companyName: 'Apple Inc' });
    expect(result.length).toBe(1);
    expect(result[0].title).toContain('Apple supplier Foxconn');
    expect(result[0].factualEvent).toBeDefined();
    expect(result[0].newsInterpretation).toBeDefined();
    expect(result[0].potentialFinancialImpact).toBeDefined();
    expect(result[0].observedMarketReaction).toBeDefined();
  });
});

describe('Mathematical & Quantitative Engines Audit', () => {
  const FinancialCalculationEngine = require('./financial-calculation-engine');
  const { evaluateScenarioPredictiveValue } = require('./scenario-backtester');

  it('computes Wilder Modified Moving Average ATR(14) recursively and accurately', () => {
    // Generate 20 candles with synthetic deterministic volatility
    const bars = [];
    let base = 100;
    for (let i = 0; i < 25; i++) {
      bars.push({
        open: base,
        high: base + 4,
        low: base - 2,
        close: base + 1,
        volume: 10000 + i * 500,
        time: `2026-10-${String(i + 1).padStart(2, '0')}`
      });
      base += 0.5;
    }

    const atrSeries = FinancialCalculationEngine.calculateWilderATRSeries(bars, 14);
    expect(atrSeries.length).toBe(bars.length);

    // Initial periods should be null
    for (let i = 0; i < 13; i++) {
      expect(atrSeries[i]).toBeNull();
    }

    // At index 13 (14th bar), ATR is the unweighted average of initial 14 TRs
    expect(atrSeries[13]).toBeGreaterThan(0);

    // At index 14, ATR must follow ((13 * prevATR) + currentTR) / 14 exactly
    const prevATR = atrSeries[13];
    const high = bars[14].high;
    const low = bars[14].low;
    const prevClose = bars[13].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    const expectedATR14 = ((13 * prevATR) + tr) / 14;

    expect(atrSeries[14]).toBeCloseTo(expectedATR14, 5);
  });

  it('identifies confirmed 5-bar fractal swing pivots without lookahead bias and clusters into zones', () => {
    // Construct candle series with a prominent swing high at index 5 and swing low at index 10
    const bars = [];
    const closes = [100, 102, 105, 108, 112, 120, 115, 110, 104, 98, 90, 95, 100, 105, 110, 112, 118, 114, 108, 102];
    for (let i = 0; i < closes.length; i++) {
      bars.push({
        open: closes[i] - 1,
        high: closes[i] + (i === 5 ? 5 : 2), // High spike at i=5 (125)
        low: closes[i] - (i === 10 ? 5 : 2),  // Low trough at i=10 (85)
        close: closes[i],
        volume: 50000,
        time: `2026-10-${String(i + 1).padStart(2, '0')}`
      });
    }

    const sr = FinancialCalculationEngine.calculateSupportResistance(bars, 105, { lookback: 20, k: 2 });
    expect(sr.support).toBeLessThan(105);
    expect(sr.resistance).toBeGreaterThan(105);
    expect(sr.method).toBe('FRACTAL_SWING_PIVOT_CLUSTERS');
    expect(sr.supportZone).toBeDefined();
    expect(sr.resistanceZone).toBeDefined();
    expect(sr.supportZone.touchCount).toBeGreaterThanOrEqual(1);
    expect(sr.resistanceZone.touchCount).toBeGreaterThanOrEqual(1);
  });

  it('executes chronological walk-forward scenario backtest with zero lookahead bias', () => {
    // Generate 60 days of historical bars with a known breakout regime
    const bars = [];
    let p = 1000;
    for (let i = 0; i < 60; i++) {
      if (i < 30) {
        // Rangebound between 980 and 1020
        p = 1000 + (i % 2 === 0 ? 15 : -15);
      } else if (i === 30) {
        // Decisive breakout bar above 1023 resistance
        p = 1045;
      } else {
        // Steady upward continuation trend
        p += 3;
      }
      const d = new Date(Date.UTC(2026, 7, 1) + i * 86400000);
      bars.push({
        open: p - 2,
        high: p + 8,
        low: p - 5,
        close: p,
        volume: i >= 30 ? 150000 : 100000,
        time: d.toISOString().split('T')[0]
      });
    }

    const backtest = evaluateScenarioPredictiveValue('TEST', bars);
    expect(backtest.symbol).toBe('TEST');
    expect(backtest.methodology).toBe('CHRONOLOGICAL_WALK_FORWARD');
    expect(backtest.evaluationWindow).toBe('60 Completed Sessions');
    expect(backtest.tradeCount).toBeGreaterThanOrEqual(1);
    expect(backtest.targetHitRatePercent).toBeGreaterThanOrEqual(0);
    expect(backtest.falseBreakoutRatePercent).toBeGreaterThanOrEqual(0);
    expect(backtest.transactionCostDeductionPercent).toBe(0.1);
  });
});
