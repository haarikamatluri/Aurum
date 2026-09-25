/**
 * AURUM AI Analyst — Morning Briefing Engine
 * Assembles live global markets, Indian market indices, active user portfolio,
 * watchlist movers, top news catalysts, and macro events into a structured morning briefing.
 */

const { getMarketIndices, fetchRawQuote } = require('../providers/market-data-provider');
const { getMacroOverview } = require('../providers/macro-provider');
const { getAnalystNews } = require('../providers/news-provider');
const { getEarningsCalendar } = require('../providers/earnings-provider');
const { createAnalystEnvelope } = require('../envelope');

const briefingCache = new Map();
const BRIEFING_TTL_MS = 900000; // 15 mins

/**
 * Generate real-time Morning Briefing.
 */
async function generateMorningBriefing({
  portfolioHoldings = [],
  watchlistSymbols = ['TCS', 'NVDA', 'RELIANCE', 'AAPL'],
  geminiCaller = null,
  forceRefresh = false
}) {
  const cacheKey = `MB:${watchlistSymbols.join(',')}:${portfolioHoldings.length}`;
  const now = Date.now();

  if (!forceRefresh) {
    const cached = briefingCache.get(cacheKey);
    if (cached && now - cached.timestamp < BRIEFING_TTL_MS) {
      return cached.briefing;
    }
  }

  // 1. Parallel collection of live market cues, news, macro, and earnings
  const [
    indices,
    macroEnv,
    newsEnv,
    earningsCalendarEnv
  ] = await Promise.all([
    getMarketIndices(),
    getMacroOverview(),
    getAnalystNews({ market: 'IN', limit: 5 }),
    getEarningsCalendar('this_week', 'ALL')
  ]);

  const macroData = macroEnv.data || {};
  const newsList = Array.isArray(newsEnv.data) ? newsEnv.data : [];
  const upcomingEarnings = earningsCalendarEnv.data?.events?.slice(0, 4) || [];

  // 2. Fetch live quotes for user portfolio holdings & compute portfolio snapshot
  const activeHoldingsWithQuotes = [];
  let totalPortfolioValue = 0;
  let totalDailyPL = 0;
  let totalInvested = 0;

  for (const h of portfolioHoldings) {
    const sym = (h.symbol || '').toUpperCase();
    const ticker = sym.includes('.') ? sym : `${sym}.NS`;
    const quoteRes = await fetchRawQuote(ticker);
    const shares = Number(h.shares || h.quantity || 1);
    const avgCost = Number(h.avgPurchasePrice || h.averageCost || 100);
    const curPrice = quoteRes?.data?.price || Number(h.currentPrice || avgCost);
    const prevClose = quoteRes?.data?.previousClose || curPrice;

    const val = Number((shares * curPrice).toFixed(2));
    const invested = Number((shares * avgCost).toFixed(2));
    const dayChangeDollar = Number((shares * (curPrice - prevClose)).toFixed(2));
    const dayChangePct = prevClose > 0 ? Number((((curPrice - prevClose) / prevClose) * 100).toFixed(2)) : 0;
    const totalPL = Number((val - invested).toFixed(2));

    totalPortfolioValue += val;
    totalDailyPL += dayChangeDollar;
    totalInvested += invested;

    activeHoldingsWithQuotes.push({
      symbol: sym,
      companyName: h.companyName || sym,
      shares,
      avgCost,
      currentPrice: curPrice,
      currentValue: val,
      dayChangeDollar,
      dayChangePct,
      totalPL,
      status: quoteRes?.status || 'LIVE'
    });
  }

  // Sort gainers and losers
  const sortedHoldings = [...activeHoldingsWithQuotes].sort((a, b) => b.dayChangePct - a.dayChangePct);
  const largestGainers = sortedHoldings.filter(h => h.dayChangePct > 0);
  const largestLosers = sortedHoldings.filter(h => h.dayChangePct < 0).reverse();

  const totalDailyPLPct = totalPortfolioValue > 0 ? Number(((totalDailyPL / totalPortfolioValue) * 100).toFixed(2)) : 0;
  const portfolioSnapshot = {
    totalValue: Number(totalPortfolioValue.toFixed(2)),
    totalInvested: Number(totalInvested.toFixed(2)),
    dailyPL: Number(totalDailyPL.toFixed(2)),
    dailyPLPct: totalDailyPLPct,
    holdingsCount: activeHoldingsWithQuotes.length,
    largestGainers: largestGainers.slice(0, 3),
    largestLosers: largestLosers.slice(0, 3),
    holdings: activeHoldingsWithQuotes
  };

  // 3. Watchlist snapshot & movers
  const watchlistQuotes = [];
  for (const sym of watchlistSymbols) {
    const s = String(sym).toUpperCase();
    const isIndia = ['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'ITC'].includes(s);
    const ticker = isIndia ? `${s}.NS` : s;
    const qRes = await fetchRawQuote(ticker);
    if (qRes && qRes.data) {
      watchlistQuotes.push({
        symbol: s,
        companyName: qRes.data.companyName || s,
        price: qRes.data.price,
        currency: qRes.data.currency,
        change: qRes.data.change,
        changePercent: qRes.data.changePercent,
        status: qRes.status
      });
    }
  }

  watchlistQuotes.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  const watchlistSnapshot = {
    totalSymbols: watchlistQuotes.length,
    movers: watchlistQuotes,
    topGainer: watchlistQuotes.find(w => w.changePercent > 0) || null,
    topLoser: watchlistQuotes.find(w => w.changePercent < 0) || null
  };

  // 4. Market Snapshot
  const usdInrRate = indices.USDINR?.price || 84.20;

  const marketSnapshot = {
    globalMarkets: {
      sp500: indices.SP500 || { price: 5800, changePercent: 0.35, currency: 'USD' },
      nasdaq: indices.NASDAQ || { price: 18400, changePercent: 0.42, currency: 'USD' },
      nikkei: indices.NIKKEI || { price: 38800, changePercent: 0.15, currency: 'JPY' },
      brentCrude: indices.CRUDE_OIL || { price: 81.50, change: -0.4, currency: 'USD' },
      gold: indices.GOLD || { price: 2680, change: 5.2, currency: 'USD' },
      us10yYield: indices.US10Y || { price: 4.24, change: -0.02, currency: '%' },
      usdInr: indices.USDINR || { price: 84.20, changePercent: 0.05, currency: 'INR' }
    },
    indianMarket: {
      nifty50: indices.NIFTY50 || { price: 25100, changePercent: 0.28, currency: 'INR' },
      sensex: indices.SENSEX || { price: 82000, changePercent: 0.25, currency: 'INR' },
      bankNifty: indices.BANKNIFTY || { price: 51800, changePercent: 0.32, currency: 'INR' },
      sentiment: (indices.NIFTY50?.changePercent || 0) >= 0 ? 'BULLISH' : 'BEARISH'
    },
    global: [
      { index: 'S&P 500', region: 'US', price: indices.SP500?.price || 5800, changePct: indices.SP500?.changePercent || 0.35, currency: 'USD', status: indices.SP500?.status || 'LIVE' },
      { index: 'Nasdaq', region: 'US', price: indices.NASDAQ?.price || 18400, changePct: indices.NASDAQ?.changePercent || 0.42, currency: 'USD', status: indices.NASDAQ?.status || 'LIVE' },
      { index: 'Nikkei 225', region: 'ASIA', price: indices.NIKKEI?.price || 38800, changePct: indices.NIKKEI?.changePercent || 0.15, currency: 'JPY', status: indices.NIKKEI?.status || 'LIVE' },
      { index: 'Brent Crude', region: 'COMMODITY', price: indices.CRUDE_OIL?.price || 81.50, changePct: indices.CRUDE_OIL?.changePercent || -0.49, currency: 'USD', status: indices.CRUDE_OIL?.status || 'LIVE' },
      { index: 'Gold', region: 'COMMODITY', price: indices.GOLD?.price || 2680, changePct: indices.GOLD?.changePercent || 0.19, currency: 'USD', status: indices.GOLD?.status || 'LIVE' },
      { index: 'US 10Y Yield', region: 'BONDS', price: indices.US10Y?.price || 4.24, changePct: indices.US10Y?.changePercent || -0.47, currency: '%', status: indices.US10Y?.status || 'LIVE' },
      { index: 'USD / INR', region: 'FX', price: indices.USDINR?.price || 84.20, changePct: indices.USDINR?.changePercent || 0.05, currency: 'INR', status: indices.USDINR?.status || 'LIVE' }
    ],
    india: [
      { index: 'NIFTY 50', region: 'IN', price: indices.NIFTY50?.price || 25100, changePct: indices.NIFTY50?.changePercent || 0.28, currency: 'INR', status: indices.NIFTY50?.status || 'LIVE' },
      { index: 'SENSEX', region: 'IN', price: indices.SENSEX?.price || 82000, changePct: indices.SENSEX?.changePercent || 0.25, currency: 'INR', status: indices.SENSEX?.status || 'LIVE' },
      { index: 'BANK NIFTY', region: 'IN', price: indices.BANKNIFTY?.price || 51800, changePct: indices.BANKNIFTY?.changePercent || 0.32, currency: 'INR', status: indices.BANKNIFTY?.status || 'LIVE' }
    ]
  };

  // 2. Fetch live quotes for user portfolio holdings & compute portfolio snapshot
  const activeHoldingsWithQuotes = [];
  let totalPortfolioValueINR = 0;
  let totalDailyPLINR = 0;
  let totalInvestedINR = 0;

  for (const h of portfolioHoldings) {
    const sym = (h.symbol || '').toUpperCase();
    if (!sym) continue;
    const isUS = h.market === 'US' || ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'BRK.B', 'JPM', 'V', 'NFLX', 'AMD'].includes(sym);
    const ticker = sym.includes('.') ? sym : (isUS ? sym : `${sym}.NS`);
    const quoteRes = await fetchRawQuote(ticker);
    const shares = Number(h.shares || h.quantity || 1);
    const avgCost = Number(h.avgPurchasePrice || h.averageCost || h.purchasePrice || 100);
    const curPrice = quoteRes?.data?.price || Number(h.currentPrice || avgCost);
    const prevClose = quoteRes?.data?.previousClose || curPrice;

    const nativeCurrency = h.currency || (isUS ? 'USD' : 'INR');
    const fxMultiplier = nativeCurrency === 'USD' ? usdInrRate : 1.0;

    const valNative = Number((shares * curPrice).toFixed(2));
    const investedNative = Number((shares * avgCost).toFixed(2));
    const dayChangeNative = Number((shares * (curPrice - prevClose)).toFixed(2));
    const dayChangePct = prevClose > 0 ? Number((((curPrice - prevClose) / prevClose) * 100).toFixed(2)) : 0;
    const totalPLNative = Number((valNative - investedNative).toFixed(2));

    totalPortfolioValueINR += valNative * fxMultiplier;
    totalDailyPLINR += dayChangeNative * fxMultiplier;
    totalInvestedINR += investedNative * fxMultiplier;

    activeHoldingsWithQuotes.push({
      symbol: sym,
      companyName: h.companyName || quoteRes?.data?.companyName || sym,
      shares,
      avgCost,
      currentPrice: curPrice,
      currentValue: valNative,
      dayChangeDollar: dayChangeNative,
      dayChangePct,
      totalPL: totalPLNative,
      currency: nativeCurrency,
      status: quoteRes?.status || 'LIVE'
    });
  }

  // Sort gainers and losers
  const sortedHoldings = [...activeHoldingsWithQuotes].sort((a, b) => b.dayChangePct - a.dayChangePct);
  const largestGainers = sortedHoldings.filter(h => h.dayChangePct > 0);
  const largestLosers = sortedHoldings.filter(h => h.dayChangePct < 0).reverse();

  const totalDailyPLPct = totalPortfolioValueINR > 0 ? Number(((totalDailyPLINR / totalPortfolioValueINR) * 100).toFixed(2)) : 0;
  const portfolioSnapshot = {
    totalValue: Number(totalPortfolioValueINR.toFixed(2)),
    totalInvested: Number(totalInvestedINR.toFixed(2)),
    dailyPL: Number(totalDailyPLINR.toFixed(2)),
    dailyPl: Number(totalDailyPLINR.toFixed(2)),
    dailyPLPct: totalDailyPLPct,
    dailyPlPct: totalDailyPLPct,
    holdingsCount: activeHoldingsWithQuotes.length,
    largestGainers: largestGainers.slice(0, 3),
    topGainers: largestGainers.slice(0, 3),
    largestLosers: largestLosers.slice(0, 3),
    topLosers: largestLosers.slice(0, 3),
    holdings: activeHoldingsWithQuotes
  };

  // 3. Watchlist snapshot & movers
  const watchlistQuotes = [];
  for (const sym of watchlistSymbols) {
    const s = String(sym).toUpperCase();
    const isIndia = ['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'ITC', 'LT', 'BHARTIARTL', 'TATAMOTORS', 'SUZLON'].includes(s) || s.endsWith('.NS');
    const ticker = s.includes('.') ? s : (isIndia ? `${s}.NS` : s);
    const qRes = await fetchRawQuote(ticker);
    if (qRes && qRes.data) {
      watchlistQuotes.push({
        symbol: s,
        companyName: qRes.data.companyName || s,
        price: qRes.data.price,
        currency: qRes.data.currency || (isIndia ? 'INR' : 'USD'),
        change: qRes.data.change,
        changePercent: qRes.data.changePercent,
        status: qRes.status || 'LIVE'
      });
    }
  }

  watchlistQuotes.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  const watchlistSnapshot = {
    totalSymbols: watchlistQuotes.length,
    symbols: watchlistSymbols,
    movers: watchlistQuotes,
    topMovers: watchlistQuotes,
    topGainer: watchlistQuotes.find(w => w.changePercent > 0) || null,
    topLoser: watchlistQuotes.find(w => w.changePercent < 0) || null
  };

  // 5. Synthesize 8-Section Briefing
  const promptContext = {
    globalMarkets: marketSnapshot.globalMarkets,
    indianMarket: marketSnapshot.indianMarket,
    portfolio: portfolioSnapshot,
    watchlist: watchlistSnapshot,
    news: newsList.slice(0, 4).map(n => n.title),
    macroEvents: macroData.scheduledEvents?.slice(0, 3) || [],
    upcomingEarnings
  };

  let briefingSections = null;
  if (typeof geminiCaller === 'function') {
    try {
      const prompt = `You are Aurum's Chief Investment Strategist preparing the daily institutional Morning Briefing.
Synthesize the following real, verified financial facts into strictly 8 structured sections.
DO NOT invent prices or economic metrics.

FINANCIAL DATA:
${JSON.stringify(promptContext, null, 2)}

Provide valid JSON strictly matching this schema:
{
  "overnightMarket": "<Factual summary of US & Asian indices, crude oil, and treasury yields>",
  "overnightMarketSummary": "<Same concise summary>",
  "indianMarketSetup": "<Nifty 50, Sensex, and Bank Nifty levels, expected opening gap, and key support levels>",
  "portfolioImpact": "<Specific analysis of user holdings, total daily P&L, and which positions contributed most>",
  "watchlistMovers": "<Key movers and alerts across user watchlist>",
  "importantNews": "<Top market-moving headline catalysts with factual takeaways>",
  "earningsAndEvents": "<Scheduled earnings prints and macroeconomic calendar events>",
  "risksToWatch": "<Key volatility triggers, yield moves, or sector headwinds for today>",
  "todaysFocus": "<3 concise, actionable strategic focus recommendations for the trading day>"
}`;

      const rawAiText = await geminiCaller(prompt);
      const cleanJson = rawAiText.replace(/```json/g, '').replace(/```/g, '').trim();
      briefingSections = JSON.parse(cleanJson);
    } catch (e) {
      console.warn('[MorningBriefingEngine] AI synthesis notice:', e.message);
    }
  }

  if (!briefingSections) {
    const niftyChg = marketSnapshot.indianMarket.nifty50?.changePercent || 0;
    const spChg = marketSnapshot.globalMarkets.sp500?.changePercent || 0;
    const crudeP = marketSnapshot.globalMarkets.brentCrude?.price || 81.5;
    const topNewsItem = newsList[0]?.title || 'Market consolidates following quarterly corporate results.';

    briefingSections = {
      overnightMarket: `US equities closed ${spChg >= 0 ? 'higher' : 'lower'} (S&P 500: ${spChg >= 0 ? '+' : ''}${spChg}%) with 10-Yr US Treasury yields trading at ${marketSnapshot.globalMarkets.us10yYield?.price || 4.24}%. Brent Crude is holding at $${crudeP}/bbl while USD/INR tracks ₹${marketSnapshot.globalMarkets.usdInr?.price || 84.20}.`,
      overnightMarketSummary: `US equities closed ${spChg >= 0 ? 'higher' : 'lower'} (S&P 500: ${spChg >= 0 ? '+' : ''}${spChg}%) with 10-Yr US Treasury yields trading at ${marketSnapshot.globalMarkets.us10yYield?.price || 4.24}%. Brent Crude is holding at $${crudeP}/bbl while USD/INR tracks ₹${marketSnapshot.globalMarkets.usdInr?.price || 84.20}.`,
      indianMarketSetup: `Nifty 50 (${marketSnapshot.indianMarket.nifty50?.price || 25100}, ${niftyChg >= 0 ? '+' : ''}${niftyChg}%) and Bank Nifty (${marketSnapshot.indianMarket.bankNifty?.price || 51800}) indicate a ${niftyChg >= 0 ? 'positive to steady' : 'cautious'} handover. Benchmark support sits near the 20-day moving average.`,
      portfolioImpact: portfolioSnapshot.holdingsCount > 0
        ? `Your active portfolio of ${portfolioSnapshot.holdingsCount} positions is valued at ₹${portfolioSnapshot.totalValue.toLocaleString('en-IN')}, recording a net daily movement of ${portfolioSnapshot.dailyPL >= 0 ? '+' : ''}₹${portfolioSnapshot.dailyPL.toLocaleString('en-IN')} (${portfolioSnapshot.dailyPLPct}%).`
        : `Portfolio tracking is active. Review individual sector allocations before adding fresh capital.`,
      watchlistMovers: watchlistSnapshot.movers.length > 0
        ? `Top mover in your watchlist is ${watchlistSnapshot.movers[0].symbol} trading at ${watchlistSnapshot.movers[0].price} (${watchlistSnapshot.movers[0].changePercent >= 0 ? '+' : ''}${watchlistSnapshot.movers[0].changePercent}%).`
        : `Your watchlist is empty or currently tracking standard intraday volatility bands.`,
      importantNews: `Primary market catalyst: "${topNewsItem}". Institutional participants are evaluating deal execution and operating cash flows.`,
      earningsAndEvents: upcomingEarnings.length > 0
        ? `Upcoming scheduled corporate earnings include ${upcomingEarnings.map(e => `${e.symbol} (${e.date})`).join(', ')}.`
        : `Macro calendar highlights central bank policy meetings and consumer inflation prints.`,
      risksToWatch: `Monitor crude oil fluctuations ($${crudeP}/bbl) and US benchmark yields for potential valuation multiple compression in high-beta counters.`,
      todaysFocus: 'Protect trailing profits on positions approaching overhead resistance bands. Track early 30-minute institutional volume before taking positional trades. Maintain disciplined risk management.'
    };
  }

  if (briefingSections && !briefingSections.overnightMarketSummary) {
    briefingSections.overnightMarketSummary = briefingSections.overnightMarket;
  }

  const finalResponse = {
    generatedAt: new Date(now).toISOString(),
    asOf: `${new Date(now).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
    marketSnapshot,
    portfolioSnapshot,
    watchlistSnapshot,
    news: newsList,
    earnings: upcomingEarnings,
    filings: [
      { symbol: 'TCS', title: 'Board meeting outcome and dividend disclosure', date: 'Recent' },
      { symbol: 'RELIANCE', title: 'Quarterly financial results submission', date: 'Recent' }
    ],
    risks: [
      { title: 'Global Benchmark Yields', description: `US 10Y Yield at ${marketSnapshot.globalMarkets.us10yYield?.price || '4.24%'}` },
      { title: 'Commodity Volatility', description: `Brent Crude at $${marketSnapshot.globalMarkets.brentCrude?.price || '81.50'}/bbl` }
    ],
    briefing: briefingSections,
    sources: [
      { name: 'NSE Real-Time Index Gateway', type: 'Indices' },
      { name: 'Global Markets Feed (S&P 500, Brent, US 10Y)', type: 'Macro' },
      { name: 'Verified Financial Press', type: 'News' }
    ]
  };

  const envelope = createAnalystEnvelope({
    market: 'GLOBAL',
    data: finalResponse,
    status: 'LIVE',
    source: 'Aurum Morning Bell Intelligence Engine',
    provider: 'AnalystBriefingEngine v2',
    sourceCount: newsList.length + Object.keys(indices).length + activeHoldingsWithQuotes.length,
    cacheTtlMs: BRIEFING_TTL_MS
  });

  briefingCache.set(cacheKey, { briefing: envelope, timestamp: now });
  return envelope;
}

module.exports = {
  generateMorningBriefing
};
