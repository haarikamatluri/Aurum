/**
 * AURUM Security Master & Instrument Directory
 * Resolves symbols across global exchanges, Upstox instrument keys,
 * BSE scrip codes, and SEC EDGAR CIKs.
 */

const INSTRUMENT_DIRECTORY = {
  // Major Indian Equities (NSE & BSE)
  'TCS': {
    symbol: 'TCS',
    canonicalSymbol: 'TCS',
    companyName: 'Tata Consultancy Services Limited',
    market: 'IN',
    exchange: 'NSE',
    currency: 'INR',
    isin: 'INE467B01029',
    upstoxInstrumentKey: 'NSE_EQ|INE467B01029',
    bseScripCode: '532540',
    yahooTicker: 'TCS.NS',
    screenerSlug: 'TCS'
  },
  'RELIANCE': {
    symbol: 'RELIANCE',
    canonicalSymbol: 'RELIANCE',
    companyName: 'Reliance Industries Limited',
    market: 'IN',
    exchange: 'NSE',
    currency: 'INR',
    isin: 'INE002A01018',
    upstoxInstrumentKey: 'NSE_EQ|INE002A01018',
    bseScripCode: '500325',
    yahooTicker: 'RELIANCE.NS',
    screenerSlug: 'RELIANCE'
  },
  'INFY': {
    symbol: 'INFY',
    canonicalSymbol: 'INFY',
    companyName: 'Infosys Limited',
    market: 'IN',
    exchange: 'NSE',
    currency: 'INR',
    isin: 'INE009A01021',
    upstoxInstrumentKey: 'NSE_EQ|INE009A01021',
    bseScripCode: '500209',
    yahooTicker: 'INFY.NS',
    screenerSlug: 'INFY',
    cik: '0001065837'
  },
  'HDFCBANK': {
    symbol: 'HDFCBANK',
    canonicalSymbol: 'HDFCBANK',
    companyName: 'HDFC Bank Limited',
    market: 'IN',
    exchange: 'NSE',
    currency: 'INR',
    isin: 'INE040A01034',
    upstoxInstrumentKey: 'NSE_EQ|INE040A01034',
    bseScripCode: '500180',
    yahooTicker: 'HDFCBANK.NS',
    screenerSlug: 'HDFCBANK'
  },
  'ICICIBANK': {
    symbol: 'ICICIBANK',
    canonicalSymbol: 'ICICIBANK',
    companyName: 'ICICI Bank Limited',
    market: 'IN',
    exchange: 'NSE',
    currency: 'INR',
    isin: 'INE090A01021',
    upstoxInstrumentKey: 'NSE_EQ|INE090A01021',
    bseScripCode: '532174',
    yahooTicker: 'ICICIBANK.NS',
    screenerSlug: 'ICICIBANK'
  },
  'SBIN': {
    symbol: 'SBIN',
    canonicalSymbol: 'SBIN',
    companyName: 'State Bank of India',
    market: 'IN',
    exchange: 'NSE',
    currency: 'INR',
    isin: 'INE062A01020',
    upstoxInstrumentKey: 'NSE_EQ|INE062A01020',
    bseScripCode: '500112',
    yahooTicker: 'SBIN.NS',
    screenerSlug: 'SBIN'
  },
  'SUZLON': {
    symbol: 'SUZLON',
    canonicalSymbol: 'SUZLON',
    companyName: 'Suzlon Energy Limited',
    market: 'IN',
    exchange: 'NSE',
    currency: 'INR',
    isin: 'INE043D01016',
    upstoxInstrumentKey: 'NSE_EQ|INE043D01016',
    bseScripCode: '532667',
    yahooTicker: 'SUZLON.NS',
    screenerSlug: 'SUZLON'
  },
  'TATASTEEL': {
    symbol: 'TATASTEEL',
    canonicalSymbol: 'TATASTEEL',
    companyName: 'Tata Steel Limited',
    market: 'IN',
    exchange: 'NSE',
    currency: 'INR',
    isin: 'INE081A01020',
    upstoxInstrumentKey: 'NSE_EQ|INE081A01020',
    bseScripCode: '500470',
    yahooTicker: 'TATASTEEL.NS',
    screenerSlug: 'TATASTEEL'
  },
  'TATAMOTORS': {
    symbol: 'TATAMOTORS',
    canonicalSymbol: 'TATAMOTORS',
    companyName: 'Tata Motors Limited',
    market: 'IN',
    exchange: 'NSE',
    currency: 'INR',
    isin: 'INE155A01022',
    upstoxInstrumentKey: 'NSE_EQ|INE155A01022',
    bseScripCode: '500570',
    yahooTicker: 'TATAMOTORS.NS',
    screenerSlug: 'TATAMOTORS'
  },
  'WIPRO': {
    symbol: 'WIPRO',
    canonicalSymbol: 'WIPRO',
    companyName: 'Wipro Limited',
    market: 'IN',
    exchange: 'NSE',
    currency: 'INR',
    isin: 'INE075A01022',
    upstoxInstrumentKey: 'NSE_EQ|INE075A01022',
    bseScripCode: '507685',
    yahooTicker: 'WIPRO.NS',
    screenerSlug: 'WIPRO'
  },
  'ITC': {
    symbol: 'ITC',
    canonicalSymbol: 'ITC',
    companyName: 'ITC Limited',
    market: 'IN',
    exchange: 'NSE',
    currency: 'INR',
    isin: 'INE154A01025',
    upstoxInstrumentKey: 'NSE_EQ|INE154A01025',
    bseScripCode: '500875',
    yahooTicker: 'ITC.NS',
    screenerSlug: 'ITC'
  },
  'BHARTIARTL': {
    symbol: 'BHARTIARTL',
    canonicalSymbol: 'BHARTIARTL',
    companyName: 'Bharti Airtel Limited',
    market: 'IN',
    exchange: 'NSE',
    currency: 'INR',
    isin: 'INE397D01024',
    upstoxInstrumentKey: 'NSE_EQ|INE397D01024',
    bseScripCode: '532454',
    yahooTicker: 'BHARTIARTL.NS',
    screenerSlug: 'BHARTIARTL'
  },
  'LT': {
    symbol: 'LT',
    canonicalSymbol: 'LT',
    companyName: 'Larsen & Toubro Limited',
    market: 'IN',
    exchange: 'NSE',
    currency: 'INR',
    isin: 'INE018A01030',
    upstoxInstrumentKey: 'NSE_EQ|INE018A01030',
    bseScripCode: '500510',
    yahooTicker: 'LT.NS',
    screenerSlug: 'LT'
  },

  // US Equities (NASDAQ / NYSE)
  'AAPL': {
    symbol: 'AAPL',
    canonicalSymbol: 'AAPL',
    companyName: 'Apple Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    cik: '0000320193',
    yahooTicker: 'AAPL'
  },
  'MSFT': {
    symbol: 'MSFT',
    canonicalSymbol: 'MSFT',
    companyName: 'Microsoft Corporation',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    cik: '0000789019',
    yahooTicker: 'MSFT'
  },
  'NVDA': {
    symbol: 'NVDA',
    canonicalSymbol: 'NVDA',
    companyName: 'NVIDIA Corporation',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    cik: '0001045810',
    yahooTicker: 'NVDA'
  },
  'AMZN': {
    symbol: 'AMZN',
    canonicalSymbol: 'AMZN',
    companyName: 'Amazon.com, Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    cik: '0001018724',
    yahooTicker: 'AMZN'
  },
  'GOOGL': {
    symbol: 'GOOGL',
    canonicalSymbol: 'GOOGL',
    companyName: 'Alphabet Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    cik: '0001652044',
    yahooTicker: 'GOOGL'
  },
  'META': {
    symbol: 'META',
    canonicalSymbol: 'META',
    companyName: 'Meta Platforms, Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    cik: '0001326801',
    yahooTicker: 'META'
  },
  'TSLA': {
    symbol: 'TSLA',
    canonicalSymbol: 'TSLA',
    companyName: 'Tesla, Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    cik: '0001318605',
    yahooTicker: 'TSLA'
  }
};

