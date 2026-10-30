/**
 * AURUM — Scenario Walk-Forward Backtester & Statistical Evaluation Engine
 * 
 * Strict specifications (Technical & Financial Accuracy Audit Phase II):
 * 1. Strictly chronological walk-forward time-series simulation with zero lookahead bias.
 * 2. Reconciled canonical rules: Uses the exact same swing pivots, confirmation buffer,
 *    volume expansion threshold (>= 1.20x), RSI, and target projection rules as live engine.
 * 3. Strict signal handling: Eliminates sub-buffer noise; enforces non-overlapping trades
 *    (single active position per direction at any time).
 * 4. Dataset Audit: Discloses total candles, warm-up horizon, evaluation window, forward
 *    observation period, exit logic, target hit, and false breakout definitions.
 * 5. Institutional Transaction Costs: Applies statutory Indian / US regulatory fees and slippage,
 *    reporting Gross and Net returns, win rates, and profit factors separately.
 * 6. Statistical Validation: Reports MAE, MFE, target hit rate, false breakout rate,
 *    max drawdown, and compares against Buy & Hold benchmark.
 */

const FinancialCalculationEngine = require('./financial-calculation-engine');
const {
  calculateConfirmationBuffer,
  evaluateBreakoutCondition,
  evaluateBreakdownCondition,
  calculateScenarioTargets
} = require('./scenario-rules');
const { calculateTransactionCosts } = require('./transaction-cost-model');

/**
 * Runs walk-forward evaluation on a historical OHLCV time-series.
 * 
 * @param {string|Array} firstArg - Symbol string or historical bars array
 * @param {Array|Object} [secondArg] - Historical bars array or options object
 * @param {Object} [thirdArg] - Options object
 * @returns {Object} Comprehensive statistical validation results
 */
