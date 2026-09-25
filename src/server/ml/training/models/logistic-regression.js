// ============================================================================
// Deterministic L2 Regularized Logistic Regression Classifier
// Gradient descent optimization with z-score standardization
// ============================================================================

class LogisticRegressionModel {
  constructor(options = {}) {
    this.learningRate = options.learningRate || 0.05;
    this.l2Penalty = options.l2Penalty || 0.01;
    this.iterations = options.iterations || 300;
    this.weights = null; // Map<featureName, weight>
    this.bias = 0.0;
    this.means = {};
    this.stds = {};
    this.featureNames = [];
  }

  sigmoid(z) {
    if (z > 20) return 0.999999;
    if (z < -20) return 0.000001;
    return 1 / (1 + Math.exp(-z));
  }

  train(dataset, featureNames, targetKey = 'targetBinary') {
    this.featureNames = [...featureNames];
    const m = dataset.length;
    const n = this.featureNames.length;

    // 1. Compute means and stds for feature standardization
    for (const f of this.featureNames) {
      const vals = dataset.map((d) => Number(d[f]) || 0);
      const mean = vals.reduce((a, b) => a + b, 0) / m;
      const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (m - 1 || 1);
      const std = Math.sqrt(Math.max(1e-8, variance));
      this.means[f] = mean;
      this.stds[f] = std;
    }

    // 2. Initialize weights deterministically to 0
    this.weights = {};
    for (const f of this.featureNames) {
      this.weights[f] = 0.0;
    }
    this.bias = 0.0;

    // 3. Batch gradient descent
    for (let iter = 0; iter < this.iterations; iter++) {
      const weightGradients = {};
      for (const f of this.featureNames) weightGradients[f] = 0.0;
      let biasGradient = 0.0;

      for (let i = 0; i < m; i++) {
        const row = dataset[i];
        const y = Number(row[targetKey]) > 0 ? 1 : 0;

        let z = this.bias;
        for (const f of this.featureNames) {
          const xNorm = ((Number(row[f]) || 0) - this.means[f]) / this.stds[f];
          z += this.weights[f] * xNorm;
        }

        const pred = this.sigmoid(z);
        const error = pred - y;

        biasGradient += error;
        for (const f of this.featureNames) {
          const xNorm = ((Number(row[f]) || 0) - this.means[f]) / this.stds[f];
          weightGradients[f] += error * xNorm;
        }
      }

      // Update weights with L2 regularization
      this.bias -= (this.learningRate / m) * biasGradient;
      for (const f of this.featureNames) {
        const reg = (this.l2Penalty / m) * this.weights[f];
        this.weights[f] -= (this.learningRate / m) * (weightGradients[f] + reg);
      }
    }

    return this;
  }

  predictProbability(features) {
    if (!this.weights) {
      throw new Error('Logistic Regression model not trained.');
    }

    let z = this.bias;
    for (const f of this.featureNames) {
      const val = Number(features[f]) || 0;
      const mean = this.means[f] || 0;
      const std = this.stds[f] || 1;
      const xNorm = (val - mean) / std;
      z += (this.weights[f] || 0) * xNorm;
    }

    const prob = this.sigmoid(z);
    return Math.round(prob * 1000) / 1000;
  }

  predict(features, threshold = 0.5) {
    const prob = this.predictProbability(features);
    return prob >= threshold ? 1 : 0;
  }

  toJSON() {
    return {
      type: 'LOGISTIC_REGRESSION',
      featureNames: this.featureNames,
      weights: this.weights,
      bias: this.bias,
      means: this.means,
      stds: this.stds
    };
  }

  static fromJSON(data) {
    const model = new LogisticRegressionModel();
    model.featureNames = data.featureNames;
    model.weights = data.weights;
    model.bias = data.bias;
    model.means = data.means;
    model.stds = data.stds;
    return model;
  }
}

module.exports = LogisticRegressionModel;
