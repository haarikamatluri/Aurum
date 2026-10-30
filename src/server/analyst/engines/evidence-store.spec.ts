import { describe, it, expect, beforeEach } from 'vitest';
declare const require: any;
const { EvidenceStore, evidenceStore, getEvidence, registerEvidence } = require('./evidence-store');
const { buildEvidenceLedger } = require('./evidence-ledger');

describe('Evidence Store & Verification Trail Tests', () => {
  beforeEach(() => {
    evidenceStore.clear();
  });

  it('generates a full 10-step verification trail for RSI evidence', () => {
    const ledger = buildEvidenceLedger({
      symbol: 'TCS',
      security: { symbol: 'TCS', market: 'IN', currency: 'INR' },
      quote: { price: 3450.25, currency: 'INR', status: 'LIVE', timestamp: new Date().toISOString() },
      technicals: { rsi14: 56.1, rsiCondition: 'NEUTRAL' }
    });

    const rsiEntry = ledger.getAll().find((e: any) => e.metric.includes('RSI'));
    expect(rsiEntry).toBeDefined();

    const verifiedRecord = getEvidence(rsiEntry.id, { symbol: 'TCS' });
    expect(verifiedRecord).toBeDefined();
    expect(verifiedRecord.evidenceId).toBe(rsiEntry.id);
    expect(verifiedRecord.symbol).toBe('TCS');
    expect(verifiedRecord.status).toBe('VERIFIED');
    expect(verifiedRecord.calculationMethod).toContain('Wilder');
    expect(verifiedRecord.calculatedResult).toContain('56.1');
    expect(verifiedRecord.validationMethod).toContain('independent calculation');
    expect(verifiedRecord.validationResult).toBe('PASS');
    expect(verifiedRecord.freshness).toBe('FRESH');

    // Verification trail must have exactly 10 chronological steps
    expect(verifiedRecord.verificationTrail).toHaveLength(10);
    const steps = verifiedRecord.verificationTrail;
    expect(steps[0].step).toBe(1);
    expect(steps[0].title).toBe('Original Analysis Context');
    expect(steps[1].step).toBe(2);
    expect(steps[1].title).toBe('Instrument Binding');
    expect(steps[2].step).toBe(3);
    expect(steps[2].title).toBe('Data Provider Requested');
    expect(steps[3].step).toBe(4);
    expect(steps[3].title).toBe('Actual API / Source Used');
    expect(steps[4].step).toBe(5);
    expect(steps[4].title).toBe('Raw Response Fields Used');
    expect(steps[5].step).toBe(6);
    expect(steps[5].title).toBe('Data Normalization & Freshness Checks');
    expect(steps[6].step).toBe(7);
    expect(steps[6].title).toBe('Calculation / Interpretation Applied');
    expect(steps[7].step).toBe(8);
    expect(steps[7].title).toBe('Independent Validation');
    expect(steps[8].step).toBe(9);
    expect(steps[8].title).toBe('Final Verification Decision');
    expect(steps[9].step).toBe(10);
    expect(steps[9].title).toBe('Evidence Ledger Record Returned');
  });

  it('generates specific MACD evidence distinct from RSI evidence', () => {
    const ledger = buildEvidenceLedger({
      symbol: 'NVDA',
      security: { symbol: 'NVDA', market: 'US', currency: 'USD' },
      quote: { price: 125.50, currency: 'USD', status: 'LIVE' },
      technicals: {
        rsi14: 62.4,
        macd: { line: 2.45, signal: 1.80, histogram: 0.65, cross: 'BULLISH' }
      }
    });

    const macdEntry = ledger.getAll().find((e: any) => e.metric.includes('MACD'));
    const rsiEntry = ledger.getAll().find((e: any) => e.metric.includes('RSI'));

    expect(macdEntry).toBeDefined();
    expect(rsiEntry).toBeDefined();
    expect(macdEntry.id).not.toBe(rsiEntry.id);

    const macdRecord = getEvidence(macdEntry.id, { symbol: 'NVDA' });
    const rsiRecord = getEvidence(rsiEntry.id, { symbol: 'NVDA' });

    expect(macdRecord.calculationMethod).toContain('EMA(12)');
    expect(macdRecord.calculatedResult).toContain('Line: 2.45');
    expect(rsiRecord.calculationMethod).toContain('Wilder');
    expect(macdRecord.calculatedResult).not.toBe(rsiRecord.calculatedResult);
  });

  it('generates Support & Resistance evidence with swing pivot cluster calculation', () => {
    const ledger = buildEvidenceLedger({
      symbol: 'TCS',
      security: { symbol: 'TCS', market: 'IN', currency: 'INR' },
      quote: { price: 3450.25, currency: 'INR', status: 'LIVE' },
      technicals: { support: 3350, resistance: 3600 }
    });

    const srEntry = ledger.getAll().find((e: any) => e.metric.includes('Support'));
    expect(srEntry).toBeDefined();

    const srRecord = getEvidence(srEntry.id, { symbol: 'TCS' });
    expect(srRecord.calculationMethod).toContain('swing pivot cluster');
    expect(srRecord.calculatedResult).toContain('Support: 3350');
    expect(srRecord.calculatedResult).toContain('Resistance: 3600');
    expect(srRecord.rawInputs.support).toBe(3350);
    expect(srRecord.rawInputs.resistance).toBe(3600);
  });

  it('generates corporate quarterly Earnings evidence with consensus surprise', () => {
    const ledger = buildEvidenceLedger({
      symbol: 'AAPL',
      security: { symbol: 'AAPL', market: 'US', currency: 'USD' },
      quote: { price: 230.00, currency: 'USD', status: 'LIVE' },
      earnings: {
        latestEPSActual: 1.64,
        latestEPSEstimate: 1.60,
        epsSurprise: 0.04,
        epsSurprisePercent: 2.5,
        status: 'BEAT',
        latestReportingPeriod: 'Q3 2026',
        source: 'SEC 10-Q Quarterly Filing'
      }
    });

    const earnEntry = ledger.getAll().find((e: any) => e.metric.includes('Surprise') || e.metric.includes('Consensus'));
    expect(earnEntry).toBeDefined();

    const earnRecord = getEvidence(earnEntry.id, { symbol: 'AAPL' });
    expect(earnRecord.calculatedResult).toContain('Estimate: 1.6');
    expect(earnRecord.calculatedResult).toContain('Surprise: +0.04');
    expect(earnRecord.source).toContain('SEC 10-Q');
    expect(earnRecord.validationResult).toBe('PASS');
  });

  it('returns null for an unrecorded evidence ID without inventing data', () => {
    const record = getEvidence('EVIDENCE-NONEXISTENT', { symbol: 'TCS' });
    expect(record).toBeNull();
  });

  it('flags stale quote evidence with status STALE and validationResult FAIL', () => {
    const staleDate = new Date(Date.now() - 86400 * 5 * 1000).toISOString(); // 5 days ago
    const ledger = buildEvidenceLedger({
      symbol: 'TCS',
      security: { symbol: 'TCS', market: 'IN', currency: 'INR' },
      quote: { price: 3450.25, currency: 'INR', status: 'STALE', timestamp: staleDate }
    });

    const priceEntry = ledger.getById('EVIDENCE-001');
    expect(priceEntry.status).toBe('STALE');

    const verifiedRecord = getEvidence(priceEntry.id, { symbol: 'TCS' });
    expect(verifiedRecord.status).toBe('STALE');
    expect(verifiedRecord.freshness).toBe('STALE');
    expect(verifiedRecord.validationResult).toBe('FAIL');
  });
});
