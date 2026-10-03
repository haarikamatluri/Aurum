/**
 * AURUM AI Analyst — Stress Test Engine
 * Deterministic scenario engine executing mathematical macroeconomic and factor shocks
 * across actual user portfolio holdings.
 * 
 * Rules:
 * - Deterministic arithmetic: position value * shock % = position impact.
 * - Sector aggregation & vulnerability rating.
 * - Distinguishes hypothetical scenario from deterministic certainty.
 */

const { createAnalystEnvelope } = require('../envelope');

// Predefined macroeconomic scenario models
const SCENARIO_DEFINITIONS = {
  'market_crash_10': {
    name: 'Broad Market Correction (-10%)',
    description: 'Hypothetical uniform 10% decline across global equities due to liquidity tightening.',
    defaultShock: -10.0,
    sectorShocks: {
      'Technology': -12.5,
      'Financial': -11.0,
      'Energy': -9.0,
      'Consumer': -6.5,
      'Healthcare': -5.0
    }
  },
  'market_crash_20': {
    name: 'Severe Market Crash (-20%)',
    description: 'Deep bear market contraction with credit spread widening.',
    defaultShock: -20.0,
    sectorShocks: {
      'Technology': -25.0,
      'Financial': -22.0,
      'Energy': -18.0,
      'Consumer': -12.0,
      'Healthcare': -10.0
    }
  },
  'market_rally_10': {
    name: 'Global Market Expansion (+10%)',
    description: 'Risk-on liquidity expansion across all equity asset classes.',
    defaultShock: 10.0,
    sectorShocks: {
      'Technology': 13.5,
      'Financial': 11.0,
      'Energy': 8.5,
      'Consumer': 7.0,
      'Healthcare': 5.5
    }
  },
  'tech_selloff_10': {
    name: 'Technology Sector Multiple Compression (-10%)',
    description: 'Multiples contraction across semiconductors, cloud, and enterprise software.',
    defaultShock: -3.0,
    sectorShocks: {
      'Technology': -10.0,
      'Financial': -1.5,
      'Energy': 0.0,
      'Consumer': 1.5,
      'Healthcare': 2.0
    }
  },
  'crude_oil_spike': {
    name: 'Brent Crude Oil Spike (+15%)',
    description: 'Surge in Brent crude prices tests input margin compression in transport and consumer goods while supporting upstream energy.',
    defaultShock: -4.5,
    sectorShocks: {
      'Energy': 7.5,
      'Technology': -3.5,
      'Financial': -4.0,
      'Consumer': -8.0,
      'Healthcare': -1.5
    }
  },
  'fed_rate_hike': {
    name: 'Hawkish Fed Rate Hike (+50 bps)',
    description: 'Benchmark yields rise, compressing high-duration growth equity multiples.',
    defaultShock: -5.0,
    sectorShocks: {
      'Technology': -8.5,
      'Financial': 2.0,
      'Energy': -4.0,
      'Consumer': -5.5,
      'Healthcare': -2.0
    }
  },
  'inr_depreciation': {
    name: 'Rupee Depreciation vs USD (-2.5%)',
    description: 'USD/INR advances past 86. Boosts IT/Pharma exporters while pressuring domestic importers.',
    defaultShock: -1.0,
    sectorShocks: {
      'Technology': 3.5,
      'Healthcare': 2.5,
      'Financial': -2.5,
      'Energy': -3.0,
      'Consumer': -3.5
    }
  },
  'custom_shock': {
    name: 'Custom Parameter Shock',
    description: 'User-specified arbitrary percentage or asset-specific stress parameters.',
    defaultShock: -5.0,
    sectorShocks: {}
  }
};

function resolveSector(symbol) {
  const sym = String(symbol || '').toUpperCase();
  if (['TCS', 'INFY', 'WIPRO', 'TECHM', 'HCLTECH', 'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META', 'AMD', 'AVGO'].includes(sym)) {
    return 'Technology';
  }
  if (['HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK', 'BAJFINANCE', 'JPM', 'BAC', 'V', 'MA'].includes(sym)) {
    return 'Financial';
  }
  if (['RELIANCE', 'ONGC', 'BPCL', 'IOC', 'XOM', 'CVX'].includes(sym)) {
    return 'Energy';
  }
  if (['SUNPHARMA', 'CIPLA', 'DRREDDY', 'JNJ', 'PFE', 'ABBV'].includes(sym)) {
    return 'Healthcare';
  }
  if (['ITC', 'HINDUNILVR', 'NESTLEIND', 'TITAN', 'ASIANPAINT', 'WMT', 'PG', 'KO'].includes(sym)) {
    return 'Consumer';
  }
  return 'General Equity';
}

/**
 * Execute mathematical deterministic stress test on real portfolio holdings.
 * 
 * @param {Object} params
 * @param {Array} params.holdings - Array of user holding objects
 * @param {string} [params.scenario='market_crash_10'] - Scenario ID
 * @param {number} [params.customShockPercent] - Custom uniform percentage shock
 * @param {Object} [params.assetShocks] - Custom per-asset shock percentages { 'TCS': -12, 'AAPL': -8 }
 * @param {Array<string>} [params.selectedSymbols] - Specific positions to stress
 */
