/**
 * AURUM Recommendation & Signal Fusion Engine
 * Computes deterministic data-driven Aurum Analytical View
 * (BUY_THESIS_SUPPORTED, HOLD_WAIT, SELL_THESIS_SUPPORTED, INSUFFICIENT_EVIDENCE)
 * based on composite scoring across Fundamentals, Technicals, Valuation, News Sentiment, and Risk.
 */

function calculateRecommendation({
  symbol = 'TCS',
  market = 'IN',
  quote = {},
  fundamentals = {},
  technicals = {},
  news = [],
  earnings = {},
  filings = {},
  portfolioContext = null,
  macro = {}
}) {
  if (!quote.price || isNaN(quote.price)) {
    return {
      action: 'NO_TRADE_INSUFFICIENT_EVIDENCE',
      conclusion: 'INSUFFICIENT_EVIDENCE',
      score: 0,
      confidence: 0,
      breakdown: { fundamentals: 0, technicals: 0, valuation: 0, newsSentiment: 0 },
      supportingSignals: [],
      conflictingSignals: ['No valid market quote available.'],
      keyDrivers: ['Market data unavailable for analysis.'],
      keyRisks: ['Insufficient price or fundamental evidence.'],
      disclaimerNote: 'Data is currently unavailable. No conclusion can be formed.'
    };
  }

  let fundamentalScore = 50;
  let technicalScore = 50;
  let valuationScore = 50;
  let newsSentimentScore = 50;

  const supportingSignals = [];
  const conflictingSignals = [];
  const keyDrivers = [];
  const keyRisks = [];

  // 1. Fundamentals Evaluation
  if (fundamentals.peRatio != null && !isNaN(fundamentals.peRatio)) {
    const pe = Number(fundamentals.peRatio);
    if (pe > 0 && pe < 22) {
      valuationScore += 25;
      supportingSignals.push(`Attractive valuation: P/E ratio of ${pe}x sits at a reasonable multiple.`);
    } else if (pe > 42) {
      valuationScore -= 25;
      conflictingSignals.push(`Elevated valuation: P/E ratio of ${pe}x expands multiple compression risk.`);
      keyRisks.push(`High valuation multiple (${pe}x P/E) increases vulnerability to earnings growth slowdowns.`);
    }
  }

  if (fundamentals.returnOnEquity != null && !isNaN(fundamentals.returnOnEquity)) {
    const roe = Number(fundamentals.returnOnEquity);
    if (roe > 18) {
      fundamentalScore += 25;
      supportingSignals.push(`Strong capital efficiency: Return on Equity of ${roe}% indicates high profitability.`);
    } else if (roe < 8) {
      fundamentalScore -= 20;
      conflictingSignals.push(`Subdued Return on Equity (${roe}%).`);
    }
  }

  if (fundamentals.operatingMargin != null && !isNaN(fundamentals.operatingMargin)) {
    const opMargin = Number(fundamentals.operatingMargin);
    if (opMargin > 18) {
      fundamentalScore += 15;
      supportingSignals.push(`Healthy operational profitability: Operating margin of ${opMargin}%.`);
    }
  }

  // 2. Technical Evaluation
  const rsi = technicals.rsi14 || technicals.rsi || 50;
  if (rsi < 35) {
    technicalScore += 25;
    supportingSignals.push(`Oversold technical state: RSI(14) at ${Number(rsi).toFixed(1)} indicates potential support.`);
  } else if (rsi > 70) {
    technicalScore -= 22;
    conflictingSignals.push(`Overbought technical state: RSI(14) at ${Number(rsi).toFixed(1)} signals potential near-term resistance.`);
    keyRisks.push(`Near-term overbought technical indicators (RSI ${Number(rsi).toFixed(1)}) may trigger consolidation.`);
  }

  const trend = technicals.trend || (quote.changePercent >= 0 ? 'BULLISH' : 'BEARISH');
  if (trend === 'BULLISH') {
    technicalScore += 20;
    supportingSignals.push('Uptrend momentum: Trading above short-term moving average support levels.');
  } else if (trend === 'BEARISH') {
    technicalScore -= 22;
    conflictingSignals.push('Deteriorating trend: Trading under short-term moving average resistance.');
  }

  // 3. News Sentiment Evaluation
  if (Array.isArray(news) && news.length > 0) {
    let posCount = 0;
    let negCount = 0;
    news.forEach(n => {
      const text = `${n.title || ''} ${n.snippet || ''}`.toLowerCase();
      if (text.includes('growth') || text.includes('profit') || text.includes('rally') || text.includes('upgrade') || text.includes('record') || text.includes('surge') || text.includes('beat') || text.includes('rise')) {
        posCount++;
      }
      if (text.includes('fall') || text.includes('drop') || text.includes('loss') || text.includes('downgrade') || text.includes('slash') || text.includes('risk') || text.includes('miss') || text.includes('slip')) {
        negCount++;
      }
    });

    if (posCount > negCount) {
      newsSentimentScore += 20;
      supportingSignals.push(`Positive press flow: ${posCount} favorable media & market news reports.`);
    } else if (negCount > posCount) {
      newsSentimentScore -= 20;
      conflictingSignals.push(`Negative news sentiment: ${negCount} adverse headline catalysts reported.`);
    }
  }

  // 4. Earnings Evaluation
  if (earnings && earnings.lastQuarterSurprisePct != null) {
    if (earnings.lastQuarterSurprisePct > 0) {
      fundamentalScore += 10;
      supportingSignals.push(`Earnings beat: Exceeded consensus estimates by +${earnings.lastQuarterSurprisePct}% last quarter.`);
    } else if (earnings.lastQuarterSurprisePct < 0) {
      fundamentalScore -= 10;
      conflictingSignals.push(`Earnings miss: Trailed consensus estimates by ${earnings.lastQuarterSurprisePct}%.`);
    }
  }

  // 5. Portfolio Context
  if (portfolioContext && portfolioContext.shares > 0) {
    const curVal = portfolioContext.shares * (quote.price || portfolioContext.avgCost);
    const pnlPct = portfolioContext.avgCost > 0 ? (((quote.price || portfolioContext.avgCost) - portfolioContext.avgCost) / portfolioContext.avgCost) * 100 : 0;
    supportingSignals.push(`Active portfolio position: You currently hold ${portfolioContext.shares} shares worth ${quote.currency === 'USD' ? '$' : '₹'}${curVal.toLocaleString()} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% return).`);
  }

  // Helper clamp
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const fScore = clamp(fundamentalScore);
  const tScore = clamp(technicalScore);
  const vScore = clamp(valuationScore);
  const nScore = clamp(newsSentimentScore);

  // Composite Score (Deterministic: 35% Fundamentals, 35% Technicals, 20% Valuation, 10% News)
  const compositeScore = Math.round(
    fScore * 0.35 +
    tScore * 0.35 +
    vScore * 0.20 +
    nScore * 0.10
  );

  // Analytical Conclusion Mapping
  let conclusion = 'HOLD_WAIT';
  let action = 'HOLD / WAIT';
  if (compositeScore >= 64) {
    conclusion = 'BUY_THESIS_SUPPORTED';
    action = 'BUY-THESIS SUPPORTED';
  } else if (compositeScore <= 38) {
    conclusion = 'SELL_THESIS_SUPPORTED';
    action = 'SELL-THESIS SUPPORTED';
  }

  // Quality & Confidence calculation based strictly on verified data sources available
  let dataCount = 0;
  if (quote.price) dataCount++;
  if (fundamentals.peRatio || fundamentals.returnOnEquity) dataCount++;
  if (technicals.rsi14 || technicals.rsi) dataCount++;
  if (news.length > 0) dataCount++;

  const confidence = Math.min(90, Math.max(40, dataCount * 22));

  // Assemble Key Drivers & Risks
  keyDrivers.push(...supportingSignals.slice(0, 3));
  if (keyDrivers.length < 2) {
    const curP = quote.price ? `${quote.currency === 'USD' ? '$' : '₹'}${quote.price}` : 'N/A';
    keyDrivers.push(`Verified market quote is ${curP} with ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent || 0}% daily movement.`);
  }

  keyRisks.push(...conflictingSignals.slice(0, 3));
  if (keyRisks.length === 0) {
    keyRisks.push('Macroeconomic volatility, interest rate shifts, and broad market sector rotation.');
  }

  return {
    action,
    conclusion,
    score: compositeScore,
    confidence,
    breakdown: {
      fundamentals: fScore,
      technicals: tScore,
      valuation: vScore,
      newsSentiment: nScore
    },
    supportingSignals,
    conflictingSignals,
    keyDrivers,
    keyRisks,
    disclaimerNote: 'Technical indicators describe historical price behavior and do not guarantee future movements. This analysis is an evidence-based decision framework and not personalized financial advice.'
  };
}

module.exports = {
  calculateRecommendation
};
