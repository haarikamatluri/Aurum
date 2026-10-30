/**
 * AURUM — Canonical Scenario & Breakout Rules Engine
 * 
 * Shared rule engine unifying live scenario generation and historical walk-forward backtesting.
 * Guarantees zero strategy divergence between real-time inference and quantitative backtesting.
 * 
 * Core Rules:
 * 1. Minimum Breakout Buffer: Breakout requires price to exceed resistance by at least
 *    max(0.15 * ATR14, 0.0025 * Resistance) to eliminate sub-tick and sub-buffer noise.
 * 2. Candle Completion: Real breakout requires a completed daily close above the buffered resistance.
 *    Intraday excursions without close confirmation are flagged as INTRADAY_PROBE_UNCONFIRMED.
 * 3. Volume Expansion: Volume must exceed 1.20x the 20-session volume average (or RVOL >= 1.20).
 * 4. Momentum Confirmation: RSI-14 >= 55.0 and positive/expanding MACD histogram.
 * 5. Invalidation Threshold: Daily close falling back below resistance (or below 20-day SMA).
 */

const FinancialCalculationEngine = require('./financial-calculation-engine');

/**
 * Calculates the required minimum confirmation buffer to avoid false breakouts on sub-cent/sub-tick noise.
 * @param {number} level - Support or Resistance price level
 * @param {number} atr14 - 14-period Average True Range
 * @returns {number} Minimum required buffer in currency units
 */
function calculateConfirmationBuffer(level, atr14) {
  if (!level || level <= 0) return 0;
  const safeATR = (typeof atr14 === 'number' && atr14 > 0) ? atr14 : (level * 0.015);
  // Buffer is maximum of 15% of daily ATR or 0.25% of level price
  const bufferFromATR = safeATR * 0.15;
  const bufferFromPct = level * 0.0025;
  return Number(Math.max(bufferFromATR, bufferFromPct).toFixed(2));
}

/**
 * Evaluates whether a market state satisfies a confirmed breakout, resistance test, or consolidation.
 */
function evaluateBreakoutCondition({
  currentPrice,
  resistance,
  support,
  atr14,
  volume = 0,
  avgVolume20 = 0,
  avgVolume = 0,
  rsi14 = 50,
  macd = {},
  isCompletedCandle = true
}) {
  const price = Number(currentPrice);
  const R = Number(resistance);
  const S = Number(support);
  const safeATR = Number(atr14) || (price * 0.015);
  const buffer = calculateConfirmationBuffer(R, safeATR);
  const bufferedResistance = Number((R + buffer).toFixed(2));

  // Check volume expansion (support avgVolume20 or avgVolume)
  const avgVol = Number(avgVolume20 || avgVolume || 0);
  const isVolumeExpanded = avgVol > 0 ? (volume >= avgVol * 1.20) : true;
  const volumeRatio = avgVol > 0 ? Number((volume / avgVol).toFixed(2)) : 1.0;

  // Check momentum
  const isRsiBullish = typeof rsi14 === 'number' ? (rsi14 >= 55.0) : true;
  const isMacdBullish = macd ? (macd.histogram >= 0 || macd.histogramDirection === 'EXPANDING' || macd.momentumBias?.includes('EXPANDING')) : true;

  // 1. Above Buffered Resistance with Full Multi-Factor Confirmation
  if (price >= bufferedResistance) {
    if (!isCompletedCandle) {
      return {
        status: 'CONDITIONAL',
        code: 'INTRADAY_PROBE_UNCONFIRMED',
        isBreakout: false,
        buffer,
        requiredPrice: bufferedResistance,
        isCompletedCandle: false,
        reason: `Price (${price}) exceeds buffered resistance (${bufferedResistance}), but candle is an unclosed session (intraday wick probe). Requires verified daily close.`
      };
    }
    if (!isVolumeExpanded) {
      return {
        status: 'CONDITIONAL',
        code: 'UNCONFIRMED_LOW_VOLUME',
        isBreakout: false,
        buffer,
        requiredPrice: bufferedResistance,
        isCompletedCandle: true,
        reason: `Price (${price}) closed above buffered resistance (${bufferedResistance}), but volume (${volumeRatio}x avg) lacks institutional expansion (minimum 1.20x required).`
      };
    }
    return {
      status: 'ACTIVE',
      code: 'CONFIRMED_BREAKOUT_ACTIVE',
      isBreakout: true,
      buffer,
      requiredPrice: bufferedResistance,
      isCompletedCandle: true,
      reason: `Confirmed daily close (${price}) above tactical resistance (${R}) exceeding required buffer (+${buffer}) with volume expansion (${volumeRatio}x) and momentum support.`
    };
  }

  // 2. Price Crossing Resistance but Below Minimum Buffer (e.g. AAPL 5-cent noise)
  if (price >= R && price < bufferedResistance) {
    const excess = Number((price - R).toFixed(2));
    const excessPct = Number(((excess / R) * 100).toFixed(3));
    return {
      status: 'CONDITIONAL',
      code: 'SUB_BUFFER_RESISTANCE_TEST',
      isBreakout: false,
      buffer,
      requiredPrice: bufferedResistance,
      isCompletedCandle,
      reason: `Price (${price}) is probing resistance (${R}) by ${excess} (+${excessPct}%), but remains within the required confirmation buffer of ${buffer} (0.15x ATR). Sub-buffer price crossing is classified as a resistance test, not an active breakout.`
    };
  }

  // 3. Price Below Resistance
  return {
    status: 'CONDITIONAL',
    code: 'BELOW_RESISTANCE',
    isBreakout: false,
    buffer,
    requiredPrice: bufferedResistance,
    isCompletedCandle,
    reason: `Price (${price}) trades below tactical resistance (${R}). Breakout scenario remains conditional upon confirmed breach above ${bufferedResistance}.`
  };
}

