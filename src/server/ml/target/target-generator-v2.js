// ============================================================================
// Aurum Target Generator v2
// Target v1: Directional 1D Binary (NEXT_DAY_UP)
// Target v2: Three-Class Selective Prediction (BUY / HOLD / SELL) with Cost Hurdle
// ============================================================================

const TARGET_VERSION_V2 = 'target-v2.0.0';

// Default transaction cost & slippage hurdle: 0.50% (50 basis points)
const DEFAULT_BUY_HURDLE_PCT = 0.50;
const DEFAULT_SELL_HURDLE_PCT = -0.50;

/**
 * Generates forward-looking targets for chronological supervised training.
 * Excludes the final row because its future outcome t+1 is genuinely unobservable.
 */
function generateTargetsV2(candlesWithFeatures, buyHurdle = DEFAULT_BUY_HURDLE_PCT, sellHurdle = DEFAULT_SELL_HURDLE_PCT) {
  if (!candlesWithFeatures || candlesWithFeatures.length < 2) {
    throw new Error('Target generation requires at least 2 rows.');
  }

  const datasetWithTargets = [];
  let buyCount = 0;
  let holdCount = 0;
  let sellCount = 0;
  let binaryUpCount = 0;

  for (let i = 0; i < candlesWithFeatures.length - 1; i++) {
    const current = candlesWithFeatures[i];
    const next = candlesWithFeatures[i + 1];

    const currentClose = current.close;
    const nextClose = next.close;

    if (!currentClose || !nextClose || currentClose <= 0) {
      continue;
    }

    // 1D percentage return at t+1: ((close[t+1] - close[t]) / close[t]) * 100
    const rawFutureReturn = ((nextClose - currentClose) / currentClose) * 100;
    const futureReturn1D = Math.round(rawFutureReturn * 1000) / 1000;

    // Target v1: Binary Directional (1 if up, 0 if down or flat)
    const targetBinary = futureReturn1D > 0 ? 1 : 0;
    if (targetBinary === 1) binaryUpCount++;

    // Target v2: Three-Class Selective with Transaction Cost Hurdle
    let targetClass = 0; // 0 = HOLD / NO_TRADE
    let targetLabel = 'HOLD';

    if (futureReturn1D >= buyHurdle) {
      targetClass = 1; // +1 = BUY
      targetLabel = 'BUY';
      buyCount++;
    } else if (futureReturn1D <= sellHurdle) {
      targetClass = -1; // -1 = SELL
      targetLabel = 'SELL';
      sellCount++;
    } else {
      holdCount++;
    }

    datasetWithTargets.push({
      ...current,
      futureClose1D: nextClose,
      futureReturn1D,
      targetBinary,
      targetClass,
      targetLabel,
      targetVersion: TARGET_VERSION_V2
    });
  }

  const total = datasetWithTargets.length;
  const meta = {
    targetVersion: TARGET_VERSION_V2,
    totalLabeledRows: total,
    excludedFinalDate: candlesWithFeatures[candlesWithFeatures.length - 1].date,
    buyHurdlePct: buyHurdle,
    sellHurdlePct: sellHurdle,
    distribution: {
      buyCount,
      buyRatio: Math.round((buyCount / total) * 1000) / 1000,
      holdCount,
      holdRatio: Math.round((holdCount / total) * 1000) / 1000,
      sellCount,
      sellRatio: Math.round((sellCount / total) * 1000) / 1000,
      binaryUpRatio: Math.round((binaryUpCount / total) * 1000) / 1000
    }
  };

  return { dataset: datasetWithTargets, meta };
}

module.exports = {
  TARGET_VERSION_V2,
  DEFAULT_BUY_HURDLE_PCT,
  DEFAULT_SELL_HURDLE_PCT,
  generateTargetsV2
};
