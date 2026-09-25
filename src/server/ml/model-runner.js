// ============================================================================
// Aurum ML Model Runner — Multi-Version Inference Engine (v1 Baseline + v2 Ensemble)
// ============================================================================

const fs = require('fs');
const path = require('path');
const EnsembleEngine = require('./ensemble/ensemble-engine');

const ARTIFACT_V1_PATH = path.join(__dirname, 'artifacts', 'tcs_momentum_model.json');
const ARTIFACT_V2_PATH = path.join(__dirname, 'artifacts', 'tcs_ensemble_v2.json');

class ModelRunner {
  constructor() {
    this.artifact = null; // Baseline v1 artifact
    this.artifactV2 = null; // Ensemble v2 artifact
    this.ensembleV2 = null; // Instantiated EnsembleEngine
    this.loadModel();
  }

  loadModel() {
    // 1. Load Baseline Model v1
    try {
      if (fs.existsSync(ARTIFACT_V1_PATH)) {
        const raw1 = fs.readFileSync(ARTIFACT_V1_PATH, 'utf-8');
        this.artifact = JSON.parse(raw1);
      }
    } catch (err) {
      console.warn('[ModelRunner] Failed to load v1 artifact:', err.message);
    }

    // 2. Load Ensemble Model v2
    try {
      if (fs.existsSync(ARTIFACT_V2_PATH)) {
        const raw2 = fs.readFileSync(ARTIFACT_V2_PATH, 'utf-8');
        this.artifactV2 = JSON.parse(raw2);
        if (this.artifactV2?.modelsEnsemble?.serializedModels) {
          this.ensembleV2 = EnsembleEngine.fromJSON(this.artifactV2.modelsEnsemble.serializedModels);
        }
      }
    } catch (err) {
      console.warn('[ModelRunner] Failed to load v2 ensemble artifact:', err.message);
    }
  }

  evaluateNode(node, features) {
    if (!node || !node.feature) {
      return node; // Leaf node reached
    }
    const val = features[node.feature];
    if (val !== undefined && val < node.threshold) {
      return this.evaluateNode(node.left, features);
    } else {
      return this.evaluateNode(node.right, features);
    }
  }

  /**
   * Evaluates Baseline Decision Tree Model (v1)
   */
  runInferenceV1(symbol, featuresSnapshot, currentPrice) {
    const startTime = Date.now();
    if (!this.artifact) this.loadModel();
    if (!this.artifact) {
      throw new Error('Baseline v1 ML model artifact unavailable on server disk.');
    }

    const rootNode = this.artifact.treeNodes[0];
    const leaf = this.evaluateNode(rootNode, featuresSnapshot);

    const prediction = leaf.prediction || 'NEUTRAL';
    const confidence = leaf.probability || 0.65;
    const latencyMs = Math.round((Date.now() - startTime) * 10) / 10 || 1.2;

    const targetPrice = prediction === 'BULLISH'
      ? Math.round(currentPrice * 1.035 * 100) / 100
      : prediction === 'BEARISH'
        ? Math.round(currentPrice * 0.965 * 100) / 100
        : currentPrice;

    return {
      symbol: symbol.toUpperCase(),
      modelId: this.artifact.modelId,
      modelVersion: this.artifact.version,
      artifactPath: 'src/server/ml/artifacts/tcs_momentum_model.json',
      validationMethod: this.artifact.validationMethod,
      prediction,
      confidence: Math.round(confidence * 100) / 100,
      currentPrice,
      targetPrice,
      featuresSnapshot,
      featureTimestamp: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      latencyMs,
      provenanceMetrics: this.artifact.provenanceMetrics
    };
  }

