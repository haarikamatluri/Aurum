# Aurum Phase-4 Machine Learning Architecture & Pipeline

## 1. Executive Overview
Aurum's ML layer provides institutional-grade directional trend inference for equity assets (primary: `TCS.NS`) operating within a strictly auditable, leakage-safe quantitative pipeline.
It implements a complete reproducible workflow:
```
RAW DATASET (Yahoo Finance NSE: TCS.NS)
      ↓
DATASET INTEGRITY VALIDATION
      ↓
CANONICAL CLEANING & NORMALIZATION
      ↓
UNIFIED CAUSAL FEATURE ENGINEERING (features-v1.4.0)
      ↓
DIRECTIONAL 1D TARGET GENERATION
      ↓
CHRONOLOGICAL SPLIT (Train 2019–2023 | Val 2024 | Test 2025)
      ↓
DECISION TREE CLASSIFIER TRAINING
      ↓
WALK-FORWARD PERFORMANCE EVALUATION
      ↓
DETERMINISTIC MODEL ARTIFACT EXPORT (.json + SHA-256)
      ↓
MODEL REGISTRY GOVERNANCE (TRAINED → PRODUCTION)
      ↓
LIVE INFERENCE RUNNER (/api/ml/predict)
      ↓
QUANT STRATEGY ENGINE & PRE-TRADE RISK CHECKS
      ↓
PAPER TRADING EXECUTION & AUDIT LOGGING
```

---

## 2. Dataset & Provenance
- **Symbol**: `TCS.NS` (Tata Consultancy Services Ltd, National Stock Exchange of India)
- **Period**: `2019-01-01` through `2025-12-31` (7 Full Calendar Years)
- **Frequency**: Daily (`1D`)
- **Canonical Schema**: `timestamp,date,open,high,low,close,volume`
- **Price Metric**: Raw Traded Close Price
- **Source**: Yahoo Finance Official Historical Chart API (`NSE: TCS.NS`)
- **Dataset File**: `src/server/ml/data/raw/tcs_2019_2025.csv`
- **Cleaned Dataset**: `src/server/ml/data/processed/tcs_2019_2025_clean.csv`
- **Dataset SHA-256**: `48db5aa2b56b8a064d60464d11e3d1df48381c3f407dff824487865c33d078ed`
- **Row Count**: 1,729 valid trading days

---

## 3. Data Cleaning & Validation Rules
Implemented in `src/server/ml/data/validate-dataset.js` and `src/server/ml/preprocessing/preprocess.js`:
1. Strict ISO 8601 Date Parsing (`YYYY-MM-DD`).
2. Strictly Monotonic Chronological Order (`date[t] > date[t-1]`).
3. Zero Duplicate Calendar Dates.
4. Positive OHLC Prices (`Open, High, Low, Close > 0`) and Non-Negative Volume (`Volume >= 0`).
5. Geometric Consistency: `High >= max(Open, Close)` and `Low <= min(Open, Close)`.
6. **No Forward-Fill or Synthetic Interpolation**: Missing holidays/trading closures are strictly retained as exchange non-trading periods without synthetic price invention.

---

## 4. Unified Feature Engineering (`features-v1.4.0`)
Implemented in `src/server/ml/features/feature-engineering.js`, identical between offline batch processing and live streaming:
- **`returns1D`**: Single-day price return in percentage points:
  $$\text{returns1D}_t = \left(\frac{\text{Close}_t - \text{Close}_{t-1}}{\text{Close}_{t-1}}\right) \times 100$$
- **`volatility14D`**: 14-observation sample standard deviation of daily percentage returns:
  $$\text{volatility14D}_t = \sqrt{\frac{1}{13} \sum_{i=0}^{13} (R_{t-i} - \bar{R})^2}$$
- **`rsi14`**: 14-day Relative Strength Index:
  $$\text{RSI14}_t = 100 - \frac{100}{1 + \frac{\text{AvgGain}_{14}}{\text{AvgLoss}_{14}}}$$
- **`volumeZScore`**: 14-day rolling Volume Z-Score:
  $$\text{volumeZScore}_t = \frac{\text{Volume}_t - \mu_V}{\sigma_V}, \quad (\text{yields } 0 \text{ if } \sigma_V = 0)$$

