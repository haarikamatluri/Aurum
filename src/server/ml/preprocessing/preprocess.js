// ============================================================================
// Aurum ML Data Preprocessing Pipeline
// Input: data/raw/tcs_2019_2025.csv
// Output: data/processed/tcs_2019_2025_clean.csv + metadata
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAW_DEFAULT = path.join(__dirname, '..', 'data', 'raw', 'tcs_2019_2025.csv');
const PROCESSED_DIR = path.join(__dirname, '..', 'data', 'processed');
const CLEAN_DEFAULT = path.join(PROCESSED_DIR, 'tcs_2019_2025_clean.csv');
const META_DEFAULT = path.join(PROCESSED_DIR, 'tcs_2019_2025_clean.meta.json');

function computeHash(strOrBuf) {
  return crypto.createHash('sha256').update(strOrBuf).digest('hex');
}

function preprocessDataset(inputPath = RAW_DEFAULT, outputPath = CLEAN_DEFAULT) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Raw dataset file not found: ${inputPath}`);
  }

  const raw = fs.readFileSync(inputPath, 'utf-8');
  const lines = raw.trim().split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('Raw dataset has insufficient lines to preprocess.');
  }

  const rawHeader = lines[0].trim().split(',').map(h => h.trim().toLowerCase());
  const dateIdx = rawHeader.indexOf('date');
  const openIdx = rawHeader.indexOf('open');
  const highIdx = rawHeader.indexOf('high');
  const lowIdx = rawHeader.indexOf('low');
  const closeIdx = rawHeader.indexOf('close');
  const volIdx = rawHeader.indexOf('volume');
  const tsIdx = rawHeader.indexOf('timestamp');

  const rows = [];
  const rejectedRows = [];
  const seenDates = new Set();
  let duplicateCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].trim().split(',');
    if (parts.length < rawHeader.length) {
      rejectedRows.push({ row: i + 1, reason: 'Malformed column count' });
      continue;
    }

    const dateStr = parts[dateIdx].trim();
    const open = parseFloat(parts[openIdx]);
    const high = parseFloat(parts[highIdx]);
    const low = parseFloat(parts[lowIdx]);
    const close = parseFloat(parts[closeIdx]);
    const volume = parseFloat(parts[volIdx]);
    const timestamp = tsIdx >= 0 ? parseInt(parts[tsIdx], 10) : Math.floor(new Date(dateStr).getTime() / 1000);

    // 1. Validate date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      rejectedRows.push({ row: i + 1, reason: `Invalid date: ${dateStr}` });
      continue;
    }

    // 2. Reject duplicate date rows
    if (seenDates.has(dateStr)) {
      duplicateCount++;
      rejectedRows.push({ row: i + 1, reason: `Duplicate date: ${dateStr}` });
      continue;
    }
    seenDates.add(dateStr);

    // 3. Reject invalid numbers
    if ([open, high, low, close, volume].some(n => isNaN(n) || n <= 0)) {
      rejectedRows.push({ row: i + 1, reason: 'Non-positive or NaN values' });
      continue;
    }

    // 4. Reject geometric inconsistencies
    const eps = 0.0001;
    if (high < low - eps || high < open - eps || high < close - eps ||
        low > open + eps || low > close + eps) {
      rejectedRows.push({ row: i + 1, reason: 'OHLC bounds violation' });
      continue;
    }

    rows.push({
      timestamp,
      date: dateStr,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.round(volume)
    });
  }

  // 5. Strict chronological sort ascending
  rows.sort((a, b) => a.date.localeCompare(b.date));

  if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  }

  // 6. Write clean CSV
  const cleanHeader = 'timestamp,date,open,high,low,close,volume';
  const cleanLines = [cleanHeader];
  for (const r of rows) {
    cleanLines.push(`${r.timestamp},${r.date},${r.open.toFixed(2)},${r.high.toFixed(2)},${r.low.toFixed(2)},${r.close.toFixed(2)},${r.volume}`);
  }

  const cleanCsvContent = cleanLines.join('\n') + '\n';
  fs.writeFileSync(outputPath, cleanCsvContent, 'utf-8');

  // 7. Write clean dataset metadata & checksum
  const meta = {
    cleaningVersion: 'v1.0.0-aurum-clean',
    source: 'Yahoo Finance Official (NSE: TCS.NS)',
    sourceSymbol: 'TCS.NS',
    startDate: rows.length > 0 ? rows[0].date : null,
    endDate: rows.length > 0 ? rows[rows.length - 1].date : null,
    rawRowCount: lines.length - 1,
    cleanRowCount: rows.length,
    rejectedRowsCount: rejectedRows.length,
    duplicateCount,
    rawChecksumSha256: computeHash(raw),
    cleanChecksumSha256: computeHash(cleanCsvContent),
    forwardFilled: false,
    interpolated: false,
    generatedAt: new Date().toISOString()
  };

  const metaPath = outputPath.replace(/\.csv$/, '.meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

  return {
    rows,
    meta,
    outputPath,
    metaPath
  };
}

if (require.main === module) {
  try {
    console.log('[ML:Preprocess] Running dataset cleaning pipeline...');
    const res = preprocessDataset();
    console.log('====================================================');
    console.log('      AURUM PREPROCESSING CLEANING COMPLETED        ');
    console.log('====================================================');
    console.log(`Clean CSV:    ${res.outputPath}`);
    console.log(`Metadata:     ${res.metaPath}`);
    console.log(`Clean Rows:   ${res.meta.cleanRowCount}`);
    console.log(`Period:       ${res.meta.startDate} to ${res.meta.endDate}`);
    console.log(`Clean SHA256: ${res.meta.cleanChecksumSha256}`);
    console.log('====================================================');
  } catch (err) {
    console.error('Preprocessing failed:', err.message);
    process.exit(1);
  }
}

module.exports = { preprocessDataset, PROCESSED_DIR, CLEAN_DEFAULT, META_DEFAULT };