const DYNAMIC_RESOLVED_CACHE = new Map();

/**
 * Resolve security metadata for any symbol or company name.
 * @param {string} symbol - Ticker or company name
 * @param {string} [marketHint] - 'IN' | 'US'
 * @returns {Object} Security master record
 */
function resolveSecurity(symbol, marketHint) {
  if (!symbol) return null;
  const raw = String(symbol).trim().toUpperCase();
  const clean = raw.replace(/\.(NS|BO|O|N)$/i, '');

  // Check static master first
  if (INSTRUMENT_DIRECTORY[clean]) {
    return { ...INSTRUMENT_DIRECTORY[clean] };
  }

  // Check dynamic cache
  if (DYNAMIC_RESOLVED_CACHE.has(clean)) {
    return { ...DYNAMIC_RESOLVED_CACHE.get(clean) };
  }

  // Detect market from suffix or hint
  const isIndia = marketHint === 'IN' || raw.endsWith('.NS') || raw.endsWith('.BO');
  const isUS = marketHint === 'US' || raw.endsWith('.O') || raw.endsWith('.N');
  const market = isIndia ? 'IN' : (isUS ? 'US' : (raw.length <= 4 && !raw.includes('.') ? 'US' : 'IN'));

  const resolved = {
    symbol: clean,
    canonicalSymbol: clean,
    companyName: clean,
    market,
    exchange: market === 'IN' ? 'NSE' : 'NASDAQ',
    currency: market === 'IN' ? 'INR' : 'USD',
    yahooTicker: market === 'IN' ? `${clean}.NS` : clean,
    upstoxInstrumentKey: market === 'IN' ? `NSE_EQ|${clean}` : null,
    bseScripCode: null,
    cik: null,
    screenerSlug: market === 'IN' ? clean : null
  };

  DYNAMIC_RESOLVED_CACHE.set(clean, resolved);
  return resolved;
}

module.exports = {
  INSTRUMENT_DIRECTORY,
  resolveSecurity
};