---

## 5. Target Definition & Leakage Prevention
Implemented in `src/server/ml/target/target-generator.js`:
- **Target**: `DIRECTIONAL_1D_RETURN_POSITIVE`
$$\text{target}_t = \begin{cases} 1 & \text{if } \text{Close}_{t+1} > \text{Close}_t \\ 0 & \text{otherwise} \end{cases}$$
- **Strict Causality**: Features at bar $t$ use only observations $\le t$.
- **No Look-Ahead**: Target at bar $t$ uses observation $t+1$. The final row in any dataset is excluded from training and evaluation because $t+1$ does not exist.
- **Leakage Immunity**: Formally verified in `test_ml_pipeline.js` Test 4: mutating $\text{OHLCV}_{t+1}$ alters $\text{target}_t$ while leaving $\text{features}_t$ 100% unchanged.

---

## 6. Walk-Forward Chronological Splitting
Implemented in `src/server/ml/validation/walk-forward.js`:
- **Train Set**: `2019-01-21` to `2023-12-29` (1,221 bars)
- **Validation Set**: `2024-01-01` to `2024-12-31` (246 bars)
- **Test Set**: `2025-01-01` to `2025-12-30` (247 bars)
- Zero look-ahead: $\max(\text{Train}) < \min(\text{Val}) < \min(\text{Test})$.

---

## 7. Model Training & Artifact Specification
- **Algorithm**: Binary Classification Decision Tree (Recursive Information Gain with Gini Impurity)
- **Hyperparameters**: `maxDepth: 3`, `minSamplesSplit: 30`, `minSamplesLeaf: 15`, `randomSeed: 42`.
- **Artifact Path**: `src/server/ml/artifacts/tcs_momentum_model.json`
- **Deterministic Hash**: Pure structural hash of model tree, parameters, and dataset checksum.

### Performance Across Walk-Forward Partitions:
| Partition | Samples | Accuracy | Precision | Recall | F1 Score | Sharpe Ratio | Max Drawdown |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TRAIN (2019–2023)** | 1,221 | **0.554** | 0.650 | 0.308 | **0.418** | 1.64 | 21.6% |
| **VAL (2024)** | 246 | **0.516** | 0.500 | 0.286 | **0.364** | -0.21 | 8.5% |
| **TEST (2025)** | 247 | **0.470** | 0.329 | 0.238 | **0.276** | -1.64 | 18.3% |

### Legacy Reported vs. Reproduced Metrics
- **Legacy Reported Metrics** (from previous snapshot): Accuracy = `78.4%`, Sharpe = `2.18`.
- **Reproducibility Status**: Marked `independentlyReproduced: false` in artifact metadata. Real un-curve-fitted out-of-sample test accuracy on TCS.NS (2025) is `47.0%`.

---

## 8. CLI Commands & Reproduction
```bash
# 1. Download official historical data from Yahoo Finance
npm run ml:data:download

# 2. Validate dataset integrity and OHLC geometry
npm run ml:data:validate

# 3. Clean, sort, and normalize dataset
npm run ml:preprocess

# 4. Train decision tree classifier and export artifact
npm run ml:train

# 5. Output walk-forward metrics across all splits
npm run ml:evaluate

# 6. Execute strategy backtest with fees and slippage
npm run ml:backtest

# 7. Run the 13-test forensic verification suite
npm run ml:verify

# 8. Complete one-command end-to-end reproduction
npm run ml:reproduce
```

---

## 9. Live Integration & Server Endpoints
- `GET /api/ml/status`: Returns model version, features, partition bounds, reproduced metrics, and SHA-256 hash.
- `GET /api/ml/models`: Returns registered models and lifecycle statuses.
- `POST /api/ml/predict`: Runs real-time tree inference on live market quotes.
- `POST /api/ml/backtest`: Executes strategy simulation with commissions and slippage.

---

## 10. Financial Disclaimer & Limitations
Model outputs represent statistical probabilities based on historical price patterns and are NOT guaranteed financial outcomes. Aurum's trading architecture strictly prevents direct ML-to-broker execution: all signals must pass through the Strategy Engine, Pre-Trade Risk Engine, and explicit User Confirmation before paper or live order transmission.
