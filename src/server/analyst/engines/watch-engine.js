/**
 * AURUM AI Analyst — Watch & Monitoring Engine
 * Defines, evaluates, and manages real monitoring conditions for securities.
 * Eliminates generic uncertainty statements from the Watch section.
 */

const WATCH_STATUSES = {
  ACTIVE_TRIGGERED: 'ACTIVE_TRIGGERED',
  ACTIVE_UNTRIGGERED: 'ACTIVE_UNTRIGGERED',
  AWAITING_CONFIGURATION: 'AWAITING_CONFIGURATION',
  INPUT_UNAVAILABLE: 'INPUT_UNAVAILABLE',
  EVALUATION_FAILED: 'EVALUATION_FAILED'
};

/**
 * Evaluates whether an operator and threshold are triggered by currentValue.
 */
function evaluateCondition(currentValue, operator, threshold) {
  if (currentValue === null || currentValue === undefined || threshold === null || threshold === undefined) {
    return null;
  }
  const curr = Number(currentValue);
  const thresh = Number(threshold);
  if (isNaN(curr) || isNaN(thresh)) return null;

  switch (operator) {
    case 'below':
    case 'crosses_below':
      return curr < thresh;
    case 'above':
    case 'crosses_above':
      return curr > thresh;
    case 'equals':
      return Math.abs(curr - thresh) < 0.001;
    default:
      return null;
  }
}

/**
 * Builds candidate and active watch rules grounded in verified evidence.
 */
