/**
 * AURUM AI Analyst — Claim Validation Engine
 * Audits AI-generated and deterministic statements against the authoritative Evidence Ledger.
 * Discards or flags any fabricated claims, invented numbers, stale data, or ungrounded statements.
 */

const VALIDATION_STATUSES = {
  VERIFIED: 'VERIFIED',
  PARTIALLY_SUPPORTED: 'PARTIALLY_SUPPORTED',
  UNVERIFIED: 'UNVERIFIED',
  CONFLICTING: 'CONFLICTING',
  STALE: 'STALE',
  UNAVAILABLE: 'UNAVAILABLE'
};

/**
 * Extracts numeric tokens and percentages from a string for audit against ledger.
 */
function extractNumericValues(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = [];
  // Match numbers like 3450.25, -2.5%, 45x, 15%
  const regex = /([+-]?\d+(?:,\d+)*(?:\.\d+)?)\s*(%|x|points)?/gi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const rawVal = m[1].replace(/,/g, '');
    const num = parseFloat(rawVal);
    if (!isNaN(num)) {
      matches.push({
        raw: m[0].trim(),
        number: num,
        unit: m[2] ? m[2].toLowerCase() : null
      });
    }
  }
  return matches;
}

/**
 * Normalizes text for comparison.
 */
function normalizeText(txt) {
  return String(txt || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Checks whether claim text aligns with the evidence metric.
 */
function checkMetricAlignment(claimText, evidence) {
  const normClaim = normalizeText(claimText);
  const normMetric = normalizeText(evidence.metric);

  // Core keyword groups for financial metrics
  const metricKeywords = {
    rsi: ['rsi', 'relative strength', 'oversold', 'overbought', 'momentum'],
    pe: ['p/e', 'pe ratio', 'price to earnings', 'valuation multiple', 'multiple'],
    roe: ['roe', 'return on equity', 'capital efficiency'],
    margin: ['operating margin', 'profit margin', 'margin'],
    price: ['price', 'trading at', 'cmp', 'closed at', 'market price', 'quote'],
    change: ['movement', 'gained', 'lost', 'fell', 'rose', 'dropped', 'surged', 'down', 'up', 'change'],
    volume: ['volume', 'trading volume', 'turnover', 'shares traded'],
    support: ['support', 'floor', 'demand zone'],
    resistance: ['resistance', 'ceiling', 'overhead'],
    earnings: ['earnings', 'eps', 'quarterly', 'beat', 'miss', 'surprise', 'reported eps', 'consensus'],
    filing: ['filing', 'regulatory', 'annual report', '10-k', '10-q', 'disclosure'],
    news: ['headline', 'news', 'reported', 'announced', 'partnership', 'contract', 'deal', 'catalyst']
  };

  // Find metric category of the evidence
  for (const [cat, words] of Object.entries(metricKeywords)) {
    const metricMatches = words.some(w => normMetric.includes(w));
    if (metricMatches) {
      const claimMatches = words.some(w => normClaim.includes(w));
      return { matched: claimMatches, category: cat };
    }
  }

  return { matched: true, category: 'general' };
}

/**
 * Validates a single claim against referenced evidence.
 */
function validateSingleClaim(item, ledger, expectedSymbol, factorDirection = 'SUPPORTING') {
  if (!item) {
    return {
      status: VALIDATION_STATUSES.UNVERIFIED,
      reasonCode: 'EMPTY_CLAIM',
      reason: 'Claim object is null or undefined.',
      item
    };
  }

  const rawClaimText = item.claim || item.factualObservation || item.evidence || '';
  const factorTitle = item.factor || item.title || (factorDirection === 'SUPPORTING' ? 'Supporting Factor' : 'Contrary Factor');
  const referencedId = item.evidenceId || (Array.isArray(item.evidenceIds) ? item.evidenceIds[0] : null);

  // 1. Evidence Reference Guard
  if (!referencedId) {
    return {
      factorTitle,
      factualObservation: rawClaimText,
      interpretation: item.reasoning || item.interpretation || null,
      isInterpretation: Boolean(item.reasoning || item.interpretation),
      evidenceId: null,
      underlyingEvidence: null,
      status: VALIDATION_STATUSES.UNVERIFIED,
      reasonCode: 'MISSING_EVIDENCE_REFERENCE',
      reason: 'Factual claim does not reference any authoritative Evidence ID from the ledger.',
      limitations: 'Claim is unanchored to verified provider data.'
    };
  }

  // 2. Reject unknown evidence IDs
  const evidence = ledger.getById(referencedId);
  if (!evidence) {
    return {
      factorTitle,
      factualObservation: rawClaimText,
      interpretation: item.reasoning || item.interpretation || null,
      isInterpretation: Boolean(item.reasoning || item.interpretation),
      evidenceId: referencedId,
      underlyingEvidence: null,
      status: VALIDATION_STATUSES.UNVERIFIED,
      reasonCode: 'UNKNOWN_EVIDENCE_ID',
      reason: `Referenced Evidence ID "${referencedId}" does not exist in the active Evidence Ledger.`,
      limitations: 'Referenced ID was not produced by any active market data or corporate provider.'
    };
  }

  // 3. Verify security & market binding
  if (expectedSymbol && evidence.symbol && evidence.symbol !== expectedSymbol.toUpperCase()) {
    return {
      factorTitle,
      factualObservation: rawClaimText,
      interpretation: item.reasoning || item.interpretation || null,
      isInterpretation: Boolean(item.reasoning || item.interpretation),
      evidenceId: referencedId,
      underlyingEvidence: evidence,
      status: VALIDATION_STATUSES.UNVERIFIED,
      reasonCode: 'SYMBOL_MISMATCH',
      reason: `Evidence "${referencedId}" belongs to symbol ${evidence.symbol}, not requested security ${expectedSymbol}.`,
      limitations: 'Cross-symbol evidence contamination detected.'
    };
  }

  // 4. Stale or Unavailable Evidence Guard
  if (evidence.status === 'UNAVAILABLE' || evidence.value === null || evidence.value === undefined) {
    return {
      factorTitle,
      factualObservation: rawClaimText,
      interpretation: item.reasoning || item.interpretation || null,
      isInterpretation: Boolean(item.reasoning || item.interpretation),
      evidenceId: referencedId,
      underlyingEvidence: evidence,
      status: VALIDATION_STATUSES.UNAVAILABLE,
      reasonCode: 'EVIDENCE_DATA_UNAVAILABLE',
      reason: `Underlying evidence metric "${evidence.metric}" is currently unavailable from the provider.`,
      limitations: evidence.details || 'Required provider feed returned no value.'
    };
  }

  if (evidence.freshness === 'STALE' || evidence.status === 'STALE') {
    return {
      factorTitle,
      factualObservation: rawClaimText,
      interpretation: item.reasoning || item.interpretation || null,
      isInterpretation: Boolean(item.reasoning || item.interpretation),
      evidenceId: referencedId,
      underlyingEvidence: evidence,
      status: VALIDATION_STATUSES.STALE,
      reasonCode: 'STALE_EVIDENCE',
      reason: `Referenced evidence for "${evidence.metric}" is stale (age exceeds fresh threshold).`,
      limitations: 'Data requires fresh market observation before it can be relied upon.'
    };
  }

  // 5. Metric Alignment Check
  const alignment = checkMetricAlignment(rawClaimText, evidence);
  if (!alignment.matched) {
    return {
      factorTitle,
      factualObservation: rawClaimText,
      interpretation: item.reasoning || item.interpretation || null,
      isInterpretation: Boolean(item.reasoning || item.interpretation),
      evidenceId: referencedId,
      underlyingEvidence: evidence,
      status: VALIDATION_STATUSES.PARTIALLY_SUPPORTED,
      reasonCode: 'METRIC_SEMANTIC_MISMATCH',
      reason: `Claim wording does not directly match evidence metric "${evidence.metric}".`,
      limitations: `Underlying evidence represents ${evidence.metric} (${evidence.value} ${evidence.unit || ''}).`
    };
  }

  // 6. Numeric Consistency & Directional Validation
  const claimNums = extractNumericValues(rawClaimText);
  if (typeof evidence.value === 'number' && claimNums.length > 0) {
    const evNum = evidence.value;
    // Check if any extracted number in claim matches evidence value within tolerance
    const matchesExact = claimNums.some(cn => {
      if (Math.abs(cn.number - evNum) < 0.1) return true;
      if (evNum !== 0 && Math.abs((cn.number - evNum) / evNum) < 0.05) return true;
      return false;
    });

    // If claim contains a number that heavily contradicts evidence value
    if (!matchesExact && claimNums.length === 1) {
      const claimedVal = claimNums[0].number;
      // If the difference is significant (>10%)
      const pctDiff = evNum !== 0 ? Math.abs((claimedVal - evNum) / evNum) : Math.abs(claimedVal);
      if (pctDiff > 0.10) {
        return {
          factorTitle,
          factualObservation: rawClaimText,
          interpretation: item.reasoning || item.interpretation || null,
          isInterpretation: Boolean(item.reasoning || item.interpretation),
          evidenceId: referencedId,
          underlyingEvidence: evidence,
          status: VALIDATION_STATUSES.CONFLICTING,
          reasonCode: 'NUMERIC_VALUE_CONFLICT',
          reason: `Claim asserted ${claimedVal}${claimNums[0].unit || ''}, but authoritative evidence ${evidence.id} records ${evNum}${evidence.unit ? ' ' + evidence.unit : ''}.`,
          limitations: 'Numeric value contradicted by verified provider quote.'
        };
      }
    }
  }

  // 7. Directional Consistency Guard
  // A supporting factor should not cite a clear negative shock without qualification,
  // and a contrary factor should not cite a clear positive breakout.
  const normClaim = normalizeText(rawClaimText);
  if (factorDirection === 'SUPPORTING') {
    if (evidence.metric === "Today's Price Movement" && typeof evidence.value === 'number' && evidence.value < -2.0) {
      if (normClaim.includes('surge') || normClaim.includes('gain') || normClaim.includes('rally') || normClaim.includes('positive movement')) {
        return {
          factorTitle,
          factualObservation: rawClaimText,
          interpretation: item.reasoning || item.interpretation || null,
          isInterpretation: Boolean(item.reasoning || item.interpretation),
          evidenceId: referencedId,
          underlyingEvidence: evidence,
          status: VALIDATION_STATUSES.CONFLICTING,
          reasonCode: 'DIRECTIONAL_CONTRADICTION',
          reason: `Claim describes positive price movement, but verified price change is ${evidence.value}%.`,
          limitations: 'Claim contradicts verified price direction.'
        };
      }
    }
    if (evidence.metric.includes('EPS') && evidence.details && evidence.details.includes('MISS')) {
      if (normClaim.includes('beat') || normClaim.includes('exceeded consensus')) {
        return {
          factorTitle,
          factualObservation: rawClaimText,
          interpretation: item.reasoning || item.interpretation || null,
          isInterpretation: Boolean(item.reasoning || item.interpretation),
          evidenceId: referencedId,
          underlyingEvidence: evidence,
          status: VALIDATION_STATUSES.CONFLICTING,
          reasonCode: 'EARNINGS_RESULT_CONTRADICTION',
          reason: `Claim states earnings beat, but official disclosure records earnings MISS.`,
          limitations: 'Claim contradicts statutory earnings surprise status.'
        };
      }
    }
  } else if (factorDirection === 'CONTRARY') {
    if (evidence.metric === "Today's Price Movement" && typeof evidence.value === 'number' && evidence.value > 2.0) {
      if (normClaim.includes('plunge') || normClaim.includes('crash') || normClaim.includes('sharp drop')) {
        return {
          factorTitle,
          factualObservation: rawClaimText,
          interpretation: item.reasoning || item.interpretation || null,
          isInterpretation: Boolean(item.reasoning || item.interpretation),
          evidenceId: referencedId,
          underlyingEvidence: evidence,
          status: VALIDATION_STATUSES.CONFLICTING,
          reasonCode: 'DIRECTIONAL_CONTRADICTION',
          reason: `Contrary claim alleges sharp price drop, but verified market move is +${evidence.value}%.`,
          limitations: 'Claim contradicts live market quote.'
        };
      }
    }
  }

  // 8. Distinguish directly observed facts from interpretations
  const isDirectObservation = evidence.category === 'MARKET_DATA' || evidence.category === 'EARNINGS' || evidence.category === 'FILINGS';
  const observationText = (evidence.value !== null && evidence.value !== undefined)
    ? `${evidence.metric}: ${evidence.value}${evidence.unit ? ' ' + evidence.unit : ''}${evidence.period ? ' (' + evidence.period + ')' : ''}`
    : rawClaimText;

  return {
    factorTitle,
    factualObservation: rawClaimText || observationText,
    interpretation: item.reasoning || item.interpretation || (item.claim && item.claim !== observationText ? item.claim : null),
    isInterpretation: !isDirectObservation,
    evidenceId: referencedId,
    underlyingEvidence: {
      id: evidence.id,
      symbol: evidence.symbol,
      metric: evidence.metric,
      value: evidence.value,
      unit: evidence.unit,
      period: evidence.period,
      source: evidence.source,
      sourceUrl: evidence.sourceUrl,
      provider: evidence.provider,
      providerRole: evidence.providerRole,
      observedAt: evidence.observedAt,
      freshness: evidence.freshness,
      status: evidence.status
    },
    status: VALIDATION_STATUSES.VERIFIED,
    reasonCode: 'VERIFIED_AGAINST_LEDGER',
    reason: `Verified against ledger item ${evidence.id} (${evidence.source}, ${evidence.freshness}).`,
    limitations: evidence.fallbackReason || null
  };
}

class ClaimValidator {
  /**
   * Validate an AI or deterministic response against the authoritative Evidence Ledger.
   * @param {Object} response - Response payload
   * @param {EvidenceLedger} ledger - Grounded Evidence Ledger
   * @param {string} expectedSymbol - Target stock symbol
   * @returns {Object} Validated and structured response
   */
  static validate(response, ledger, expectedSymbol = null) {
    if (!response) return null;
    if (!ledger) {
      throw new Error('ClaimValidator requires a valid EvidenceLedger instance.');
    }

    const sym = expectedSymbol || ledger.symbol;
    const validatedResponse = { ...response };
    const rejections = [];

    let supportingVerifiedCount = 0;
    let contraryVerifiedCount = 0;

    // 1. Validate Supporting Factors
    if (Array.isArray(validatedResponse.supportingEvidence)) {
      const validatedSupporting = [];
      const seenObservations = new Set();

      for (const item of validatedResponse.supportingEvidence) {
        const result = validateSingleClaim(item, ledger, sym, 'SUPPORTING');
        
        // Deduplicate identical factual claims
        const dedupeKey = normalizeText(result.factualObservation);
        if (seenObservations.has(dedupeKey)) {
          continue;
        }
        seenObservations.add(dedupeKey);

        if (result.status === VALIDATION_STATUSES.VERIFIED) {
          supportingVerifiedCount++;
        } else {
          rejections.push({
            type: 'SUPPORTING',
            claim: result.factualObservation,
            status: result.status,
            reasonCode: result.reasonCode,
            reason: result.reason
          });
        }

        validatedSupporting.push({
          title: result.factorTitle,
          factualObservation: result.factualObservation,
          interpretation: result.interpretation,
          isInterpretation: result.isInterpretation,
          evidenceId: result.evidenceId,
          underlyingEvidence: result.underlyingEvidence,
          source: result.underlyingEvidence?.source || 'Source unavailable',
          sourceUrl: result.underlyingEvidence?.sourceUrl || null,
          observedAt: result.underlyingEvidence?.observedAt || null,
          timeframe: result.underlyingEvidence?.period || 'Current',
          status: result.status,
          validationReason: result.reason,
          limitations: result.limitations
        });
      }

      validatedResponse.supportingEvidence = validatedSupporting;
    } else {
      validatedResponse.supportingEvidence = [];
    }

    // 2. Validate Contrary Factors
    if (Array.isArray(validatedResponse.contradictingEvidence)) {
      const validatedContrary = [];
      const seenObservations = new Set();

      for (const item of validatedResponse.contradictingEvidence) {
        const result = validateSingleClaim(item, ledger, sym, 'CONTRARY');

        const dedupeKey = normalizeText(result.factualObservation);
        if (seenObservations.has(dedupeKey)) {
          continue;
        }
        seenObservations.add(dedupeKey);

        if (result.status === VALIDATION_STATUSES.VERIFIED) {
          contraryVerifiedCount++;
        } else {
          rejections.push({
            type: 'CONTRARY',
            claim: result.factualObservation,
            status: result.status,
            reasonCode: result.reasonCode,
            reason: result.reason
          });
        }

        validatedContrary.push({
          title: result.factorTitle,
          factualObservation: result.factualObservation,
          interpretation: result.interpretation,
          isInterpretation: result.isInterpretation,
          evidenceId: result.evidenceId,
          underlyingEvidence: result.underlyingEvidence,
          source: result.underlyingEvidence?.source || 'Source unavailable',
          sourceUrl: result.underlyingEvidence?.sourceUrl || null,
          observedAt: result.underlyingEvidence?.observedAt || null,
          timeframe: result.underlyingEvidence?.period || 'Current',
          status: result.status,
          validationReason: result.reason,
          limitations: result.limitations
        });
      }

      validatedResponse.contradictingEvidence = validatedContrary;
    } else {
      validatedResponse.contradictingEvidence = [];
    }

    // 3. Attach Comprehensive Validation Audit Provenance
    const totalLedgerItems = ledger.getAll().length;
    const totalVerifiedFactors = supportingVerifiedCount + contraryVerifiedCount;

    validatedResponse.claimValidation = {
      status: totalVerifiedFactors > 0 ? 'VALIDATED_AGAINST_LEDGER' : (totalLedgerItems > 0 ? 'NEEDS_REVIEW' : 'INSUFFICIENT_EVIDENCE'),
      totalLedgerItems,
      supportingClaimsEvaluated: validatedResponse.supportingEvidence.length,
      supportingClaimsVerified: supportingVerifiedCount,
      contradictingClaimsEvaluated: validatedResponse.contradictingEvidence.length,
      contradictingClaimsVerified: contraryVerifiedCount,
      totalVerifiedFactors,
      rejectionsCount: rejections.length,
      rejections,
      validatedAt: new Date().toISOString()
    };

    return validatedResponse;
  }
}

module.exports = {
  ClaimValidator,
  VALIDATION_STATUSES,
  validateSingleClaim,
  extractNumericValues
};
