// ============================================================================
// Aurum ML Data Validator — Deterministic Dataset Integrity & Quality Verification
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function computeFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function validateDataset(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dataset file not found at: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('Dataset contains insufficient rows (header + data required).');
  }

  const header = lines[0].trim().split(',').map(h => h.trim().toLowerCase());
  const requiredFields = ['date', 'open', 'high', 'low', 'close', 'volume'];
  const missingRequiredFields = requiredFields.filter(f => !header.includes(f));

  if (missingRequiredFields.length > 0) {
    throw new Error(`Missing mandatory header columns: ${missingRequiredFields.join(', ')}`);
  }

  const dateIdx = header.indexOf('date');
  const openIdx = header.indexOf('open');
  const highIdx = header.indexOf('high');
  const lowIdx = header.indexOf('low');
  const closeIdx = header.indexOf('close');
  const volIdx = header.indexOf('volume');

  const seenDates = new Set();
  const invalidRows = [];
  const suspiciousRows = [];
  let duplicateCount = 0;
  let previousDate = null;
  let isSorted = true;

  const validRows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');

    if (parts.length < header.length) {
      invalidRows.push({ row: i + 1, reason: 'Incomplete column count', line });
      continue;
    }

    const dateStr = parts[dateIdx].trim();
    const open = parseFloat(parts[openIdx]);
    const high = parseFloat(parts[highIdx]);
    const low = parseFloat(parts[lowIdx]);
    const close = parseFloat(parts[closeIdx]);
    const volume = parseFloat(parts[volIdx]);

    // 1. Date validation
    const dateParsed = new Date(dateStr);
    if (isNaN(dateParsed.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      invalidRows.push({ row: i + 1, reason: `Invalid date format: ${dateStr}` });
      continue;
    }

    // 2. Duplicate check
    if (seenDates.has(dateStr)) {
      duplicateCount++;
      invalidRows.push({ row: i + 1, reason: `Duplicate date: ${dateStr}` });
      continue;
    }
    seenDates.add(dateStr);

    // 3. Chronological sorting check
    if (previousDate && dateStr <= previousDate) {
      isSorted = false;
    }
    previousDate = dateStr;

    // 4. Numeric validity
    if ([open, high, low, close, volume].some(v => isNaN(v))) {
      invalidRows.push({ row: i + 1, reason: 'Non-numeric OHLCV value' });
      continue;
    }

    // 5. Positive prices
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) {
      invalidRows.push({ row: i + 1, reason: 'Non-positive price or negative volume' });
      continue;
    }

    // 6. Strict OHLC geometric consistency
    // High must be >= open, close, and low
    // Low must be <= open, close, and high
    const epsilon = 0.0001;
    if (high < low - epsilon || high < open - epsilon || high < close - epsilon ||
        low > open + epsilon || low > close + epsilon) {
      invalidRows.push({
        row: i + 1,
        reason: `OHLC geometric violation: H=${high}, L=${low}, O=${open}, C=${close}`
      });
      continue;
    }

    // 7. Suspicious anomaly detection (e.g. single day 50% jump)
    if (open > 0 && Math.abs((close - open) / open) > 0.40) {
      suspiciousRows.push({ row: i + 1, date: dateStr, reason: 'Intraday swing > 40%' });
    }

    validRows.push({
      date: dateStr,
      open,
      high,
      low,
      close,
      volume
    });
  }

  const rowCount = validRows.length;
  const firstDate = rowCount > 0 ? validRows[0].date : null;
  const lastDate = rowCount > 0 ? validRows[rowCount - 1].date : null;

  // Expected trading days for ~7 years (NSE averages 245-250 trading days/year -> ~1700-1750 days)
  const coverageAssessment = rowCount >= 1600 ? 'EXCELLENT' : rowCount >= 1200 ? 'ADEQUATE' : 'SPARSE';

  const report = {
    valid: invalidRows.length === 0 && rowCount > 0 && isSorted,
    filePath,
    checksumSha256: computeFileHash(filePath),
    totalRowsRead: lines.length - 1,
    validRowsCount: rowCount,
    firstDate,
    lastDate,
    isChronologicallySorted: isSorted,
    duplicateCount,
    invalidRowsCount: invalidRows.length,
    invalidRows,
    suspiciousRowsCount: suspiciousRows.length,
    suspiciousRows,
    coverageAssessment,
    validatedAt: new Date().toISOString()
  };

  return report;
}

if (require.main === module) {
  const targetFile = process.argv[2] || path.join(__dirname, 'raw', 'tcs_2019_2025.csv');
  try {
    const rep = validateDataset(targetFile);
    console.log('====================================================');
    console.log('         AURUM DATASET VALIDATION REPORT            ');
    console.log('====================================================');
    console.log(`File:           ${rep.filePath}`);
    console.log(`SHA-256 Hash:   ${rep.checksumSha256}`);
    console.log(`Status:         ${rep.valid ? 'VALIDATED [PASSED]' : 'INVALID [FAILED]'}`);
    console.log(`Valid Rows:     ${rep.validRowsCount}`);
    console.log(`Period:         ${rep.firstDate} to ${rep.lastDate}`);
    console.log(`Sorted:         ${rep.isChronologicallySorted}`);
    console.log(`Duplicates:     ${rep.duplicateCount}`);
    console.log(`Invalid Rows:   ${rep.invalidRowsCount}`);
    console.log(`Coverage:       ${rep.coverageAssessment}`);
    console.log('====================================================');
    if (!rep.valid) {
      console.error('Validation Errors:', rep.invalidRows.slice(0, 5));
      process.exit(1);
    }
  } catch (err) {
    console.error('Dataset validation crashed:', err.message);
    process.exit(1);
  }
}

module.exports = { validateDataset, computeFileHash };
