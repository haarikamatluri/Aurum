// ============================================================================
// Aurum Real Reconciliation Engine — External Broker vs Aurum DB
// Categorizes discrepancies: MATCHED, MISSING_IN_AURUM, MISSING_AT_BROKER, QUANTITY_MISMATCH, PRICE_MISMATCH, CASH_MISMATCH
// ============================================================================

const { roundCurrency } = require('./financial-math');

function performReconciliation(aurumHoldings = [], brokerHoldings = [], aurumCash = 0, brokerCash = 0) {
  const reports = [];
  const brokerMap = new Map();

  for (const bHold of brokerHoldings) {
    brokerMap.set(bHold.symbol.toUpperCase(), bHold);
  }

  const aurumSymbols = new Set();

  for (const aHold of aurumHoldings) {
    const sym = aHold.symbol.toUpperCase();
    aurumSymbols.add(sym);
    const bHold = brokerMap.get(sym);

    if (!bHold) {
      reports.push({
        symbol: sym,
        aurumQuantity: aHold.shares,
        brokerQuantity: 0,
        aurumAvgPrice: aHold.avgPurchasePrice,
        brokerAvgPrice: 0,
        status: 'MISSING_AT_BROKER',
        discrepancy: `Position held in Aurum (${aHold.shares} shares) does not exist at external broker.`
      });
      continue;
    }

    const qtyDiff = Math.abs(aHold.shares - bHold.quantity);
    const priceDiff = Math.abs(aHold.avgPurchasePrice - (bHold.avgPurchasePrice || bHold.avgPrice || 0));

    if (qtyDiff > 0.0001) {
      reports.push({
        symbol: sym,
        aurumQuantity: aHold.shares,
        brokerQuantity: bHold.quantity,
        aurumAvgPrice: aHold.avgPurchasePrice,
        brokerAvgPrice: bHold.avgPurchasePrice || bHold.avgPrice,
        status: 'QUANTITY_MISMATCH',
        discrepancy: `Quantity mismatch: Aurum has ${aHold.shares}, Broker has ${bHold.quantity}.`
      });
    } else if (priceDiff > 0.5) {
      reports.push({
        symbol: sym,
        aurumQuantity: aHold.shares,
        brokerQuantity: bHold.quantity,
        aurumAvgPrice: aHold.avgPurchasePrice,
        brokerAvgPrice: bHold.avgPurchasePrice || bHold.avgPrice,
        status: 'PRICE_MISMATCH',
        discrepancy: `Average price mismatch: Aurum average ₹${aHold.avgPurchasePrice}, Broker average ₹${bHold.avgPurchasePrice || bHold.avgPrice}.`
      });
    } else {
      reports.push({
        symbol: sym,
        aurumQuantity: aHold.shares,
        brokerQuantity: bHold.quantity,
        aurumAvgPrice: aHold.avgPurchasePrice,
        brokerAvgPrice: bHold.avgPurchasePrice || bHold.avgPrice,
        status: 'MATCHED',
        discrepancy: null
      });
    }
  }

  // Check for holdings present at broker but missing in Aurum
  for (const bHold of brokerHoldings) {
    const sym = bHold.symbol.toUpperCase();
    if (!aurumSymbols.has(sym)) {
      reports.push({
        symbol: sym,
        aurumQuantity: 0,
        brokerQuantity: bHold.quantity,
        aurumAvgPrice: 0,
        brokerAvgPrice: bHold.avgPurchasePrice || bHold.avgPrice,
        status: 'MISSING_IN_AURUM',
        discrepancy: `Position held at broker (${bHold.quantity} shares of ${sym}) is missing in Aurum DB.`
      });
    }
  }

  const cashDiff = Math.abs(aurumCash - brokerCash);
  const cashStatus = cashDiff > 10.0 ? 'CASH_MISMATCH' : 'MATCHED';

  const mismatchCount = reports.filter((r) => r.status !== 'MATCHED').length + (cashStatus === 'CASH_MISMATCH' ? 1 : 0);

  return {
    status: mismatchCount === 0 ? 'RECONCILED' : 'DISCREPANCY_DETECTED',
    reconciledAt: new Date().toISOString(),
    matchedCount: reports.filter((r) => r.status === 'MATCHED').length,
    mismatchCount,
    cashStatus,
    aurumCash: roundCurrency(aurumCash),
    brokerCash: roundCurrency(brokerCash),
    details: reports
  };
}

module.exports = {
  performReconciliation
};
