# Aurum Phase-4 ML Dataset Specification & Provenance

## Primary Model Dataset
- **Symbol**: `TCS.NS` (Tata Consultancy Services Ltd, National Stock Exchange of India)
- **Period**: `2019-01-01` through `2025-12-31`
- **Frequency**: Daily (`1D`)
- **Required Columns**: `timestamp,date,open,high,low,close,volume`
- **Price Type**: Raw Close (Official Exchange End-of-Day Traded Price)
- **Source**: Yahoo Finance Official Historical API (Symbol: `TCS.NS`)
- **Target File**: `src/server/ml/data/raw/tcs_2019_2025.csv`
- **Cleaned File**: `src/server/ml/data/processed/tcs_2019_2025_clean.csv`
- **License / Usage Note**: Market data downloaded for internal algorithm training, model validation, and academic/research walk-forward backtesting. Redistribution prohibited by provider terms.

## Data Acquisition Commands
```bash
# Automated download directly from market provider:
node src/server/ml/data/download-tcs-data.js

# Or import an external official historical CSV:
node src/server/ml/data/download-tcs-data.js /path/to/external_tcs.csv

# Validate integrity, format, and geometric validity:
npm run ml:data:validate
```

## Validation Rules Enforced
1. Strict ISO date formatting (`YYYY-MM-DD`).
2. Strictly monotonic chronological ordering.
3. Zero duplicate calendar dates.
4. Non-null, numeric OHLCV.
5. Geometric validity: `High >= max(Open, Close)` and `Low <= min(Open, Close)`.
6. Zero forward-fill, zero interpolation, no synthetic fabrication of missing trading days.
