# AURUM AI Analyst — Comprehensive Architecture & Feature Audit

**Generated:** 2026-09-25T07:10:00+05:30  
**Auditor:** Principal Full-Stack & Quantitative Systems Architect (Aurum Intelligence OS)  
**Document Target:** `docs/AI_ANALYST_AUDIT.md`

---

## 1. Executive Summary

A comprehensive, line-by-line inspection of the Aurum application was conducted across Angular frontend routes, component templates, TypeScript services, Node.js Express backend routes (`server.js`), ML engines (`src/server/ml`), trading services (`src/server/trading`), and broker integrations.

The audit revealed that while a rich visual UI skeleton and partial server-side Gemini integration existed for single-stock news chat (`/api/ai/analyze` and `/api/ai/chat`), **critical analyst capabilities (Morning Briefing, Stock Report Engine, Stress Test, Filings, Earnings, Watchlist Intelligence, Company Comparison, and Saved Reports) were either only partially prototyped in the browser with hardcoded fallbacks or completely empty placeholder tabs.**

This audit outlines every feature's current state, identifies fake/static/hardcoded fallbacks, and specifies the required production-grade architecture to make Aurum's AI Analyst a real-data, end-to-end financial intelligence operating system.

---

## 2. Feature-by-Feature Audit Matrix

| Feature | UI Exists? | Backend Exists? | Real Data? | AI Analysis? | Persistence? | Refresh? | Error Handling? | Source Provenance? | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Morning Briefing** | Partial (Tab stub with 4 cards) | No dedicated endpoint (`/api/analyst/morning-brief` missing) | No (Hardcoded S&P futures, GIFT Nifty, Crude, Yields in client service) | Client-side only if key present, else hardcoded text | No | Manual button only | Minimal fallback | No provenance metadata | **INCOMPLETE / STUB** |
| **Stock Report Engine** | Partial (Stock header + chart + basic quickTake) | Partial (`/api/ai/analyze` returns partial news analysis) | Partial (Yahoo quote + news, but fundamentals, technicals, valuation missing) | Yes (`/api/ai/analyze`) | No report persistence | Manual search | Fallback catches errors | Partial (news links) | **PARTIALLY WIRED** |
| **Stress Test Engine** | Stub (`<p>` tag in tab container) | No (`/api/analyst/stress-test` missing) | No (Client-side heuristics with hardcoded percentage shifts) | No | Scenarios hardcoded | No | None | None | **STUB / PLACEHOLDER** |
| **Corporate Filings** | Stub (`<p>` tag in tab container) | No (`/api/analyst/filings/:symbol` missing) | No (No exchange/regulatory filing integration) | No | None | No | None | None | **EMPTY TAB** |
| **Earnings & Estimates** | Stub (`<p>` tag in tab container) | No (`/api/analyst/earnings/:symbol` & `/calendar` missing) | No (Hardcoded numbers like ₹22,450 Cr / $14.28B in fallback) | Simulated prompt | None | No | None | None | **EMPTY TAB / HARDCODED** |
| **Watchlist Intelligence** | Minimal (Pill list) | Basic (`/api/watchlist` CRUD) | Quotes only, no multi-stock ranking or factor intelligence | No | Yes (Mongo + LocalStorage) | Polling | Basic | Missing | **BASIC CRUD ONLY** |
| **Watchlist Alerts** | No | No (`/api/analyst/alerts` missing) | No | No | No | No | None | None | **MISSING** |
| **News Engine** | Yes (Drawer + cards) | Yes (`/api/market/news` via Brave & Google RSS) | **Yes** (Real live headlines) | News used in prompt | No | Cache TTL (5m) | Yes | Real publisher & link | **OPERATIONAL (Needs normalization)** |
| **Portfolio Intelligence** | Partial (Quick take holding text) | Partial (`/api/portfolio/holdings`) | **Yes** (Real user holdings & quotes) | Partial | Yes (Mongo + Memory) | Yes | Yes | Holding cost basis | **PARTIALLY CONNECTED** |
| **Market Intelligence** | No (No macro overview tab) | No (`/api/analyst/market-intelligence` missing) | Partial (Individual Yahoo quotes) | No | No | No | None | None | **MISSING** |
| **Company Comparison** | No | No (`/api/analyst/compare` missing) | No | No | No | No | None | None | **MISSING** |
| **ML V2 Integration** | No UI in Analyst | Yes (`/api/ml/predict`, `model-runner.js`, ensemble v2) | **Yes** (Deterministic feature generator + Platt-calibrated ensemble) | ML model (not generative) | Yes | On-demand | Yes | Artifact hash & version | **NOT CONNECTED TO ANALYST UI** |
| **Strategy Integration** | No UI in Analyst | Yes (`/api/strategies`, automation controller) | **Yes** (Deterministic rules) | No | In-memory | Yes | Yes | Rule descriptions | **NOT CONNECTED TO ANALYST UI** |
| **Analyst Data Envelope** | No | No | No | No | N/A | N/A | N/A | N/A | **MISSING CONTRACT** |
| **Saved Reports** | No | No (`/api/analyst/reports` missing) | No | No | No | No | None | None | **MISSING** |
| **Analyst Health & Metrics** | No | Partial (`/api/ai/health`, `/api/ml/health`) | Partial | No | No | On-demand | Yes | Provider status | **FRAGMENTED** |
| **Universal Voice OS** | Yes (Mic button + query endpoint) | Partial (`/api/voice/query` with simple regex routing) | Partial | Yes | Yes (Voice sessions) | N/A | Yes | Partial | **DISCONNECTED FROM ANALYST TABS** |

---

## 3. Discovered Mock / Dummy / Hardcoded Data

