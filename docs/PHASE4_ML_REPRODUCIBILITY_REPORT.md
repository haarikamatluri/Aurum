# AURUM PHASE-4 ML FORENSIC REPRODUCIBILITY REPORT

## A. DATASET
- **Source**: Yahoo Finance Official Historical Chart API (`https://query1.finance.yahoo.com/v8/finance/chart/TCS.NS`)
- **Symbol**: `TCS.NS` (National Stock Exchange of India)
- **Period**: `2019-01-01` to `2025-12-31`
- **Rows**: 1,730 raw daily bars downloaded
- **Schema**: `timestamp,date,open,high,low,close,volume`
- **Checksum (Raw)**: `afd6cc2d4a2059588ec3749bb4f7cdbe5fbc18ee9fb77caf36b2a68843e85459`

---

## B. CLEANING
- **Rows Before**: 1,730
- **Rows After**: 1,729
- **Rejected Rows**: 1 (Single exchange closure / non-trading holiday row)
- **Duplicate Rows**: 0
- **Checksum (Clean)**: `48db5aa2b56b8a064d60464d11e3d1df48381c3f407dff824487865c33d078ed`
- **Methodology**: Strict monotonic ascending sort; no forward-filling of prices; zero synthetic interpolation.

---

## C. FEATURES
- **`returns1D`**: $100 \times (\text{Close}_t - \text{Close}_{t-1}) / \text{Close}_{t-1}$
- **`volatility14D`**: 14-observation sample standard deviation of daily percentage returns
- **`rsi14`**: 14-day standard Relative Strength Index
- **`volumeZScore`**: 14-day rolling Volume Z-Score with zero standard deviation guard
- **Feature Version**: `features-v1.4.0`
- **Parity Status**: Verified 100% mathematical equality between offline batch computation and live streaming calculation (`0.000` tolerance in Test 2).

---

## D. TARGET
- **Target Name**: `DIRECTIONAL_1D_RETURN_POSITIVE`
- **Definition**: $\text{target}_t = 1$ if $\text{Close}_{t+1} > \text{Close}_t$, else $0$.
- **Total Labeled Rows**: 1,714 (Final row excluded due to absence of $t+1$)
- **Positive Samples**: 858 (50.1%)
- **Negative Samples**: 856 (49.9%)

---

## E. TRAINING
- **Algorithm**: Binary Classification Decision Tree (Recursive Information Gain, Gini Impurity)
- **Hyperparameters**: `maxDepth: 3`, `minSamplesSplit: 30`, `minSamplesLeaf: 15`, `randomSeed: 42`
- **Training Period**: `2019-01-21` to `2023-12-29`
- **Training Rows**: 1,221 bars
- **Look-Ahead Prevention**: Training fitted exclusively on the Train partition; zero exposure to validation or test data.

---

## F. VALIDATION
- **Validation Period**: `2024-01-01` to `2024-12-31`
- **Method**: Out-of-sample chronological evaluation
- **Validation Rows**: 246 bars

---

## G. TEST
- **Test Period**: `2025-01-01` to `2025-12-30`
- **Test Rows**: 247 bars

---

## H. METRICS
Metrics calculated from actual predictions on historical data without synthetic inflation:

| Metric | TRAIN (2019–2023) | VALIDATION (2024) | TEST (2025) |
| :--- | :--- | :--- | :--- |
| **Accuracy** | 0.554 | 0.516 | **0.470** |
| **Precision** | 0.650 | 0.500 | **0.329** |
| **Recall** | 0.308 | 0.286 | **0.238** |
| **F1 Score** | 0.418 | 0.364 | **0.276** |
| **Balanced Accuracy** | 0.564 | 0.509 | **0.439** |
| **Confusion Matrix** | TP:195, FP:105, TN:482, FN:439 | TP:34, FP:34, TN:93, FN:85 | TP:25, FP:51, TN:91, FN:80 |
| **Sharpe Ratio** | 1.64 | -0.21 | **-1.64** |
| **Max Drawdown** | 21.6% | 8.5% | **18.3%** |
| **Win Rate** | 65.0% | 50.0% | **32.9%** |

### Legacy Metadata Accounting:
- **Previous Reported Accuracy**: 78.4%
- **Previous Reported Sharpe**: 2.18
- **Independently Reproduced**: **NO** (Quarantined in artifact as `legacyReportedMetrics.independentlyReproduced: false`). Real unmanipulated test accuracy is 47.0%.

---

## I. MODEL ARTIFACT
- **Path**: `src/server/ml/artifacts/tcs_momentum_model.json`
- **Version**: `v1.4.2`
- **Deterministic Hash**: `6005436296fc2782345bcb49dcc691e662523fc65aa6ec4f1aeea66fb9d18540`
- **Feature Version**: `features-v1.4.0`
- **Dataset Version**: `DS-NSE-TCS-2019-2025`

---

## J. INFERENCE
- **Endpoint**: `POST /api/ml/predict`
- **Status**: Verified active and operational
- **Measured Latency**: 1.9 ms (Sub-3ms execution)
- **Live Output**: Returns modelId, prediction (`BULLISH` / `BEARISH` / `NEUTRAL`), confidence probability, current price, target price, and features snapshot.

---

## K. BACKTEST
- **Endpoint**: `POST /api/ml/backtest`
- **Strategy Evaluated**: `STRAT_MOMENTUM_ALPHA_V1`
- **Period**: 60-day historical window
- **Slippage**: 0.05%
- **Commission**: 0.10%
- **Benchmark**: Buy & Hold TCS

---

## L. LEAKAGE TEST
- **Status**: **PASSED (Test 4)**
- **Verification Proof**: Mutating bar $t+1$ close price by +500% leaves features at bar $t$ 100% invariant, while correctly altering target at bar $t$.

---

## M. REPRODUCIBILITY
- **One-Command Reproduction**: `npm run ml:reproduce`
- **Execution Output**:
  1. Validates dataset integrity and OHLC bounds.
  2. Cleans and normalizes canonical CSV.
  3. Computes batch causal features.
  4. Generates directional targets.
  5. Fits Decision Tree on Train partition only.
  6. Computes walk-forward metrics across Train, Val, and Test.
  7. Exports JSON artifact with SHA-256 hash.
  8. Registers model in Model Registry.
  9. Validates live inference via `model-runner.js`.
  10. Runs strategy backtest with trading fees.

---

## N. REMAINING LIMITATIONS
1. **Public Yahoo Finance API Dependency**: While official and functional, public market endpoints can occasionally rate-limit; the offline CSV import CLI (`npm run ml:data:download -- /path/to/custom.csv`) provides an offline fallback.
2. **Equity Out-of-Sample Regime Shift**: TCS.NS experienced consolidation in 2025, resulting in 47% test accuracy for pure momentum trees. Institutional deployment should ensemble multi-factor features.
