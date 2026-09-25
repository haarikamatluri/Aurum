/**
 * AURUM AI Analyst — Data Contract & Normalization Layer
 * Provides standardized AnalystDataEnvelope for all financial intelligence features.
 */

/**
 * Creates an AnalystDataEnvelope wrapping real financial data.
 * @param {Object} params
 * @param {string} [params.symbol] - Stock ticker (e.g., 'TCS', 'AAPL')
 * @param {string} [params.market] - 'IN' | 'US' | 'GLOBAL'
 * @param {any} params.data - The payload (quote, technicals, report, filings, earnings, etc.)
 * @param {'LIVE' | 'CACHED' | 'STALE' | 'UNAVAILABLE'} [params.status='LIVE']
 * @param {string} [params.source='Aurum Intelligence OS'] - Name of data source
 * @param {string} [params.sourceUrl] - Link to authoritative data or exchange disclosure
 * @param {string} [params.provider='Internal'] - Upstream API or calculation engine
 * @param {string} [params.query] - Query or instrument identifier used
 * @param {number} [params.sourceCount] - Number of aggregated sources
 * @param {number} [params.cacheTtlMs=60000] - Cache freshness window in milliseconds
 * @param {string} [params.retrievedAt] - Timestamp when raw data was fetched
 * @returns {AnalystDataEnvelope}
 */
function createAnalystEnvelope({
  symbol,
  market = 'IN',
  data,
  status = 'LIVE',
  source = 'Market Data Provider',
  sourceUrl,
  provider = 'Aurum Market Engine',
  query,
  sourceCount = 1,
  cacheTtlMs = 60000,
  retrievedAt
}) {
  const now = new Date();
  const fetchTime = retrievedAt ? new Date(retrievedAt) : now;
  const ageMs = Math.max(0, now.getTime() - fetchTime.getTime());
  const freshnessSeconds = Math.round(ageMs / 1000);

  // If age exceeds TTL by more than 3x and status was LIVE/CACHED, mark as STALE
  let finalStatus = status;
  if (data === null || data === undefined) {
    finalStatus = 'UNAVAILABLE';
  } else if (ageMs > cacheTtlMs * 3 && (finalStatus === 'LIVE' || finalStatus === 'CACHED')) {
    finalStatus = 'STALE';
  } else if (finalStatus === 'LIVE' && ageMs > cacheTtlMs) {
    finalStatus = 'CACHED';
  }

  // Format human readable asOf in IST or Local
  const asOf = fetchTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata'
  }) + ' IST';

  return {
    symbol: symbol ? String(symbol).toUpperCase() : undefined,
    market: market ? String(market).toUpperCase() : undefined,
    timestamp: now.toISOString(),
    asOf,
    freshness: freshnessSeconds,
    source,
    sourceUrl,
    data,
    status: finalStatus,
    provenance: {
      provider,
      retrievedAt: fetchTime.toISOString(),
      query: query || symbol,
      sourceCount: Number(sourceCount) || 1
    }
  };
}

module.exports = {
  createAnalystEnvelope
};
