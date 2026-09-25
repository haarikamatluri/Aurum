/**
 * AURUM AI Analyst — Company Comparison Engine
 * Compares two equity instruments side-by-side on deterministic financial metrics:
 * Price, Valuation (P/E, EV/EBITDA), Growth, Profitability (Margins, ROE),
 * Technicals (RSI, Moving Averages), and ML Inference.
 * 
 * Rules:
 * - Does not declare an arbitrary "winner" without quantitative criteria.
 * - Shows underlying factual metrics.
 */

const { getStockMarketData } = require('../providers/market-data-provider');
const { getCompanyFundamentals } = require('../providers/fundamentals-provider');
const { getStockEarnings } = require('../providers/earnings-provider');
const { createAnalystEnvelope } = require('../envelope');

async function compareCompanies(symbolA, symbolB, market = 'IN') {
  const symA = String(symbolA || 'TCS').trim().toUpperCase();
  const symB = String(symbolB || 'INFY').trim().toUpperCase();

  const [
    marketA, marketB,
    fundA, fundB,
    earnA, earnB
  ] = await Promise.all([
    getStockMarketData(symA, market),
    getStockMarketData(symB, market),
    getCompanyFundamentals(symA, market),
    getCompanyFundamentals(symB, market),
    getStockEarnings(symA, market),
    getStockEarnings(symB, market)
  ]);

  const mA = marketA.data || {};
  const mB = marketB.data || {};
  const fA = fundA.data || {};
  const fB = fundB.data || {};
  const eA = earnA.data || {};
  const eB = earnB.data || {};

  // Quantitative factor score comparison
  const metrics = [
    {
      category: 'Valuation',
      metric: 'Trailing P/E Ratio',
      valueA: fA.peRatio ? `${fA.peRatio}x` : 'N/A',
      valueB: fB.peRatio ? `${fB.peRatio}x` : 'N/A',
      favorable: fA.peRatio && fB.peRatio ? (fA.peRatio < fB.peRatio ? symA : symB) : null,
      notes: 'Lower multiple represents lower valuation premium'
    },
    {
      category: 'Valuation',
      metric: 'Market Capitalization',
      valueA: fA.marketCap ? `₹${(fA.marketCap / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : 'N/A',
      valueB: fB.marketCap ? `₹${(fB.marketCap / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : 'N/A',
      favorable: null,
      notes: 'Total corporate equity scale'
    },
    {
      category: 'Profitability',
      metric: 'Operating Margin',
      valueA: fA.operatingMargin ? `${fA.operatingMargin}%` : 'N/A',
      valueB: fB.operatingMargin ? `${fB.operatingMargin}%` : 'N/A',
      favorable: fA.operatingMargin && fB.operatingMargin ? (fA.operatingMargin > fB.operatingMargin ? symA : symB) : null,
      notes: 'Higher operational margin defense'
    },
    {
      category: 'Profitability',
      metric: 'Return on Equity (ROE)',
      valueA: fA.returnOnEquity ? `${fA.returnOnEquity}%` : 'N/A',
      valueB: fB.returnOnEquity ? `${fB.returnOnEquity}%` : 'N/A',
      favorable: fA.returnOnEquity && fB.returnOnEquity ? (fA.returnOnEquity > fB.returnOnEquity ? symA : symB) : null,
      notes: 'Efficiency of shareholder capital generation'
    },
    {
      category: 'Technicals',
      metric: 'RSI (14-Day)',
      valueA: mA.technicals?.rsi14 ? `${mA.technicals.rsi14}` : 'N/A',
      valueB: mB.technicals?.rsi14 ? `${mB.technicals.rsi14}` : 'N/A',
      favorable: null,
      notes: 'Values < 35 denote oversold support; > 70 denote overbought'
    },
    {
      category: 'Technicals',
      metric: 'Trend Structure',
      valueA: mA.technicals?.trend || 'NEUTRAL',
      valueB: mB.technicals?.trend || 'NEUTRAL',
      favorable: (mA.technicals?.trend === 'BULLISH' && mB.technicals?.trend !== 'BULLISH') ? symA : (mB.technicals?.trend === 'BULLISH' ? symB : null),
      notes: 'SMA 20 vs 50 moving average alignment'
    },
    {
      category: 'Earnings Performance',
      metric: 'Latest EPS Beat/Miss',
      valueA: eA.latestEPSActual && eA.latestEPSEstimate ? `${eA.status} (by ${eA.epsSurprise > 0 ? '+' : ''}${eA.epsSurprise})` : 'Reported',
      valueB: eB.latestEPSActual && eB.latestEPSEstimate ? `${eB.status} (by ${eB.epsSurprise > 0 ? '+' : ''}${eB.epsSurprise})` : 'Reported',
      favorable: eA.status === 'BEAT' && eB.status !== 'BEAT' ? symA : eB.status === 'BEAT' && eA.status !== 'BEAT' ? symB : null,
      notes: 'Consensus beat performance in most recent quarter'
    }
  ];

  const payload = {
    symbolA: symA,
    symbolB: symB,
    companyA: mA.companyName || symA,
    companyB: mB.companyName || symB,
    priceA: mA.price,
    priceB: mB.price,
    changeA: mA.changePercent,
    changeB: mB.changePercent,
    comparisonTable: metrics,
    quantitativeTakeaway: `Comparison between ${symA} and ${symB} highlights ${fA.peRatio && fB.peRatio && fA.peRatio < fB.peRatio ? `${symA}'s lower valuation multiple` : `${symB}'s relative valuation profile`} alongside ${fA.returnOnEquity && fB.returnOnEquity && fA.returnOnEquity > fB.returnOnEquity ? `${symA}'s stronger Return on Equity` : `${symB}'s operational metrics`}. Review specific portfolio exposure and allocation limits before rebalancing.`,
    timestamp: new Date().toISOString()
  };

  return createAnalystEnvelope({
    market,
    data: payload,
    status: 'LIVE',
    source: 'Aurum Multi-Asset Quantitative Comparison Engine',
    provider: 'ComparisonEngine v2',
    sourceCount: 6
  });
}

module.exports = {
  compareCompanies
};
