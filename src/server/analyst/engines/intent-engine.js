/**
 * AURUM Intent Classification & Response Planning Engine
 * Classifies user questions into 25 explicit financial intent categories
 * and generates structured evidence acquisition and response execution plans.
 */

const INTENTS = {
  HOLDING_PERIOD: 'HOLDING_PERIOD',
  BUY_SELL_DECISION_SUPPORT: 'BUY_SELL_DECISION_SUPPORT',
  STOCK_PRICE: 'STOCK_PRICE',
  PRICE_MOVEMENT_EXPLANATION: 'PRICE_MOVEMENT_EXPLANATION',
  TECHNICAL_ANALYSIS: 'TECHNICAL_ANALYSIS',
  FUNDAMENTAL_ANALYSIS: 'FUNDAMENTAL_ANALYSIS',
  EARNINGS_ANALYSIS: 'EARNINGS_ANALYSIS',
  FILINGS_ANALYSIS: 'FILINGS_ANALYSIS',
  NEWS_ANALYSIS: 'NEWS_ANALYSIS',
  COMPANY_COMPARISON: 'COMPANY_COMPARISON',
  PORTFOLIO_IMPACT: 'PORTFOLIO_IMPACT',
  PORTFOLIO_EXPOSURE: 'PORTFOLIO_EXPOSURE',
  RISK_ANALYSIS: 'RISK_ANALYSIS',
  SCENARIO_ANALYSIS: 'SCENARIO_ANALYSIS',
  TARGET_PRICE_DISCUSSION: 'TARGET_PRICE_DISCUSSION',
  VALUATION_ANALYSIS: 'VALUATION_ANALYSIS',
  DIVIDEND_ANALYSIS: 'DIVIDEND_ANALYSIS',
  COMPANY_BUSINESS_OVERVIEW: 'COMPANY_BUSINESS_OVERVIEW',
  HISTORICAL_PERFORMANCE: 'HISTORICAL_PERFORMANCE',
  MARKET_OUTLOOK: 'MARKET_OUTLOOK',
  REPORT_SUMMARY: 'REPORT_SUMMARY',
  CONCEPT_EXPLANATION: 'CONCEPT_EXPLANATION',
  FOLLOW_UP_QUESTION: 'FOLLOW_UP_QUESTION',
  GENERAL_FINANCIAL_QUESTION: 'GENERAL_FINANCIAL_QUESTION',
  CLARIFICATION_REQUIRED: 'CLARIFICATION_REQUIRED'
};

/**
 * Classify user question text into one of 25 intent categories.
 */
