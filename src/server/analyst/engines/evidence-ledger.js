/**
 * AURUM AI Analyst — Evidence Ledger Engine
 * Creates a rigorous, auditable ledger of verified facts from real providers.
 * Every analytical statement in Aurum must anchor to one or more Evidence Ledger IDs.
 */

class EvidenceLedger {
  constructor(symbol) {
    this.symbol = symbol ? String(symbol).toUpperCase() : 'UNKNOWN';
    this.entries = [];
    this.counter = 1;
  }

  /**
   * Add a verified fact to the ledger
   * @param {Object} item
   * @returns {string} Assigned Evidence ID (e.g., EVIDENCE-001)
   */
  add({
    category,
    metric,
    value,
    period = null,
    source,
    sourceUrl = null,
    timestamp = new Date().toISOString(),
    freshness = 'LIVE',
    details = null,
    provider = null,
    providerRole = 'PRIMARY',
    retrievedAt = null,
    fallbackReason = null
  }) {
    const id = `EVIDENCE-${String(this.counter++).padStart(3, '0')}`;
    const entry = {
      id,
      symbol: this.symbol,
      category,
      metric,
      value,
      period,
      source: source || 'Authoritative Market Gateway',
      sourceUrl: sourceUrl || null,
      sourceURL: sourceUrl || null,
      timestamp,
      retrievedAt: retrievedAt || timestamp,
      freshness,
      details,
      provider: provider || source || 'Authoritative Market Gateway',
      providerRole,
      fallbackReason
    };
    this.entries.push(entry);
    return id;
  }

  getById(id) {
    return this.entries.find(e => e.id === id) || null;
  }

  getByCategory(cat) {
    return this.entries.filter(e => e.category === cat);
  }

  getAll() {
    return [...this.entries];
  }

  /**
   * Formats ledger into clear numbered references for Gemini reasoning
   */
  toPromptContext() {
    if (this.entries.length === 0) {
      return 'No verified evidence items recorded in ledger.';
    }

    return this.entries.map(e => {
      let line = `[${e.id}] [${e.category}] ${e.metric}: ${e.value}`;
      if (e.period) line += ` (Period: ${e.period})`;
      line += ` | Source: ${e.source} (${e.freshness})`;
      if (e.sourceUrl && e.sourceUrl !== '#') line += ` | URL: ${e.sourceUrl}`;
      return line;
    }).join('\n');
  }
}

/**
 * Compiles a complete Evidence Ledger from verified real data sources.
 */
