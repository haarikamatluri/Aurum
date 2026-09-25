// ============================================================================
// Aurum ML Walk-Forward Chronological Split & Performance Metrics Engine
// Splits:
//   TRAIN:      2019-01-01 to 2023-12-31
//   VALIDATION: 2024-01-01 to 2024-12-31
//   TEST:       2025-01-01 to 2025-12-31
// Zero lookahead, strictly chronological.
// ============================================================================

const SPLIT_CONFIG = {
  train: { start: '2019-01-01', end: '2023-12-31' },
  validation: { start: '2024-01-01', end: '2024-12-31' },
  test: { start: '2025-01-01', end: '2025-12-31' }
};

/**
 * Splits dataset chronologically into train, validation, and test partitions.
 */
function splitChronological(dataset) {
  const train = [];
  const validation = [];
  const test = [];

  for (const row of dataset) {
    const d = row.date;
    if (d >= SPLIT_CONFIG.train.start && d <= SPLIT_CONFIG.train.end) {
      train.push(row);
    } else if (d >= SPLIT_CONFIG.validation.start && d <= SPLIT_CONFIG.validation.end) {
      validation.push(row);
    } else if (d >= SPLIT_CONFIG.test.start && d <= SPLIT_CONFIG.test.end) {
      test.push(row);
    }
  }

  // Strict chronological assertion: max(train) < min(val) and max(val) < min(test)
  if (train.length === 0 || validation.length === 0 || test.length === 0) {
    throw new Error(`Insufficient data for partition split: train=${train.length}, val=${validation.length}, test=${test.length}`);
  }

  const maxTrain = train[train.length - 1].date;
  const minVal = validation[0].date;
  const maxVal = validation[validation.length - 1].date;
  const minTest = test[0].date;

  if (maxTrain >= minVal) {
    throw new Error(`Chronological boundary leakage: maxTrain (${maxTrain}) >= minVal (${minVal})`);
  }
  if (maxVal >= minTest) {
    throw new Error(`Chronological boundary leakage: maxVal (${maxVal}) >= minTest (${minTest})`);
  }

  return {
    train,
    validation,
    test,
    boundaries: {
      train: { start: train[0].date, end: maxTrain, count: train.length },
      validation: { start: minVal, end: maxVal, count: validation.length },
      test: { start: minTest, end: test[test.length - 1].date, count: test.length }
    }
  };
}

/**
 * Computes standard classification metrics.
 * @param {Array} actual - ground truth labels (0 or 1)
 * @param {Array} predicted - model predicted labels (0 or 1)
 */
function computeClassificationMetrics(actual, predicted) {
  if (actual.length !== predicted.length || actual.length === 0) {
    throw new Error('Input arrays must have equal positive length');
  }

  let tp = 0; // True Positive
  let fp = 0; // False Positive
  let tn = 0; // True Negative
  let fn = 0; // False Negative

  for (let i = 0; i < actual.length; i++) {
    const y = actual[i];
    const yHat = predicted[i];
    if (y === 1 && yHat === 1) tp++;
    else if (y === 0 && yHat === 1) fp++;
    else if (y === 0 && yHat === 0) tn++;
    else if (y === 1 && yHat === 0) fn++;
  }

  const total = actual.length;
  const accuracy = (tp + tn) / total;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // Balanced accuracy: (Sensitivity + Specificity) / 2
  const sensitivity = recall;
  const specificity = (tn + fp) > 0 ? tn / (tn + fp) : 0;
  const balancedAccuracy = (sensitivity + specificity) / 2;

  return {
    sampleCount: total,
    confusionMatrix: { tp, fp, tn, fn },
    accuracy: Math.round(accuracy * 1000) / 1000,
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1Score: Math.round(f1 * 1000) / 1000,
    balancedAccuracy: Math.round(balancedAccuracy * 1000) / 1000
  };
}

/**
 * Computes strategy performance metrics from return sequence.
 * @param {Array} strategyDailyReturns - daily returns of the strategy in decimal
 * @param {number} riskFreeRateAnnual - annual risk free rate (default 5.0%)
 */
function computeTradingMetrics(strategyDailyReturns, riskFreeRateAnnual = 0.05) {
  if (!strategyDailyReturns || strategyDailyReturns.length === 0) {
    return { sharpeRatio: 0, maxDrawdownPct: 0, winRate: 0, cagr: 0 };
  }

  const n = strategyDailyReturns.length;
  const meanReturn = strategyDailyReturns.reduce((a, b) => a + b, 0) / n;
  const variance = strategyDailyReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (n - 1 || 1);
  const dailyStd = Math.sqrt(Math.max(0, variance));

  // Annualized metrics (252 trading days)
  const dailyRiskFree = riskFreeRateAnnual / 252;
  const excessDailyReturn = meanReturn - dailyRiskFree;
  const annualizedSharpe = dailyStd > 0 ? (excessDailyReturn / dailyStd) * Math.sqrt(252) : 0;

  // Max Drawdown calculation
  let peak = 1.0;
  let equity = 1.0;
  let maxDd = 0.0;
  let wins = 0;
  let tradeDays = 0;

  for (const r of strategyDailyReturns) {
    if (r !== 0) tradeDays++;
    if (r > 0) wins++;
    equity = equity * (1 + r);
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDd) maxDd = dd;
  }

  const years = n / 252;
  const cagr = years > 0 ? Math.pow(equity, 1 / years) - 1 : equity - 1;
  const winRate = tradeDays > 0 ? wins / tradeDays : 0;

  return {
    tradingDays: n,
    cagr: Math.round(cagr * 1000) / 10, // in %
    sharpeRatio: Math.round(annualizedSharpe * 100) / 100,
    maxDrawdownPct: Math.round(maxDd * 1000) / 10,
    winRate: Math.round(winRate * 1000) / 1000,
    finalEquityMultiple: Math.round(equity * 100) / 100
  };
}

module.exports = {
  SPLIT_CONFIG,
  splitChronological,
  computeClassificationMetrics,
  computeTradingMetrics
};
