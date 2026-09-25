// ============================================================================
// Aurum Expanding-Window Walk-Forward Validation Engine v2
// Multiple chronological folds: 2019-2021 -> 2022, 2019-2022 -> 2023, 2019-2023 -> 2024
// FINAL TEST SET: 2025 (Untouched until all models and hyperparameters are frozen)
// ============================================================================

const LogisticRegressionModel = require('../training/models/logistic-regression');
const DecisionTreeModel = require('../training/models/decision-tree');
const RandomForestModel = require('../training/models/random-forest');
const GradientBoostingModel = require('../training/models/gradient-boosting');
const ProbabilityCalibrator = require('../calibration/probability-calibrator');
const EnsembleEngine = require('../ensemble/ensemble-engine');
const { NUMERIC_FEATURE_NAMES } = require('../features/feature-engineering-v2');
const { evaluateSelectivePredictions, generateConfidenceCurve } = require('../evaluation/selective-prediction');

const WALK_FORWARD_FOLDS = [
  { fold: 1, trainEnd: '2021-12-31', valStart: '2022-01-01', valEnd: '2022-12-31' },
  { fold: 2, trainEnd: '2022-12-31', valStart: '2023-01-01', valEnd: '2023-12-31' },
  { fold: 3, trainEnd: '2023-12-31', valStart: '2024-01-01', valEnd: '2024-12-31' }
];

const FROZEN_TEST_START = '2025-01-01';
const FROZEN_TEST_END = '2025-12-31';

/**
 * Splits dataset chronologically into train, validation, and untouched test sets
 */
function splitChronologicalData(dataset) {
  const trainSet = dataset.filter((d) => d.date <= '2023-12-31');
  const valSet = dataset.filter((d) => d.date >= '2024-01-01' && d.date <= '2024-12-31');
  const testSet = dataset.filter((d) => d.date >= FROZEN_TEST_START && d.date <= FROZEN_TEST_END);

  return { trainSet, valSet, testSet };
}

/**
 * Trains and evaluates an individual model architecture on a given split
 */
function trainAndScoreModel(ModelClass, options, trainSet, valSet, featureNames) {
  const model = new ModelClass(options);
  model.train(trainSet, featureNames, 'targetBinary');

  // Evaluate on validation set
  let correct = 0;
  const rawScores = [];
  const labels = [];

  for (const row of valSet) {
    const prob = model.predictProbability(row);
    const pred = prob >= 0.5 ? 1 : 0;
    const actual = row.targetBinary > 0 ? 1 : 0;
    if (pred === actual) correct++;
    rawScores.push(prob);
    labels.push(actual);
  }

  const accuracy = valSet.length > 0 ? Math.round((correct / valSet.length) * 1000) / 1000 : 0;
  return { model, accuracy, rawScores, labels };
}

/**
 * Executes full Expanding-Window Walk-Forward Validation across all folds
 */
