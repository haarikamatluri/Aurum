// ============================================================================
// Deterministic Gradient Boosting Classifier
// High-efficiency O(N log N) sorted residual scan stumps with shrinkage
// ============================================================================

class RegressionStump {
  constructor(feature, threshold, leftVal, rightVal) {
    this.feature = feature;
    this.threshold = threshold;
    this.leftVal = leftVal;
    this.rightVal = rightVal;
  }

  predict(features) {
    const val = Number(features[this.feature]) || 0;
    return val < this.threshold ? this.leftVal : this.rightVal;
  }

  toJSON() {
    return {
      feature: this.feature,
      threshold: this.threshold,
      leftVal: this.leftVal,
      rightVal: this.rightVal
    };
  }

  static fromJSON(data) {
    return new RegressionStump(data.feature, data.threshold, data.leftVal, data.rightVal);
  }
}

class GradientBoostingModel {
  constructor(options = {}) {
    this.nEstimators = options.nEstimators || 20;
    this.learningRate = options.learningRate || 0.08;
    this.initialLogOdds = 0.0;
    this.stumps = [];
    this.featureNames = [];
  }

  sigmoid(z) {
    if (z > 20) return 0.999999;
    if (z < -20) return 0.000001;
    return 1 / (1 + Math.exp(-z));
  }

  findBestStump(dataset, residuals, featureNames) {
    let bestGain = -Infinity;
    let bestStump = null;
    const n = dataset.length;

    let totalSum = 0;
    for (let i = 0; i < n; i++) totalSum += residuals[i];

    for (const feat of featureNames) {
      // Sort dataset index by feature value
      const sortedIdxs = Array.from({ length: n }, (_, i) => i)
        .sort((a, b) => (Number(dataset[a][feat]) || 0) - (Number(dataset[b][feat]) || 0));

      let leftSum = 0;

      for (let i = 0; i < n - 1; i++) {
        const idx = sortedIdxs[i];
        const nextIdx = sortedIdxs[i + 1];

        leftSum += residuals[idx];
        const leftCount = i + 1;
        const rightCount = n - leftCount;

        const valCurrent = Number(dataset[idx][feat]) || 0;
        const valNext = Number(dataset[nextIdx][feat]) || 0;

        if (valCurrent === valNext || leftCount < 10 || rightCount < 10) {
          continue;
        }

        const rightSum = totalSum - leftSum;

        // Variance reduction gain = leftSum^2 / leftCount + rightSum^2 / rightCount
        const gain = (leftSum * leftSum) / leftCount + (rightSum * rightSum) / rightCount;

        if (gain > bestGain) {
          bestGain = gain;
          const leftMean = leftSum / leftCount;
          const rightMean = rightSum / rightCount;
          const threshold = (valCurrent + valNext) / 2;

          bestStump = new RegressionStump(
            feat,
            Math.round(threshold * 1000) / 1000,
            Math.round(leftMean * 1000) / 1000,
            Math.round(rightMean * 1000) / 1000
          );
        }
      }
    }

    return bestStump;
  }

  train(dataset, featureNames, targetKey = 'targetBinary') {
    this.featureNames = [...featureNames];
    const n = dataset.length;
    let posCount = 0;

    for (let i = 0; i < n; i++) {
      if (Number(dataset[i][targetKey]) > 0) posCount++;
    }

    const p0 = Math.max(0.01, Math.min(0.99, posCount / n));
    this.initialLogOdds = Math.log(p0 / (1 - p0));

    // Cumulative raw predictions F(x)
    const F = new Array(n).fill(this.initialLogOdds);
    this.stumps = [];

    for (let m = 0; m < this.nEstimators; m++) {
      // 1. Calculate pseudo-residuals: r_i = y_i - p_i
      const residuals = new Array(n);
      for (let i = 0; i < n; i++) {
        const y = Number(dataset[i][targetKey]) > 0 ? 1 : 0;
        const p = this.sigmoid(F[i]);
        residuals[i] = y - p;
      }

      // 2. Fit a regression stump to the residuals in O(N log N)
      const stump = this.findBestStump(dataset, residuals, this.featureNames);
      if (!stump) break;

      this.stumps.push(stump);

      // 3. Update cumulative predictions F(x) = F(x) + learningRate * stump(x)
      for (let i = 0; i < n; i++) {
        const update = stump.predict(dataset[i]);
        F[i] += this.learningRate * update;
      }
    }

    return this;
  }

  predictRawScore(features) {
    let score = this.initialLogOdds;
    for (const stump of this.stumps) {
      score += this.learningRate * stump.predict(features);
    }
    return score;
  }

  predictProbability(features) {
    const score = this.predictRawScore(features);
    const prob = this.sigmoid(score);
    return Math.round(prob * 1000) / 1000;
  }

  predict(features, threshold = 0.5) {
    return this.predictProbability(features) >= threshold ? 1 : 0;
  }

  toJSON() {
    return {
      type: 'GRADIENT_BOOSTING',
      nEstimators: this.nEstimators,
      learningRate: this.learningRate,
      initialLogOdds: this.initialLogOdds,
      featureNames: this.featureNames,
      stumps: this.stumps.map((s) => s.toJSON())
    };
  }

  static fromJSON(data) {
    const model = new GradientBoostingModel({
      nEstimators: data.nEstimators,
      learningRate: data.learningRate
    });
    model.initialLogOdds = data.initialLogOdds;
    model.featureNames = data.featureNames;
    model.stumps = data.stumps.map((s) => RegressionStump.fromJSON(s));
    return model;
  }
}

module.exports = GradientBoostingModel;
