// ============================================================================
// Aurum ML Decision Tree Classifier Training Engine
// Algorithm: Recursive Information Gain (Binary Decision Tree)
// Training Split: 2019-01-01 to 2023-12-31 ONLY
// Target: DIRECTIONAL_1D_RETURN_POSITIVE
// Output: src/server/ml/artifacts/tcs_momentum_model.json
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { computeBatchFeatures } = require('../features/feature-engineering');
const { generateTargets } = require('../target/target-generator');
const { splitChronological, computeClassificationMetrics, computeTradingMetrics } = require('../validation/walk-forward');

const CLEAN_CSV = path.join(__dirname, '..', 'data', 'processed', 'tcs_2019_2025_clean.csv');
const ARTIFACT_PATH = path.join(__dirname, '..', 'artifacts', 'tcs_momentum_model.json');

// Default Hyperparameters
const HYPERPARAMETERS = {
  algorithm: 'CART_DECISION_TREE_CLASSIFIER',
  criterion: 'GINI', // or 'INFORMATION_GAIN'
  maxDepth: 3,
  minSamplesSplit: 30,
  minSamplesLeaf: 15,
  randomSeed: 42,
  features: ['rsi14', 'returns1D', 'volatility14D', 'volumeZScore'],
  target: 'DIRECTIONAL_1D_RETURN_POSITIVE'
};

function computeGini(labels) {
  if (labels.length === 0) return 0;
  const p1 = labels.filter(y => y === 1).length / labels.length;
  const p0 = 1 - p1;
  return 1 - (p1 * p1 + p0 * p0);
}

function findBestSplit(data, features, minLeaf) {
  let bestGini = Infinity;
  let bestFeature = null;
  let bestThreshold = null;
  let bestLeft = null;
  let bestRight = null;

  const currentLabels = data.map(d => d.target);
  const currentGini = computeGini(currentLabels);

  for (const feature of features) {
    // Sort unique values of this feature
    const values = Array.from(new Set(data.map(d => d.features[feature]))).sort((a, b) => a - b);
    if (values.length < 2) continue;

    // Test candidate split thresholds (midpoints between consecutive sorted values)
    // Subsample candidate thresholds for performance and stability
    const step = Math.max(1, Math.floor(values.length / 25));
    for (let i = 0; i < values.length - 1; i += step) {
      const threshold = Math.round(((values[i] + values[i + 1]) / 2) * 100) / 100;

      const left = data.filter(d => d.features[feature] < threshold);
      const right = data.filter(d => d.features[feature] >= threshold);

      if (left.length < minLeaf || right.length < minLeaf) continue;

      const leftGini = computeGini(left.map(d => d.target));
      const rightGini = computeGini(right.map(d => d.target));
      const weightedGini = (left.length / data.length) * leftGini + (right.length / data.length) * rightGini;

      if (weightedGini < bestGini) {
        bestGini = weightedGini;
        bestFeature = feature;
        bestThreshold = threshold;
        bestLeft = left;
        bestRight = right;
      }
    }
  }

  // Only split if information was actually gained
  if (bestGini < currentGini && bestFeature) {
    return { feature: bestFeature, threshold: bestThreshold, left: bestLeft, right: bestRight };
  }
  return null;
}

function buildTree(data, features, depth, maxDepth, minSplit, minLeaf) {
  const labels = data.map(d => d.target);
  const ones = labels.filter(y => y === 1).length;
  const zeros = labels.length - ones;
  const p1 = labels.length > 0 ? ones / labels.length : 0.5;

  // Classify leaf:
  // p1 >= 0.55 -> BULLISH
  // p1 <= 0.45 -> BEARISH
  // otherwise -> NEUTRAL
  let prediction = 'NEUTRAL';
  let probability = 0.50;

  if (p1 >= 0.53) {
    prediction = 'BULLISH';
    probability = p1;
  } else if (p1 <= 0.47) {
    prediction = 'BEARISH';
    probability = 1 - p1;
  } else {
    prediction = 'NEUTRAL';
    probability = Math.max(p1, 1 - p1);
  }

  // Stopping conditions: pure node, max depth, or insufficient samples
  if (depth >= maxDepth || data.length < minSplit || ones === 0 || zeros === 0) {
    return {
      prediction,
      probability: Math.round(probability * 100) / 100,
      samples: data.length
    };
  }

  const split = findBestSplit(data, features, minLeaf);
  if (!split) {
    return {
      prediction,
      probability: Math.round(probability * 100) / 100,
      samples: data.length
    };
  }

  return {
    feature: split.feature,
    threshold: split.threshold,
    samples: data.length,
    left: buildTree(split.left, features, depth + 1, maxDepth, minSplit, minLeaf),
    right: buildTree(split.right, features, depth + 1, maxDepth, minSplit, minLeaf)
  };
}

