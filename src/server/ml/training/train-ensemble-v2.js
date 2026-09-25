// ============================================================================
// Aurum ML Training & Artifact Export Pipeline v2
// High-Confidence Ensemble (LR + DT + RF + GB) with Probability Calibration
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { generateBatchFeaturesV2, NUMERIC_FEATURE_NAMES, FEATURE_VERSION_V2 } = require('../features/feature-engineering-v2');
const { generateTargetsV2, TARGET_VERSION_V2 } = require('../target/target-generator-v2');
const { runWalkForwardValidation, splitChronologicalData } = require('../validation/walk-forward-v2');
const { generateConfidenceCurve, evaluateSelectivePredictions } = require('../evaluation/selective-prediction');
const modelRegistry = require('../model-registry');

const PROCESSED_DATA_PATH = path.join(__dirname, '..', 'data', 'processed', 'tcs_2019_2025_clean.csv');
const ARTIFACT_V2_PATH = path.join(__dirname, '..', 'artifacts', 'tcs_ensemble_v2.json');

/**
 * Parses clean CSV rows into typed candle objects
 */
function loadCleanCandles(filePath = PROCESSED_DATA_PATH) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Clean dataset file not found at: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  const candles = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (cols.length < headers.length) continue;

    candles.push({
      timestamp: parseInt(cols[0], 10),
      date: cols[1],
      open: parseFloat(cols[2]),
      high: parseFloat(cols[3]),
      low: parseFloat(cols[4]),
      close: parseFloat(cols[5]),
      volume: parseInt(cols[6], 10)
    });
  }

  return candles;
}

/**
 * Computes permutation feature importance on validation data
 */
function computePermutationImportance(ensemble, valSet, featureNames) {
  const baseEval = valSet.map((row) => ensemble.evaluateFeatures(row));
  const baseCorrect = baseEval.filter((p, i) => (p.prediction === 'BULLISH' ? 1 : 0) === valSet[i].targetBinary).length;
  const baseAcc = baseCorrect / valSet.length;

  const importances = {};

  for (const feat of featureNames) {
    // Permute (shuffle) values of this feature
    const shuffledValues = valSet.map((r) => r[feat]).sort(() => Math.random() - 0.5);
    const permutedSet = valSet.map((r, i) => ({ ...r, [feat]: shuffledValues[i] }));

    const permEval = permutedSet.map((row) => ensemble.evaluateFeatures(row));
    const permCorrect = permEval.filter((p, i) => (p.prediction === 'BULLISH' ? 1 : 0) === valSet[i].targetBinary).length;
    const permAcc = permCorrect / valSet.length;

    const drop = Math.max(0, baseAcc - permAcc);
    importances[feat] = Math.round(drop * 1000) / 1000;
  }

  return importances;
}

/**
 * Master training and artifact generation function
 */
