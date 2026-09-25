// ============================================================================
// Aurum Quantitative Backtest Engine v2
// Realistic Execution: Commission, Slippage, Position Sizing, Max Drawdown,
// Sharpe, Sortino, Calmar, Profit Factor & Expectancy
// Benchmarks: BUY & HOLD vs AURUM V1 vs AURUM V2 BALANCED vs AURUM V2 HIGH-CONFIDENCE
// ============================================================================

const fs = require('fs');
const path = require('path');
const { generateBatchFeaturesV2 } = require('./features/feature-engineering-v2');
const { generateTargetsV2 } = require('./target/target-generator-v2');

class BacktestEngineV2 {
  constructor(options = {}) {
    this.initialCapital = options.initialCapital || 100000;
    this.commissionPct = options.commissionPct !== undefined ? options.commissionPct : 0.05; // 0.05% per trade
    this.slippagePct = options.slippagePct !== undefined ? options.slippagePct : 0.05;     // 0.05% slippage
    this.positionSizePct = options.positionSizePct || 0.25; // 25% of equity per trade
  }

  /**
   * Simulates strategy performance on test bars
   */
  simulateStrategy(strategyName, testBars, signalFunction) {
    let cash = this.initialCapital;
    let shares = 0;
    let portfolioValue = this.initialCapital;
    let peakValue = this.initialCapital;
    let maxDrawdownPct = 0;

    const trades = [];
    const equityCurve = [];
    const dailyReturns = [];
    let previousValue = this.initialCapital;

    for (let i = 0; i < testBars.length; i++) {
      const bar = testBars[i];
      const close = bar.close;
      const date = bar.date;

      // 1. Get strategy signal for this bar
      const signal = signalFunction(bar, i);

      // 2. Execute buy or sell order if signal triggered
      if (signal === 'BUY' && shares === 0 && cash > 0) {
        const alloc = cash * this.positionSizePct;
        const effectivePrice = close * (1 + this.slippagePct / 100);
        const qty = Math.floor(alloc / effectivePrice);
        if (qty > 0) {
          const cost = qty * effectivePrice;
          const comm = cost * (this.commissionPct / 100);
          cash -= (cost + comm);
          shares += qty;
          trades.push({ type: 'BUY', date, price: effectivePrice, shares: qty, cost, commission: comm });
        }
      } else if (signal === 'SELL' && shares > 0) {
        const effectivePrice = close * (1 - this.slippagePct / 100);
        const proceeds = shares * effectivePrice;
        const comm = proceeds * (this.commissionPct / 100);
        cash += (proceeds - comm);
        const lastBuy = trades.filter((t) => t.type === 'BUY').pop();
        const pnl = proceeds - comm - (lastBuy ? lastBuy.cost : 0);
        const pnlPct = lastBuy ? ((proceeds - comm - lastBuy.cost) / lastBuy.cost) * 100 : 0;
        trades.push({ type: 'SELL', date, price: effectivePrice, shares, pnl, pnlPct, commission: comm });
        shares = 0;
      }

      // Mark to market
      portfolioValue = Math.round((cash + (shares * close)) * 100) / 100;
      equityCurve.push({ date, portfolioValue, cash, shares });

      // Daily return
      const ret = (portfolioValue - previousValue) / previousValue;
      dailyReturns.push(ret);
      previousValue = portfolioValue;

      // Drawdown
      if (portfolioValue > peakValue) {
        peakValue = portfolioValue;
      }
      const dd = ((peakValue - portfolioValue) / peakValue) * 100;
      if (dd > maxDrawdownPct) {
        maxDrawdownPct = Math.round(dd * 100) / 100;
      }
    }

    // Final liquidation mark
    const finalClose = testBars[testBars.length - 1].close;
    const finalValue = Math.round((cash + (shares * finalClose)) * 100) / 100;
    const totalReturnPct = Math.round((((finalValue - this.initialCapital) / this.initialCapital) * 100) * 100) / 100;

    // Financial Metrics
    const completedTrades = trades.filter((t) => t.type === 'SELL');
    const winningTrades = completedTrades.filter((t) => t.pnl > 0);
    const losingTrades = completedTrades.filter((t) => t.pnl <= 0);

    const winRatePct = completedTrades.length > 0 ? Math.round((winningTrades.length / completedTrades.length) * 1000) / 10 : 0;
    const grossProfit = winningTrades.reduce((acc, t) => acc + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : grossProfit > 0 ? 10.0 : 0.0;

    const avgWin = winningTrades.length > 0 ? Math.round((grossProfit / winningTrades.length) * 100) / 100 : 0;
    const avgLoss = losingTrades.length > 0 ? Math.round((grossLoss / losingTrades.length) * 100) / 100 : 0;
    const expectancy = completedTrades.length > 0
      ? Math.round(((winRatePct / 100 * avgWin) - ((100 - winRatePct) / 100 * avgLoss)) * 100) / 100
      : 0;

    // Sharpe and Sortino ratios
    const meanDaily = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const varDaily = dailyReturns.reduce((s, r) => s + Math.pow(r - meanDaily, 2), 0) / (dailyReturns.length - 1 || 1);
    const stdDaily = Math.sqrt(Math.max(1e-8, varDaily));
    const sharpeRatio = stdDaily > 0 ? Math.round(((meanDaily / stdDaily) * Math.sqrt(252)) * 100) / 100 : 0;

    const downsideReturns = dailyReturns.filter((r) => r < 0);
    const downsideVar = downsideReturns.length > 0 ? downsideReturns.reduce((s, r) => s + Math.pow(r, 2), 0) / downsideReturns.length : 1e-8;
    const sortinoRatio = Math.sqrt(downsideVar) > 0 ? Math.round(((meanDaily / Math.sqrt(downsideVar)) * Math.sqrt(252)) * 100) / 100 : 0;

    const calmarRatio = maxDrawdownPct > 0 ? Math.round((totalReturnPct / maxDrawdownPct) * 100) / 100 : 0;

    return {
      strategyName,
      initialCapital: this.initialCapital,
      finalValue,
      totalReturnPct,
      maxDrawdownPct,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      totalTrades: completedTrades.length,
      winRatePct,
      profitFactor,
      expectancy,
      avgWin,
      avgLoss
    };
  }

  /**
   * Runs the 4-way comparative backtest across the untouched 2025 test dataset
   */
  runComparativeBacktest(testBars, v1ModelRunner, v2Ensemble) {
    // Strategy 1: Buy & Hold
    const buyAndHold = this.simulateStrategy('BUY_AND_HOLD', testBars, (bar, idx) => {
      return idx === 0 ? 'BUY' : 'HOLD';
    });

    // Strategy 2: Aurum v1 Decision Tree
    const v1Strategy = this.simulateStrategy('AURUM_V1_DECISION_TREE', testBars, (bar) => {
      try {
        const inf = v1ModelRunner.runInference('TCS', bar, bar.close);
        return inf.prediction === 'BULLISH' ? 'BUY' : inf.prediction === 'BEARISH' ? 'SELL' : 'HOLD';
      } catch {
        return 'HOLD';
      }
    });

    // Strategy 3: Aurum v2 Balanced Mode (75% confidence)
    const v2Balanced = this.simulateStrategy('AURUM_V2_BALANCED', testBars, (bar) => {
      try {
        const evalRes = v2Ensemble.evaluateFeatures(bar, 0.75);
        return evalRes.signal;
      } catch {
        return 'HOLD';
      }
    });

    // Strategy 4: Aurum v2 High-Confidence Selective Mode (85% confidence + agreement)
    const v2HighConfidence = this.simulateStrategy('AURUM_V2_HIGH_CONFIDENCE', testBars, (bar) => {
      try {
        const evalRes = v2Ensemble.evaluateFeatures(bar, 0.85);
        return evalRes.signal;
      } catch {
        return 'HOLD';
      }
    });

    return {
      testPeriod: `${testBars[0]?.date} to ${testBars[testBars.length - 1]?.date}`,
      totalBars: testBars.length,
      comparison: {
        buyAndHold,
        v1Strategy,
        v2Balanced,
        v2HighConfidence
      }
    };
  }
}

module.exports = BacktestEngineV2;
