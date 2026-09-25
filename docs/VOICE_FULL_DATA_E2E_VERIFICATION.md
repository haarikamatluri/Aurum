# AURUM VOICE FULL DATA E2E VERIFICATION

## End-to-End Test Execution Scenarios

### Test Case 1: Indian Stock Complete Intelligence ("Give me everything about TCS")

1. **User Speaks**: *"Give me everything about TCS."*
2. **Intent & Entity Resolution**:
   - Resolves `TCS` via SecurityMaster -> NSE Market (`IN`), Currency (`INR` / `₹`).
3. **Backend Multi-Provider Execution**:
   - Fetches live quote: `₹3,420.50` (+0.85%).
   - Fetches latest headlines: Tech earnings and IT sector outlook.
   - Fetches ML Ensemble prediction: `BULLISH` (88% confidence).
   - Checks portfolio holdings: `TCS` position P&L contribution.
4. **UI & Spoken Response**:
   - UI automatically navigates to `TCS` stock view.
   - Spoken feedback: *"Here is complete intelligence for TCS. TCS is trading at ₹3,420.50 (+0.85%). ML ensemble signal is BULLISH with 88% confidence."*
   - Displays structured research card with Indian Rupee symbol `₹`.

---

### Test Case 2: US Stock Complete Intelligence ("Give me everything about Nvidia")

1. **User Speaks**: *"Give me everything about Nvidia."*
2. **Intent & Entity Resolution**:
   - Resolves `NVDA` via SecurityMaster -> NASDAQ Market (`US`), Currency (`USD` / `$`).
3. **Backend Multi-Provider Execution**:
   - Fetches live quote: `$118.40` (+2.15%).
   - Fetches latest news headlines & earnings calendar.
   - Fetches ML Ensemble prediction: `BULLISH` (84% confidence).
4. **UI & Spoken Response**:
   - UI automatically navigates to `NVDA` stock view.
   - Spoken feedback: *"Here is complete intelligence for NVDA. NVDA is trading at $118.40 (+2.15%). ML ensemble signal is BULLISH with 84% confidence."*
   - Displays structured research card with US Dollar symbol `$`.

---

### Test Case 3: Portfolio Health Check & Decliner Analysis ("What is hurting my portfolio today?")

1. **User Speaks**: *"What is hurting my portfolio today?"*
2. **Execution**:
   - Evaluates active holdings across all markets.
   - Identifies top decliner (e.g. `TSLA` or `INFY`).
3. **Spoken Response**:
   - *"TSLA is down 2.15%, making it your largest decliner today."*

---

### Test Case 4: Pre-Trade Risk Safety Check ("Buy 10 TCS")

1. **User Speaks**: *"Buy 10 TCS."*
2. **Execution**:
   - Resolves symbol `TCS`, quantity `10`, side `BUY`.
   - Generates `PREVIEW_ORDER` via `TradingService.previewOrder`.
3. **Safety Enforcement**:
   - Live trade IS NOT executed silently.
   - UI displays Order Confirmation Card requiring explicit user click.
   - Spoken feedback: *"Order preview ready for 10 shares of TCS for approximately ₹34,205. Please confirm on your screen."*
