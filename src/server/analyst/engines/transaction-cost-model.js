/**
 * AURUM — Institutional Financial Transaction Cost & Regulatory Tax Model
 * 
 * Provides explicit, statutory cost calculation for Indian Equities (NSE/BSE)
 * and US Equities (NASDAQ/NYSE).
 * 
 * Complies with Indian statutory tax schedules:
 * - STT: 0.1% delivery buy & sell, 0.025% intraday sell
 * - Exchange Turnover Charges (NSE: 0.00297%, BSE: 0.00375%)
 * - SEBI Turnover Charges: ₹10 per crore (0.0001%)
 * - GST: 18% on (Brokerage + Exchange Charges + SEBI Charges)
 * - Stamp Duty: 0.015% on Buy (Delivery), 0.003% on Buy (Intraday)
 * - Slippage: Configurable (default 0.05% per leg for liquid large-caps)
 * 
 * Complies with US regulatory schedules:
 * - SEC Section 31 Fee: 0.00278% of sell transaction principal
 * - FINRA Trading Activity Fee (TAF): $0.000166 per share sold (max $8.30)
 * - Brokerage: $0 retail (default) or $0.005/share (pro)
 * - Slippage: Configurable (default 0.02% per leg for liquid large-caps)
 */

function calculateTransactionCosts({
  market = 'IN',
  symbol = '',
  tradeType = 'DELIVERY',     // 'DELIVERY' | 'INTRADAY'
  brokerType = 'DISCOUNT',    // 'DISCOUNT' | 'FULL_SERVICE'
  entryPrice = 100,
  exitPrice = 105,
  shares = 100,
  orderValue = null,
  slippagePct = null
}) {
  const symClean = String(symbol || '').toUpperCase().replace(/\.(NS|BO|O|N)$/i, '');
  const isIndian = market === 'IN' || ['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'SBIN', 'ICICIBANK', 'WIPRO'].includes(symClean);

  const effectiveShares = orderValue && entryPrice > 0 ? Math.max(1, Math.floor(orderValue / entryPrice)) : Math.max(1, shares);
  const buyValue = Number((entryPrice * effectiveShares).toFixed(2));
  const sellValue = Number((exitPrice * effectiveShares).toFixed(2));
  const turnover = Number((buyValue + sellValue).toFixed(2));

  if (isIndian) {
    const defaultSlippage = slippagePct !== null ? slippagePct : 0.05; // 0.05% per leg
    const slippageCost = Number(((buyValue * (defaultSlippage / 100)) + (sellValue * (defaultSlippage / 100))).toFixed(2));

    // 1. Brokerage
    let brokerageBuy = 0;
    let brokerageSell = 0;
    if (brokerType === 'DISCOUNT') {
      if (tradeType === 'INTRADAY') {
        brokerageBuy = Math.min(20, buyValue * 0.0003);
        brokerageSell = Math.min(20, sellValue * 0.0003);
      } else {
        brokerageBuy = 0; // ₹0 delivery commission
        brokerageSell = 0;
      }
    } else {
      brokerageBuy = buyValue * 0.0025; // 0.25% full service
      brokerageSell = sellValue * 0.0025;
    }
    const brokerageTotal = Number((brokerageBuy + brokerageSell).toFixed(2));

    // 2. Securities Transaction Tax (STT)
    let stt = 0;
    if (tradeType === 'DELIVERY') {
      stt = Math.round(buyValue * 0.001) + Math.round(sellValue * 0.001); // 0.1% on buy AND sell
    } else {
      stt = Math.round(sellValue * 0.00025); // 0.025% on sell only
    }

    // 3. Exchange Transaction Charges (NSE: 0.00297%)
    const exchangeTurnoverCharge = Number((turnover * 0.0000297).toFixed(2));

    // 4. SEBI Turnover Charges: ₹10 per crore (0.0001%)
    const sebiCharges = Number((turnover * 0.000001).toFixed(2));

    // 5. GST: 18% on (Brokerage + Exchange Charges + SEBI Charges)
    const gst = Number((0.18 * (brokerageTotal + exchangeTurnoverCharge + sebiCharges)).toFixed(2));

    // 6. Stamp Duty: 0.015% on Buy (Delivery), 0.003% on Buy (Intraday)
    const stampDuty = Number((tradeType === 'DELIVERY' ? buyValue * 0.00015 : buyValue * 0.00003).toFixed(2));

    // Statutory Total
    const statutoryFees = Number((stt + exchangeTurnoverCharge + sebiCharges + gst + stampDuty).toFixed(2));
    const totalCosts = Number((brokerageTotal + statutoryFees + slippageCost).toFixed(2));
    const totalCostPct = buyValue > 0 ? Number(((totalCosts / buyValue) * 100).toFixed(3)) : 0;

    return {
      market: 'IN',
      exchange: 'NSE',
      currency: 'INR',
      currencySymbol: '₹',
      tradeType,
      brokerType,
      shares: effectiveShares,
      buyValue,
      sellValue,
      turnover,
      brokerage: brokerageTotal,
      stt,
      exchangeTurnoverCharge,
      sebiCharges,
      gst,
      stampDuty,
      statutoryFeesTotal: statutoryFees,
      slippageCost,
      totalCosts,
      totalCostPct,
      breakdown: {
        brokeragePct: Number(((brokerageTotal / buyValue) * 100).toFixed(3)),
        sttPct: Number(((stt / buyValue) * 100).toFixed(3)),
        statutoryPct: Number(((statutoryFees / buyValue) * 100).toFixed(3)),
        slippagePct: Number(((slippageCost / buyValue) * 100).toFixed(3))
      }
    };
  } else {
    // US Equities (NASDAQ / NYSE)
    const defaultSlippage = slippagePct !== null ? slippagePct : 0.02; // 0.02% per leg
    const slippageCost = Number(((buyValue * (defaultSlippage / 100)) + (sellValue * (defaultSlippage / 100))).toFixed(2));

    // 1. Brokerage
    const brokerageTotal = brokerType === 'FULL_SERVICE' ? Number((Math.max(1.0, effectiveShares * 0.005 * 2)).toFixed(2)) : 0;

    // 2. SEC Section 31 Fee: 0.00278% of sell leg
    const secFee = Number((sellValue * 0.0000278).toFixed(4));

    // 3. FINRA Trading Activity Fee (TAF): $0.000166 per share sold (max $8.30)
    const finraTaf = Number((Math.min(8.30, effectiveShares * 0.000166)).toFixed(4));

    const statutoryFees = Number((secFee + finraTaf).toFixed(2));
    const totalCosts = Number((brokerageTotal + statutoryFees + slippageCost).toFixed(2));
    const totalCostPct = buyValue > 0 ? Number(((totalCosts / buyValue) * 100).toFixed(3)) : 0;

    return {
      market: 'US',
      exchange: 'NASDAQ',
      currency: 'USD',
      currencySymbol: '$',
      tradeType,
      brokerType,
      shares: effectiveShares,
      buyValue,
      sellValue,
      turnover,
      brokerage: brokerageTotal,
      secFee,
      finraTaf,
      statutoryFeesTotal: statutoryFees,
      slippageCost,
      totalCosts,
      totalCostPct,
      breakdown: {
        brokeragePct: Number(((brokerageTotal / buyValue) * 100).toFixed(3)),
        regulatoryPct: Number(((statutoryFees / buyValue) * 100).toFixed(3)),
        slippagePct: Number(((slippageCost / buyValue) * 100).toFixed(3))
      }
    };
  }
}

module.exports = {
  calculateTransactionCosts
};