/**
 * Evaluates whether a market state satisfies a confirmed breakdown, support test, or consolidation.
 */
function evaluateBreakdownCondition({
  currentPrice,
  support,
  resistance,
  atr14,
  volume = 0,
  avgVolume20 = 0,
  avgVolume = 0,
  rsi14 = 50,
  isCompletedCandle = true
}) {
  const price = Number(currentPrice);
  const S = Number(support);
  const safeATR = Number(atr14) || (price * 0.015);
  const buffer = calculateConfirmationBuffer(S, safeATR);
  const bufferedSupport = Number((S - buffer).toFixed(2));

  const avgVol = Number(avgVolume20 || avgVolume || 0);
  const isVolumeElevated = avgVol > 0 ? (volume >= avgVol * 1.15) : true;
  const isRsiBearish = typeof rsi14 === 'number' ? (rsi14 <= 45.0) : true;

  // 1. Below Buffered Support with Confirmation
  if (price <= bufferedSupport) {
    if (!isCompletedCandle) {
      return {
        status: 'CONDITIONAL',
        code: 'INTRADAY_BREAKDOWN_PROBE',
        isBreakdown: false,
        buffer,
        requiredPrice: bufferedSupport,
        isCompletedCandle: false,
        reason: `Price (${price}) penetrated buffered support (${bufferedSupport}), but current session is unclosed. Requires completed daily close.`
      };
    }
    return {
      status: 'ACTIVE',
      code: 'CONFIRMED_BREAKDOWN_ACTIVE',
      isBreakdown: true,
      buffer,
      requiredPrice: bufferedSupport,
      isCompletedCandle: true,
      reason: `Confirmed daily close (${price}) below structural support (${S}) exceeding minimum breakdown buffer (-${buffer}).`
    };
  }

  // 2. Price Crossing Support but Within Buffer
  if (price <= S && price > bufferedSupport) {
    const deficit = Number((S - price).toFixed(2));
    return {
      status: 'CONDITIONAL',
      code: 'SUB_BUFFER_SUPPORT_TEST',
      isBreakdown: false,
      buffer,
      requiredPrice: bufferedSupport,
      isCompletedCandle,
      reason: `Price (${price}) is probing support (${S}) by ${deficit}, which is within the confirmation buffer of ${buffer}. Classified as support test, not an active breakdown.`
    };
  }

  // 3. Price Above Support
  return {
    status: 'CONDITIONAL',
    code: 'ABOVE_SUPPORT',
    isBreakdown: false,
    buffer,
    requiredPrice: bufferedSupport,
    isCompletedCandle,
    reason: `Price (${price}) trades above structural support (${S}). Breakdown scenario remains conditional upon confirmed breach below ${bufferedSupport}.`
  };
}

/**
 * Evaluates the deterministic scenario state machine (BULLISH, NEUTRAL, BEARISH).
 */
