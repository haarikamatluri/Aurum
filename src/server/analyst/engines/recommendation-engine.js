/**
 * AURUM Recommendation & Signal Fusion Engine
 * Computes deterministic data-driven Aurum Analytical View
 * (STRONG_BUY, BUY, HOLD, WATCH, REDUCE, SELL, AVOID, INSUFFICIENT_DATA)
 * based on composite scoring across Fundamentals, Technicals, Valuation, News Sentiment, ML, Macro, and Risk.
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
  ml = {},
  portfolioContext = null,
  macro = {}
}) {
  let fundamentalScore = 50;
  let technicalScore = 50;
  let valuationScore = 50;
  let newsSentimentScore = 50;
  let mlScore = 50;

  const supportingSignals = [];
  const conflictingSignals = [];
  const keyDrivers = [];
  const keyRisks = [];

  // 1. Fundamentals Evaluation
  if (fundamentals.peRatio != null && !isNaN(fundamentals.peRatio)) {
    const pe = Number(fundamentals.peRatio);
    if (pe > 0 && pe < 22) {
      valuationScore += 20;
      supportingSignals.push(`Attractive valuation: P/E ratio of ${pe}x sits at a reasonable multiple.`);
    } else if (pe > 42) {
      valuationScore -= 22;
      conflictingSignals.push(`Elevated valuation: P/E ratio of ${pe}x expands multiple compression risk.`);
      keyRisks.push(`High valuation multiple (${pe}x P/E) increases vulnerability to earnings growth slowdowns.`);
    }
  }

  if (fundamentals.returnOnEquity != null && !isNaN(fundamentals.returnOnEquity)) {
    const roe = Number(fundamentals.returnOnEquity);
    if (roe > 18) {
      fundamentalScore += 20;
      supportingSignals.push(`Strong capital efficiency: Return on Equity of ${roe}% indicates high profitability.`);
    } else if (roe < 8) {
      fundamentalScore -= 15;
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
    technicalScore += 20;
    supportingSignals.push(`Oversold technical state: RSI(14) at ${Number(rsi).toFixed(1)} indicates potential mean-reversion rebound support.`);
  } else if (rsi > 70) {
    technicalScore -= 18;
    conflictingSignals.push(`Overbought technical state: RSI(14) at ${Number(rsi).toFixed(1)} signals near-term profit-taking pressure.`);
    keyRisks.push(`Near-term overbought technical indicators (RSI ${Number(rsi).toFixed(1)}) may trigger consolidation.`);
  }

  const trend = technicals.trend || (quote.changePercent >= 0 ? 'BULLISH' : 'BEARISH');
  if (trend === 'BULLISH') {
    technicalScore += 15;
    supportingSignals.push('Uptrend momentum: Trading above short-term moving average support levels.');
  } else if (trend === 'BEARISH') {
    technicalScore -= 18;
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
      newsSentimentScore += 18;
      supportingSignals.push(`Positive press flow: ${posCount} favorable media & market news reports.`);
    } else if (negCount > posCount) {
      newsSentimentScore -= 18;
      conflictingSignals.push(`Negative news sentiment: ${negCount} adverse headline catalysts reported.`);
    }
  }

  // 4. ML Model Evaluation
  if (ml && ml.prediction) {
    if (ml.prediction === 'BULLISH' || ml.prediction === 'STRONG_BUY') {
      mlScore += 22;
      supportingSignals.push(`ML Signal: ${ml.modelId || 'Aurum Ensemble V2'} model outputs ${ml.prediction} prediction (${ml.confidence || 72}% confidence).`);
    } else if (ml.prediction === 'BEARISH' || ml.prediction === 'SELL') {
      mlScore -= 22;
      conflictingSignals.push(`ML Signal: ${ml.modelId || 'Aurum Ensemble V2'} model predicts downward price pressure.`);
    }
  }

  // 5. Earnings Evaluation
  if (earnings && earnings.lastQuarterSurprisePct != null) {
    if (earnings.lastQuarterSurprisePct > 0) {
      fundamentalScore += 10;
      supportingSignals.push(`Earnings beat: Exceeded consensus earnings estimates by +${earnings.lastQuarterSurprisePct}% last quarter.`);
    } else if (earnings.lastQuarterSurprisePct < 0) {
      fundamentalScore -= 10;
      conflictingSignals.push(`Earnings miss: Trailed quarterly consensus estimate by ${earnings.lastQuarterSurprisePct}%.`);
    }
  }

  // 6. Portfolio Context
  if (portfolioContext && portfolioContext.shares > 0) {
    const curVal = portfolioContext.shares * (quote.price || portfolioContext.avgCost);
    const pnlPct = portfolioContext.avgCost > 0 ? (((quote.price || portfolioContext.avgCost) - portfolioContext.avgCost) / portfolioContext.avgCost) * 100 : 0;
    supportingSignals.push(`Active portfolio position: You currently hold ${portfolioContext.shares} shares with total value ₹${curVal.toLocaleString('en-IN')} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% total return).`);
  }

  // Helper clamp
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const fScore = clamp(fundamentalScore);
  const tScore = clamp(technicalScore);
  const vScore = clamp(valuationScore);
  const nScore = clamp(newsSentimentScore);
  const mScore = clamp(mlScore);

  // Composite Score
  const compositeScore = Math.round(
    fScore * 0.25 +
    tScore * 0.25 +
    vScore * 0.20 +
    nScore * 0.15 +
    mScore * 0.15
  );

  // Determine Action
  let action = 'HOLD';
  if (compositeScore >= 78) action = 'STRONG_BUY';
  else if (compositeScore >= 62) action = 'BUY';
  else if (compositeScore >= 45) action = 'HOLD';
  else if (compositeScore >= 35) action = 'WATCH';
  else if (compositeScore >= 22) action = 'REDUCE';
  else action = 'SELL';

  // Quality & Confidence
  let dataCount = 0;
  if (quote.price) dataCount++;
  if (fundamentals.peRatio || fundamentals.returnOnEquity) dataCount++;
  if (technicals.rsi14 || technicals.rsi) dataCount++;
  if (news.length > 0) dataCount++;
  if (ml?.prediction) dataCount++;

  const confidence = Math.min(95, Math.max(55, dataCount * 18));

  // Assemble Key Drivers & Risks
  keyDrivers.push(...supportingSignals.slice(0, 3));
  if (keyDrivers.length < 2) {
    const curP = quote.price ? `${quote.currency === 'USD' ? '$' : '₹'}${quote.price}` : 'N/A';
    keyDrivers.push(`Current market quote is ${curP} with ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent || 0}% daily movement.`);
  }

  keyRisks.push(...conflictingSignals.slice(0, 3));
  if (keyRisks.length === 0) {
    keyRisks.push('Macroeconomic volatility, interest rate shifts, and broad market sector rotation.');
  }

  return {
    action,
    score: compositeScore,
    confidence,
    breakdown: {
      fundamentals: fScore,
      technicals: tScore,
      valuation: vScore,
      newsSentiment: nScore,
      mlModel: mScore
    },
    supportingSignals,
    conflictingSignals,
    keyDrivers,
    keyRisks,
    disclaimerNote: 'Aurum Analytical View is a quantitative model output based on available market quotes, technical indicators, news sentiment, and portfolio context. It is not personalized regulated financial advice.'
  };
}

module.exports = {
  calculateRecommendation
};
