// ============================================================================
// Aurum Probability Calibration Engine
// Platt Scaling (Sigmoidal Logistic Calibration), Brier Score & ECE
// Distinguishes RAW MODEL SCORE from CALIBRATED REAL-WORLD PROBABILITY
// ============================================================================

class ProbabilityCalibrator {
  constructor(options = {}) {
    this.A = options.A !== undefined ? options.A : -1.0; // Slope
    this.B = options.B !== undefined ? options.B : 0.0;  // Intercept
    this.brierScore = null;
    this.expectedCalibrationError = null;
    this.reliabilityBins = [];
  }

  sigmoid(z) {
    if (z > 20) return 0.999999;
    if (z < -20) return 0.000001;
    return 1 / (1 + Math.exp(-z));
  }

  /**
   * Fits Platt scaling parameters (A, B) on validation set raw predictions and binary labels.
   */
  fit(rawScores, trueLabels, numBins = 10) {
    if (!rawScores || rawScores.length === 0 || rawScores.length !== trueLabels.length) {
      throw new Error('Raw scores and labels must be non-empty matching arrays.');
    }

    const n = rawScores.length;
    let A = -1.0;
    let B = 0.0;
    const lr = 0.05;
    const iters = 200;

    // Gradient descent to minimize log-loss
    for (let iter = 0; iter < iters; iter++) {
      let gradA = 0;
      let gradB = 0;

      for (let i = 0; i < n; i++) {
        const s = rawScores[i];
        const y = trueLabels[i] > 0 ? 1 : 0;
        const p = this.sigmoid(A * s + B);
        const err = p - y;
        gradA += err * s;
        gradB += err;
      }

      A -= (lr / n) * gradA;
      B -= (lr / n) * gradB;
    }

    this.A = Math.round(A * 1000) / 1000;
    this.B = Math.round(B * 1000) / 1000;

    // Evaluate Brier score and Expected Calibration Error (ECE)
    this.evaluateCalibration(rawScores, trueLabels, numBins);
    return this;
  }

  calibrate(rawScore) {
    // If not fitted or degenerate, preserve clamped raw score
    if (this.A === -1.0 && this.B === 0.0) {
      return Math.max(0.01, Math.min(0.99, rawScore));
    }
    const cal = this.sigmoid(this.A * rawScore + this.B);
    return Math.round(Math.max(0.01, Math.min(0.99, cal)) * 1000) / 1000;
  }

  evaluateCalibration(rawScores, trueLabels, numBins = 10) {
    const n = rawScores.length;
    let brierSum = 0;

    const bins = Array.from({ length: numBins }, (_, i) => ({
      binIndex: i,
      min: i / numBins,
      max: (i + 1) / numBins,
      confidences: [],
      accuracies: []
    }));

    for (let i = 0; i < n; i++) {
      const cal = this.calibrate(rawScores[i]);
      const y = trueLabels[i] > 0 ? 1 : 0;
      brierSum += Math.pow(cal - y, 2);

      const bIdx = Math.min(numBins - 1, Math.floor(cal * numBins));
      bins[bIdx].confidences.push(cal);
      bins[bIdx].accuracies.push(y);
    }

    this.brierScore = Math.round((brierSum / n) * 10000) / 10000;

    let ece = 0;
    this.reliabilityBins = bins.map((b) => {
      const count = b.confidences.length;
      if (count === 0) {
        return { range: `[${b.min.toFixed(1)}, ${b.max.toFixed(1)}]`, count: 0, avgConfidence: 0, empiricalAccuracy: 0, gap: 0 };
      }
      const avgConf = b.confidences.reduce((a, c) => a + c, 0) / count;
      const empAcc = b.accuracies.reduce((a, c) => a + c, 0) / count;
      const gap = Math.abs(empAcc - avgConf);
      ece += (count / n) * gap;

      return {
        range: `[${b.min.toFixed(1)}, ${b.max.toFixed(1)}]`,
        count,
        avgConfidence: Math.round(avgConf * 1000) / 1000,
        empiricalAccuracy: Math.round(empAcc * 1000) / 1000,
        gap: Math.round(gap * 1000) / 1000
      };
    });

    this.expectedCalibrationError = Math.round(ece * 10000) / 10000;
  }

  toJSON() {
    return {
      type: 'PLATT_SCALING',
      A: this.A,
      B: this.B,
      brierScore: this.brierScore,
      expectedCalibrationError: this.expectedCalibrationError,
      reliabilityBins: this.reliabilityBins
    };
  }

  static fromJSON(data) {
    const cal = new ProbabilityCalibrator({ A: data.A, B: data.B });
    cal.brierScore = data.brierScore;
    cal.expectedCalibrationError = data.expectedCalibrationError;
    cal.reliabilityBins = data.reliabilityBins || [];
    return cal;
  }
}

module.exports = ProbabilityCalibrator;
