// ============================================================================
// Aurum Financial Precision Math Helper
// Prevents IEEE 754 floating-point errors (e.g. 0.1 + 0.2 = 0.30000000000000004)
// ============================================================================

function roundCurrency(val, decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((Number(val) + Number.EPSILON) * factor) / factor;
}

function multiplyCurrency(qty, price, decimals = 2) {
  const q = Number(qty) || 0;
  const p = Number(price) || 0;
  return roundCurrency(q * p, decimals);
}

function computeFees(totalValue, feePct = 0.001, decimals = 2) {
  return roundCurrency(totalValue * feePct, decimals);
}

function computePnL(shares, avgPrice, currentPrice, decimals = 2) {
  const s = Number(shares) || 0;
  const avg = Number(avgPrice) || 0;
  const cur = Number(currentPrice) || 0;
  const pnl = roundCurrency(s * (cur - avg), decimals);
  const invested = roundCurrency(s * avg, decimals);
  const pnlPct = invested > 0 ? roundCurrency((pnl / invested) * 100, 2) : 0;
  return { pnl, pnlPct };
}

module.exports = {
  roundCurrency,
  multiplyCurrency,
  computeFees,
  computePnL
};