function runWalkForwardValidation(dataset) {
  console.log('[ML:WalkForward] Starting Expanding-Window Walk-Forward Validation...');
  const featureNames = NUMERIC_FEATURE_NAMES;
  const foldResults = [];

  for (const foldConfig of WALK_FORWARD_FOLDS) {
    const trainData = dataset.filter((d) => d.date <= foldConfig.trainEnd);
    const valData = dataset.filter((d) => d.date >= foldConfig.valStart && d.date <= foldConfig.valEnd);

    // Train the 4 models on this fold
    const lr = trainAndScoreModel(LogisticRegressionModel, { iterations: 300, learningRate: 0.05 }, trainData, valData, featureNames);
    const dt = trainAndScoreModel(DecisionTreeModel, { maxDepth: 4, minSamplesSplit: 20 }, trainData, valData, featureNames);
    const rf = trainAndScoreModel(RandomForestModel, { nEstimators: 12, maxDepth: 4, seed: 42 + foldConfig.fold }, trainData, valData, featureNames);
    const gb = trainAndScoreModel(GradientBoostingModel, { nEstimators: 20, learningRate: 0.08 }, trainData, valData, featureNames);

    foldResults.push({
      fold: foldConfig.fold,
      trainRange: `2019-01-01 to ${foldConfig.trainEnd}`,
      valRange: `${foldConfig.valStart} to ${foldConfig.valEnd}`,
      trainRows: trainData.length,
      valRows: valData.length,
      models: {
        logisticRegression: lr.accuracy,
        decisionTree: dt.accuracy,
        randomForest: rf.accuracy,
        gradientBoosting: gb.accuracy
      }
    });

    console.log(`[ML:WalkForward] Fold ${foldConfig.fold} (${foldConfig.valRange}) -> LR: ${lr.accuracy} | DT: ${dt.accuracy} | RF: ${rf.accuracy} | GB: ${gb.accuracy}`);
  }

  // --------------------------------------------------------------------------
  // PRIMARY TRAINING ON 2019-2023 FOR THE FINAL CANDIDATE ENSEMBLE
  // --------------------------------------------------------------------------
  const { trainSet, valSet, testSet } = splitChronologicalData(dataset);

  const trainedModels = {
    lr: new LogisticRegressionModel({ iterations: 350, learningRate: 0.05, l2Penalty: 0.02 }).train(trainSet, featureNames),
    dt: new DecisionTreeModel({ maxDepth: 4, minSamplesSplit: 20, minSamplesLeaf: 10 }).train(trainSet, featureNames),
    rf: new RandomForestModel({ nEstimators: 15, maxDepth: 4, minSamplesSplit: 15, seed: 42 }).train(trainSet, featureNames),
    gb: new GradientBoostingModel({ nEstimators: 25, learningRate: 0.08 }).train(trainSet, featureNames)
  };

  // Evaluate raw validation predictions
  const valPredictions = valSet.map((row) => {
    const pLR = trainedModels.lr.predictProbability(row);
    const pDT = trainedModels.dt.predictProbability(row);
    const pRF = trainedModels.rf.predictProbability(row);
    const pGB = trainedModels.gb.predictProbability(row);
    const rawEnsemble = (pLR * 0.15) + (pDT * 0.20) + (pRF * 0.35) + (pGB * 0.30);
    return { rawEnsemble, actual: row.targetBinary };
  });

  // Fit Platt Scaling Calibrator on 2024 validation data
  const rawValScores = valPredictions.map((v) => v.rawEnsemble);
  const valLabels = valPredictions.map((v) => v.actual);

  const calibrator = new ProbabilityCalibrator();
  calibrator.fit(rawValScores, valLabels);

  const ensemble = new EnsembleEngine({
    models: trainedModels,
    weights: { lr: 0.15, dt: 0.20, rf: 0.35, gb: 0.30 },
    calibrator,
    defaultConfidenceThreshold: 0.85,
    minAgreementRatio: 0.75
  });

  // Generate validation confidence curve
  const valConfidenceCurve = generateConfidenceCurve(ensemble, valSet);

  // Overfitting check on validation data
  const trainPredictions = trainSet.map((row) => ensemble.evaluateFeatures(row));
  const trainAcc = trainPredictions.filter((p, i) => (p.prediction === 'BULLISH' ? 1 : 0) === trainSet[i].targetBinary).length / trainSet.length;
  const valAcc = valPredictions.filter((v) => (v.rawEnsemble >= 0.5 ? 1 : 0) === v.actual).length / valSet.length;

  let overfitFlag = false;
  let suspiciousFlag = false;

  if (trainAcc - valAcc > 0.35) {
    overfitFlag = true;
    console.warn(`[ML:OverfitWarning] Train Acc (${(trainAcc*100).toFixed(1)}%) significantly exceeds Validation Acc (${(valAcc*100).toFixed(1)}%).`);
  }

  return {
    walkForwardFolds: foldResults,
    trainRows: trainSet.length,
    valRows: valSet.length,
    testRows: testSet.length,
    ensemble,
    calibrator,
    valConfidenceCurve,
    diagnostics: {
      trainAccuracy: Math.round(trainAcc * 1000) / 1000,
      validationAccuracy: Math.round(valAcc * 1000) / 1000,
      overfitFlag,
      suspiciousFlag
    }
  };
}

module.exports = {
  WALK_FORWARD_FOLDS,
  FROZEN_TEST_START,
  FROZEN_TEST_END,
  splitChronologicalData,
  runWalkForwardValidation
};