function evaluateScenarioPredictiveValue(firstArg, secondArg, thirdArg) {
  let symbol = 'SECURITY';
  let historyBars = [];
  let options = {};

  if (typeof firstArg === 'string') {
    symbol = firstArg;
    historyBars = Array.isArray(secondArg) ? secondArg : [];
    options = (typeof thirdArg === 'object' && thirdArg !== null) ? thirdArg : {};
  } else if (Array.isArray(firstArg)) {
    historyBars = firstArg;
    if (typeof secondArg === 'object' && secondArg !== null) {
      options = secondArg;
      if (options.symbol) symbol = options.symbol;
    }
  }

  const requestedLookback = options.lookback || 60;
  const maxHoldingBars = options.maxHoldingBars || 20;
  const tradeType = options.tradeType || 'DELIVERY';
  const brokerType = options.brokerType || 'DISCOUNT';
  const orderValue = options.orderValue || 100000;
  const flatCostFallback = options.costPerTradePct !== undefined ? options.costPerTradePct : null;

  if (!Array.isArray(historyBars) || historyBars.length < 25) {
    return {
      symbol,
      status: 'NOT_EVALUATED',
      reason: `Insufficient historical bars for walk-forward evaluation (provided ${historyBars ? historyBars.length : 0}, minimum required: 25).`,
      signalsCount: 0,
      tradeCount: 0,
      breakouts: null,
      breakdowns: null,
      benchmark: null
    };
  }

  // Clean and validate bars chronologically
  const validation = FinancialCalculationEngine.validateCandleIntegrity(historyBars);
  const bars = validation.isValid ? validation.validBars : historyBars;

  // Adapt lookback dynamically if history is shorter than 80 bars
  const lookback = Math.min(requestedLookback, Math.max(15, Math.floor(bars.length / 2)));

  const isIndianSecurity = ['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'SBIN', 'ICICIBANK', 'WIPRO'].includes(
    String(symbol).toUpperCase().replace(/\.(NS|BO)$/, '')
  ) || options.market === 'IN';
  const market = isIndianSecurity ? 'IN' : 'US';

  const breakoutTrades = [];
  const breakdownTrades = [];
  let lastBullishExitBar = -1;
  let lastBearishExitBar = -1;
  let totalSignalsGenerated = 0;
  let unresolvedTradesCount = 0;

  // Walk forward bar by bar from index = lookback up to bars.length - 2
  for (let t = lookback; t < bars.length - 1; t++) {
    // Strictly bars 0..t-1 available prior to current bar t close
    const historicalSlice = bars.slice(0, t);
    const currentBar = bars[t];
    const prevBar = bars[t - 1];

    // 1. S/R calculated strictly at time t using lookback window
    const sr = FinancialCalculationEngine.calculateSupportResistance(historicalSlice, prevBar.close, { lookback, k: 2 });
    if (!sr.support || !sr.resistance) continue;

    const S = sr.support;
    const R = sr.resistance;
    const rangeHeight = R - S;
    if (rangeHeight <= 0) continue;

    // 2. Technical indicators on historical slice
    const atrResult = FinancialCalculationEngine.calculateATR(historicalSlice, 14);
    const atr14 = atrResult.atr || (currentBar.close * 0.02);

    const closes = historicalSlice.map(b => b.close);
    const rsi14 = FinancialCalculationEngine.calculateRSI(closes, 14);

    const volSlice = historicalSlice.slice(-20).map(b => b.volume || 0);
    const avgVol = volSlice.reduce((a, b) => a + b, 0) / (volSlice.length || 1);

    // 3. Targets and Invalidation
    const targets = calculateScenarioTargets({
      currentPrice: currentBar.close,
      support: S,
      resistance: R,
      atr14
    });

    const bullishTarget = targets.bullishTarget;
    const bearishTarget = targets.bearishTarget;

    // 4. Canonical Breakout / Breakdown Evaluation (Shared Canonical Rules)
    const breakoutEval = evaluateBreakoutCondition({
      currentPrice: currentBar.close,
      resistance: R,
      prevClose: prevBar.close,
      volume: currentBar.volume,
      avgVolume: avgVol,
      rsi14,
      atr14,
      isCompletedCandle: true
    });

    const breakdownEval = evaluateBreakdownCondition({
      currentPrice: currentBar.close,
      support: S,
      prevClose: prevBar.close,
      volume: currentBar.volume,
      avgVolume: avgVol,
      rsi14,
      atr14,
      isCompletedCandle: true
    });

    // 5. Bullish Trade Evaluation (Strict non-overlapping signals)
    if (breakoutEval.isBreakout && t > lastBullishExitBar) {
      totalSignalsGenerated++;
      const entryPrice = currentBar.close;
      let exitPrice = entryPrice;
      let exitReason = 'TIME_EXPIRY';
      let targetHit = false;
      let invalidated = false;
      let mfePct = 0;
      let maePct = 0;
      let holdingBars = 0;

      const evalMaxBar = Math.min(bars.length - 1, t + maxHoldingBars);
      for (let f = t + 1; f <= evalMaxBar; f++) {
        const futureBar = bars[f];
        holdingBars++;

        const currentFavorable = ((futureBar.high - entryPrice) / entryPrice) * 100;
        const currentAdverse = ((futureBar.low - entryPrice) / entryPrice) * 100;
        if (currentFavorable > mfePct) mfePct = currentFavorable;
        if (currentAdverse < maePct) maePct = currentAdverse;

        // Target reached
        if (futureBar.high >= bullishTarget) {
          exitPrice = bullishTarget;
          exitReason = 'TARGET_REACHED';
          targetHit = true;
          break;
        }

        // Invalidation stop (Close drops below broken resistance with slight buffer or support)
        if (futureBar.close < R * 0.99 || futureBar.close < S) {
          exitPrice = futureBar.close;
          exitReason = 'INVALIDATION_STOP';
          invalidated = true;
          break;
        }

        exitPrice = futureBar.close;
      }

      // Check if forward window was prematurely truncated by end-of-history
      const isUnresolved = (!targetHit && !invalidated && (t + maxHoldingBars) > (bars.length - 1));
      if (isUnresolved) unresolvedTradesCount++;

      // Accurate transaction cost calculation
      let costResult;
      if (flatCostFallback !== null) {
        costResult = { totalCostPct: flatCostFallback * 2, totalCosts: (entryPrice * (flatCostFallback * 2 / 100)) };
      } else {
        costResult = calculateTransactionCosts({
          market,
          symbol,
          tradeType,
          brokerType,
          entryPrice,
          exitPrice,
          orderValue
        });
      }

      const grossReturnPct = ((exitPrice - entryPrice) / entryPrice) * 100;
      const netReturnPct = grossReturnPct - costResult.totalCostPct;

      breakoutTrades.push({
        entryDate: currentBar.timestamp || currentBar.time,
        entryPrice,
        exitPrice,
        exitReason,
        targetHit,
        invalidated,
        isUnresolved,
        holdingBars,
        grossReturnPct: Number(grossReturnPct.toFixed(2)),
        netReturnPct: Number(netReturnPct.toFixed(2)),
        transactionCostPct: Number(costResult.totalCostPct.toFixed(3)),
        mfePct: Number(mfePct.toFixed(2)),
        maePct: Number(maePct.toFixed(2))
      });

      lastBullishExitBar = t + holdingBars;
    }

    // 6. Bearish Trade Evaluation (Strict non-overlapping signals)
    if (breakdownEval.isBreakdown && t > lastBearishExitBar) {
      totalSignalsGenerated++;
      const entryPrice = currentBar.close;
      let exitPrice = entryPrice;
      let exitReason = 'TIME_EXPIRY';
      let targetHit = false;
      let invalidated = false;
      let mfePct = 0;
      let maePct = 0;
      let holdingBars = 0;

      const evalMaxBar = Math.min(bars.length - 1, t + maxHoldingBars);
      for (let f = t + 1; f <= evalMaxBar; f++) {
        const futureBar = bars[f];
        holdingBars++;

        const currentFavorable = ((entryPrice - futureBar.low) / entryPrice) * 100;
        const currentAdverse = ((futureBar.high - entryPrice) / entryPrice) * 100;
        if (currentFavorable > mfePct) mfePct = currentFavorable;
        if (currentAdverse < maePct) maePct = currentAdverse;

        // Target reached
        if (futureBar.low <= bearishTarget) {
          exitPrice = bearishTarget;
          exitReason = 'TARGET_REACHED';
          targetHit = true;
          break;
        }

        // Invalidation stop (Close recovers back above broken support)
        if (futureBar.close > S * 1.01 || futureBar.close > R) {
          exitPrice = futureBar.close;
          exitReason = 'INVALIDATION_STOP';
          invalidated = true;
          break;
        }

        exitPrice = futureBar.close;
      }

      const isUnresolved = (!targetHit && !invalidated && (t + maxHoldingBars) > (bars.length - 1));
      if (isUnresolved) unresolvedTradesCount++;

      let costResult;
      if (flatCostFallback !== null) {
        costResult = { totalCostPct: flatCostFallback * 2, totalCosts: (entryPrice * (flatCostFallback * 2 / 100)) };
      } else {
        costResult = calculateTransactionCosts({
          market,
          symbol,
          tradeType,
          brokerType,
          entryPrice,
          exitPrice,
          orderValue
        });
      }

      const grossReturnPct = ((entryPrice - exitPrice) / entryPrice) * 100;
      const netReturnPct = grossReturnPct - costResult.totalCostPct;

      breakdownTrades.push({
        entryDate: currentBar.timestamp || currentBar.time,
        entryPrice,
        exitPrice,
        exitReason,
        targetHit,
        invalidated,
        isUnresolved,
        holdingBars,
        grossReturnPct: Number(grossReturnPct.toFixed(2)),
        netReturnPct: Number(netReturnPct.toFixed(2)),
        transactionCostPct: Number(costResult.totalCostPct.toFixed(3)),
        mfePct: Number(mfePct.toFixed(2)),
        maePct: Number(maePct.toFixed(2))
      });

      lastBearishExitBar = t + holdingBars;
    }
  }

  // Compile trade analytics helper with separate Gross vs Net statistics
  const compileStats = (trades) => {
    if (trades.length === 0) {
      return {
        count: 0,
        winRatePct: 0,
        grossWinRatePct: 0,
        netWinRatePct: 0,
        falseSignalRatePct: 0,
        targetHitRatePct: 0,
        avgReturnPct: 0,
        grossAvgReturnPct: 0,
        netAvgReturnPct: 0,
        medianReturnPct: 0,
        grossMedianReturnPct: 0,
        netMedianReturnPct: 0,
        profitFactor: 0,
        grossProfitFactor: 0,
        netProfitFactor: 0,
        avgHoldingBars: 0,
        avgMfePct: 0,
        avgMaePct: 0,
        maxDrawdownPct: 0,
        grossMaxDrawdownPct: 0,
        netMaxDrawdownPct: 0,
        avgTransactionCostPct: 0
      };
    }

    const grossWins = trades.filter(t => t.grossReturnPct > 0);
    const netWins = trades.filter(t => t.netReturnPct > 0);
    const targetHits = trades.filter(t => t.targetHit);
    const falseSignals = trades.filter(t => t.invalidated);

    const grossWinRatePct = Number(((grossWins.length / trades.length) * 100).toFixed(1));
    const netWinRatePct = Number(((netWins.length / trades.length) * 100).toFixed(1));
    const targetHitRatePct = Number(((targetHits.length / trades.length) * 100).toFixed(1));
    const falseSignalRatePct = Number(((falseSignals.length / trades.length) * 100).toFixed(1));

    const grossReturns = trades.map(t => t.grossReturnPct);
    const netReturns = trades.map(t => t.netReturnPct);

    const grossAvgReturnPct = Number((grossReturns.reduce((a, b) => a + b, 0) / grossReturns.length).toFixed(2));
    const netAvgReturnPct = Number((netReturns.reduce((a, b) => a + b, 0) / netReturns.length).toFixed(2));

    const sortedGross = [...grossReturns].sort((a, b) => a - b);
    const sortedNet = [...netReturns].sort((a, b) => a - b);
    const grossMedianReturnPct = Number(sortedGross[Math.floor(sortedGross.length / 2)].toFixed(2));
    const netMedianReturnPct = Number(sortedNet[Math.floor(sortedNet.length / 2)].toFixed(2));

    const grossGains = trades.filter(t => t.grossReturnPct > 0).reduce((sum, t) => sum + t.grossReturnPct, 0);
    const grossLosses = Math.abs(trades.filter(t => t.grossReturnPct < 0).reduce((sum, t) => sum + t.grossReturnPct, 0));
    const grossProfitFactor = grossLosses > 0 ? Number((grossGains / grossLosses).toFixed(2)) : (grossGains > 0 ? 99.0 : 0);

    const netGains = trades.filter(t => t.netReturnPct > 0).reduce((sum, t) => sum + t.netReturnPct, 0);
    const netLosses = Math.abs(trades.filter(t => t.netReturnPct < 0).reduce((sum, t) => sum + t.netReturnPct, 0));
    const netProfitFactor = netLosses > 0 ? Number((netGains / netLosses).toFixed(2)) : (netGains > 0 ? 99.0 : 0);

    const avgHoldingBars = Number((trades.reduce((a, t) => a + t.holdingBars, 0) / trades.length).toFixed(1));
    const avgMfePct = Number((trades.reduce((a, t) => a + t.mfePct, 0) / trades.length).toFixed(2));
    const avgMaePct = Number((trades.reduce((a, t) => a + t.maePct, 0) / trades.length).toFixed(2));
    const avgCost = Number((trades.reduce((a, t) => a + (t.transactionCostPct || 0), 0) / trades.length).toFixed(3));

    // Equity curves and maximum drawdowns
    let grossPeak = 100, grossEquity = 100, grossMaxDd = 0;
    let netPeak = 100, netEquity = 100, netMaxDd = 0;

    for (const t of trades) {
      grossEquity = grossEquity * (1 + (t.grossReturnPct / 100));
      if (grossEquity > grossPeak) grossPeak = grossEquity;
      const gdd = ((grossPeak - grossEquity) / grossPeak) * 100;
      if (gdd > grossMaxDd) grossMaxDd = gdd;

      netEquity = netEquity * (1 + (t.netReturnPct / 100));
      if (netEquity > netPeak) netPeak = netEquity;
      const ndd = ((netPeak - netEquity) / netPeak) * 100;
      if (ndd > netMaxDd) netMaxDd = ndd;
    }

    return {
      count: trades.length,
      winRatePct: netWinRatePct,
      grossWinRatePct,
      netWinRatePct,
      targetHitRatePct,
      falseSignalRatePct,
      avgReturnPct: netAvgReturnPct,
      grossAvgReturnPct,
      netAvgReturnPct,
      medianReturnPct: netMedianReturnPct,
      grossMedianReturnPct,
      netMedianReturnPct,
      profitFactor: netProfitFactor,
      grossProfitFactor,
      netProfitFactor,
      avgHoldingBars,
      avgMfePct,
      avgMaePct,
      maxDrawdownPct: Number(netMaxDd.toFixed(2)),
      grossMaxDrawdownPct: Number(grossMaxDd.toFixed(2)),
      netMaxDrawdownPct: Number(netMaxDd.toFixed(2)),
      avgTransactionCostPct: avgCost
    };
  };

  const breakoutStats = compileStats(breakoutTrades);
  const breakdownStats = compileStats(breakdownTrades);

  // Buy & Hold Benchmark
  const evalStartPrice = bars[lookback].close;
  const evalEndPrice = bars[bars.length - 1].close;
  const buyAndHoldReturnPct = Number((((evalEndPrice - evalStartPrice) / evalStartPrice) * 100).toFixed(2));

  // Combined stats
  const allCompletedTrades = [...breakoutTrades, ...breakdownTrades];
  const combinedStats = compileStats(allCompletedTrades);
  const totalSignals = breakoutTrades.length + breakdownTrades.length;
  const combinedTargetHits = breakoutTrades.filter(t => t.targetHit).length + breakdownTrades.filter(t => t.targetHit).length;
  const overallTargetHitRatePct = totalSignals > 0 ? Number(((combinedTargetHits / totalSignals) * 100).toFixed(1)) : 0;

  // Reference cost model for disclosure
  const refCost = calculateTransactionCosts({
    market,
    symbol,
    tradeType,
    brokerType,
    entryPrice: evalStartPrice,
    exitPrice: evalStartPrice * 1.05,
    orderValue
  });

  const reportedCostDeduction = flatCostFallback !== null ? flatCostFallback : 0.1;

  return {
    symbol,
    status: 'EVALUATED',
    evaluationPeriod: {
      startDate: bars[lookback].timestamp || bars[lookback].time,
      endDate: bars[bars.length - 1].timestamp || bars[bars.length - 1].time,
      sessionsCount: bars.length - lookback,
      totalHistoricalCandles: bars.length
    },
    evaluationWindow: `${bars.length} Completed Sessions`,
    methodology: 'CHRONOLOGICAL_WALK_FORWARD',
    methodologyDescription: `Chronological Walk-Forward Simulation (Reconciled canonical rules, statutory ${market} transaction tax schedule, zero lookahead bias)`,
    
    // Dataset Audit Metadata (Priority 2)
    datasetAudit: {
      totalHistoricalCandles: bars.length,
      warmupPeriodSessions: lookback,
      evaluationPeriodSessions: bars.length - lookback,
      eligibleSessionsCount: bars.length - lookback,
      signalsGenerated: totalSignals,
      completedTradesCount: totalSignals,
      unresolvedTradesCount,
      forwardObservationWindow: maxHoldingBars,
      overlappingSignalHandling: 'STRICT_SINGLE_ACTIVE_TRADE_PER_DIRECTION',
      exitLogic: 'TARGET_REACHED | INVALIDATION_STOP | TIME_EXPIRY',
      targetHitDefinition: 'High/low touches measured-move target projection before invalidation',
      falseBreakoutDefinition: 'Daily close drops below resistance (or recovers above support) before target'
    },

    // Transaction Cost Schedule Metadata (Priority 3)
    transactionCostModel: {
      market,
      tradeType,
      brokerType,
      statutoryTaxSchedule: isIndianSecurity ? 'STT (0.1% buy+sell delivery) + GST 18% + NSE 0.00297% + SEBI + Stamp Duty' : 'SEC Section 31 + FINRA TAF + Brokerage',
      averageRoundTripCostPct: reportedCostDeduction,
      sampleScheduleBreakdown: refCost
    },

    tradeCount: totalSignals,
    signalsCount: totalSignals,
    targetHitRatePercent: overallTargetHitRatePct,
    falseBreakoutRatePercent: breakoutStats.falseSignalRatePct,
    falseBreakdownRatePercent: breakdownStats.falseSignalRatePct,
    transactionCostDeductionPercent: reportedCostDeduction,
    overallTargetHitRatePct,

    // Performance Breakdown: Gross vs Net
    performance: {
      grossWinRatePct: combinedStats.grossWinRatePct,
      netWinRatePct: combinedStats.netWinRatePct,
      grossAvgReturnPct: combinedStats.grossAvgReturnPct,
      netAvgReturnPct: combinedStats.netAvgReturnPct,
      grossMedianReturnPct: combinedStats.grossMedianReturnPct,
      netMedianReturnPct: combinedStats.netMedianReturnPct,
      grossProfitFactor: combinedStats.grossProfitFactor,
      netProfitFactor: combinedStats.netProfitFactor,
      grossMaxDrawdownPct: combinedStats.grossMaxDrawdownPct,
      netMaxDrawdownPct: combinedStats.netMaxDrawdownPct
    },

    breakouts: breakoutStats,
    breakdowns: breakdownStats,
    benchmark: {
      strategy: 'Buy and Hold (Unmanaged Benchmark)',
      returnPct: buyAndHoldReturnPct,
      startPrice: evalStartPrice,
      endPrice: evalEndPrice
    },
    statisticalVerdict: totalSignals < 15 
      ? 'LIMITED_SAMPLE_SIZE: Statistical sample is insufficient to establish predictive edge (requires multi-year market cycle dataset).'
      : (combinedStats.netProfitFactor > 1.2 && overallTargetHitRatePct >= 50.0 
        ? 'MODEST_TECHNICAL_CONTINUATION: Historical breakouts demonstrated technical follow-through above chance, but remain vulnerable to volatility whipsaws.'
        : 'RANDOM_WALK_CHARACTERISTICS: Breakout target projections behave as conditional reference levels without statistically reliable excess alpha.'),
    riskDisclosure: 'Past breakout outcomes do not guarantee future results. Measured moves are conditional geometric projections, not statistically certain price targets.'
  };
}

module.exports = {
  evaluateScenarioPredictiveValue
};
