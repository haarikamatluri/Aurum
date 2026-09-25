# AURUM UNIVERSAL VOICE OPERATING SYSTEM V4 — ARCHITECTURE & CAPABILITIES

## Executive Summary

Aurum Universal Voice Operating System V4 establishes natural voice speech as a first-class, full-capability operating layer for the entire Aurum financial intelligence platform.

Any legitimate financial analysis, portfolio tracking, alert management, strategy monitoring, risk assessment, or market research action available in Aurum is directly controllable through natural speech.

---

## 1. Unified Execution Pipeline Architecture

```
  MICROPHONE / TEXT
         │
         ▼
  SPEECH-TO-TEXT (STT)
         │
         ▼
    TRANSCRIPT
         │
         ▼
  NORMALIZATION
         │
         ▼
  INTENT ROUTER & CAPABILITY DISCOVERY
         │
         ▼
  UNIVERSAL ENTITY RESOLUTION (SecurityMaster API)
         │
         ▼
  CONVERSATIONAL CONTEXT RESOLUTION (VoiceContextService)
         │
         ▼
  PERMISSION & FINANCIAL SAFETY CHECK (Order Pre-Trade Gate)
         │
         ▼
  ACTION GRAPH GENERATOR (CommandPlannerService)
         │
         ▼
  SERVER-SIDE BACKEND PROVIDER LAYER (/api/*)
         │
         ▼
  REAL MARKET DATA PROVIDERS (Yahoo Finance / Finnhub / Upstox)
         │
         ▼
  DATA NORMALIZATION & CURRENCY SYMBOL MATCHING (INR ₹ / USD $)
         │
         ▼
  ANGULAR APPLICATION STATE SYNCHRONIZATION (Signals & Router)
         │
         ▼
  VOICE RESPONSE & TEXT-TO-SPEECH (TTS)
```

---

## 2. Universal Capability Coverage Matrix

| Capability Category | Capabilities | Command Examples |
| :--- | :--- | :--- |
| **Navigation & UI** | `OPEN_DASHBOARD`, `OPEN_STOCK`, `OPEN_ANALYST`, `OPEN_NOTIFICATIONS`, `OPEN_SETTINGS`, `NAVIGATE_BACK`, `SET_TIMEFRAME`, `SET_MARKET_FILTER`, `SWITCH_TAB`, `EXPAND_CHART`, `COLLAPSE_DETAILS` | "Open TCS", "Show 1 year chart", "Switch to Indian market", "Go back", "Open settings" |
| **Market Intelligence** | `GET_STOCK_QUOTE`, `GET_MARKET_BRIEF`, `COMPARE_STOCKS`, `ANALYZE_STOCK_MOVEMENT`, `GET_COMPLETE_SECURITY_INTELLIGENCE` | "What's Apple trading at?", "Give me everything about Nvidia", "Why is Reliance falling?", "Compare TCS and Infosys" |
| **Portfolio & Holdings** | `GET_PORTFOLIO_SUMMARY`, `GET_BIGGEST_LOSER`, `GET_TOP_MOVER`, `GET_SECTOR_EXPOSURE`, `GET_MARKET_EXPOSURE`, `GET_PORTFOLIO_IMPACT` | "Show my portfolio", "What's my P&L?", "What is hurting my portfolio today?", "What is my Indian exposure?" |
| **Alerts & Notifications** | `SET_PRICE_ALERT`, `REMOVE_ALERT`, `LIST_ALERTS` | "Alert me if Apple crosses $250", "Create an alert for TCS at ₹3,500", "Show my alerts" |
| **AI Analyst & Research** | `GET_FINANCIAL_NEWS`, `SEARCH_RESEARCH`, `EXPLAIN_FINANCIAL_CONCEPT`, `TOGGLE_MORNING_BRIEFING`, `STRESS_TEST`, `FILINGS`, `EARNINGS` | "Show Nvidia earnings", "Show latest TCS filings", "Run a stress test", "Explain P/E ratio" |
| **ML & Quantitative** | `GET_ML_PREDICTION`, `EXPLAIN_ML_PREDICTION`, `COMPARE_ML_MODELS`, `RUN_BACKTEST` | "Run an ML prediction for TCS", "Show model performance", "Backtest this strategy" |
| **Strategy & Automation** | `GET_AUTOMATION_STATUS`, `ENABLE_AUTOMATION`, `DISABLE_AUTOMATION`, `TOGGLE_KILL_SWITCH` | "Show strategy status", "Stop automation", "Activate kill switch" |
| **Financial Safety Orders** | `PREVIEW_ORDER`, `CANCEL_ORDER` | "Buy 10 TCS", "Sell 5 NVDA" *(Generates mandatory Pre-Trade Order Preview for explicit screen confirmation)* |

---

## 3. Financial Safety & Permission Architecture

1. **Pre-Trade Confirmation Gate**: No live orders can be executed blindly via voice. Voice actions involving buying or selling generate a pre-trade risk ticket and order preview card requiring explicit user confirmation.
2. **Kill Switch & Automation Locks**: High-impact or destructive actions (such as turning on automated execution or triggering kill switches) require explicit user consent and pre-flight risk checks.
3. **Secret Redaction**: API keys and tokens are stored exclusively in server environment variables and never exposed to the client or voice transcripts.