function buildWatchConditions({
  symbol,
  currency = 'INR',
  quote = {},
  technicals = {},
  fundamentals = {},
  ledger = null,
  userConfiguredAlerts = []
}) {
  const sym = String(symbol || 'UNKNOWN').toUpperCase();
  const rules = [];
  const nowIso = new Date().toISOString();
  let counter = 1;

  const currentPrice = typeof quote.price === 'number' ? quote.price : null;
  const currUnit = quote.currency || currency || 'INR';

  // Helper to find evidence ID for a given category or metric
  const findEvidenceId = (predicate) => {
    if (!ledger) return null;
    const entries = ledger.getAll ? ledger.getAll() : (ledger.entries || []);
    const found = entries.find(predicate);
    return found ? found.id : null;
  };

  // 1. Technical Support Level Rule
  if (technicals && technicals.support) {
    const supportThreshold = Number(technicals.support);
    const supportEvId = findEvidenceId(e => e.metric && e.metric.includes('Support'));
    const isPriceAvailable = currentPrice !== null;
    let status = WATCH_STATUSES.INPUT_UNAVAILABLE;
    let isTriggered = false;

    if (isPriceAvailable && !isNaN(supportThreshold)) {
      isTriggered = currentPrice <= supportThreshold;
      status = isTriggered ? WATCH_STATUSES.ACTIVE_TRIGGERED : WATCH_STATUSES.ACTIVE_UNTRIGGERED;
    }

    rules.push({
      id: `WATCH-${String(counter++).padStart(3, '0')}`,
      symbol: sym,
      title: 'Tactical Price Support Breach',
      metric: 'price',
      operator: 'below',
      threshold: !isNaN(supportThreshold) ? supportThreshold : null,
      unit: currUnit,
      timeframe: 'daily',
      reason: `A daily close below support level at ${currUnit} ${supportThreshold} invalidates bullish technical structure.`,
      evidenceIds: supportEvId ? [supportEvId] : [],
      source: '60-Day Swing Pivot Cluster Calculation',
      lastEvaluatedAt: nowIso,
      currentValue: currentPrice,
      status,
      isTriggered,
      conditionText: `Price drops below ${currUnit} ${supportThreshold}`
    });
  }

  // 2. Technical Resistance Breakout Rule
  if (technicals && technicals.resistance) {
    const resistanceThreshold = Number(technicals.resistance);
    const resistanceEvId = findEvidenceId(e => e.metric && e.metric.includes('Resistance'));
    const isPriceAvailable = currentPrice !== null;
    let status = WATCH_STATUSES.INPUT_UNAVAILABLE;
    let isTriggered = false;

    if (isPriceAvailable && !isNaN(resistanceThreshold)) {
      isTriggered = currentPrice >= resistanceThreshold;
      status = isTriggered ? WATCH_STATUSES.ACTIVE_TRIGGERED : WATCH_STATUSES.ACTIVE_UNTRIGGERED;
    }

    rules.push({
      id: `WATCH-${String(counter++).padStart(3, '0')}`,
      symbol: sym,
      title: 'Overhead Resistance Breakout',
      metric: 'price',
      operator: 'above',
      threshold: !isNaN(resistanceThreshold) ? resistanceThreshold : null,
      unit: currUnit,
      timeframe: 'daily',
      reason: `A breakout above ${currUnit} ${resistanceThreshold} confirms momentum continuation toward higher price bands.`,
      evidenceIds: resistanceEvId ? [resistanceEvId] : [],
      source: '60-Day Swing Pivot Cluster Calculation',
      lastEvaluatedAt: nowIso,
      currentValue: currentPrice,
      status,
      isTriggered,
      conditionText: `Price breaks above ${currUnit} ${resistanceThreshold}`
    });
  }

  // 3. RSI Momentum Reversal Alert
  if (technicals && typeof technicals.rsi14 === 'number') {
    const rsiVal = technicals.rsi14;
    const rsiEvId = findEvidenceId(e => e.metric && e.metric.includes('RSI'));

    if (rsiVal < 35) {
      rules.push({
        id: `WATCH-${String(counter++).padStart(3, '0')}`,
        symbol: sym,
        title: 'Oversold RSI Rebound Monitor',
        metric: 'rsi',
        operator: 'crosses_above',
        threshold: 35.0,
        unit: 'points',
        timeframe: 'daily',
        reason: `RSI is currently oversold at ${rsiVal.toFixed(1)}; watch for crossing above 35.0 to confirm bullish momentum recovery.`,
        evidenceIds: rsiEvId ? [rsiEvId] : [],
        source: 'Calculated 14-Period RSI from Daily OHLCV',
        lastEvaluatedAt: nowIso,
        currentValue: Number(rsiVal.toFixed(1)),
        status: WATCH_STATUSES.ACTIVE_UNTRIGGERED,
        isTriggered: false,
        conditionText: 'RSI(14) crosses above 35.0'
      });
    } else if (rsiVal > 70) {
      rules.push({
        id: `WATCH-${String(counter++).padStart(3, '0')}`,
        symbol: sym,
        title: 'Overbought RSI Cooldown Monitor',
        metric: 'rsi',
        operator: 'crosses_below',
        threshold: 70.0,
        unit: 'points',
        timeframe: 'daily',
        reason: `RSI is elevated at ${rsiVal.toFixed(1)}; watch for crossing below 70.0 signaling tactical profit taking.`,
        evidenceIds: rsiEvId ? [rsiEvId] : [],
        source: 'Calculated 14-Period RSI from Daily OHLCV',
        lastEvaluatedAt: nowIso,
        currentValue: Number(rsiVal.toFixed(1)),
        status: WATCH_STATUSES.ACTIVE_UNTRIGGERED,
        isTriggered: false,
        conditionText: 'RSI(14) crosses below 70.0'
      });
    }
  }

  // 4. Incorporate any user-configured alerts if provided
  if (Array.isArray(userConfiguredAlerts) && userConfiguredAlerts.length > 0) {
    userConfiguredAlerts.forEach(uAlert => {
      const evalResult = evaluateCondition(currentPrice, uAlert.operator, uAlert.threshold);
      let status = WATCH_STATUSES.ACTIVE_UNTRIGGERED;
      let isTriggered = false;

      if (evalResult === null) {
        status = currentPrice === null ? WATCH_STATUSES.INPUT_UNAVAILABLE : WATCH_STATUSES.AWAITING_CONFIGURATION;
      } else {
        isTriggered = evalResult;
        status = isTriggered ? WATCH_STATUSES.ACTIVE_TRIGGERED : WATCH_STATUSES.ACTIVE_UNTRIGGERED;
      }

      rules.push({
        id: uAlert.id || `WATCH-${String(counter++).padStart(3, '0')}`,
        symbol: sym,
        title: uAlert.title || 'User Configured Price Alert',
        metric: uAlert.metric || 'price',
        operator: uAlert.operator || 'below',
        threshold: uAlert.threshold != null ? Number(uAlert.threshold) : null,
        unit: uAlert.unit || currUnit,
        timeframe: uAlert.timeframe || 'realtime',
        reason: uAlert.reason || 'User active notification threshold',
        evidenceIds: [],
        source: 'User Notification Configuration',
        lastEvaluatedAt: nowIso,
        currentValue: currentPrice,
        status,
        isTriggered,
        conditionText: `${uAlert.metric || 'Price'} ${uAlert.operator} ${uAlert.threshold}`
      });
    });
  }

  return rules;
}

module.exports = {
  buildWatchConditions,
  evaluateCondition,
  WATCH_STATUSES
};
