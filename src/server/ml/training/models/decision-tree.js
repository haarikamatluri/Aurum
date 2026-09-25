// ============================================================================
// Deterministic Decision Tree Classifier
// High-efficiency Quantile-Sampled Gini Impurity Binary Partitioning
// ============================================================================

class DecisionTreeModel {
  constructor(options = {}) {
    this.maxDepth = options.maxDepth || 3;
    this.minSamplesSplit = options.minSamplesSplit || 20;
    this.minSamplesLeaf = options.minSamplesLeaf || 10;
    this.root = null;
    this.featureNames = [];
  }

  findBestSplit(dataset, candidateFeatures, targetKey) {
    const n = dataset.length;
    if (n < this.minSamplesSplit) return null;

    let totalPos = 0;
    for (let i = 0; i < n; i++) {
      if (Number(dataset[i][targetKey]) > 0) totalPos++;
    }
    const totalNeg = n - totalPos;
    const pPos = totalPos / n;
    const pNeg = totalNeg / n;
    const currentGini = 1 - (pPos * pPos + pNeg * pNeg);

    let bestGain = 0;
    let bestSplit = null;
    const step = Math.max(1, Math.floor(n / 10));

    for (const feat of candidateFeatures) {
      const sorted = [...dataset].sort((a, b) => (Number(a[feat]) || 0) - (Number(b[feat]) || 0));

      let leftPos = 0;
      let leftNeg = 0;
      let nextCheck = step;

      for (let i = 0; i < n - 1; i++) {
        if (Number(sorted[i][targetKey]) > 0) leftPos++;
        else leftNeg++;

        if (i + 1 !== nextCheck) continue;
        nextCheck = Math.min(n - 1, nextCheck + step);

        const valCurrent = Number(sorted[i][feat]) || 0;
        const valNext = Number(sorted[i + 1][feat]) || 0;

        const leftCount = i + 1;
        const rightCount = n - leftCount;

        if (valCurrent === valNext || leftCount < this.minSamplesLeaf || rightCount < this.minSamplesLeaf) {
          continue;
        }

        const rightPos = totalPos - leftPos;
        const rightNeg = totalNeg - leftNeg;

        const pPosL = leftPos / leftCount;
        const pNegL = leftNeg / leftCount;
        const giniL = 1 - (pPosL * pPosL + pNegL * pNegL);

        const pPosR = rightPos / rightCount;
        const pNegR = rightNeg / rightCount;
        const giniR = 1 - (pPosR * pPosR + pNegR * pNegR);

        const weightedGini = (leftCount / n) * giniL + (rightCount / n) * giniR;
        const gain = currentGini - weightedGini;

        if (gain > bestGain) {
          bestGain = gain;
          const threshold = (valCurrent + valNext) / 2;
          bestSplit = { feature: feat, threshold, gain };
        }
      }
    }

    if (!bestSplit || bestSplit.gain <= 0.001) {
      return null;
    }

    const left = [];
    const right = [];
    for (let i = 0; i < n; i++) {
      if ((Number(dataset[i][bestSplit.feature]) || 0) < bestSplit.threshold) {
        left.push(dataset[i]);
      } else {
        right.push(dataset[i]);
      }
    }

    return {
      feature: bestSplit.feature,
      threshold: bestSplit.threshold,
      gain: bestSplit.gain,
      left,
      right
    };
  }

  buildTree(dataset, depth, candidateFeatures, targetKey) {
    let pos = 0;
    for (let i = 0; i < dataset.length; i++) {
      if (Number(dataset[i][targetKey]) > 0) pos++;
    }
    const prob = dataset.length > 0 ? pos / dataset.length : 0.5;

    // Leaf condition
    if (
      depth >= this.maxDepth ||
      dataset.length < this.minSamplesSplit ||
      prob === 0 ||
      prob === 1
    ) {
      return {
        isLeaf: true,
        probability: Math.round(prob * 1000) / 1000,
        prediction: prob >= 0.5 ? 1 : 0,
        samples: dataset.length
      };
    }

    const split = this.findBestSplit(dataset, candidateFeatures, targetKey);
    if (!split) {
      return {
        isLeaf: true,
        probability: Math.round(prob * 1000) / 1000,
        prediction: prob >= 0.5 ? 1 : 0,
        samples: dataset.length
      };
    }

    return {
      isLeaf: false,
      feature: split.feature,
      threshold: Math.round(split.threshold * 1000) / 1000,
      samples: dataset.length,
      left: this.buildTree(split.left, depth + 1, candidateFeatures, targetKey),
      right: this.buildTree(split.right, depth + 1, candidateFeatures, targetKey)
    };
  }

  train(dataset, featureNames, targetKey = 'targetBinary') {
    this.featureNames = [...featureNames];
    this.root = this.buildTree(dataset, 0, this.featureNames, targetKey);
    return this;
  }

  evaluateNode(node, features) {
    if (!node || node.isLeaf || !node.feature) {
      return node;
    }
    const val = Number(features[node.feature]) || 0;
    if (val < node.threshold) {
      return this.evaluateNode(node.left, features);
    } else {
      return this.evaluateNode(node.right, features);
    }
  }

  predictProbability(features) {
    if (!this.root) throw new Error('Decision tree model not trained.');
    const leaf = this.evaluateNode(this.root, features);
    return leaf ? leaf.probability : 0.5;
  }

  predict(features, threshold = 0.5) {
    return this.predictProbability(features) >= threshold ? 1 : 0;
  }

  toJSON() {
    return {
      type: 'DECISION_TREE',
      maxDepth: this.maxDepth,
      minSamplesSplit: this.minSamplesSplit,
      minSamplesLeaf: this.minSamplesLeaf,
      featureNames: this.featureNames,
      root: this.root
    };
  }

  static fromJSON(data) {
    const model = new DecisionTreeModel({
      maxDepth: data.maxDepth,
      minSamplesSplit: data.minSamplesSplit,
      minSamplesLeaf: data.minSamplesLeaf
    });
    model.featureNames = data.featureNames;
    model.root = data.root;
    return model;
  }
}

module.exports = DecisionTreeModel;
