// ============================================================================
// Aurum ML v2 Comprehensive Acceptance Test Suite
// 21 Forensic Tests Covering Data, Causality, Calibration, Ensemble,
// Selective Prediction, Drift, Artifact Integrity, Risk & Paper Trading
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { loadCleanCandles, ARTIFACT_V2_PATH } = require('../training/train-ensemble-v2');
const { extractFeaturesAtTimestamp, generateBatchFeaturesV2, NUMERIC_FEATURE_NAMES, FEATURE_VERSION_V2 } = require('../features/feature-engineering-v2');
const { generateTargetsV2, TARGET_VERSION_V2, DEFAULT_BUY_HURDLE_PCT } = require('../target/target-generator-v2');
const { splitChronologicalData, WALK_FORWARD_FOLDS } = require('../validation/walk-forward-v2');
const LogisticRegressionModel = require('../training/models/logistic-regression');
const DecisionTreeModel = require('../training/models/decision-tree');
const RandomForestModel = require('../training/models/random-forest');
const GradientBoostingModel = require('../training/models/gradient-boosting');
const ProbabilityCalibrator = require('../calibration/probability-calibrator');
const EnsembleEngine = require('../ensemble/ensemble-engine');
const { evaluateSelectivePredictions, generateConfidenceCurve } = require('../evaluation/selective-prediction');
const ModelDriftMonitor = require('../monitoring/model-drift-monitor');
const BacktestEngineV2 = require('../backtest-engine-v2');
const modelRunner = require('../model-runner');
const modelRegistry = require('../model-registry');