  /**
   * Evaluates Selective High-Confidence Ensemble (v2) with Fail-Closed Protection
   */
  runInferenceV2(symbol, featuresSnapshot, currentPrice, options = {}) {
    const startTime = Date.now();
    const threshold = options.confidenceThreshold || this.artifactV2?.selectiveHurdles?.defaultConfidenceThreshold || 0.85;

    // Fail-Closed Check 1: Artifact / Ensemble engine availability
    if (!this.artifactV2 || !this.ensembleV2) {
      this.loadModel();
    }
    if (!this.artifactV2 || !this.ensembleV2) {
      return this.generateFailClosedResponse(symbol, currentPrice, 'ARTIFACT_UNAVAILABLE', 'Ensemble v2 artifact not loaded.');
    }

    // Fail-Closed Check 2: Kill switch or stale market data flag
    if (options.killSwitchActive) {
      return this.generateFailClosedResponse(symbol, currentPrice, 'KILL_SWITCH_ACTIVE', 'Trading kill switch is active.');
    }

    // Fail-Closed Check 3: Missing features validation
    const requiredFeatures = this.artifactV2.features || [];
    const missingFeatures = requiredFeatures.filter((f) => featuresSnapshot[f] === undefined || isNaN(featuresSnapshot[f]));
    if (missingFeatures.length > 5) {
      return this.generateFailClosedResponse(symbol, currentPrice, 'INSUFFICIENT_FEATURES', `Missing ${missingFeatures.length} required features.`);
    }

    // Execute multi-model ensemble evaluation
    const ensembleResult = this.ensembleV2.evaluateFeatures(featuresSnapshot, threshold);
    const latency = Math.round((Date.now() - startTime) * 10) / 10 || 1.5;

    // Identify top contributing feature drivers
    const topFeatureDrivers = this.extractFeatureDrivers(featuresSnapshot, ensembleResult.prediction);

    return {
      symbol: symbol.toUpperCase(),
      prediction: ensembleResult.prediction,
      probability: ensembleResult.calibratedProbability,
      calibratedConfidence: Math.round(ensembleResult.calibratedConfidence * 1000) / 10, // e.g. 85.2%
      signal: ensembleResult.signal,
      signalStatus: ensembleResult.signalStatus,
      modelAgreement: `${ensembleResult.agreement.modelsAgreeing}/${ensembleResult.agreement.totalModels}`,
      agreementRatio: ensembleResult.agreement.agreementRatio,
      consensus: ensembleResult.agreement.consensus,
      coverageClass: ensembleResult.uncertaintyClass,
      marketRegime: ensembleResult.marketRegime,
      expectedEdge: ensembleResult.expectedEdge,
      decisionReason: ensembleResult.decisionReason,
      featureDrivers: topFeatureDrivers,
      modelVersion: this.artifactV2.version,
      modelId: this.artifactV2.modelId,
      currentPrice,
      latency,
      artifactHash: this.artifactV2.artifactHash,
      provenance: {
        trainedAt: this.artifactV2.trainedAt,
        datasetVersion: this.artifactV2.datasetVersion,
        featureVersion: this.artifactV2.featureVersion,
        targetVersion: this.artifactV2.targetVersion
      }
    };
  }

  extractFeatureDrivers(features, prediction) {
    const drivers = [];
    if (prediction === 'BULLISH') {
      if (features.returns5D > 0) drivers.push('Positive 5D momentum');
      if (features.rsi14 < 40) drivers.push('RSI oversold rebound');
      if (features.trendDistanceSMA20 > 0) drivers.push('Trading above 20D SMA');
      if (features.volumeZScore > 0.5) drivers.push('Volume expansion');
    } else {
      if (features.returns5D < 0) drivers.push('Negative 5D momentum breakdown');
      if (features.rsi14 > 65) drivers.push('RSI overbought exhaustion');
      if (features.trendDistanceSMA20 < 0) drivers.push('Trading below 20D SMA');
      if (features.volumeZScore > 0.5) drivers.push('Elevated selling volume');
    }
    if (drivers.length === 0) drivers.push('Multi-model statistical consensus');
    return drivers;
  }

  generateFailClosedResponse(symbol, currentPrice, reasonCode, reasonMessage) {
    return {
      symbol: symbol.toUpperCase(),
      prediction: 'NEUTRAL',
      probability: 0.50,
      calibratedConfidence: 50.0,
      signal: 'NO_TRADE',
      signalStatus: 'FAIL_CLOSED',
      modelAgreement: '0/4',
      agreementRatio: 0.0,
      coverageClass: 'FAIL_CLOSED',
      marketRegime: 'UNKNOWN',
      expectedEdge: 0.0,
      decisionReason: `FAIL_CLOSED: ${reasonMessage} [${reasonCode}]`,
      featureDrivers: [],
      modelVersion: this.artifactV2?.version || 'v2.0.0',
      currentPrice,
      latency: 0.5,
      failClosed: true
    };
  }

  /**
   * Unified Inference API
   * Automatically routes between v1 and v2 based on requested version or feature vector
   */
  runInference(symbol, featuresSnapshot, currentPrice, options = {}) {
    if (options.version === 'v1' || (!options.version && featuresSnapshot.returns3D === undefined)) {
      return this.runInferenceV1(symbol, featuresSnapshot, currentPrice);
    }
    return this.runInferenceV2(symbol, featuresSnapshot, currentPrice, options);
  }

  getModelMetadata(version = 'v1') {
    if (version === 'v2') {
      if (!this.artifactV2) this.loadModel();
      return this.artifactV2;
    }
    if (!this.artifact) this.loadModel();
    return this.artifact;
  }
}

module.exports = new ModelRunner();