During the code audit, the following specific files and lines were identified containing simulated, hardcoded, or placeholder data:

1. **`src/app/core/services/ai-analyst.service.ts`**:
   - Lines 560, 879: `marketData: 'Live (Simulated)'` and `'Delayed (Simulated)'`.
   - Lines 923–968 (`getFallbackMorningBriefing`): Hardcoded pre-market numbers: S&P Futures `+0.42%`, GIFT Nifty `+54 pts`, Crude Oil `$81.75/bbl`, US 10Y Yield `4.24%`.
   - Lines 1128–1155 (`summarizeEarningsAndFilings`): Hardcoded mock revenue numbers (`₹22,450 Cr (+9.4% YoY)` or `$14.28B (+12.6% YoY)`), EPS (`₹28.40` or `$1.82`).
   - Lines 1163–1287 (`runPortfolioStressTest`): Client-side deterministic calculation with hardcoded sector heuristic shifts rather than backed by real market volatility and factor models.

2. **`src/app/features/ai-analyst/ai-analyst.ts`**:
   - Lines 658–678: Static fallback claims (`'AI Demand Supports Sector Sentiment'`, `'Operational Margin & Deal Pipeline Support'`) injected whenever news array is small.
   - Lines 702–723: Static contradicting claims (`'Analyst Valuation Re-Rating Caution'`, `'Discretionary Tech Spend Slowdown'`).
   - Lines 746–766: Static uncertain factors (`'Valuation & P/E Multiples Re-assessment'`).
   - Lines 870–889: Hardcoded dummy news objects when news fetch fails.

3. **`src/app/features/ai-analyst/ai-analyst.html`**:
   - Lines 707–753: Placeholder tab containers for `MORNING_BELL`, `EARNINGS_FILINGS`, and `STRESS_TEST`.

4. **`server.js`**:
   - Lines 3451, 3856: Default price fallbacks `₹2,089.60` and change `-0.73%` if Yahoo quote returns null.
   - Absence of dedicated `/api/analyst/*` suite of endpoints.

---

## 4. Architectural Transformation Plan

To fulfill the requirements of the **AURUM AI Analyst OS**:

1. **Normalized Analyst Data Envelope (`AnalystDataEnvelope`)**:
   Standardize all analyst data across market, company, filings, earnings, stress test, and reports with `status` (`LIVE | CACHED | STALE | UNAVAILABLE`), freshness timestamps, and full provenance tracking.

2. **Server-Side Data Providers & Analyst Engine (`src/server/analyst/`)**:
   - `MarketDataProvider`: Real live quotes, intraday & historical candles, technical indicators (RSI, MACD, SMAs, Bollinger, ATR), index breadth (NIFTY 50, SENSEX, BANK NIFTY, S&P 500, NASDAQ, Crude, Gold, US 10Y, USD/INR).
   - `FundamentalsProvider`: Real market cap, P/E, EPS, revenue, profit margins, 52-week high/low, dividend yield.
   - `EarningsProvider`: Real quarterly reporting history, EPS/Revenue actuals vs consensus estimates, earnings surprises, and upcoming earnings calendar.
   - `FilingsProvider`: Real corporate announcements, board meetings, regulatory disclosures from NSE/BSE and SEC EDGAR.
   - `NewsProvider`: Real-time multi-source market news with relevance ranking and article metadata.
   - `MacroEventProvider`: Scheduled economic indicators (CPI, interest rate decisions, GDP releases).
   - `StressTestEngine`: Deterministic portfolio shock simulation on active user holdings with sector aggregations, factor sensitivities, and mathematical loss attribution (AI only synthesizes executive explanation, never invents math).
   - `AnalystReportEngine`: Synthesizes full multi-dimensional equity dossiers (Identity + Price + Technicals + Fundamentals + Valuation + News + Earnings + Filings + ML V2 + Strategy + Portfolio Impact + Grounded Gemini Synthesis).

3. **Express API Routes (`/api/analyst/*`)**:
   - `GET /api/analyst/morning-brief`
   - `GET /api/analyst/stock/:symbol/report`
   - `GET /api/analyst/filings/:symbol`
   - `GET /api/analyst/filings/:symbol/summary`
   - `GET /api/analyst/earnings/:symbol`
   - `GET /api/analyst/earnings/calendar`
   - `POST /api/analyst/stress-test`
   - `GET /api/analyst/watchlist/intelligence`
   - `GET /api/analyst/news`
   - `GET /api/analyst/portfolio-intelligence`
   - `GET /api/analyst/market-intelligence`
   - `GET /api/analyst/compare`
   - `GET /api/analyst/health`
   - `GET /api/analyst/metrics`
   - `GET /api/analyst/reports/saved`
   - `POST /api/analyst/reports/save`
   - `GET /api/analyst/alerts`
   - `POST /api/analyst/alerts`

4. **Frontend Transformation (`src/app/features/ai-analyst/`)**:
   - Connect all tabs (`Market News Verdict`, `Morning Bell Briefing`, `Earnings & Filings`, `What-If Stress Test`, and new `Stock Deep Report`, `Watchlist Intelligence`, `Company Comparison`) to real backend services.
   - Replace every stub card with full interactive components showing real timestamps, data source tags, freshness badges, loading skeletons, truthful empty states, and manual refresh actions.
   - Ensure zero mock data or placeholder values exist in any user-facing path.

5. **Universal Voice OS Integration**:
   - Wire all voice intents ("Give me my morning briefing", "Stress test my portfolio by 10%", "Show TCS filings", "What earnings are coming up?", "Compare TCS and Infosys") directly to the same underlying backend analyst services.