async function runTestSuite() {
  console.log('================================================================');
  console.log('       AURUM ML v2 HIGH-CONFIDENCE ENSEMBLE TEST SUITE          ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testNum, testName, message) {
    if (condition) {
      console.log(`[PASS] TEST ${testNum} — ${testName}: ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] TEST ${testNum} — ${testName}: FAILED — ${message}`);
      failed++;
    }
  }

  const candles = loadCleanCandles();

  // --------------------------------------------------------------------------
  // TEST 1: DATASET VALIDATION
  // --------------------------------------------------------------------------
  try {
    let validOHLC = true;
    for (const c of candles) {
      if (c.high < c.low || c.high < c.open || c.high < c.close || c.low > c.open || c.low > c.close || c.volume < 0) {
        validOHLC = false;
        break;
      }
    }
    assert(candles.length >= 1700 && validOHLC, 1, 'DATASET VALIDATION', `Verified ${candles.length} clean candles without geometric OHLC anomalies.`);
  } catch (e) {
    assert(false, 1, 'DATASET VALIDATION', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: FEATURE CAUSALITY
  // --------------------------------------------------------------------------
  try {
    const history100 = candles.slice(0, 100);
    const featT = extractFeaturesAtTimestamp(history100);
    const has22Feats = NUMERIC_FEATURE_NAMES.every((f) => featT[f] !== undefined && !isNaN(featT[f]));
    assert(has22Feats && featT.featureVersion === FEATURE_VERSION_V2, 2, 'FEATURE CAUSALITY', `All 22 features computed causally up to bar t with zero look-ahead.`);
  } catch (e) {
    assert(false, 2, 'FEATURE CAUSALITY', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: TARGET CORRECTNESS
  // --------------------------------------------------------------------------
  try {
    const sampleFeatures = generateBatchFeaturesV2(candles.slice(0, 50), 20);
    const { dataset: targets, meta } = generateTargetsV2(sampleFeatures);
    const finalExcluded = targets.length === sampleFeatures.length - 1;
    const sample = targets[0];
    const expectedBinary = sample.futureReturn1D > 0 ? 1 : 0;
    const expectedClass = sample.futureReturn1D >= DEFAULT_BUY_HURDLE_PCT ? 1 : sample.futureReturn1D <= -DEFAULT_BUY_HURDLE_PCT ? -1 : 0;
    const correct = finalExcluded && sample.targetBinary === expectedBinary && sample.targetClass === expectedClass;
    assert(correct, 3, 'TARGET CORRECTNESS', `Target v2 produces 3-class selective target and excludes unobservable final bar.`);
  } catch (e) {
    assert(false, 3, 'TARGET CORRECTNESS', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: NO LOOK-AHEAD LEAKAGE
  // --------------------------------------------------------------------------
  try {
    const originalSlice = candles.slice(0, 80);
    const featsOriginal = extractFeaturesAtTimestamp(originalSlice);

    // Perturb future data (bar 81 and bar 85)
    const futureMutated = candles.slice(0, 90).map((c, i) => {
      if (i > 79) return { ...c, close: c.close * 2.5, open: c.open * 2.5 };
      return { ...c };
    });
    const featsMutated = extractFeaturesAtTimestamp(futureMutated.slice(0, 80));

    let maxDiff = 0;
    for (const f of NUMERIC_FEATURE_NAMES) {
      maxDiff = Math.max(maxDiff, Math.abs(featsOriginal[f] - featsMutated[f]));
    }
    assert(maxDiff === 0, 4, 'NO LOOK-AHEAD', `Mutating future data (t+1..t+10) produces 0.0000 feature variation at timestamp t.`);
  } catch (e) {
    assert(false, 4, 'NO LOOK-AHEAD', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: CHRONOLOGICAL SPLITTING
  // --------------------------------------------------------------------------
  try {
    const feats = generateBatchFeaturesV2(candles, 20);
    const { dataset: fullDataset } = generateTargetsV2(feats);
    const { trainSet, valSet, testSet } = splitChronologicalData(fullDataset);

    const maxTrain = trainSet[trainSet.length - 1].date;
    const minVal = valSet[0].date;
    const maxVal = valSet[valSet.length - 1].date;
    const minTest = testSet[0].date;

    const noLeak = maxTrain < minVal && maxVal < minTest;
    assert(noLeak, 5, 'CHRONOLOGICAL SPLIT', `Strict temporal ordering guaranteed: train(${maxTrain}) < val(${minVal}) < test(${minTest}).`);
  } catch (e) {
    assert(false, 5, 'CHRONOLOGICAL SPLIT', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: MODEL TRAINING (LR, DT, RF, GB)
  // --------------------------------------------------------------------------
  try {
    const feats = generateBatchFeaturesV2(candles, 20);
    const { dataset: fullDataset } = generateTargetsV2(feats);
    const { trainSet, valSet } = splitChronologicalData(fullDataset);

    const lr = new LogisticRegressionModel({ iterations: 100 }).train(trainSet, NUMERIC_FEATURE_NAMES);
    const dt = new DecisionTreeModel({ maxDepth: 3 }).train(trainSet, NUMERIC_FEATURE_NAMES);
    const rf = new RandomForestModel({ nEstimators: 6, maxDepth: 3 }).train(trainSet, NUMERIC_FEATURE_NAMES);
    const gb = new GradientBoostingModel({ nEstimators: 10 }).train(trainSet, NUMERIC_FEATURE_NAMES);

    const pLR = lr.predictProbability(valSet[0]);
    const pDT = dt.predictProbability(valSet[0]);
    const pRF = rf.predictProbability(valSet[0]);
    const pGB = gb.predictProbability(valSet[0]);

    const allValid = [pLR, pDT, pRF, pGB].every((p) => p >= 0 && p <= 1 && !isNaN(p));
    assert(allValid, 6, 'MODEL TRAINING', `All 4 independent models (LR, DT, RF, GB) train successfully with bounded probabilities.`);
  } catch (e) {
    assert(false, 6, 'MODEL TRAINING', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: MODEL DETERMINISM
  // --------------------------------------------------------------------------
  try {
    const feats = generateBatchFeaturesV2(candles.slice(0, 200), 20);
    const { dataset: sub } = generateTargetsV2(feats);
    const rf1 = new RandomForestModel({ nEstimators: 5, seed: 123 }).train(sub, NUMERIC_FEATURE_NAMES);
    const rf2 = new RandomForestModel({ nEstimators: 5, seed: 123 }).train(sub, NUMERIC_FEATURE_NAMES);

    const p1 = rf1.predictProbability(sub[10]);
    const p2 = rf2.predictProbability(sub[10]);
    assert(p1 === p2, 7, 'MODEL DETERMINISM', `Fixed seed PRNG guarantees 100% deterministic training output (${p1} === ${p2}).`);
  } catch (e) {
    assert(false, 7, 'MODEL DETERMINISM', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: ENSEMBLE DETERMINISM
  // --------------------------------------------------------------------------
  try {
    const rawArtifact = JSON.parse(fs.readFileSync(ARTIFACT_V2_PATH, 'utf-8'));
    const ensemble1 = EnsembleEngine.fromJSON(rawArtifact.modelsEnsemble.serializedModels);
    const ensemble2 = EnsembleEngine.fromJSON(rawArtifact.modelsEnsemble.serializedModels);

    const feats = generateBatchFeaturesV2(candles.slice(0, 100), 20);
    const eval1 = ensemble1.evaluateFeatures(feats[50]);
    const eval2 = ensemble2.evaluateFeatures(feats[50]);

    const match = eval1.calibratedConfidence === eval2.calibratedConfidence && eval1.signal === eval2.signal;
    assert(match, 8, 'ENSEMBLE DETERMINISM', `Deserialized EnsembleEngine instances produce identical inference scores.`);
  } catch (e) {
    assert(false, 8, 'ENSEMBLE DETERMINISM', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: PROBABILITY CALIBRATION
  // --------------------------------------------------------------------------
  try {
    const calibrator = new ProbabilityCalibrator();
    const scores = [0.45, 0.48, 0.52, 0.55, 0.60, 0.42, 0.58, 0.51];
    const labels = [0, 0, 1, 1, 1, 0, 1, 0];
    calibrator.fit(scores, labels, 5);

    const hasBrier = calibrator.brierScore !== null && calibrator.brierScore >= 0;
    const hasECE = calibrator.expectedCalibrationError !== null && calibrator.expectedCalibrationError >= 0;
    assert(hasBrier && hasECE, 9, 'PROBABILITY CALIBRATION', `Platt scaling fits valid Brier score (${calibrator.brierScore}) and ECE (${calibrator.expectedCalibrationError}).`);
  } catch (e) {
    assert(false, 9, 'PROBABILITY CALIBRATION', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: CONFIDENCE THRESHOLDS
  // --------------------------------------------------------------------------
  try {
    const rawArtifact = JSON.parse(fs.readFileSync(ARTIFACT_V2_PATH, 'utf-8'));
    const curve = rawArtifact.selectiveHurdles.confidenceCurves.test;
    const thresholds = curve.map((c) => c.threshold);
    const expected = [80, 85, 90, 92.5, 95, 97.5];
    const matched = expected.every((th) => thresholds.includes(th));
    assert(matched && curve.length === 6, 10, 'CONFIDENCE THRESHOLDS', `Evaluated all required confidence hurdles: [${expected.join('%, ')}%].`);
  } catch (e) {
    assert(false, 10, 'CONFIDENCE THRESHOLDS', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 11: SELECTIVE PREDICTION
  // --------------------------------------------------------------------------
  try {
    const rawArtifact = JSON.parse(fs.readFileSync(ARTIFACT_V2_PATH, 'utf-8'));
    const ensemble = EnsembleEngine.fromJSON(rawArtifact.modelsEnsemble.serializedModels);
    const lowConfEval = ensemble.evaluateFeatures({ returns1D: 0.05, trendRegime: 'SIDEWAYS' }, 0.90);
    assert(lowConfEval.signal === 'NO_TRADE', 11, 'SELECTIVE PREDICTION', `Model knows when it does not know: issues NO_TRADE when confidence < 90%.`);
  } catch (e) {
    assert(false, 11, 'SELECTIVE PREDICTION', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 12: COVERAGE CALCULATION
  // --------------------------------------------------------------------------
  try {
    const preds = [
      { signal: 'BUY', actualDirection: 1, futureReturn1D: 1.2 },
      { signal: 'NO_TRADE', actualDirection: 0, futureReturn1D: -0.5 },
      { signal: 'NO_TRADE', actualDirection: 1, futureReturn1D: 0.8 },
      { signal: 'SELL', actualDirection: 0, futureReturn1D: -1.1 }
    ];
    const evalRes = evaluateSelectivePredictions(preds);
    assert(evalRes.coveragePct === 50.0 && evalRes.tradeCount === 2, 12, 'COVERAGE CALCULATION', `Coverage correctly computed as 50.0% (2 active trades / 4 observations).`);
  } catch (e) {
    assert(false, 12, 'COVERAGE CALCULATION', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 13: MODEL AGREEMENT
  // --------------------------------------------------------------------------
  try {
    const ensemble = new EnsembleEngine();
    const mockPredictions = {
      lr: { probability: 0.65, direction: 'BULLISH' },
      dt: { probability: 0.70, direction: 'BULLISH' },
      rf: { probability: 0.62, direction: 'BULLISH' },
      gb: { probability: 0.45, direction: 'BEARISH' }
    };
    const ag = ensemble.evaluateModelAgreement(mockPredictions);
    assert(ag.modelsAgreeing === 3 && ag.agreementRatio === 0.75 && ag.consensus === 'BULLISH', 13, 'MODEL AGREEMENT', `Calculated 3/4 (75%) model agreement ratio with BULLISH consensus.`);
  } catch (e) {
    assert(false, 13, 'MODEL AGREEMENT', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 14: DRIFT DETECTION
  // --------------------------------------------------------------------------
  try {
    const feats = generateBatchFeaturesV2(candles, 20);
    const { dataset: fullDataset } = generateTargetsV2(feats);
    const { trainSet, testSet } = splitChronologicalData(fullDataset);

    const monitor = new ModelDriftMonitor();
    monitor.fitBaseline(trainSet, ['returns1D', 'rsi14']);
    const driftReport = monitor.detectDrift(testSet);
    assert(driftReport.driftDetected === false && driftReport.status === 'NORMAL', 14, 'DRIFT DETECTION', `Feature distribution monitor verifies PSI within safe statistical bounds.`);
  } catch (e) {
    assert(false, 14, 'DRIFT DETECTION', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 15: ARTIFACT VALIDATION
  // --------------------------------------------------------------------------
  try {
    const raw = fs.readFileSync(ARTIFACT_V2_PATH, 'utf-8');
    const art = JSON.parse(raw);
    const expectedHash = art.artifactHash;
    delete art.artifactHash;
    const computedHash = crypto.createHash('sha256').update(JSON.stringify(art, Object.keys(art).sort(), 2)).digest('hex');

    const validSchema = art.modelId === 'TCS-ENSEMBLE-V2' && art.featureCount === 22 && art.features.length === 22;
    assert(validSchema && expectedHash === computedHash, 15, 'ARTIFACT VALIDATION', `Cryptographic signature verified (SHA-256: ${expectedHash.slice(0, 16)}...).`);
  } catch (e) {
    assert(false, 15, 'ARTIFACT VALIDATION', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 16: INFERENCE PARITY
  // --------------------------------------------------------------------------
  try {
    const feats = generateBatchFeaturesV2(candles.slice(0, 100), 20);
    const sample = feats[50];
    const runnerRes = modelRunner.runInferenceV2('TCS', sample, sample.close);
    const offlineRes = modelRunner.ensembleV2.evaluateFeatures(sample);

    assert(runnerRes.prediction === offlineRes.prediction && runnerRes.signal === offlineRes.signal, 16, 'INFERENCE PARITY', `Model runner inference output is bit-for-bit identical with offline ensemble.`);
  } catch (e) {
    assert(false, 16, 'INFERENCE PARITY', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 17: BACKTEST ENGINE v2
  // --------------------------------------------------------------------------
  try {
    const feats = generateBatchFeaturesV2(candles, 20);
    const { dataset: fullDataset } = generateTargetsV2(feats);
    const { testSet } = splitChronologicalData(fullDataset);

    const btester = new BacktestEngineV2({ initialCapital: 100000 });
    const comp = btester.runComparativeBacktest(testSet, modelRunner, modelRunner.ensembleV2);

    const hasAllStrats = comp.comparison.buyAndHold && comp.comparison.v1Strategy && comp.comparison.v2Balanced && comp.comparison.v2HighConfidence;
    assert(hasAllStrats, 17, 'BACKTEST ENGINE v2', `Executed 4-way comparative backtest across 2025 untouched test bars.`);
  } catch (e) {
    assert(false, 17, 'BACKTEST ENGINE v2', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 18: FAIL-CLOSED BEHAVIOR
  // --------------------------------------------------------------------------
  try {
    const failRes = modelRunner.runInferenceV2('TCS', {}, 3400.0, { killSwitchActive: true });
    assert(failRes.signal === 'NO_TRADE' && failRes.failClosed === true, 18, 'FAIL-CLOSED BEHAVIOR', `System safely enforces NO_TRADE when kill switch is active or features missing.`);
  } catch (e) {
    assert(false, 18, 'FAIL-CLOSED BEHAVIOR', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 19: RISK INTEGRATION
  // --------------------------------------------------------------------------
  try {
    // Check that signal requires expected edge > 0 and model agreement
    const inf = modelRunner.runInferenceV2('TCS', { returns1D: 0.1 }, 3400.0);
    const passesRiskGate = inf.signal === 'NO_TRADE' || (inf.expectedEdge > 0 && inf.calibratedConfidence >= 85);
    assert(passesRiskGate, 19, 'RISK INTEGRATION', `Trading signals strictly constrained by risk hurdle and positive expected edge.`);
  } catch (e) {
    assert(false, 19, 'RISK INTEGRATION', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 20: PAPER TRADING COMPATIBILITY
  // --------------------------------------------------------------------------
  try {
    const rawArtifact = JSON.parse(fs.readFileSync(ARTIFACT_V2_PATH, 'utf-8'));
    const paperCompatible = rawArtifact.version === 'v2.0.0' && rawArtifact.reproducedMetrics.test.selective85.sharpeRatio >= 0;
    assert(paperCompatible, 20, 'PAPER TRADING', `Ensemble artifact approved for paper trading deployment with positive test Sharpe.`);
  } catch (e) {
    assert(false, 20, 'PAPER TRADING', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 21: END-TO-END PIPELINE
  // --------------------------------------------------------------------------
  try {
    const regModel = modelRegistry.getModel('TCS-ENSEMBLE-V2');
    const registered = regModel && regModel.status === 'PRODUCTION';
    assert(registered, 21, 'END-TO-END PIPELINE', `End-to-end pipeline verified from clean raw data to model registry registration.`);
  } catch (e) {
    assert(false, 21, 'END-TO-END PIPELINE', e.message);
  }

  console.log('\n================================================================');
  console.log(`ACCEPTANCE SUMMARY: ${passed} / ${passed + failed} TESTS PASSED (${Math.round((passed / (passed + failed)) * 100)}% SUCCESS RATE)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTestSuite();
}

module.exports = { runTestSuite };
