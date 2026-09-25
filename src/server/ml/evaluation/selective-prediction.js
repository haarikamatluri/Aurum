// ============================================================================
// Aurum Selective Prediction Evaluator & Confidence Curve Generator
// Evaluates performance at 80%, 85%, 90%, 92.5%, 95%, 97.5% confidence hurdles
// CRITICAL LAW: Never report confidence-filtered accuracy without reporting coverage
// ============================================================================

const CONFIDENCE_LEVELS = [0.80, 0.85, 0.90, 0.925, 0.95, 0.975];

/**
 * Computes standard classification and financial metrics for a set of selective predictions
 */
function evaluateSelectivePredictions(predictionsWithActuals) {
  const totalSamples = predictionsWithActuals.length;
  if (totalSamples === 0) {
    return {
      coveragePct: 0,
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1: 0,
      tradeCount: 0,
      winRatePct: 0,
      profitFactor: 0,
      sharpeRatio: 0
    };
  }

  // Filter out rows where the model elected NO_TRADE
  const activeTrades = predictionsWithActuals.filter((p) => p.signal === 'BUY' || p.signal === 'SELL');
  const tradeCount = activeTrades.length;
  const coveragePct = Math.round((tradeCount / totalSamples) * 1000) / 10; // e.g. 14.5%

  if (tradeCount === 0) {
    return {
      coveragePct: 0,
      tradeCount: 0,
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1: 0,
      winRatePct: 0,
      profitFactor: 0,
      sharpeRatio: 0
    };
  }

  let truePositives = 0;
  let falsePositives = 0;
  let trueNegatives = 0;
  let falseNegatives = 0;

  const tradeReturns = [];
  let grossProfits = 0;
  let grossLosses = 0;

  for (const t of activeTrades) {
    const isBullish = t.signal === 'BUY';
    const actualUp = t.actualDirection > 0;
    const futureRet = t.futureReturn1D || 0;

    // Financial outcome of the trade:
    // If BUY, return is futureRet; if SELL, return is -futureRet
    const pnlRet = isBullish ? futureRet : -futureRet;
    tradeReturns.push(pnlRet);

    if (pnlRet > 0) {
      grossProfits += pnlRet;
    } else {
      grossLosses += Math.abs(pnlRet);
    }

    if (isBullish) {
      if (actualUp) truePositives++;
      else falsePositives++;
    } else {
      if (!actualUp) trueNegatives++;
      else falseNegatives++;
    }
  }

  const correctPredictions = truePositives + trueNegatives;
  const accuracy = Math.round((correctPredictions / tradeCount) * 1000) / 1000;
  const precision = (truePositives + falsePositives > 0)
    ? Math.round((truePositives / (truePositives + falsePositives)) * 1000) / 1000
    : 0;
  const recall = (truePositives + falseNegatives > 0)
    ? Math.round((truePositives / (truePositives + falseNegatives)) * 1000) / 1000
    : 0;
  const f1 = (precision + recall > 0)
    ? Math.round((2 * precision * recall / (precision + recall)) * 1000) / 1000
    : 0;

  const wins = tradeReturns.filter((r) => r > 0).length;
  const winRatePct = Math.round((wins / tradeCount) * 1000) / 10;
  const profitFactor = grossLosses > 0 ? Math.round((grossProfits / grossLosses) * 100) / 100 : grossProfits > 0 ? 10.0 : 0.0;

  // Annualized Sharpe approximation of selective trade returns
  const meanRet = tradeReturns.reduce((a, b) => a + b, 0) / tradeCount;
  const variance = tradeReturns.reduce((sum, r) => sum + Math.pow(r - meanRet, 2), 0) / (tradeCount - 1 || 1);
  const std = Math.sqrt(Math.max(1e-8, variance));
  const sharpeRatio = std > 0 ? Math.round(((meanRet / std) * Math.sqrt(252)) * 100) / 100 : 0.0;

  return {
    totalSamples,
    tradeCount,
    coveragePct,
    accuracy,
    precision,
    recall,
    f1,
    winRatePct,
    profitFactor,
    sharpeRatio,
    meanReturnPct: Math.round(meanRet * 100) / 100
  };
}

/**
 * Generates the full Confidence Curve across thresholds (80% to 97.5%)
 */
function generateConfidenceCurve(ensemble, dataset) {
  const curve = [];

  for (const threshold of CONFIDENCE_LEVELS) {
    const predictions = [];

    for (const row of dataset) {
      const evalRes = ensemble.evaluateFeatures(row, threshold);
      predictions.push({
        signal: evalRes.signal,
        confidence: evalRes.calibratedConfidence,
        actualDirection: row.targetBinary,
        futureReturn1D: row.futureReturn1D
      });
    }

    const metrics = evaluateSelectivePredictions(predictions);
    curve.push({
      threshold: Math.round(threshold * 1000) / 10, // e.g. 80.0%, 90.0%
      thresholdValue: threshold,
      ...metrics
    });
  }

  return curve;
}

module.exports = {
  CONFIDENCE_LEVELS,
  evaluateSelectivePredictions,
  generateConfidenceCurve
};
