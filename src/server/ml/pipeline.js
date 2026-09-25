// ============================================================================
// Aurum ML Pipeline — Complete Reproducible One-Command Workflow
// Executes:
//   DATASET VALIDATION -> PREPROCESSING -> FEATURES -> TARGETS
//   -> TRAINING -> WALK-FORWARD VALIDATION -> ARTIFACT EXPORT
//   -> REGISTRY REGISTRATION -> RUNNER INFERENCE VERIFICATION
// ============================================================================

const fs = require('fs');
const path = require('path');
const { validateDataset } = require('./data/validate-dataset');
const { preprocessDataset } = require('./preprocessing/preprocess');
const { trainAndExportModel, ARTIFACT_PATH } = require('./training/train-decision-tree');
const modelRunner = require('./model-runner');
const modelRegistry = require('./model-registry');
const { runBacktest } = require('./backtest-engine');

const RAW_FILE = path.join(__dirname, 'data', 'raw', 'tcs_2019_2025.csv');

async function runFullPipeline() {
  console.log('================================================================');
  console.log('       AURUM PHASE-4 REPRODUCIBLE ML PIPELINE EXECUTION         ');
  console.log('================================================================\n');

  const startTime = Date.now();

  // 1. DATASET VALIDATION
  console.log('STAGE 1: DATASET INTEGRITY VALIDATION');
  if (!fs.existsSync(RAW_FILE)) {
    console.log('[Stage 1] Raw dataset missing. Attempting automatic download...');
    const { downloadFromYahoo } = require('./data/download-tcs-data');
    await downloadFromYahoo();
  }
  const valReport = validateDataset(RAW_FILE);
  if (!valReport.valid) {
    throw new Error(`Dataset validation failed: ${valReport.invalidRowsCount} invalid rows.`);
  }
  console.log(`   [PASS] Raw Dataset: ${valReport.validRowsCount} valid rows (${valReport.firstDate} to ${valReport.lastDate})`);
  console.log(`   [PASS] SHA-256 Checksum: ${valReport.checksumSha256}\n`);

  // 2. DATA PREPROCESSING
  console.log('STAGE 2: DATA PREPROCESSING & CANONICAL NORMALIZATION');
  const prepResult = preprocessDataset();
  console.log(`   [PASS] Clean Rows: ${prepResult.meta.cleanRowCount} | Outlier/Duplicates Rejected: ${prepResult.meta.rejectedRowsCount}`);
  console.log(`   [PASS] Clean Checksum: ${prepResult.meta.cleanChecksumSha256}\n`);

  // 3. TRAINING & WALK-FORWARD ARTIFACT GENERATION
  console.log('STAGE 3: FEATURES, TARGETS & CHRONOLOGICAL MODEL TRAINING');
  const { artifact, trainMetrics, valMetrics, testMetrics } = trainAndExportModel();
  console.log(`   [PASS] Model Trained & Exported to: ${ARTIFACT_PATH}`);
  console.log(`   [PASS] Artifact Hash: ${artifact.artifactHash}\n`);

  // 4. MODEL REGISTRY UPDATE
  console.log('STAGE 4: MODEL REGISTRY GOVERNANCE');
  const regEntry = modelRegistry.registerModel(artifact);
  console.log(`   [PASS] Registered Model ID: ${regEntry.modelId} (${regEntry.modelVersion}) | Status: ${regEntry.status}\n`);

  // 5. LIVE MODEL RUNNER INFERENCE TEST
  console.log('STAGE 5: LIVE RUNNER INFERENCE VERIFICATION');
  modelRunner.loadModel();
  const testSample = {
    rsi14: 64.2,
    returns1D: 0.85,
    volatility14D: 1.25,
    volumeZScore: 1.10
  };
  const inf = modelRunner.runInference('TCS', testSample, 3500.0);
  console.log(`   [PASS] Inference Execution Success:`);
  console.log(`          Symbol:     ${inf.symbol}`);
  console.log(`          Prediction: ${inf.prediction}`);
  console.log(`          Confidence: ${(inf.confidence * 100).toFixed(1)}%`);
  console.log(`          Target:     INR ${inf.targetPrice}`);
  console.log(`          Latency:    ${inf.latencyMs} ms\n`);

  // 6. BACKTEST ENGINE VERIFICATION
  console.log('STAGE 6: STRATEGY BACKTEST EXECUTION');
  const bt = await runBacktest({ symbol: 'TCS', initialCapital: 100000 });
  console.log(`   [PASS] Backtest Strategy: ${bt.strategyId}`);
  console.log(`          Trades:           ${bt.metrics.totalTrades}`);
  console.log(`          Win Rate:         ${bt.metrics.winRatePct}%`);
  console.log(`          Sharpe Ratio:     ${bt.metrics.sharpeRatio}`);
  console.log(`          Strategy Return:  ${bt.strategyReturnPct}% (vs Buy & Hold: ${bt.buyHoldReturnPct}%)\n`);

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('================================================================');
  console.log('                 PIPELINE REPRODUCTION SUMMARY                  ');
  console.log('================================================================');
  console.log(`DATASET:    TCS.NS (Daily OHLCV, 2019-01-01 to 2025-12-31, ${prepResult.meta.cleanRowCount} rows)`);
  console.log(`FEATURES:   returns1D, volatility14D, rsi14, volumeZScore (features-v1.4.0)`);
  console.log(`TARGET:     DIRECTIONAL_1D_RETURN_POSITIVE (1 if close[t+1] > close[t] else 0)`);
  console.log(`TRAINING:   2019-01-01 to 2023-12-31 (${artifact.provenance.trainingRows} bars) -> Acc: ${trainMetrics.classification.accuracy}`);
  console.log(`VALIDATION: 2024-01-01 to 2024-12-31 (${artifact.provenance.validationRows} bars) -> Acc: ${valMetrics.classification.accuracy}`);
  console.log(`TEST:       2025-01-01 to 2025-12-31 (${artifact.provenance.testRows} bars) -> Acc: ${testMetrics.classification.accuracy}`);
  console.log(`ARTIFACT:   ${artifact.artifactHash.slice(0, 16)}... (Version: ${artifact.version})`);
  console.log(`INFERENCE:  VERIFIED (${inf.latencyMs}ms latency)`);
  console.log(`BACKTEST:   VERIFIED (Outperformance: ${bt.outperformancePct}%)`);
  console.log(`TIME:       ${elapsedSec} seconds`);
  console.log('================================================================\n');

  return {
    success: true,
    artifact,
    valReport,
    prepResult,
    trainMetrics,
    valMetrics,
    testMetrics,
    inference: inf,
    backtest: bt
  };
}

if (require.main === module) {
  runFullPipeline().catch(err => {
    console.error('Pipeline execution crashed:', err);
    process.exit(1);
  });
}

module.exports = { runFullPipeline };
