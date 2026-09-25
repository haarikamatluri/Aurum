// ============================================================================
// Aurum ML Target Generator — Directional 1D Return Target
// Definition: target[t] = 1 if close[t+1] > close[t] else 0
// Final row t = N-1 has no t+1 observation -> excluded
// ============================================================================

const TARGET_NAME = 'DIRECTIONAL_1D_RETURN_POSITIVE';
const TARGET_VERSION = 'target-v1.0.0';

/**
 * Computes directional target for candle sequence.
 * @param {Array} featureRows - Array of objects with close prices and features
 * @returns {Array} - Array of rows with target property attached. Final row excluded.
 */
function generateTargets(featureRows) {
  if (!featureRows || featureRows.length < 2) {
    throw new Error('Target generation requires at least 2 consecutive rows.');
  }

  const labeledData = [];
  let positiveCount = 0;
  let negativeCount = 0;

  // Process rows from 0 to N-2. Row N-1 cannot have a target because t+1 does not exist yet.
  for (let t = 0; t < featureRows.length - 1; t++) {
    const current = featureRows[t];
    const next = featureRows[t + 1];

    const currentClose = current.close;
    const nextClose = next.close;

    if (currentClose <= 0 || nextClose <= 0) {
      throw new Error(`Invalid non-positive close price at row ${t} or ${t + 1}`);
    }

    const nextReturn = (nextClose - currentClose) / currentClose;
    const target = nextReturn > 0 ? 1 : 0;

    if (target === 1) positiveCount++;
    else negativeCount++;

    labeledData.push({
      ...current,
      nextDate: next.date,
      nextClose,
      nextReturnPct: Math.round(nextReturn * 10000) / 100,
      target
    });
  }

  return {
    labeledData,
    summary: {
      targetName: TARGET_NAME,
      targetVersion: TARGET_VERSION,
      totalRowsWithTarget: labeledData.length,
      excludedFinalRowDate: featureRows[featureRows.length - 1].date,
      positiveCount,
      negativeCount,
      positiveRatio: Math.round((positiveCount / labeledData.length) * 1000) / 1000,
      negativeRatio: Math.round((negativeCount / labeledData.length) * 1000) / 1000
    }
  };
}

module.exports = {
  TARGET_NAME,
  TARGET_VERSION,
  generateTargets
};