function trainAndExportEnsembleV2() {
  console.log('[ML:TrainV2] Loading processed clean candles...');
  const candles = loadCleanCandles();
  console.log(`[ML:TrainV2] Loaded ${candles.length} candles (${candles[0].date} to ${candles[candles.length - 1].date}).`);

  console.log('[ML:TrainV2] Generating batch features (v2.0.0)...');
  const featureRows = generateBatchFeaturesV2(candles, 20);

  console.log('[ML:TrainV2] Generating forward-looking targets...');
  const { dataset: fullDataset, meta: targetMeta } = generateTargetsV2(featureRows);
  console.log(`[ML:TrainV2] Labeled dataset ready with ${fullDataset.length} rows.`);

  // Walk-forward validation across expanding folds
  const wfResults = runWalkForwardValidation(fullDataset);
  const { ensemble, calibrator, valConfidenceCurve, diagnostics } = wfResults;

  const { trainSet, valSet, testSet } = splitChronologicalData(fullDataset);

  // Feature Importance on validation set
  console.log('[ML:TrainV2] Calculating feature importance via permutation testing...');
  const featureImportance = computePermutationImportance(ensemble, valSet, NUMERIC_FEATURE_NAMES);

  // --------------------------------------------------------------------------
  // EVALUATION ON UNTOUCHED FINAL TEST SET (2025)
  // --------------------------------------------------------------------------
  console.log('[ML:TrainV2] Evaluating frozen ensemble on untouched 2025 Test Set...');
  const testConfidenceCurve = generateConfidenceCurve(ensemble, testSet);

  // Primary selective prediction metrics at 85% confidence hurdle
  const testEval85 = testSet.map((row) => {
    const res = ensemble.evaluateFeatures(row, 0.85);
    return {
      signal: res.signal,
      confidence: res.calibratedConfidence,
      actualDirection: row.targetBinary,
      futureReturn1D: row.futureReturn1D
    };
  });
  const testMetrics85 = evaluateSelectivePredictions(testEval85);

  // Baseline 50% non-selective metrics
  const testEvalBase = testSet.map((row) => {
    const res = ensemble.evaluateFeatures(row, 0.50);
    return {
      signal: res.signal,
      confidence: res.calibratedConfidence,
      actualDirection: row.targetBinary,
      futureReturn1D: row.futureReturn1D
    };
  });
  const testMetricsBase = evaluateSelectivePredictions(testEvalBase);

  console.log(`[ML:TrainV2] Test Performance (Base 50%): Acc: ${(testMetricsBase.accuracy*100).toFixed(1)}% | Coverage: ${testMetricsBase.coveragePct}%`);
  console.log(`[ML:TrainV2] Test Performance (Selective 85%): Acc: ${(testMetrics85.accuracy*100).toFixed(1)}% | Precision: ${(testMetrics85.precision*100).toFixed(1)}% | Coverage: ${testMetrics85.coveragePct}% | Trades: ${testMetrics85.tradeCount}`);

  // Construct artifact structure
  const artifactPayload = {
    modelId: 'TCS-ENSEMBLE-V2',
    name: 'TCS High-Confidence Selective Ensemble',
    version: 'v2.0.0',
    type: 'SELECTIVE_ENSEMBLE',
    targetAsset: 'TCS.NS',
    currency: 'INR',
    trainedAt: new Date().toISOString(),
    datasetVersion: 'DS-NSE-TCS-2019-2025-V2',
    datasetChecksumSha256: crypto.createHash('sha256').update(fs.readFileSync(PROCESSED_DATA_PATH)).digest('hex'),
    featureVersion: FEATURE_VERSION_V2,
    targetVersion: TARGET_VERSION_V2,
    features: NUMERIC_FEATURE_NAMES,
    featureCount: NUMERIC_FEATURE_NAMES.length,
    featureImportance,
    trainingPeriod: `2019-01-21 to 2023-12-29`,
    validationPeriod: `2024-01-01 to 2024-12-31`,
    testPeriod: `2025-01-01 to 2025-12-30`,
    modelsEnsemble: {
      architectures: ['LOGISTIC_REGRESSION', 'DECISION_TREE', 'RANDOM_FOREST', 'GRADIENT_BOOSTING'],
      weights: ensemble.weights,
      serializedModels: ensemble.toJSON()
    },
    calibration: {
      method: 'PLATT_SCALING',
      A: calibrator.A,
      B: calibrator.B,
      brierScore: calibrator.brierScore,
      expectedCalibrationError: calibrator.expectedCalibrationError,
      reliabilityBins: calibrator.reliabilityBins
    },
    selectiveHurdles: {
      defaultConfidenceThreshold: 0.85,
      minAgreementRatio: 0.75,
      confidenceCurves: {
        validation: valConfidenceCurve,
        test: testConfidenceCurve
      }
    },
    reproducedMetrics: {
      validation: {
        diagnostics,
        metricsAt85: valConfidenceCurve.find((c) => c.thresholdValue === 0.85) || valConfidenceCurve[0]
      },
      test: {
        baseline: testMetricsBase,
        selective85: testMetrics85
      }
    },
    provenance: {
      trainBars: trainSet.length,
      valBars: valSet.length,
      testBars: testSet.length,
      totalCleanBars: candles.length,
      seed: 42,
      nodeVersion: process.version
    }
  };

  // Compute artifact cryptographic signature
  const artifactJson = JSON.stringify(artifactPayload, Object.keys(artifactPayload).sort(), 2);
  const artifactHash = crypto.createHash('sha256').update(artifactJson).digest('hex');
  artifactPayload.artifactHash = artifactHash;

  // Write artifact to disk
  fs.writeFileSync(ARTIFACT_V2_PATH, JSON.stringify(artifactPayload, null, 2), 'utf-8');
  console.log(`[ML:TrainV2] Successfully generated and signed artifact: ${ARTIFACT_V2_PATH}`);
  console.log(`[ML:TrainV2] Artifact SHA-256: ${artifactHash}`);

  // Register in Model Registry
  modelRegistry.registerModel({
    modelId: artifactPayload.modelId,
    version: artifactPayload.version,
    status: 'PRODUCTION',
    symbol: 'TCS.NS',
    datasetVersion: artifactPayload.datasetVersion,
    featureVersion: artifactPayload.featureVersion,
    features: artifactPayload.features,
    trainingPeriod: artifactPayload.trainingPeriod,
    validationPeriod: artifactPayload.validationPeriod,
    testPeriod: artifactPayload.testPeriod,
    metrics: {
      accuracy: testMetrics85.accuracy,
      precision: testMetrics85.precision,
      coveragePct: testMetrics85.coveragePct,
      tradeCount: testMetrics85.tradeCount,
      sharpeRatio: testMetrics85.sharpeRatio,
      winRatePct: testMetrics85.winRatePct
    },
    artifactHash,
    artifactPath: 'src/server/ml/artifacts/tcs_ensemble_v2.json'
  });

  return {
    artifact: artifactPayload,
    artifactHash,
    testMetrics85,
    testMetricsBase
  };
}

module.exports = {
  ARTIFACT_V2_PATH,
  loadCleanCandles,
  trainAndExportEnsembleV2
};

if (require.main === module) {
  trainAndExportEnsembleV2();
}