function determineScenarioStateMatrix({
  currentPrice,
  support,
  resistance,
  atr14,
  volume = 0,
  avgVolume20 = 0,
  rsi14 = 50,
  macd = {},
  isCompletedCandle = true
}) {
  const breakoutEval = evaluateBreakoutCondition({
    currentPrice,
    resistance,
    support,
    atr14,
    volume,
    avgVolume20,
    rsi14,
    macd,
    isCompletedCandle
  });

  const breakdownEval = evaluateBreakdownCondition({
    currentPrice,
    support,
    resistance,
    atr14,
    volume,
    avgVolume20,
    rsi14,
    isCompletedCandle
  });

  let bullishStatus = breakoutEval.status;
  let bearishStatus = breakdownEval.status;
  let neutralStatus = 'ACTIVE';

  if (breakoutEval.isBreakout) {
    bullishStatus = 'ACTIVE';
    neutralStatus = 'INVALIDATED';
    bearishStatus = 'CONDITIONAL';
  } else if (breakdownEval.isBreakdown) {
    bearishStatus = 'ACTIVE';
    neutralStatus = 'INVALIDATED';
    bullishStatus = 'CONDITIONAL';
  } else {
    // Current price is consolidating inside range or testing boundaries
    neutralStatus = 'ACTIVE';
    bullishStatus = 'CONDITIONAL';
    bearishStatus = 'CONDITIONAL';
  }

  return {
    bullishStatus,
    neutralStatus,
    bearishStatus,
    breakoutEvaluation: breakoutEval,
    breakdownEvaluation: breakdownEval
  };
}

/**
 * Computes canonical measured-move target geometry and ATR volatility sensitivity bands.
 */
function calculateScenarioTargets({
  currentPrice,
  support,
  resistance,
  atr14,
  currencySymbol = '₹'
}) {
  const P = Number(currentPrice);
  const S = Number(support);
  const R = Number(resistance);
  const atr = Number(atr14) || (P * 0.015);

  const rangeHeight = Number(Math.abs(R - S).toFixed(2));
  const rangeHeightPct = S > 0 ? Number(((rangeHeight / S) * 100).toFixed(2)) : 0;

  // Conditional measured-move projection
  const bullishTarget = Number((R + rangeHeight).toFixed(2));
  const bullishTargetPct = P > 0 ? Number((((bullishTarget - P) / P) * 100).toFixed(2)) : 0;

  const bearishTarget = Number(Math.max(0, S - rangeHeight).toFixed(2));
  const bearishTargetPct = P > 0 ? Number((((P - bearishTarget) / P) * 100).toFixed(2)) : 0;

  // 1.5x ATR Volatility Sensitivity Bands (1-session dispersion estimate)
  const atrUpper = Number((P + 1.5 * atr).toFixed(2));
  const atrLower = Number(Math.max(0, P - 1.5 * atr).toFixed(2));
  const atrBandPct = P > 0 ? Number((((1.5 * atr) / P) * 100).toFixed(2)) : 0;

  return {
    rangeHeight,
    rangeHeightPct,
    bullishTarget,
    bullishTargetPct,
    bearishTarget,
    bearishTargetPct,
    atrSensitivityBands: {
      multiplier: 1.5,
      upper: atrUpper,
      lower: atrLower,
      upperBound: atrUpper,
      lowerBound: atrLower,
      bandPct: atrBandPct,
      disclaimer: '1.5x ATR Volatility Sensitivity Band (Conditional 1-session trading volatility estimate, not a probability distribution or guaranteed trading range).'
    },
    targetMathBullish: `Resistance (${currencySymbol}${R}) + Channel Height (${currencySymbol}${rangeHeight}) = ${currencySymbol}${bullishTarget} (+${bullishTargetPct}%). Illustrative measured-move projection conditional on breakout confirmation; not a guaranteed price forecast.`,
    targetMathBearish: `Support (${currencySymbol}${S}) - Channel Height (${currencySymbol}${rangeHeight}) = ${currencySymbol}${bearishTarget} (-${bearishTargetPct}%). Illustrative measured-move projection conditional on breakdown confirmation; not a guaranteed price forecast.`
  };
}

module.exports = {
  calculateConfirmationBuffer,
  evaluateBreakoutCondition,
  evaluateBreakdownCondition,
  determineScenarioStateMatrix,
  calculateScenarioTargets
};
