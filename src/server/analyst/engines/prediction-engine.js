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
    freshness = {},
    ledger = null
  }) {
    // Insufficient Evidence Guard: If price is missing or unavailable, report honestly
    if (!quote || !quote.price || typeof quote.price !== 'number' || quote.status === 'UNAVAILABLE') {
      return {
        predictionDirection: 'INSUFFICIENT_EVIDENCE',
        action: 'INSUFFICIENT_EVIDENCE',
        conclusion: 'INSUFFICIENT_EVIDENCE',
        score: null,
        confidence: 0,
        timeHorizon: 'CONDITIONAL',
        supportingEvidence: [],
        contradictingEvidence: [],
        uncertainty: ['Verified real-time market price data is currently unavailable. Analytical assessment requires live market quote baseline.'],
        invalidatingConditions: ['Fresh market feed connection required to establish analytical baseline.'],
        keyDrivers: [],
        keyRisks: ['Insufficient price or fundamental evidence from market data provider.'],
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

    const curPrice = quote.price;
    const curUnit = quote.currency || (market === 'US' ? 'USD' : 'INR');

    // Helper to find evidence item in ledger
    const findEvidence = (predicate) => {
      if (!ledger) return null;
      const entries = ledger.getAll ? ledger.getAll() : (ledger.entries || []);
      return entries.find(predicate) || null;
    };

    // 1. Technical Trend & Momentum Analysis
    if (technicals) {
      dataPointsEvaluated += 2;
      const rsi = technicals.rsi14;
      if (typeof rsi === 'number') {
        const rsiEv = findEvidence(e => e.metric && e.metric.includes('RSI'));
        if (rsi < 35) {
          bullishPoints += 2;
          supportingEvidence.push({
            factor: 'Oversold Technical Momentum',
            claim: `14-day RSI is ${rsi.toFixed(1)} (oversold territory)`,
            reasoning: `Oversold RSI readings below 35 frequently signal near-term exhaustion of selling pressure and tactical bounce potential.`,
            evidenceId: rsiEv ? rsiEv.id : null,
            evidenceValue: rsi,
            evidenceMetric: rsiEv ? rsiEv.metric : 'Relative Strength Index (RSI 14)',
            unit: 'points',
            source: rsiEv ? rsiEv.source : 'Daily OHLCV Chart Calculation',
            sourceUrl: rsiEv ? rsiEv.sourceUrl : null,
            observedAt: rsiEv ? rsiEv.observedAt : null,
            provenance: rsiEv ? rsiEv.source : 'Daily OHLCV Chart Calculation'
          });
        } else if (rsi > 70) {
          bearishPoints += 2;
          contradictingEvidence.push({
            factor: 'Overbought Technical Resistance',
            claim: `14-day RSI is ${rsi.toFixed(1)} (overbought territory)`,
            reasoning: `RSI readings above 70 indicate extended short-term momentum with heightened risk of consolidation or mean-reversion pullbacks.`,
            evidenceId: rsiEv ? rsiEv.id : null,
            evidenceValue: rsi,
            evidenceMetric: rsiEv ? rsiEv.metric : 'Relative Strength Index (RSI 14)',
            unit: 'points',
            source: rsiEv ? rsiEv.source : 'Daily OHLCV Chart Calculation',
            sourceUrl: rsiEv ? rsiEv.sourceUrl : null,
            observedAt: rsiEv ? rsiEv.observedAt : null,
            provenance: rsiEv ? rsiEv.source : 'Daily OHLCV Chart Calculation'
          });
        }
      }

      const trendEv = findEvidence(e => e.metric && e.metric.includes('Trend'));
      if (technicals.trend === 'BULLISH') {
        bullishPoints += 2;
        supportingEvidence.push({
          factor: 'Upward Moving Average Alignment',
          claim: `Trading in an active BULLISH trend regime above moving average bands`,
          reasoning: `Price trades above short-term and intermediate moving average clusters, confirming upward structural momentum.`,
          evidenceId: trendEv ? trendEv.id : null,
          evidenceValue: technicals.trend,
          evidenceMetric: trendEv ? trendEv.metric : 'Price Trend Regime',
          unit: 'regime',
          source: trendEv ? trendEv.source : 'Moving Average Trend Filter',
          sourceUrl: trendEv ? trendEv.sourceUrl : null,
          observedAt: trendEv ? trendEv.observedAt : null,
          provenance: trendEv ? trendEv.source : 'Moving Average Trend Filter'
        });
      } else if (technicals.trend === 'BEARISH') {
        bearishPoints += 2;
        contradictingEvidence.push({
          factor: 'Negative Trend Structure',
          claim: `Trading in a BEARISH trend regime below moving average clusters`,
          reasoning: `Sustained positioning below intermediate moving averages reflects institutional distribution and overhead supply.`,
          evidenceId: trendEv ? trendEv.id : null,
          evidenceValue: technicals.trend,
          evidenceMetric: trendEv ? trendEv.metric : 'Price Trend Regime',
          unit: 'regime',
          source: trendEv ? trendEv.source : 'Moving Average Trend Filter',
          sourceUrl: trendEv ? trendEv.sourceUrl : null,
          observedAt: trendEv ? trendEv.observedAt : null,
          provenance: trendEv ? trendEv.source : 'Moving Average Trend Filter'
        });
      }

      if (technicals.support) {
        invalidatingConditions.push(`A decisive daily close below tactical support at ${curUnit} ${technicals.support} invalidates positive trend structure.`);
      }
    }

    // 2. Fundamental Valuation & Profitability
    if (fundamentals && (fundamentals.peRatio != null || fundamentals.returnOnEquity != null)) {
      dataPointsEvaluated += 2;
      const pe = fundamentals.peRatio;
      if (pe != null && !isNaN(pe)) {
        const peEv = findEvidence(e => e.metric && e.metric.includes('P/E'));
        if (pe > 0 && pe < 22) {
          bullishPoints += 2;
          supportingEvidence.push({
            factor: 'Attractive Valuation Multiple',
            claim: `Price-to-Earnings (P/E) multiple is ${pe}x`,
            reasoning: `A multiple below 22x provides valuation support and margin of safety relative to broader peer medians.`,
            evidenceId: peEv ? peEv.id : null,
            evidenceValue: pe,
            evidenceMetric: peEv ? peEv.metric : 'Price-to-Earnings (P/E Ratio)',
            unit: 'x',
            source: peEv ? peEv.source : 'Corporate Financial Disclosures',
            sourceUrl: peEv ? peEv.sourceUrl : null,
            observedAt: peEv ? peEv.observedAt : null,
            provenance: peEv ? peEv.source : 'Corporate Financial Disclosures'
          });
        } else if (pe > 45) {
          bearishPoints += 2;
          contradictingEvidence.push({
            factor: 'Premium Valuation Multiple',
            claim: `Price-to-Earnings (P/E) multiple is elevated at ${pe}x`,
            reasoning: `Elevated multiple leaves limited cushion if future quarterly revenue or margin growth falls short of market expectations.`,
            evidenceId: peEv ? peEv.id : null,
            evidenceValue: pe,
            evidenceMetric: peEv ? peEv.metric : 'Price-to-Earnings (P/E Ratio)',
            unit: 'x',
            source: peEv ? peEv.source : 'Corporate Financial Disclosures',
            sourceUrl: peEv ? peEv.sourceUrl : null,
            observedAt: peEv ? peEv.observedAt : null,
            provenance: peEv ? peEv.source : 'Corporate Financial Disclosures'
          });
          invalidatingConditions.push(`Multiple compression risk if forward earnings growth decelerates.`);
        }
      }

      const roe = fundamentals.returnOnEquity;
      if (roe != null && !isNaN(roe)) {
        const roeEv = findEvidence(e => e.metric && e.metric.includes('ROE'));
        if (roe > 20) {
          bullishPoints += 1.5;
          supportingEvidence.push({
            factor: 'Superior Return on Capital',
            claim: `Return on Equity (ROE) is strong at ${roe}%`,
            reasoning: `ROE exceeding 20% indicates disciplined operational reinvestment and high net capital productivity.`,
            evidenceId: roeEv ? roeEv.id : null,
            evidenceValue: roe,
            evidenceMetric: roeEv ? roeEv.metric : 'Return on Equity (ROE)',
            unit: '%',
            source: roeEv ? roeEv.source : 'Corporate Financial Disclosures',
            sourceUrl: roeEv ? roeEv.sourceUrl : null,
            observedAt: roeEv ? roeEv.observedAt : null,
            provenance: roeEv ? roeEv.source : 'Corporate Financial Disclosures'
          });
        } else if (roe < 8) {
          bearishPoints += 1.5;
          contradictingEvidence.push({
            factor: 'Subdued Capital Efficiency',
            claim: `Return on Equity (ROE) is subdued at ${roe}%`,
            reasoning: `Low return on equity indicates compressed operating returns relative to shareholder equity base.`,
            evidenceId: roeEv ? roeEv.id : null,
            evidenceValue: roe,
            evidenceMetric: roeEv ? roeEv.metric : 'Return on Equity (ROE)',
            unit: '%',
            source: roeEv ? roeEv.source : 'Corporate Financial Disclosures',
            sourceUrl: roeEv ? roeEv.sourceUrl : null,
            observedAt: roeEv ? roeEv.observedAt : null,
            provenance: roeEv ? roeEv.source : 'Corporate Financial Disclosures'
          });
        }
      }
    } else {
      uncertainty.push('Detailed balance sheet valuation ratios require latest statutory filing publication.');
    }

    // 3. Earnings Track Record
    if (earnings && earnings.status) {
      dataPointsEvaluated += 1;
      const epsEv = findEvidence(e => e.metric && e.metric.includes('EPS'));
      if (earnings.status === 'BEAT') {
        bullishPoints += 2;
        supportingEvidence.push({
          factor: 'Quarterly Earnings Outperformance',
          claim: `Reported EPS beat consensus expectations (${earnings.epsSurprise > 0 ? '+' : ''}${earnings.epsSurprisePercent}% surprise in ${earnings.latestReportingPeriod || 'recent quarter'})`,
          reasoning: `Quarterly earnings beat demonstrates operational execution exceeding analyst consensus forecasts.`,
          evidenceId: epsEv ? epsEv.id : null,
          evidenceValue: earnings.latestEPSActual,
          evidenceMetric: epsEv ? epsEv.metric : 'Quarterly Reported EPS',
          unit: curUnit,
          source: epsEv ? epsEv.source : 'Quarterly Financial Statements',
          sourceUrl: epsEv ? epsEv.sourceUrl : null,
          observedAt: epsEv ? epsEv.observedAt : null,
          provenance: epsEv ? epsEv.source : 'Quarterly Financial Statements'
        });
      } else if (earnings.status === 'MISS') {
        bearishPoints += 2;
        contradictingEvidence.push({
          factor: 'Quarterly Earnings Shortfall',
          claim: `Reported EPS trailed consensus estimates (${earnings.epsSurprisePercent}% surprise in ${earnings.latestReportingPeriod || 'recent quarter'})`,
          reasoning: `Earnings miss reflects operational margin headwinds or revenue shortfall relative to market expectations.`,
          evidenceId: epsEv ? epsEv.id : null,
          evidenceValue: earnings.latestEPSActual,
          evidenceMetric: epsEv ? epsEv.metric : 'Quarterly Reported EPS',
          unit: curUnit,
          source: epsEv ? epsEv.source : 'Quarterly Financial Statements',
          sourceUrl: epsEv ? epsEv.sourceUrl : null,
          observedAt: epsEv ? epsEv.observedAt : null,
          provenance: epsEv ? epsEv.source : 'Quarterly Financial Statements'
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

      const newsEv = findEvidence(e => e.category === 'NEWS');
      if (positiveHeadlines > negativeHeadlines) {
        bullishPoints += 1.5;
        supportingEvidence.push({
          factor: 'Positive Commercial News Flow',
          claim: `Verified coverage highlights commercial growth and contract catalysts: "${news[0].title}"`,
          reasoning: `Active news catalysts provide fundamental tailwinds and positive institutional attention.`,
          evidenceId: newsEv ? newsEv.id : null,
          evidenceValue: news[0].title,
          evidenceMetric: newsEv ? newsEv.metric : 'Verified Headline',
          unit: 'headline',
          source: news[0].publisher || (newsEv ? newsEv.source : 'Financial Newswire'),
          sourceUrl: news[0].url || (newsEv ? newsEv.sourceUrl : null),
          observedAt: news[0].publishedAt || (newsEv ? newsEv.observedAt : null),
          provenance: news[0].publisher || 'Financial Newswire'
        });
      } else if (negativeHeadlines > positiveHeadlines) {
        bearishPoints += 1.5;
        contradictingEvidence.push({
          factor: 'Adverse Regulatory or Media Sentiment',
          claim: `Headline scrutiny reflects cautious sentiment: "${news[0].title}"`,
          reasoning: `Negative news headlines introduce near-term sentiment friction and valuation overhang.`,
          evidenceId: newsEv ? newsEv.id : null,
          evidenceValue: news[0].title,
          evidenceMetric: newsEv ? newsEv.metric : 'Verified Headline',
          unit: 'headline',
          source: news[0].publisher || (newsEv ? newsEv.source : 'Financial Newswire'),
          sourceUrl: news[0].url || (newsEv ? newsEv.sourceUrl : null),
          observedAt: news[0].publishedAt || (newsEv ? newsEv.observedAt : null),
          provenance: news[0].publisher || 'Financial Newswire'
        });
      }
    }

    // 5. Macro & Volatility Guard
    if (macro && macro.bonds?.us10yYield && macro.bonds.us10yYield !== 'UNAVAILABLE') {
      uncertainty.push(`Macro sensitivity: Benchmark 10-Year yield sits at ${macro.bonds.us10yYield}; sovereign yield shifts affect equity cost of capital.`);
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

    // Evidence Confidence (represents evidence coverage & data completeness)
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
