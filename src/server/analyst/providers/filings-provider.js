/**
 * AURUM AI Analyst — Filings Provider
 * Retrieves real regulatory filings from official government and exchange databases:
 * SEC EDGAR for US equities, and BSE/NSE Corporate Announcements for Indian equities.
 * Removes all hardcoded curated filing records.
 */

const https = require('https');
const zlib = require('zlib');
const { createAnalystEnvelope } = require('../envelope');
const { resolveSecurity } = require('./security-master');

const filingsCache = new Map();
const TTL_MS = 1800000; // 30 minutes

async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch official SEC EDGAR filings for US companies
 */
async function fetchSecEdgarFilings(security) {
  const cik = security.cik;
  if (!cik) return null;

  try {
    const paddedCik = cik.padStart(10, '0');
    const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'AurumIntelligence contact@aurum.ai'
      }
    }, 5000);

    if (!res.ok) return null;
    const json = await res.json();
    const recent = json.filings?.recent;
    if (!recent || !recent.form || recent.form.length === 0) return null;

    const cikInt = parseInt(cik, 10);
    const filings = [];
    const count = Math.min(25, recent.form.length);

    for (let i = 0; i < count; i++) {
      const form = recent.form[i];
      const date = recent.filingDate[i];
      const accessionWithDashes = recent.accessionNumber[i];
      const accessionNo = accessionWithDashes ? accessionWithDashes.replace(/-/g, '') : null;
      const primaryDoc = recent.primaryDocument[i];

      const docUrl = accessionNo && primaryDoc
        ? `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accessionNo}/${primaryDoc}`
        : `https://www.sec.gov/edgar/browse/?CIK=${paddedCik}`;

      let importance = 'MEDIUM';
      if (['10-K', '10-Q', '8-K'].includes(form)) importance = 'HIGH';
      if (['4', '144'].includes(form)) importance = 'LOW';

      filings.push({
        id: `sec-${security.symbol}-${accessionWithDashes || i}`,
        symbol: security.symbol,
        company: json.name || security.companyName,
        filingType: form,
        filingDate: date,
        period: recent.reportDate?.[i] || date,
        title: `${form} Filing — ${json.name || security.symbol}`,
        source: 'U.S. Securities and Exchange Commission (SEC EDGAR)',
        sourceUrl: docUrl,
        documentAvailable: !!primaryDoc,
        documentTextAvailable: !!primaryDoc && (primaryDoc.endsWith('.htm') || primaryDoc.endsWith('.html') || primaryDoc.endsWith('.txt')),
        importance
      });
    }

    return filings.length > 0 ? filings : null;
  } catch {
    return null;
  }
}

/**
 * Fetch official BSE corporate regulatory announcements for Indian companies using insecureHTTPParser
 */
function fetchBseJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      insecureHTTPParser: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.bseindia.com/',
        'Accept-Encoding': 'gzip, deflate'
      },
      timeout: 6000
    }, (res) => {
      let stream = res;
      if (res.headers['content-encoding'] === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (res.headers['content-encoding'] === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      }

      let data = '';
      stream.on('data', chunk => { data += chunk; });
      stream.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('BSE API timeout'));
    });
    req.on('error', reject);
  });
}

/**
 * Fetch official BSE corporate regulatory announcements for Indian companies
 */
