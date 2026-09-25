// ============================================================================
// Aurum High-Confidence Ensemble Engine v2
// Weighted Multi-Model Aggregation, Agreement Ratio & Uncertainty Engine
// ============================================================================

const LogisticRegressionModel = require('../training/models/logistic-regression');
const DecisionTreeModel = require('../training/models/decision-tree');
const RandomForestModel = require('../training/models/random-forest');
const GradientBoostingModel = require('../training/models/gradient-boosting');
const ProbabilityCalibrator = require('../calibration/probability-calibrator');

class EnsembleEngine {
  constructor(options = {}) {
    this.models = options.models || {}; // { lr, dt, rf, gb }
    this.weights = options.weights || { lr: 0.15, dt: 0.20, rf: 0.35, gb: 0.30 };
    this.calibrator = options.calibrator || new ProbabilityCalibrator();
    this.defaultConfidenceThreshold = options.defaultConfidenceThreshold || 0.85;
    this.minAgreementRatio = options.minAgreementRatio || 0.75;
  }

  setWeights(newWeights) {
    const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
    this.weights = {};
    for (const [k, v] of Object.entries(newWeights)) {
      this.weights[k] = Math.round((v / sum) * 1000) / 1000;
    }
  }

  predictRawEnsembleScore(features) {
    let weightedScore = 0;
    const individualPredictions = {};

    for (const [key, model] of Object.entries(this.models)) {
      const prob = model.predictProbability(features);
      individualPredictions[key] = {
        probability: prob,
        direction: prob >= 0.5 ? 'BULLISH' : 'BEARISH',
        weight: this.weights[key] || 0.25
      };
      weightedScore += prob * (this.weights[key] || 0.25);
    }

    return {
      rawScore: Math.round(weightedScore * 1000) / 1000,
      individualPredictions
    };
  }

  evaluateModelAgreement(individualPredictions) {
    const list = Object.values(individualPredictions);
    const total = list.length;
    if (total === 0) return { agreementRatio: 0, modelsAgreeing: 0, totalModels: 0, consensus: 'NEUTRAL' };

    let bullishCount = 0;
    let bearishCount = 0;

    for (const m of list) {
      if (m.direction === 'BULLISH') bullishCount++;
      else bearishCount++;
    }

    const maxAgreed = Math.max(bullishCount, bearishCount);
    const consensus = bullishCount > bearishCount ? 'BULLISH' : bearishCount > bullishCount ? 'BEARISH' : 'NEUTRAL';
    const agreementRatio = Math.round((maxAgreed / total) * 100) / 100;

    return {
      agreementRatio,
      modelsAgreeing: maxAgreed,
      totalModels: total,
      consensus,
      bullishCount,
      bearishCount
    };
  }

  classifyUncertainty(calibratedConfidence, agreementRatio) {
    if (agreementRatio < 0.60) {
      return 'CONFLICTING_MODELS';
    }
    if (calibratedConfidence >= 0.90 && agreementRatio >= 0.75) {
      return 'VERY_HIGH_CONFIDENCE';
    }
    if (calibratedConfidence >= 0.85 && agreementRatio >= 0.75) {
      return 'HIGH_CONFIDENCE';
    }
    if (calibratedConfidence >= 0.75) {
      return 'MEDIUM_CONFIDENCE';
    }
    return 'LOW_CONFIDENCE';
  }

  /**
   * Complete Selective Inference for a feature row
   */
  computeCalibratedConfidence(rawScore, agreement) {
    const dev = Math.abs(rawScore - 0.50);
    const normalizedConviction = Math.min(1.0, dev / 0.12);
    const agreementFactor = Math.max(0, (agreement.agreementRatio - 0.5) * 2);
    const conf = 0.50 + 0.48 * (0.6 * normalizedConviction + 0.4 * agreementFactor);
    return Math.round(Math.max(0.50, Math.min(0.98, conf)) * 1000) / 1000;
  }

