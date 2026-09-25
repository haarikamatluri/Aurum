// ============================================================================
// Deterministic Random Forest Classifier
// Bagging ensemble of randomized decision trees with pseudo-random seed
// ============================================================================

const DecisionTreeModel = require('./decision-tree');

/**
 * Deterministic PRNG (Mulberry32)
 */
function createPRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class RandomForestModel {
  constructor(options = {}) {
    this.nEstimators = options.nEstimators || 12;
    this.maxDepth = options.maxDepth || 4;
    this.minSamplesSplit = options.minSamplesSplit || 20;
    this.minSamplesLeaf = options.minSamplesLeaf || 10;
    this.maxFeatures = options.maxFeatures || 0.6; // Feature subsampling ratio
    this.seed = options.seed || 42;
    this.trees = [];
    this.featureNames = [];
  }

  train(dataset, featureNames, targetKey = 'targetBinary') {
    this.featureNames = [...featureNames];
    this.trees = [];
    const prng = createPRNG(this.seed);
    const n = dataset.length;
    const numSubFeatures = Math.max(3, Math.floor(this.featureNames.length * this.maxFeatures));

    for (let t = 0; t < this.nEstimators; t++) {
      // 1. Bootstrap sample with replacement
      const bootstrap = [];
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(prng() * n);
        bootstrap.push(dataset[idx]);
      }

      // 2. Feature subsampling
      const shuffledFeatures = [...this.featureNames].sort(() => prng() - 0.5);
      const subFeatures = shuffledFeatures.slice(0, numSubFeatures);

      // 3. Train individual tree
      const tree = new DecisionTreeModel({
        maxDepth: this.maxDepth,
        minSamplesSplit: this.minSamplesSplit,
        minSamplesLeaf: this.minSamplesLeaf
      });
      tree.train(bootstrap, subFeatures, targetKey);
      this.trees.push(tree);
    }

    return this;
  }

  predictProbability(features) {
    if (!this.trees || this.trees.length === 0) {
      throw new Error('Random Forest model not trained.');
    }

    let sumProb = 0;
    for (const tree of this.trees) {
      sumProb += tree.predictProbability(features);
    }
    const avg = sumProb / this.trees.length;
    return Math.round(avg * 1000) / 1000;
  }

  predict(features, threshold = 0.5) {
    return this.predictProbability(features) >= threshold ? 1 : 0;
  }

  toJSON() {
    return {
      type: 'RANDOM_FOREST',
      nEstimators: this.nEstimators,
      maxDepth: this.maxDepth,
      minSamplesSplit: this.minSamplesSplit,
      minSamplesLeaf: this.minSamplesLeaf,
      maxFeatures: this.maxFeatures,
      seed: this.seed,
      featureNames: this.featureNames,
      trees: this.trees.map((t) => t.toJSON())
    };
  }

  static fromJSON(data) {
    const model = new RandomForestModel({
      nEstimators: data.nEstimators,
      maxDepth: data.maxDepth,
      minSamplesSplit: data.minSamplesSplit,
      minSamplesLeaf: data.minSamplesLeaf,
      maxFeatures: data.maxFeatures,
      seed: data.seed
    });
    model.featureNames = data.featureNames;
    model.trees = data.trees.map((t) => DecisionTreeModel.fromJSON(t));
    return model;
  }
}

module.exports = RandomForestModel;
