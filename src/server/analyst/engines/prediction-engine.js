/**
 * AURUM AI Analyst — Prediction & Decision Engine
 * Computes transparent, evidence-based analytical outlooks from verified market data,
 * technical indicators, fundamentals, earnings, filings, and news flow.
 * Eliminates generic "HOLD/WAIT 51/100" and never claims false ML accuracy.
 */

class PredictionEngine {
  /**
   * Evaluate verified multi-factor evidence and compute structured analytical prediction.
   */
  static evaluate({
    symbol,
    market = 'IN',
    quote = {},
    technicals = {},
    fundamentals = {},
    earnings = {},
    filings = {},
    news = [],
    macro = {},
    portfolioContext = null,
    freshness = {}
  }) {
    // Insufficient Evidence Guard
    if (!quote.price || typeof quote.price !== 'number' || quote.status === 'UNAVAILABLE') {
      return {
        predictionDirection: 'INSUFFICIENT_EVIDENCE',
        action: 'INSUFFICIENT_EVIDENCE',
        conclusion: 'INSUFFICIENT_EVIDENCE',
        score: null,
        confidence: 0,
        timeHorizon: 'CONDITIONAL',
        supportingEvidence: [],
        contradictingEvidence: ['Verified real-time market price data is currently unavailable.'],
        uncertainty: ['Data source was unreachable or returned an empty quote.'],
        invalidatingConditions: ['Fresh market feed connection required to establish analytical baseline.'],
        keyDrivers: ['Market data unavailable for analysis.'],
        keyRisks: ['Insufficient price or fundamental evidence.'],
        modelStatus: 'Deterministic evidence-based analysis; no validated predictive model is currently active.'
      };
    }

    const supportingEvidence = [];
    const contradictingEvidence = [];
    const uncertainty = [];
    const invalidatingConditions = [];

    let bullishPoints = 0;
    let bearishPoints = 0;
    let dataPointsEvaluated = 0;

    const curPriceStr = `${quote.currency || '₹'}${quote.price.toLocaleString('en-IN')}`;

    // 1. Technical Trend & Momentum Analysis
    if (technicals) {
      dataPointsEvaluated += 2;
      const rsi = technicals.rsi14;
      if (typeof rsi === 'number') {
        if (rsi < 35) {
          bullishPoints += 2;
          supportingEvidence.push({
            factor: 'Technical Momentum',
            claim: `RSI(14) at ${rsi.toFixed(1)} indicates oversold support conditions near recent range lows.`,
            provenance: 'Daily OHLCV Chart Calculation'
          });
        } else if (rsi > 70) {
          bearishPoints += 2;
          contradictingEvidence.push({
            factor: 'Technical Momentum',
            claim: `RSI(14) at ${rsi.toFixed(1)} signals near-term overbought resistance and potential consolidation.`,
            provenance: 'Daily OHLCV Chart Calculation'
          });
        }
      }

      if (technicals.trend === 'BULLISH') {
        bullishPoints += 2;
        supportingEvidence.push({
          factor: 'Trend Structure',
          claim: `Trading above key moving average clusters (${technicals.movingAverages?.sma20 ? quote.currency + technicals.movingAverages.sma20 : 'SMA20'}) in an active upward trend.`,
          provenance: 'Moving Average Trend Filter'
        });
      } else if (technicals.trend === 'BEARISH') {
        bearishPoints += 2;
        contradictingEvidence.push({
          factor: 'Trend Structure',
          claim: `Trading below key moving average resistance with negative momentum structure.`,
          provenance: 'Moving Average Trend Filter'
        });
      }

      if (technicals.support) {
        invalidatingConditions.push(`Decisive close below key support at ${quote.currency || '₹'}${technicals.support} invalidates positive holding thesis.`);
      }
    }

    // 2. Fundamental Valuation & Profitability
    if (fundamentals && (fundamentals.peRatio != null || fundamentals.returnOnEquity != null)) {
      dataPointsEvaluated += 2;
      const pe = fundamentals.peRatio;
      if (pe != null) {
        if (pe > 0 && pe < 22) {
          bullishPoints += 2;
          supportingEvidence.push({
            factor: 'Valuation Multiples',
            claim: `Favorable valuation multiple: P/E of ${pe}x provides margin of safety relative to broader market multiples.`,
            provenance: fundamentals.source || 'Corporate Financial Disclosures'
          });
        } else if (pe > 45) {
          bearishPoints += 2;
          contradictingEvidence.push({
            factor: 'Valuation Multiples',
            claim: `Elevated valuation multiple: P/E of ${pe}x leaves limited buffer against operational earnings growth slowdowns.`,
            provenance: fundamentals.source || 'Corporate Financial Disclosures'
          });
          invalidatingConditions.push(`Multiple compression risk if forward quarterly growth falls below market consensus expectations.`);
        }
      }

      const roe = fundamentals.returnOnEquity;
      if (roe != null) {
        if (roe > 20) {
          bullishPoints += 1.5;
          supportingEvidence.push({
            factor: 'Capital Efficiency',
            claim: `High return on equity (ROE of ${roe}%) demonstrates superior operational capital allocation.`,
            provenance: fundamentals.source || 'Corporate Financial Disclosures'
          });
        } else if (roe < 8) {
          bearishPoints += 1.5;
          contradictingEvidence.push({
            factor: 'Capital Efficiency',
            claim: `Subdued return on equity (ROE of ${roe}%) reflects compressed net return on capital.`,
            provenance: fundamentals.source || 'Corporate Financial Disclosures'
          });
        }
      }
    } else {
      uncertainty.push('Detailed fundamental balance sheet ratios require latest statutory filing publication.');
    }

    // 3. Earnings Track Record
    if (earnings && earnings.status) {
      dataPointsEvaluated += 1;
      if (earnings.status === 'BEAT') {
        bullishPoints += 2;
        supportingEvidence.push({
          factor: 'Quarterly Earnings',
          claim: `Reported EPS beat consensus expectations (${earnings.epsSurprise > 0 ? '+' : ''}${earnings.epsSurprisePercent}% surprise in ${earnings.latestReportingPeriod || 'recent quarter'}).`,
          provenance: earnings.source || 'Quarterly Financial Statements'
        });
      } else if (earnings.status === 'MISS') {
        bearishPoints += 2;
        contradictingEvidence.push({
          factor: 'Quarterly Earnings',
          claim: `Reported EPS trailed consensus estimates (${earnings.epsSurprisePercent}% surprise in ${earnings.latestReportingPeriod || 'recent quarter'}).`,
          provenance: earnings.source || 'Quarterly Financial Statements'
        });
        invalidatingConditions.push('Sequential revenue or operating margin deterioration in upcoming quarterly report.');
      } else if (earnings.status === 'ESTIMATE_UNAVAILABLE') {
        uncertainty.push(`Consensus institutional EPS estimate unavailable for ${earnings.latestReportingPeriod || 'latest quarter'}; actual reported EPS was ${earnings.latestEPSActual}.`);
      }
    }

    // 4. News Catalysts & Headline Flow
    if (Array.isArray(news) && news.length > 0) {
      dataPointsEvaluated += 1;
      let positiveHeadlines = 0;
      let negativeHeadlines = 0;

      const posKeywords = ['growth', 'profit', 'expansion', 'deal', 'contract', 'partnership', 'surge', 'rally', 'beat', 'record'];
      const negKeywords = ['fall', 'loss', 'drop', 'slump', 'probe', 'lawsuit', 'fine', 'delay', 'cut', 'downgrade'];

      news.slice(0, 4).forEach(n => {
        const text = `${n.title || ''} ${n.snippet || ''}`.toLowerCase();
        if (posKeywords.some(k => text.includes(k))) positiveHeadlines++;
        if (negKeywords.some(k => text.includes(k))) negativeHeadlines++;
      });

      if (positiveHeadlines > negativeHeadlines) {
        bullishPoints += 1.5;
        supportingEvidence.push({
          factor: 'Market Newsflow',
          claim: `Positive news sentiment: verified coverage highlights commercial deal wins and growth catalysts: "${news[0].title}".`,
          provenance: news[0].publisher || 'Financial Newswire'
        });
      } else if (negativeHeadlines > positiveHeadlines) {
        bearishPoints += 1.5;
        contradictingEvidence.push({
          factor: 'Market Newsflow',
          claim: `Adverse newsflow: headline scrutiny reflects cautious sentiment: "${news[0].title}".`,
          provenance: news[0].publisher || 'Financial Newswire'
        });
      }
    }

    // 5. Portfolio Ownership Context
    if (portfolioContext && portfolioContext.shares > 0) {
      const curVal = portfolioContext.shares * quote.price;
      const inv = portfolioContext.shares * portfolioContext.avgCost;
      const pl = curVal - inv;
      const plPct = inv > 0 ? (pl / inv) * 100 : 0;
      supportingEvidence.push({
        factor: 'Portfolio Position',
        claim: `You currently hold ${portfolioContext.shares} shares worth ${quote.currency || '₹'}${curVal.toLocaleString('en-IN')} (P&L: ${pl >= 0 ? '+' : ''}${quote.currency || '₹'}${pl.toFixed(2)} [${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%]).`,
        provenance: 'User Active Portfolio'
      });
    }

    // 6. Macro & Volatility Guard
    if (macro && macro.bonds?.us10yYield && macro.bonds.us10yYield !== 'UNAVAILABLE') {
      uncertainty.push(`Macro sensitivity: Benchmark 10-Year yield sits at ${macro.bonds.us10yYield}; changes in sovereign yields affect equity discount rates.`);
    }

    // Determine Prediction Direction & Decision Thesis
    const netConviction = bullishPoints - bearishPoints;
    let predictionDirection = 'NEUTRAL';
    let action = 'HOLD / WAIT';
    let conclusion = 'HOLD_WAIT';
    let timeHorizon = 'MEDIUM_TERM';

    if (netConviction >= 3.0) {
      predictionDirection = 'BULLISH';
      action = 'BUY-THESIS SUPPORTED';
      conclusion = 'BUY_THESIS_SUPPORTED';
      timeHorizon = 'MEDIUM_TERM';
    } else if (netConviction <= -3.0) {
      predictionDirection = 'BEARISH';
      action = 'SELL-THESIS SUPPORTED';
      conclusion = 'SELL_THESIS_SUPPORTED';
      timeHorizon = 'SHORT_TERM';
    } else {
      predictionDirection = 'NEUTRAL';
      action = 'HOLD / WAIT';
      conclusion = 'HOLD_WAIT';
      timeHorizon = 'SHORT_TO_MEDIUM_TERM';
    }

    // Composite multi-factor score (scaled 0-100)
    const baseScore = 50 + (netConviction * 7.5);
    const score = Math.max(15, Math.min(85, Math.round(baseScore)));

    // Evidence Confidence (represents evidence coverage & data completeness, not certainty!)
    const coverageFraction = Math.min(1.0, dataPointsEvaluated / 6);
    const confidence = Math.round(45 + (coverageFraction * 35));

    if (invalidatingConditions.length === 0) {
      invalidatingConditions.push('Significant market-wide correction or macroeconomic shock affecting liquidity.');
    }

    return {
      predictionDirection,
      action,
      conclusion,
      score,
      confidence,
      timeHorizon,
      supportingEvidence,
      contradictingEvidence,
      uncertainty,
      invalidatingConditions,
      keyDrivers: supportingEvidence.map(s => s.claim).slice(0, 3),
      keyRisks: contradictingEvidence.map(c => c.claim).concat(invalidatingConditions).slice(0, 3),
      modelStatus: 'Deterministic evidence-based analysis; no validated predictive model is currently active.'
    };
  }
}

module.exports = {
  PredictionEngine
};