function runDeterministicStressTest({
  holdings = [],
  scenario = 'market_crash_10',
  customShockPercent,
  assetShocks = {},
  selectedSymbols = []
}) {
  const scenarioDef = SCENARIO_DEFINITIONS[scenario] || SCENARIO_DEFINITIONS['market_crash_10'];

  // Normalize holdings
  const activeHoldings = holdings.map(h => {
    const sym = (h.symbol || 'ASSET').toUpperCase();
    const shares = Number(h.shares || h.quantity || 1);
    const price = Number(h.currentPrice || h.price || h.avgPurchasePrice || h.averageCost || 100);
    const currentValue = Number((shares * price).toFixed(2));
    const sector = h.sector || resolveSector(sym);
    return {
      id: h.id || `hold-${sym}`,
      symbol: sym,
      companyName: h.companyName || sym,
      shares,
      currentPrice: price,
      currentValue,
      sector
    };
  });

  const baselineValue = activeHoldings.reduce((sum, h) => sum + h.currentValue, 0);

  // Position-by-position deterministic calculation
  const contributors = [];
  const sectorMap = {};
  let stressedTotalValue = 0;

  for (const h of activeHoldings) {
    const isSelected = selectedSymbols.length === 0 || selectedSymbols.includes(h.symbol);

    let shockPercent = 0;
    if (isSelected) {
      if (assetShocks[h.symbol] !== undefined) {
        shockPercent = Number(assetShocks[h.symbol]);
      } else if (typeof customShockPercent === 'number') {
        shockPercent = Number(customShockPercent);
      } else if (scenarioDef.sectorShocks && scenarioDef.sectorShocks[h.sector] !== undefined) {
        shockPercent = Number(scenarioDef.sectorShocks[h.sector]);
      } else {
        shockPercent = Number(scenarioDef.defaultShock || -5.0);
      }
    }

    const dollarImpact = Number(((h.currentValue * shockPercent) / 100).toFixed(2));
    const stressedPositionValue = Number((h.currentValue + dollarImpact).toFixed(2));
    stressedTotalValue += stressedPositionValue;

    // Vulnerability classification
    let vulnerability = 'LOW';
    if (shockPercent <= -10) vulnerability = 'HIGH';
    else if (shockPercent <= -5) vulnerability = 'MEDIUM';
    else if (shockPercent > 0) vulnerability = 'RESILIENT';

    const weightPercent = baselineValue > 0 ? Number(((h.currentValue / baselineValue) * 100).toFixed(2)) : 0;

    contributors.push({
      symbol: h.symbol,
      companyName: h.companyName,
      sector: h.sector,
      shares: h.shares,
      currentPrice: h.currentPrice,
      baselineValue: h.currentValue,
      stressedValue: stressedPositionValue,
      absoluteImpact: dollarImpact,
      percentageImpact: shockPercent,
      weightPercent,
      vulnerability,
      rationale: shockPercent < 0
        ? `${h.sector} sector beta under ${scenarioDef.name} indicates an estimated ${Math.abs(shockPercent)}% drawdown.`
        : `${h.sector} sector characteristics provide defensive resilience under this scenario.`
    });

    // Accumulate sector totals
    if (!sectorMap[h.sector]) {
      sectorMap[h.sector] = { sector: h.sector, baselineValue: 0, stressedValue: 0, dollarImpact: 0 };
    }
    sectorMap[h.sector].baselineValue += h.currentValue;
    sectorMap[h.sector].stressedValue += stressedPositionValue;
    sectorMap[h.sector].dollarImpact += dollarImpact;
  }

  // Format sector impacts
  const sectorImpacts = Object.values(sectorMap).map(s => {
    const sWeight = baselineValue > 0 ? Number(((s.baselineValue / baselineValue) * 100).toFixed(2)) : 0;
    const sImpactPct = s.baselineValue > 0 ? Number(((s.dollarImpact / s.baselineValue) * 100).toFixed(2)) : 0;
    return {
      sector: s.sector,
      baselineValue: Number(s.baselineValue.toFixed(2)),
      stressedValue: Number(s.stressedValue.toFixed(2)),
      absoluteImpact: Number(s.dollarImpact.toFixed(2)),
      percentageImpact: sImpactPct,
      weightPercent: sWeight
    };
  });

  // Sort contributors by largest dollar loss first
  contributors.sort((a, b) => a.absoluteImpact - b.absoluteImpact);

  const absoluteImpact = Number((stressedTotalValue - baselineValue).toFixed(2));
  const percentageImpact = baselineValue > 0 ? Number(((absoluteImpact / baselineValue) * 100).toFixed(2)) : 0;

  // Vulnerability rating of portfolio as a whole
  let portfolioRiskRating = 'MODERATE';
  if (percentageImpact < -15) portfolioRiskRating = 'CRITICAL';
  else if (percentageImpact < -8) portfolioRiskRating = 'HIGH';
  else if (percentageImpact < -3) portfolioRiskRating = 'MODERATE';
  else portfolioRiskRating = 'LOW';

  const resultData = {
    scenarioId: scenario,
    scenarioName: scenarioDef.name,
    scenarioDescription: scenarioDef.description,
    baselineValue: Number(baselineValue.toFixed(2)),
    stressedValue: Number(stressedTotalValue.toFixed(2)),
    absoluteImpact,
    percentageImpact,
    portfolioRiskRating,
    contributors,
    sectorImpacts,
    largestNegativeContributor: contributors[0] || null,
    largestResilientContributor: contributors.filter(c => c.absoluteImpact >= 0).pop() || null,
    methodology: 'Estimated portfolio impact calculated deterministically as (position market value * scenario shock %). Historical correlations and factor assumptions do not guarantee future actual performance.',
    timestamp: new Date().toISOString()
  };

  return createAnalystEnvelope({
    data: resultData,
    status: 'LIVE',
    source: 'Deterministic Portfolio Stress Engine',
    provider: 'Aurum Quantitative Risk Lab',
    sourceCount: activeHoldings.length
  });
}

module.exports = {
  SCENARIO_DEFINITIONS,
  runDeterministicStressTest
};