  /**
   * Complete Selective Inference for a feature row
   */
  evaluateFeatures(features, customConfidenceThreshold = null) {
    const threshold = customConfidenceThreshold || this.defaultConfidenceThreshold;
    const { rawScore, individualPredictions } = this.predictRawEnsembleScore(features);
    const calibratedProb = this.calibrator.calibrate(rawScore);
    const agreement = this.evaluateModelAgreement(individualPredictions);

    // Directional bias from model ensemble
    const directionalBias = rawScore >= 0.5 ? 'BULLISH' : 'BEARISH';
    
    // Calibrated confidence scales 50% to 98% based on model conviction and agreement
    const calibratedConfidence = this.computeCalibratedConfidence(rawScore, agreement);
    const uncertaintyClass = this.classifyUncertainty(calibratedConfidence, agreement.agreementRatio);

    // Expected edge calculation (gross return estimate minus 0.10% friction)
    const estimatedMove = 0.012; // 1.2% typical 1D move
    const convictionDelta = (calibratedConfidence - 0.50) * 2;
    const grossReturn = convictionDelta * estimatedMove;
    const totalTradingCost = 0.0010; // 10 bps (commission + slippage + spread)
    const expectedEdge = Math.round(Math.max(0, grossReturn - totalTradingCost) * 10000) / 10000;
    const minRequiredEdge = 0.0015; // 15 bps minimum required edge

    // SELECTIVE DECISION RULE:
    // Only issue BUY/SELL if confidence meets threshold AND models agree AND expected edge > minRequiredEdge
    let signal = 'NO_TRADE';
    let signalStatus = 'INSUFFICIENT_CONFIDENCE';
    let decisionReason = 'Confidence or model agreement below selective hurdle';

    if (
      calibratedConfidence >= threshold &&
      agreement.agreementRatio >= this.minAgreementRatio &&
      uncertaintyClass !== 'CONFLICTING_MODELS' &&
      expectedEdge >= minRequiredEdge
    ) {
      signal = directionalBias === 'BULLISH' ? 'BUY' : 'SELL';
      signalStatus = uncertaintyClass === 'VERY_HIGH_CONFIDENCE' ? 'VERY_HIGH_CONFIDENCE' : 'HIGH_CONFIDENCE';
      decisionReason = `High-confidence signal: ${(calibratedConfidence * 100).toFixed(1)}% confidence with ${agreement.modelsAgreeing}/${agreement.totalModels} model agreement. Expected edge: ${(expectedEdge * 100).toFixed(2)}%.`;
    } else if (uncertaintyClass === 'CONFLICTING_MODELS') {
      signalStatus = 'CONFLICTING_MODELS';
      decisionReason = `NO_TRADE: Conflicting models (${agreement.bullishCount} Bullish vs ${agreement.bearishCount} Bearish).`;
    } else {
      decisionReason = `NO_TRADE: Confidence ${(calibratedConfidence * 100).toFixed(1)}% (req: ${(threshold * 100).toFixed(0)}%) | Agreement: ${agreement.modelsAgreeing}/${agreement.totalModels} | Expected edge: ${(expectedEdge * 100).toFixed(2)}%.`;
    }

    return {
      prediction: directionalBias,
      calibratedProbability: calibratedProb,
      calibratedConfidence,
      rawScore,
      signal,
      signalStatus,
      uncertaintyClass,
      decisionReason,
      expectedEdge,
      agreement,
      individualPredictions,
      marketRegime: features.trendRegime || 'SIDEWAYS'
    };
  }

  toJSON() {
    return {
      type: 'ENSEMBLE_V2',
      weights: this.weights,
      calibrator: this.calibrator ? this.calibrator.toJSON() : null,
      defaultConfidenceThreshold: this.defaultConfidenceThreshold,
      minAgreementRatio: this.minAgreementRatio,
      models: {
        lr: this.models.lr ? this.models.lr.toJSON() : null,
        dt: this.models.dt ? this.models.dt.toJSON() : null,
        rf: this.models.rf ? this.models.rf.toJSON() : null,
        gb: this.models.gb ? this.models.gb.toJSON() : null
      }
    };
  }

  static fromJSON(data) {
    const ensemble = new EnsembleEngine({
      weights: data.weights,
      calibrator: data.calibrator ? ProbabilityCalibrator.fromJSON(data.calibrator) : new ProbabilityCalibrator(),
      defaultConfidenceThreshold: data.defaultConfidenceThreshold,
      minAgreementRatio: data.minAgreementRatio
    });

    if (data.models) {
      if (data.models.lr) ensemble.models.lr = LogisticRegressionModel.fromJSON(data.models.lr);
      if (data.models.dt) ensemble.models.dt = DecisionTreeModel.fromJSON(data.models.dt);
      if (data.models.rf) ensemble.models.rf = RandomForestModel.fromJSON(data.models.rf);
      if (data.models.gb) ensemble.models.gb = GradientBoostingModel.fromJSON(data.models.gb);
    }

    return ensemble;
  }
}

module.exports = EnsembleEngine;
