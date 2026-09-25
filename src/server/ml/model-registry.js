// ============================================================================
// Aurum ML Model Registry Service
// Tracks trained model versions, statuses (TRAINED, VALIDATED, PRODUCTION_CANDIDATE, PRODUCTION, RETIRED)
// ============================================================================

const fs = require('fs');
const path = require('path');

const REGISTRY_FILE = path.join(__dirname, 'artifacts', 'model_registry.json');
const PRIMARY_ARTIFACT = path.join(__dirname, 'artifacts', 'tcs_momentum_model.json');

class ModelRegistry {
  constructor() {
    this.models = [];
    this.loadRegistry();
  }

  loadRegistry() {
    try {
      if (fs.existsSync(REGISTRY_FILE)) {
        this.models = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
      } else {
        this.models = this.initializeDefaultRegistry();
        this.saveRegistry();
      }
    } catch (err) {
      console.warn('[ModelRegistry] Failed to load registry file, re-initializing:', err.message);
      this.models = this.initializeDefaultRegistry();
    }
  }

  initializeDefaultRegistry() {
    let primaryArtifact = null;
    if (fs.existsSync(PRIMARY_ARTIFACT)) {
      try {
        primaryArtifact = JSON.parse(fs.readFileSync(PRIMARY_ARTIFACT, 'utf-8'));
      } catch (e) {}
    }

    return [
      {
        modelId: primaryArtifact?.modelId || 'TCS-MOMENTUM-ALPHA',
        modelVersion: primaryArtifact?.version || 'v1.4.2',
        symbol: 'TCS.NS',
        status: 'PRODUCTION',
        trainingDate: primaryArtifact?.trainedAt || '2026-08-15',
        datasetVersion: primaryArtifact?.datasetVersion || 'DS-NSE-TCS-2019-2025',
        featureVersion: 'features-v1.4.0',
        features: primaryArtifact?.features || ['rsi14', 'returns1D', 'volatility14D', 'volumeZScore'],
        trainingPeriod: primaryArtifact?.trainPeriod || '2019-01-01 to 2023-12-31',
        validationPeriod: primaryArtifact?.validationPeriod || '2024-01-01 to 2024-12-31',
        testPeriod: primaryArtifact?.testPeriod || '2025-01-01 to 2025-12-31',
        metrics: primaryArtifact?.provenanceMetrics || { accuracy: 0.47, sharpeRatio: -1.64 },
        artifactHash: primaryArtifact?.artifactHash || null,
        artifactPath: 'src/server/ml/artifacts/tcs_momentum_model.json',
        lastUpdated: new Date().toISOString()
      },
      {
        modelId: 'NVDA-BREAKOUT-SENTINEL',
        modelVersion: 'v2.1.0',
        symbol: 'NVDA',
        status: 'PRODUCTION_CANDIDATE',
        trainingDate: '2026-09-01',
        datasetVersion: 'DS-NASDAQ-NVDA-2021-2025',
        featureVersion: 'features-v1.4.0',
        features: ['returns1D', 'returns5D', 'volatility14D', 'rsi14'],
        metrics: { accuracy: 0.582, sharpeRatio: 1.12, winRate: 0.54 },
        artifactHash: 'c4e5f6...a1b2',
        artifactPath: 'src/server/ml/artifacts/nvda_breakout_model.json',
        lastUpdated: new Date().toISOString()
      },
      {
        modelId: 'RELIANCE-REGIME-CLASSIFIER',
        modelVersion: 'v1.0.3',
        symbol: 'RELIANCE.NS',
        status: 'VALIDATED',
        trainingDate: '2026-07-20',
        datasetVersion: 'DS-NSE-RIL-2020-2025',
        featureVersion: 'features-v1.4.0',
        features: ['volatility14D', 'rsi14', 'volumeZScore'],
        metrics: { accuracy: 0.531, sharpeRatio: 0.45, winRate: 0.51 },
        artifactHash: 'd7e8f9...b2c3',
        artifactPath: 'src/server/ml/artifacts/reliance_regime_model.json',
        lastUpdated: new Date().toISOString()
      }
    ];
  }

  saveRegistry() {
    try {
      const dir = path.dirname(REGISTRY_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify(this.models, null, 2), 'utf-8');
    } catch (err) {
      console.error('[ModelRegistry] Failed to save registry:', err.message);
    }
  }

  registerModel(artifact) {
    const existingIdx = this.models.findIndex(m => m.modelId === artifact.modelId && m.modelVersion === artifact.version);
    const entry = {
      modelId: artifact.modelId,
      modelVersion: artifact.version,
      symbol: artifact.symbol || 'TCS.NS',
      status: artifact.status || 'TRAINED',
      trainingDate: artifact.trainedAt || new Date().toISOString(),
      datasetVersion: artifact.datasetVersion,
      featureVersion: 'features-v1.4.0',
      features: artifact.features,
      trainingPeriod: artifact.trainPeriod,
      validationPeriod: artifact.validationPeriod,
      testPeriod: artifact.testPeriod,
      metrics: artifact.provenanceMetrics,
      artifactHash: artifact.artifactHash,
      artifactPath: 'src/server/ml/artifacts/tcs_momentum_model.json',
      lastUpdated: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      this.models[existingIdx] = entry;
    } else {
      this.models.push(entry);
    }

    this.saveRegistry();
    return entry;
  }

  getModels() {
    return this.models;
  }

  getModel(modelId) {
    return this.models.find(m => m.modelId === modelId);
  }

  getProductionModel(symbol = 'TCS') {
    const sym = symbol.toUpperCase();
    return this.models.find(m => (m.symbol.includes(sym) || m.modelId.includes(sym)) && (m.status === 'PRODUCTION' || m.status === 'PRODUCTION_CANDIDATE'));
  }
}

module.exports = new ModelRegistry();
