// ============================================================================
// Aurum ML Data Acquisition — Download Historical TCS.NS Daily OHLCV Data
// Period: 2019-01-01 to 2025-12-31
// Frequency: Daily
// Source: Yahoo Finance Official Historical Chart API (NSE: TCS.NS)
// ============================================================================

const https = require('https');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, 'raw');
const OUTPUT_FILE = path.join(RAW_DIR, 'tcs_2019_2025.csv');

// Timestamp bounds: 2019-01-01 00:00:00 UTC (1546300800) to 2025-12-31 23:59:59 UTC (1767225599)
const START_PERIOD = 1546300800;
const END_PERIOD = 1767225599;
const YAHOO_URL = `https://query1.finance.yahoo.com/v8/finance/chart/TCS.NS?period1=${START_PERIOD}&period2=${END_PERIOD}&interval=1d`;

function downloadFromYahoo() {
  return new Promise((resolve, reject) => {
    console.log(`[ML:Data] Requesting historical daily OHLCV for TCS.NS from Yahoo Finance...`);
    console.log(`[ML:Data] URL: ${YAHOO_URL}`);

    const req = https.get(YAHOO_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from market data provider`));
      }

      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          const result = parsed.chart?.result?.[0];
          if (!result) {
            return reject(new Error('Invalid response structure from market provider.'));
          }

          const timestamps = result.timestamp || [];
          const quote = result.indicators?.quote?.[0] || {};
          const opens = quote.open || [];
          const highs = quote.high || [];
          const lows = quote.low || [];
          const closes = quote.close || [];
          const volumes = quote.volume || [];

          if (timestamps.length === 0) {
            return reject(new Error('No timestamps returned in historical payload.'));
          }

          if (!fs.existsSync(RAW_DIR)) {
            fs.mkdirSync(RAW_DIR, { recursive: true });
          }

          const lines = ['timestamp,date,open,high,low,close,volume'];
          let validCount = 0;

          for (let i = 0; i < timestamps.length; i++) {
            const ts = timestamps[i];
            const o = opens[i];
            const h = highs[i];
            const l = lows[i];
            const c = closes[i];
            const v = volumes[i];

            // Filter out holiday/null entries
            if (o != null && h != null && l != null && c != null && v != null &&
                !isNaN(o) && !isNaN(h) && !isNaN(l) && !isNaN(c) && !isNaN(v) &&
                o > 0 && h > 0 && l > 0 && c > 0 && v >= 0) {
              const dateStr = new Date(ts * 1000).toISOString().split('T')[0];
              // Ensure 2019-01-01 to 2025-12-31 boundary
              if (dateStr >= '2019-01-01' && dateStr <= '2025-12-31') {
                lines.push(`${ts},${dateStr},${o.toFixed(2)},${h.toFixed(2)},${l.toFixed(2)},${c.toFixed(2)},${Math.round(v)}`);
                validCount++;
              }
            }
          }

          fs.writeFileSync(OUTPUT_FILE, lines.join('\n') + '\n', 'utf-8');
          console.log(`[ML:Data] Downloaded and saved ${validCount} valid daily bars to:`);
          console.log(`         ${OUTPUT_FILE}`);
          resolve({ filePath: OUTPUT_FILE, rowCount: validCount });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
  });
}

async function main() {
  const customPath = process.argv[2];
  if (customPath && fs.existsSync(customPath)) {
    console.log(`[ML:Data] Using provided custom CSV path: ${customPath}`);
    if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true });
    fs.copyFileSync(customPath, OUTPUT_FILE);
    console.log(`[ML:Data] Copied to ${OUTPUT_FILE}`);
    return;
  }

  try {
    await downloadFromYahoo();
  } catch (err) {
    console.error(`[ML:Data] Automatic download failed: ${err.message}`);
    console.error(`[ML:Data] Fallback: You can place a legitimate TCS.NS daily CSV in ${OUTPUT_FILE}`);
    console.error(`          Schema required: timestamp,date,open,high,low,close,volume`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { downloadFromYahoo, OUTPUT_FILE, RAW_DIR };