function buildEvidenceLedger({
  symbol,
  security = {},
  quote = {},
  technicals = {},
  fundamentals = {},
  earnings = {},
  filings = {},
  news = [],
  macro = {},
  portfolio = null
}) {
  const ledger = new EvidenceLedger(symbol);

  // 1. Market Quote Evidence
  if (quote && typeof quote.price === 'number') {
    const isFallback = (quote.providerUsed || quote.provider || '').toLowerCase().includes('yahoo') ||
      (Array.isArray(quote.providersAttempted) && quote.providersAttempted.length > 1);
    const providerRole = isFallback ? 'FALLBACK' : 'PRIMARY';
    const primaryName = security.market === 'US' ? 'Finnhub Institutional Feed' : 'Upstox Pro Market Gateway';
    const providerName = isFallback ? 'Yahoo Finance' : (quote.providerUsed || quote.provider || primaryName);
    const fallbackReason = isFallback ? (quote.failureReason || 'Primary provider unconfigured or unreachable') : null;
    const sourceLabel = isFallback ? `Fallback: ${providerName} (Primary: ${primaryName})` : providerName;
    const sourceUrl = quote.sourceUrl || (isFallback ? `https://finance.yahoo.com/quote/${security.symbol || symbol}` : null);

    ledger.add({
      category: 'MARKET_DATA',
      metric: 'Current Market Price',
      value: `${quote.currency || 'INR'} ${quote.price.toLocaleString('en-IN')}`,
      source: sourceLabel,
      provider: providerName,
      providerRole,
      retrievedAt: quote.timestamp,
      sourceUrl,
      timestamp: quote.timestamp,
      freshness: quote.status || 'LIVE',
      fallbackReason
    });

    if (typeof quote.changePercent === 'number') {
      ledger.add({
        category: 'MARKET_DATA',
        metric: "Today's Price Movement",
        value: `${quote.change >= 0 ? '+' : ''}${quote.change} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent}%)`,
        source: sourceLabel,
        provider: providerName,
        providerRole,
        retrievedAt: quote.timestamp,
        sourceUrl,
        timestamp: quote.timestamp,
        freshness: quote.status || 'LIVE',
        fallbackReason
      });
    }

    if (quote.dayHigh && quote.dayLow) {
      ledger.add({
        category: 'MARKET_DATA',
        metric: 'Day Range (High / Low)',
        value: `${quote.currency || 'INR'} ${quote.dayLow} - ${quote.dayHigh}`,
        source: sourceLabel,
        provider: providerName,
        providerRole,
        retrievedAt: quote.timestamp,
        sourceUrl,
        timestamp: quote.timestamp,
        freshness: quote.status || 'LIVE',
        fallbackReason
      });
    }

    if (quote.volume) {
      ledger.add({
        category: 'MARKET_DATA',
        metric: 'Intraday Trading Volume',
        value: Number(quote.volume).toLocaleString(),
        source: sourceLabel,
        provider: providerName,
        providerRole,
        retrievedAt: quote.timestamp,
        sourceUrl,
        timestamp: quote.timestamp,
        freshness: quote.status || 'LIVE',
        fallbackReason
      });
    }
  }

  // 2. Technical Indicator Evidence
  if (technicals) {
    if (typeof technicals.rsi14 === 'number') {
      ledger.add({
        category: 'TECHNICAL_ANALYSIS',
        metric: 'Relative Strength Index (RSI 14)',
        value: `${technicals.rsi14} (${technicals.rsiCondition || 'NEUTRAL'})`,
        source: 'Calculated from 1-Year Daily OHLCV Candles',
        freshness: 'FRESH'
      });
    }

    if (technicals.macd) {
      ledger.add({
        category: 'TECHNICAL_ANALYSIS',
        metric: 'MACD (12, 26, 9-EMA)',
        value: `Line: ${technicals.macd.line}, Signal: ${technicals.macd.signal}, Histogram: ${technicals.macd.histogram} (${technicals.macd.cross} bias)`,
        source: 'Calculated 9-Period Exponential Moving Average of MACD Series',
        freshness: 'FRESH'
      });
    }

    if (technicals.trend) {
      ledger.add({
        category: 'TECHNICAL_ANALYSIS',
        metric: 'Price Trend Regime',
        value: technicals.trend,
        source: 'Multi-Timeframe Moving Average Trend Filter (SMA 20/50/200)',
        freshness: 'FRESH'
      });
    }

    if (technicals.support && technicals.resistance) {
      ledger.add({
        category: 'TECHNICAL_ANALYSIS',
        metric: 'Key Support / Resistance Levels',
        value: `Support: ${quote.currency || '₹'}${technicals.support} | Resistance: ${quote.currency || '₹'}${technicals.resistance}`,
        source: '60-Day Swing Pivot Cluster Calculation',
        freshness: 'FRESH'
      });
    }
  }

  // 3. Fundamental Metrics Evidence
  if (fundamentals) {
    if (fundamentals.peRatio != null) {
      ledger.add({
        category: 'FUNDAMENTALS',
        metric: 'Price-to-Earnings (P/E Ratio)',
        value: `${fundamentals.peRatio}x`,
        period: 'TTM',
        source: fundamentals.source || 'Corporate Financial Disclosures',
        sourceUrl: fundamentals.sourceUrl,
        freshness: 'FRESH'
      });
    }

    if (fundamentals.returnOnEquity != null) {
      ledger.add({
        category: 'FUNDAMENTALS',
        metric: 'Return on Equity (ROE)',
        value: `${fundamentals.returnOnEquity}%`,
        period: 'TTM',
        source: fundamentals.source || 'Corporate Financial Disclosures',
        sourceUrl: fundamentals.sourceUrl,
        freshness: 'FRESH'
      });
    }

    if (fundamentals.operatingMargin != null) {
      ledger.add({
        category: 'FUNDAMENTALS',
        metric: 'Operating Margin',
        value: `${fundamentals.operatingMargin}%`,
        period: 'TTM',
        source: fundamentals.source || 'Corporate Financial Disclosures',
        sourceUrl: fundamentals.sourceUrl,
        freshness: 'FRESH'
      });
    }

    if (fundamentals.marketCap != null) {
      ledger.add({
        category: 'FUNDAMENTALS',
        metric: 'Market Capitalization',
        value: `${fundamentals.currency || 'INR'} ${Number(fundamentals.marketCap).toLocaleString()}`,
        source: fundamentals.source,
        sourceUrl: fundamentals.sourceUrl,
        freshness: 'FRESH'
      });
    }
  }

  // 4. Earnings Evidence
  if (earnings && earnings.latestEPSActual != null) {
    ledger.add({
      category: 'EARNINGS',
      metric: `Latest Reported EPS (${earnings.latestReportingPeriod || 'Latest Q'})`,
      value: `${quote.currency || ''}${earnings.latestEPSActual} (Reported: ${earnings.latestReportedDate || 'Recent'})`,
      period: earnings.latestReportingPeriod,
      source: earnings.source || 'Corporate Quarterly Disclosures',
      freshness: 'FRESH'
    });

    if (earnings.latestEPSEstimate != null) {
      ledger.add({
        category: 'EARNINGS',
        metric: 'Consensus EPS Estimate & Surprise',
        value: `Estimate: ${earnings.latestEPSEstimate}, Surprise: ${earnings.epsSurprise > 0 ? '+' : ''}${earnings.epsSurprise} (${earnings.epsSurprisePercent}%) - ${earnings.status}`,
        period: earnings.latestReportingPeriod,
        source: earnings.source,
        freshness: 'FRESH'
      });
    } else {
      ledger.add({
        category: 'EARNINGS',
        metric: 'Consensus EPS Estimate',
        value: 'ESTIMATE_UNAVAILABLE (No consensus estimate issued by reporting authority)',
        period: earnings.latestReportingPeriod,
        source: earnings.source,
        freshness: 'FRESH'
      });
    }
  }

  // 5. Filings Evidence
  if (filings && Array.isArray(filings.filings) && filings.filings.length > 0) {
    const latestF = filings.filings[0];
    ledger.add({
      category: 'FILINGS',
      metric: `Latest Regulatory Filing (${latestF.filingType})`,
      value: `"${latestF.title}" filed on ${latestF.filingDate}`,
      period: latestF.period || latestF.filingDate,
      source: latestF.source,
      sourceUrl: latestF.sourceUrl,
      freshness: 'FRESH'
    });
  }

  // 6. News Catalysts Evidence
  if (Array.isArray(news) && news.length > 0) {
    news.slice(0, 4).forEach((n, idx) => {
      ledger.add({
        category: 'NEWS',
        metric: `Verified Headline ${idx + 1}`,
        value: `"${n.title}"`,
        source: n.publisher || 'Financial Newswire',
        sourceUrl: n.url,
        timestamp: n.publishedAt || n.retrievedAt,
        freshness: 'FRESH',
        details: n.snippet
      });
    });
  }

  // 7. Portfolio Evidence (Strictly if user holds the asset)
  if (portfolio && portfolio.shares > 0) {
    const currentPrice = quote.price || portfolio.avgCost;
    const totalValue = portfolio.shares * currentPrice;
    const costBasis = portfolio.shares * portfolio.avgCost;
    const pnl = totalValue - costBasis;
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

    ledger.add({
      category: 'PORTFOLIO',
      metric: 'User Position Holding',
      value: `${portfolio.shares} shares owned @ avg cost ${portfolio.avgCost} (Total value: ${totalValue.toFixed(2)}, P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} [${pnlPercent.toFixed(2)}%])`,
      source: 'User Active Portfolio Ledger',
      freshness: 'LIVE'
    });
  }

  return ledger;
}

module.exports = {
  EvidenceLedger,
  buildEvidenceLedger
};