function classifyIntent(questionText, conversationContext = {}) {
  const q = String(questionText || '').trim().toLowerCase();
  if (!q) return INTENTS.CLARIFICATION_REQUIRED;

  // 1. Concept / Educational Explanation
  if (
    q.startsWith('explain ') ||
    q.includes('in simple words') ||
    q.includes('what is rsi') ||
    q.includes('what is p/e') ||
    q.includes('what is pe ratio') ||
    q.includes('what is roe') ||
    q.includes('what is macd') ||
    q.includes('what does roe mean') ||
    q.includes('definition of') ||
    q.includes('meaning of')
  ) {
    return INTENTS.CONCEPT_EXPLANATION;
  }

  // 2. Holding Period
  if (
    q.includes('how many days') ||
    q.includes('how long can i hold') ||
    q.includes('how long to hold') ||
    q.includes('holding period') ||
    q.includes('holding horizon') ||
    q.includes('how many months') ||
    q.includes('duration to hold') ||
    q.includes('holding duration')
  ) {
    return INTENTS.HOLDING_PERIOD;
  }

  // 3. Price Movement Explanation
  if (
    q.includes('why is') ||
    q.includes('why did') ||
    q.includes('why falling') ||
    q.includes('why dropping') ||
    q.includes('why rising') ||
    q.includes('why surging') ||
    q.includes('why down') ||
    q.includes('why up') ||
    q.includes('what happened to')
  ) {
    return INTENTS.PRICE_MOVEMENT_EXPLANATION;
  }

  // 4. Company Comparison
  if (
    q.includes('compare') ||
    q.includes('versus') ||
    q.includes(' vs ') ||
    q.includes('which is better') ||
    q.includes('which is stronger') ||
    q.includes('compared to')
  ) {
    return INTENTS.COMPANY_COMPARISON;
  }

  // 5. Portfolio Exposure
  if (
    q.includes('my exposure') ||
    q.includes('my position') ||
    q.includes('my holdings') ||
    q.includes('how many shares do i own') ||
    q.includes('do i own') ||
    q.includes('my portfolio size')
  ) {
    return INTENTS.PORTFOLIO_EXPOSURE;
  }

  // 6. Portfolio Impact
  if (
    q.includes('portfolio impact') ||
    q.includes('affect my portfolio') ||
    q.includes('impact on my portfolio') ||
    q.includes('rebalance')
  ) {
    return INTENTS.PORTFOLIO_IMPACT;
  }

  // 7. Scenario / What-If Analysis
  if (
    q.includes('what if') ||
    q.includes('falls 5%') ||
    q.includes('falls 10%') ||
    q.includes('drops 5%') ||
    q.includes('drops 10%') ||
    q.includes('if it drops') ||
    q.includes('if it falls') ||
    q.includes('stress test') ||
    q.includes('crash scenario')
  ) {
    return INTENTS.SCENARIO_ANALYSIS;
  }

  // 8. Earnings Analysis
  if (
    q.includes('earnings') ||
    q.includes('quarterly result') ||
    q.includes('quarterly results') ||
    q.includes('q1') ||
    q.includes('q2') ||
    q.includes('q3') ||
    q.includes('q4') ||
    q.includes('eps') ||
    q.includes('net profit') ||
    q.includes('earnings beat') ||
    q.includes('earnings surprise')
  ) {
    return INTENTS.EARNINGS_ANALYSIS;
  }

  // 9. Filings Analysis
  if (
    q.includes('filing') ||
    q.includes('filings') ||
    q.includes('sec filing') ||
    q.includes('annual report') ||
    q.includes('10-k') ||
    q.includes('10-q') ||
    q.includes('disclosures') ||
    q.includes('bse filing') ||
    q.includes('nse filing')
  ) {
    return INTENTS.FILINGS_ANALYSIS;
  }

  // 10. Fundamental Analysis
  if (
    q.includes('debt') ||
    q.includes('balance sheet') ||
    q.includes('cash flow') ||
    q.includes('roe') ||
    q.includes('operating margin') ||
    q.includes('revenue growth') ||
    q.includes('financial health') ||
    q.includes('profitability')
  ) {
    return INTENTS.FUNDAMENTAL_ANALYSIS;
  }

  // 11. Technical Analysis
  if (
    q.includes('technical analysis') ||
    q.includes('moving average') ||
    q.includes('macd') ||
    q.includes('support and resistance') ||
    q.includes('support level') ||
    q.includes('rsi') ||
    q.includes('chart trend')
  ) {
    return INTENTS.TECHNICAL_ANALYSIS;
  }

  // 12. Buy/Sell Decision Support
  if (
    q.includes('can i buy') ||
    q.includes('should i buy') ||
    q.includes('should i sell') ||
    q.includes('should i exit') ||
    q.includes('should i hold') ||
    q.includes('is it a buy') ||
    q.includes('buy or sell') ||
    q.includes('worth buying')
  ) {
    return INTENTS.BUY_SELL_DECISION_SUPPORT;
  }

  // 13. Stock Price Quote
  if (
    q.includes('what is the price') ||
    q.includes('current price') ||
    q.includes('latest price') ||
    q.includes('how much is') ||
    q.includes('quote for') ||
    q === 'price'
  ) {
    return INTENTS.STOCK_PRICE;
  }

  // 14. Valuation Analysis
  if (
    q.includes('overvalued') ||
    q.includes('undervalued') ||
    q.includes('fair value') ||
    q.includes('valuation') ||
    q.includes('p/e multiple')
  ) {
    return INTENTS.VALUATION_ANALYSIS;
  }

  // 15. Risk Analysis
  if (
    q.includes('risks') ||
    q.includes('downside risk') ||
    q.includes('key risks') ||
    q.includes('threats') ||
    q.includes('how risky')
  ) {
    return INTENTS.RISK_ANALYSIS;
  }

  // 16. Target Price
  if (
    q.includes('target price') ||
    q.includes('price target') ||
    q.includes('analyst targets')
  ) {
    return INTENTS.TARGET_PRICE_DISCUSSION;
  }

  // 17. News Analysis
  if (
    q.includes('news') ||
    q.includes('headlines') ||
    q.includes('press release')
  ) {
    return INTENTS.NEWS_ANALYSIS;
  }

  // 18. Dividend Analysis
  if (
    q.includes('dividend') ||
    q.includes('payout')
  ) {
    return INTENTS.DIVIDEND_ANALYSIS;
  }

  // 19. Company Business Overview
  if (
    q.includes('business model') ||
    q.includes('what does company do') ||
    q.includes('company overview') ||
    q.includes('competitors')
  ) {
    return INTENTS.COMPANY_BUSINESS_OVERVIEW;
  }

  // 20. Historical Performance
  if (
    q.includes('52 week') ||
    q.includes('past 1 year') ||
    q.includes('historical return') ||
    q.includes('past performance')
  ) {
    return INTENTS.HISTORICAL_PERFORMANCE;
  }

  // 21. Market Outlook
  if (
    q.includes('market outlook') ||
    q.includes('sector trend') ||
    q.includes('macro impact')
  ) {
    return INTENTS.MARKET_OUTLOOK;
  }

  // 22. Report Summary
  if (
    q.includes('summarize report') ||
    q.includes('executive summary') ||
    q.includes('key takeaways')
  ) {
    return INTENTS.REPORT_SUMMARY;
  }

  // 23. Portfolio Exposure / Impact
  if (
    q.includes('portfolio') ||
    q.includes('exposure') ||
    q.includes('my holdings') ||
    q.includes('my position') ||
    q.includes('how many shares do i have') ||
    q.includes('my cost basis')
  ) {
    return INTENTS.PORTFOLIO_EXPOSURE;
  }

  // 24. Follow Up Question
  if (
    q.startsWith('what about') ||
    q.startsWith('and its') ||
    q.startsWith('what if') ||
    q === 'tell me more'
  ) {
    return INTENTS.FOLLOW_UP_QUESTION;
  }

  // 25. General Financial Question
  if (q.split(/\s+/).length > 3) {
    return INTENTS.GENERAL_FINANCIAL_QUESTION;
  }

  return INTENTS.CLARIFICATION_REQUIRED;
}