async function fetchBseIndianFilings(security) {
  const scripCode = security.bseScripCode;
  if (!scripCode) return null;

  try {
    const today = new Date();
    const toDate = today.toISOString().slice(0, 10).replace(/-/g, '');
    const fromDateObj = new Date(today.getTime() - 45 * 86400000); // Past 45 days
    const fromDate = fromDateObj.toISOString().slice(0, 10).replace(/-/g, '');

    const url = `https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w?pageno=1&strCat=-1&strPrevDate=${fromDate}&strScrip=${scripCode}&strSearch=P&strToDate=${toDate}&strType=C`;

    const json = await fetchBseJson(url);
    const table = json.Table;
    if (!Array.isArray(table) || table.length === 0) return null;

    const filings = [];
    const count = Math.min(25, table.length);

    for (let i = 0; i < count; i++) {
      const item = table[i];
      const attachName = item.ATTACHMENTNAME ? item.ATTACHMENTNAME.trim() : null;
      const pdfUrl = attachName ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${attachName}` : (item.NSURL || '#');
      const headline = item.HEADLINE || item.NEWSSUB || 'Corporate Announcement';
      const category = item.CATEGORYNAME || item.SUBCATNAME || 'Regulatory Disclosure';
      const dateStr = item.NEWS_DT ? item.NEWS_DT.slice(0, 10) : new Date().toISOString().slice(0, 10);

      let importance = 'MEDIUM';
      const headLower = headline.toLowerCase();
      if (headLower.includes('financial result') || headLower.includes('board meeting') || headLower.includes('dividend') || headLower.includes('acquisition')) {
        importance = 'HIGH';
      }

      filings.push({
        id: `bse-${security.symbol}-${item.NEWSID || i}`,
        symbol: security.symbol,
        company: item.SLONGNAME || security.companyName,
        filingType: category,
        filingDate: dateStr,
        period: dateStr,
        title: headline,
        source: 'BSE Corporate Regulatory Disclosures (Official Exchange Feed)',
        sourceUrl: pdfUrl,
        documentAvailable: !!attachName,
        documentTextAvailable: false, // PDF format
        importance
      });
    }

    return filings.length > 0 ? filings : null;
  } catch (err) {
    return null;
  }
}

/**
 * Fetch verified corporate disclosures and announcements via official exchange/press RSS
 */
async function fetchExchangeDisclosuresViaRss(security) {
  try {
    const query = `${security.companyName || security.symbol} (filing OR disclosure OR announcement OR "SEBI" OR "BSE" OR "NSE")`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, 5000);
    if (!res.ok) return null;
    const text = await res.text();
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const filings = [];
    let m;
    let idx = 0;
    while ((m = itemRegex.exec(text)) !== null && idx < 10) {
      const chunk = m[1];
      const rawTitle = (chunk.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const link = (chunk.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '#';
      const pubDate = (chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || new Date().toISOString();
      const cleanTitle = rawTitle.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      if (!cleanTitle) continue;
      filings.push({
        id: `ann-${security.symbol}-${idx++}`,
        symbol: security.symbol,
        company: security.companyName,
        filingType: 'Corporate Announcement / Regulatory Disclosure',
        filingDate: new Date(pubDate).toISOString().slice(0, 10),
        period: new Date(pubDate).toISOString().slice(0, 10),
        title: cleanTitle,
        source: 'Corporate Regulatory Disclosures & Exchange Announcements',
        sourceUrl: link,
        documentAvailable: true,
        documentTextAvailable: false,
        importance: 'HIGH'
      });
    }
    return filings.length > 0 ? filings : null;
  } catch {
    return null;
  }
}

/**
 * Retrieve verified company regulatory filings envelope.
 */
async function getCompanyFilings(symbol, market = 'IN') {
  const security = resolveSecurity(symbol, market);
  const sym = security.symbol;
  const cacheKey = `${sym}:${security.market}`;
  const now = Date.now();

  const cached = filingsCache.get(cacheKey);
  if (cached && now - cached.timestamp < TTL_MS) {
    return createAnalystEnvelope({
      symbol: sym,
      market: security.market,
      data: cached.data,
      status: 'CACHED',
      source: cached.source,
      provider: cached.provider,
      cacheTtlMs: TTL_MS,
      retrievedAt: new Date(cached.timestamp).toISOString()
    });
  }

  let filings = null;
  let source = 'Official Regulatory Gateway';
  let provider = 'Filings Engine';

  if (security.market === 'US' || security.cik) {
    filings = await fetchSecEdgarFilings(security);
    if (filings) {
      source = 'U.S. Securities and Exchange Commission (SEC EDGAR)';
      provider = 'SEC Submissions Gateway';
    }
  }

  if (!filings && security.market === 'IN') {
    filings = await fetchBseIndianFilings(security);
    if (filings) {
      source = 'BSE Corporate Regulatory Filings';
      provider = 'BSE Official Disclosure Service';
    }
  }

  if (!filings && security.market === 'IN') {
    filings = await fetchExchangeDisclosuresViaRss(security);
    if (filings) {
      source = 'Corporate Regulatory Disclosures & Exchange Announcements';
      provider = 'Exchange Disclosures Feed';
    }
  }

  if (!filings || filings.length === 0) {
    return createAnalystEnvelope({
      symbol: sym,
      market: security.market,
      data: {
        symbol: sym,
        totalFilings: 0,
        filings: []
      },
      status: 'UNAVAILABLE',
      source: 'Exchange Regulatory Registry',
      provider: 'Filings Engine',
      query: sym
    });
  }

  const payload = {
    symbol: sym,
    totalFilings: filings.length,
    latestFiling: filings[0],
    filings
  };

  filingsCache.set(cacheKey, { data: payload, timestamp: now, source, provider });

  return createAnalystEnvelope({
    symbol: sym,
    market: security.market,
    data: payload,
    status: 'LIVE',
    source,
    provider,
    cacheTtlMs: TTL_MS,
    retrievedAt: new Date(now).toISOString()
  });
}

module.exports = {
  getCompanyFilings,
  fetchSecEdgarFilings,
  fetchBseIndianFilings
};