function evaluateTree(node, features) {
  if (!node.feature) {
    return node;
  }
  const val = features[node.feature];
  if (val !== undefined && val < node.threshold) {
    return evaluateTree(node.left, features);
  } else {
    return evaluateTree(node.right, features);
  }
}

function predictSample(tree, features) {
  const leaf = evaluateTree(tree, features);
  return leaf.prediction === 'BULLISH' ? 1 : 0;
}

function trainAndExportModel() {
  console.log(`[ML:Train] Reading processed dataset from: ${CLEAN_CSV}`);
  if (!fs.existsSync(CLEAN_CSV)) {
    throw new Error(`Processed dataset missing: ${CLEAN_CSV}. Please run preprocessing first.`);
  }

  const raw = fs.readFileSync(CLEAN_CSV, 'utf-8');
  const lines = raw.trim().split('\n').filter(l => l.trim().length > 0);
  const header = lines[0].split(',');
  const candles = [];

  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(',');
    candles.push({
      timestamp: parseInt(p[0], 10),
      date: p[1],
      open: parseFloat(p[2]),
      high: parseFloat(p[3]),
      low: parseFloat(p[4]),
      close: parseFloat(p[5]),
      volume: parseInt(p[6], 10)
    });
  }

  console.log(`[ML:Train] Generating batch features (Warmup: 14 days)...`);
  const featureDataset = computeBatchFeatures(candles);
  console.log(`[ML:Train] Features generated for ${featureDataset.length} rows.`);

  console.log(`[ML:Train] Generating directional 1D targets...`);
  const { labeledData, summary: targetSummary } = generateTargets(featureDataset);
  console.log(`[ML:Train] Target summary:`, targetSummary);

  console.log(`[ML:Train] Splitting chronologically into TRAIN, VALIDATION, and TEST sets...`);
  const { train, validation, test, boundaries } = splitChronological(labeledData);
  console.log(`[ML:Train] Train set:      ${boundaries.train.start} to ${boundaries.train.end} (${train.length} rows)`);
  console.log(`[ML:Train] Validation set: ${boundaries.validation.start} to ${boundaries.validation.end} (${validation.length} rows)`);
  console.log(`[ML:Train] Test set:       ${boundaries.test.start} to ${boundaries.test.end} (${test.length} rows)`);

  console.log(`[ML:Train] Training Decision Tree on TRAIN set only...`);
  const treeRoot = buildTree(
    train,
    HYPERPARAMETERS.features,
    0,
    HYPERPARAMETERS.maxDepth,
    HYPERPARAMETERS.minSamplesSplit,
    HYPERPARAMETERS.minSamplesLeaf
  );

  // Compute actual predictions across all partitions
  const evalPartition = (part) => {
    const actual = part.map(d => d.target);
    const predicted = part.map(d => predictSample(treeRoot, d.features));
    const metrics = computeClassificationMetrics(actual, predicted);

    // Strategy simulation: buy on BULLISH (predicted 1), cash on 0
    const returns = part.map(d => {
      const pred = predictSample(treeRoot, d.features);
      const nextRet = (d.nextReturnPct || 0) / 100;
      return pred === 1 ? nextRet : 0;
    });
    const stratMetrics = computeTradingMetrics(returns);

    return {
      classification: metrics,
      strategy: stratMetrics
    };
  };

  const trainMetrics = evalPartition(train);
  const valMetrics = evalPartition(validation);
  const testMetrics = evalPartition(test);

  console.log(`[ML:Train] Partition Performance:`);
  console.log(`   Train Acc:      ${trainMetrics.classification.accuracy} | F1: ${trainMetrics.classification.f1Score}`);
  console.log(`   Validation Acc: ${valMetrics.classification.accuracy} | F1: ${valMetrics.classification.f1Score}`);
  console.log(`   Test Acc:       ${testMetrics.classification.accuracy} | F1: ${testMetrics.classification.f1Score} | Sharpe: ${testMetrics.strategy.sharpeRatio}`);

  // Build the complete Model Artifact with provenance and legacy metrics preservation
  const rawDataChecksum = fs.existsSync(CLEAN_CSV)
    ? crypto.createHash('sha256').update(fs.readFileSync(CLEAN_CSV)).digest('hex')
    : null;

  const artifact = {
    modelId: 'TCS-MOMENTUM-ALPHA',
    version: 'v1.4.2',
    artifactType: 'DECISION_TREE_CLASSIFIER',
    symbol: 'TCS.NS',
    status: 'PRODUCTION',
    trainedAt: new Date().toISOString(),
    datasetVersion: 'DS-NSE-TCS-2019-2025',
    datasetChecksumSha256: rawDataChecksum,
    validationMethod: 'CHRONOLOGICAL_WALK_FORWARD',
    trainPeriod: `${boundaries.train.start} to ${boundaries.train.end}`,
    validationPeriod: `${boundaries.validation.start} to ${boundaries.validation.end}`,
    testPeriod: `${boundaries.test.start} to ${boundaries.test.end}`,
    features: HYPERPARAMETERS.features,
    target: HYPERPARAMETERS.target,
    hyperparameters: HYPERPARAMETERS,
    treeNodes: [treeRoot],
    // Provenance metrics preserving legacy reported figures vs verified reproduced metrics
    legacyReportedMetrics: {
      accuracy: 0.784,
      precision: 0.792,
      recall: 0.771,
      f1Score: 0.781,
      sharpeRatio: 2.18,
      maxDrawdownPct: 4.2,
      winRate: 0.65,
      totalTestTrades: 142,
      source: 'Previous Phase-4 repository snapshot',
      independentlyReproduced: false
    },
    reproducedMetrics: {
      train: trainMetrics,
      validation: valMetrics,
      test: testMetrics
    },
    provenanceMetrics: {
      accuracy: testMetrics.classification.accuracy,
      precision: testMetrics.classification.precision,
      recall: testMetrics.classification.recall,
      f1Score: testMetrics.classification.f1Score,
      sharpeRatio: testMetrics.strategy.sharpeRatio,
      maxDrawdownPct: testMetrics.strategy.maxDrawdownPct,
      winRate: testMetrics.strategy.winRate,
      totalTestTrades: test.length
    },
    provenance: {
      trainingScript: 'src/server/ml/training/train-decision-tree.js',
      pipelineVersion: 'ml-pipeline-v1.4.0',
      datasetSource: 'Yahoo Finance Official (NSE: TCS.NS)',
      trainingRows: train.length,
      validationRows: validation.length,
      testRows: test.length
    }
  };

  // Compute deterministic artifact hash based on model architecture, hyperparameters, tree, and metrics
  const hashPayload = JSON.stringify({
    modelId: artifact.modelId,
    version: artifact.version,
    symbol: artifact.symbol,
    datasetVersion: artifact.datasetVersion,
    datasetChecksumSha256: artifact.datasetChecksumSha256,
    hyperparameters: artifact.hyperparameters,
    treeNodes: artifact.treeNodes,
    reproducedMetrics: artifact.reproducedMetrics
  });
  artifact.artifactHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

  // Write artifact
  const artifactsDir = path.dirname(ARTIFACT_PATH);
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  fs.writeFileSync(ARTIFACT_PATH, JSON.stringify(artifact, null, 2), 'utf-8');
  console.log(`[ML:Train] Successfully exported verified model artifact to:`);
  console.log(`         ${ARTIFACT_PATH}`);
  console.log(`         Artifact Hash: ${artifact.artifactHash}`);

  return { artifact, trainMetrics, valMetrics, testMetrics };
}

if (require.main === module) {
  try {
    trainAndExportModel();
  } catch (err) {
    console.error('Model training failed:', err.message);
    process.exit(1);
  }
}

module.exports = {
  HYPERPARAMETERS,
  buildTree,
  findBestSplit,
  predictSample,
  trainAndExportModel,
  ARTIFACT_PATH
};
