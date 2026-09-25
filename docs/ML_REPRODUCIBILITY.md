# Aurum Phase-4 ML Reproducibility Matrix

## Quantitative Verification Status

| Stage | Status | Verification Evidence |
| :--- | :--- | :--- |
| **Dataset Acquisition** | **VERIFIED** | 1,730 raw daily bars downloaded via official Yahoo Finance API (NSE: `TCS.NS`, 2019-01-01 to 2025-12-31). Zero synthetic bars. |
| **Data Validation** | **VERIFIED** | Verified by `validate-dataset.js`: 0 duplicates, strictly monotonic ascending dates, strict OHLC geometric consistency (`High >= max(Open, Close)` and `Low <= min(Open, Close)`). |
| **Data Cleaning** | **VERIFIED** | Cleaned by `preprocess.js`: 1,729 valid bars exported to `tcs_2019_2025_clean.csv` (SHA-256: `48db5aa2b56b8a064d60464d11e3d1df48381c3f407dff824487865c33d078ed`). No forward-fill, no interpolation. |
| **Feature Engineering** | **VERIFIED** | Implemented in `feature-engineering.js` (`features-v1.4.0`). 100% parity demonstrated between offline batch processing and live inference (`0.000` tolerance in Test 2). |
| **Target Generation** | **VERIFIED** | Implemented in `target-generator.js` (`DIRECTIONAL_1D_RETURN_POSITIVE`). Class distribution: 858 positive, 856 negative (50.1% vs 49.9%). Final row excluded. |
| **Leakage Prevention** | **VERIFIED** | Formally proven in Test 4: mutating $t+1$ bar leaves $\text{features}_t$ 100% invariant while mutating $\text{target}_t$. |
| **Chronological Split** | **VERIFIED** | Strict split: Train (`2019-01-21` to `2023-12-29`, 1,221 bars), Val (`2024-01-01` to `2024-12-31`, 246 bars), Test (`2025-01-01` to `2025-12-30`, 247 bars). $\max(\text{Train}) < \min(\text{Val}) < \min(\text{Test})$. |
| **Model Training** | **VERIFIED** | Implemented in `train-decision-tree.js`. Trained strictly on Train partition using Information Gain with Gini impurity. Zero look-ahead. |
| **Walk-Forward Validation** | **VERIFIED** | Walk-forward evaluation across Train, Validation, and Test sets. Real unmanipulated metrics computed: Train Acc 55.4%, Val Acc 51.6%, Test Acc 47.0%. |
| **Metrics Provenance** | **VERIFIED** | Legacy metadata (78.4% Acc, 2.18 Sharpe) quarantined as `legacyReportedMetrics` (`independentlyReproduced: false`). Newly computed metrics recorded in `reproducedMetrics`. |
| **Model Artifact** | **VERIFIED** | Exported to `src/server/ml/artifacts/tcs_momentum_model.json` with deterministic structural SHA-256 hash `6005436296fc2782345bcb49dcc691e662523fc65aa6ec4f1aeea66fb9d18540`. |
| **Model Registry** | **VERIFIED** | `model-registry.js` manages lifecycle: `TRAINED`, `VALIDATED`, `PRODUCTION_CANDIDATE`, `PRODUCTION`. Prevents unverified model promotion. |
| **Live Inference** | **VERIFIED** | `POST /api/ml/predict` runs tree inference via `model-runner.js` with sub-3ms latency (`1.9ms`). |
| **Strategy Backtest** | **VERIFIED** | `POST /api/ml/backtest` simulates trades with 0.1% commissions and 0.05% slippage. |
| **Pre-Trade Risk & Safety** | **VERIFIED** | Strict fail-closed risk controls: position limits, cash sufficiency, emergency kill switch, and mandatory order confirmation before broker routing. |