/**
 * Generate a structured internal analysis plan based on classified intent and parameters.
 */
function createAnalysisPlan({ intent, symbol, questionText }) {
  const plan = {
    intent,
    symbol,
    question: questionText,
    requestedEvidence: [],
    requiredCalculations: [],
    responseWorkflow: intent.toLowerCase()
  };

  switch (intent) {
    case INTENTS.HOLDING_PERIOD:
      plan.requestedEvidence = ['price_trend', 'volatility', 'support_resistance', 'upcoming_earnings', 'news_risks'];
      plan.requiredCalculations = ['trend_strength', 'rsi14', 'volatility_estimate'];
      break;

    case INTENTS.PRICE_MOVEMENT_EXPLANATION:
      plan.requestedEvidence = ['recent_news', 'price_change', 'volume_spike', 'sector_movement'];
      plan.requiredCalculations = ['price_momentum', 'volume_ratio'];
      break;

    case INTENTS.EARNINGS_ANALYSIS:
      plan.requestedEvidence = ['quarterly_earnings', 'eps', 'revenue', 'yoy_growth', 'surprises'];
      break;

    case INTENTS.FILINGS_ANALYSIS:
      plan.requestedEvidence = ['sec_filings', 'form_types', 'filing_dates', 'disclosures'];
      break;

    case INTENTS.COMPANY_COMPARISON:
      plan.requestedEvidence = ['pe_ratios', 'roe', 'operating_margins', 'revenue_growth', 'price_momentum'];
      break;

    case INTENTS.PORTFOLIO_EXPOSURE:
      plan.requestedEvidence = ['user_holdings', 'shares_count', 'average_cost', 'market_value', 'portfolio_weight'];
      plan.requiredCalculations = ['current_pnl', 'weight_pct'];
      break;

    case INTENTS.CONCEPT_EXPLANATION:
      plan.requestedEvidence = ['concept_definition', 'current_symbol_value'];
      break;

    case INTENTS.BUY_SELL_DECISION_SUPPORT:
    default:
      plan.requestedEvidence = ['market_quote', 'fundamentals', 'technicals', 'news_sentiment', 'risks'];
      plan.requiredCalculations = ['composite_score', 'decision_conclusion'];
      break;
  }

  return plan;
}

module.exports = {
  INTENTS,
  classifyIntent,
  createAnalysisPlan
};
