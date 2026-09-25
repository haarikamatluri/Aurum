# AURUM CAPABILITY COVERAGE & WEBSITE DISCOVERY AUDIT v2

**Universal Voice OS v2 — Application Surface Inventory**

---

## 1. Route & Component Architecture Inventory

| Route | Component | UI Capability | Backend Capability | Voice Capability | Risk Level | Current Status | Missing Registration |
|---|---|---|---|---|---|---|---|
| `/` | `LandingPage` | Marketing landing, hero CTA, sign in/up links | Public landing assets | `NAVIGATE_LANDING` | `READ_ONLY` | Verified | None |
| `/login` | `LoginPage` | Authentication, guest login, demo credentials | `POST /api/auth/login` | `NAVIGATE_LOGIN` | `READ_ONLY` | Verified | None |
| `/signup` | `SignupPage` | User registration | `POST /api/auth/signup` | `NAVIGATE_SIGNUP` | `READ_ONLY` | Verified | None |
| `/money` | `Dashboard` | Portfolio overview, total value, P&L, market split, holdings table, morning briefing audio, search stock | `GET /api/market/quotes`, `GET /api/portfolio` | `OPEN_DASHBOARD`, `GET_PORTFOLIO_SUMMARY`, `GET_BIGGEST_LOSER`, `GET_TOP_MOVER`, `GET_SECTOR_EXPOSURE`, `GET_MARKET_EXPOSURE`, `TOGGLE_MORNING_BRIEFING` | `READ_ONLY` / `SAFE_UI` | Verified | Extended exposure & impact |
| `/money` (Modal) | `OrderModal` | Buy/Sell order placement, preview, validation, execution | `POST /api/orders/preview`, `POST /api/orders/execute` | `OPEN_ORDER_MODAL`, `PREVIEW_ORDER`, `CANCEL_ORDER` | `FINANCIAL` | Verified | Pre-trade risk enforced |
| `/money` (Modal) | `AutomationModal` | Strategy toggling, kill switch status, risk limits, paper trading | `POST /api/automation/toggle`, `POST /api/orders/kill-switch` | `OPEN_AUTOMATION_MODAL`, `GET_AUTOMATION_STATUS`, `ENABLE_AUTOMATION`, `DISABLE_AUTOMATION`, `TOGGLE_KILL_SWITCH` | `SENSITIVE` | Verified | Disengage kill switch wired |
| `/money` (Modal) | `BrokerSyncModal` | Broker account connection, balance reconciliation | `GET /api/broker/status`, `POST /api/broker/reconcile` | `OPEN_BROKER_SYNC_MODAL`, `SYNC_BROKER`, `GET_BROKER_STATUS` | `SENSITIVE` | Verified | Registered in v2 |
| `/money/stocks/:symbol` | `StockDetailPage` | Interactive price chart (1D/1W/1M/3M/1Y/All), day high/low, volume, financial metrics, news feed, quick buy/sell, alert setup | `GET /api/market/quotes`, `GET /api/market/history`, `GET /api/news` | `OPEN_STOCK`, `GET_STOCK_QUOTE`, `SET_TIMEFRAME`, `SET_PRICE_ALERT`, `ANALYZE_STOCK_MOVEMENT`, `EXPAND_CHART`, `COLLAPSE_DETAILS` | `SAFE_UI` / `READ_ONLY` | Verified | Chart zoom & details collapse |
| `/money/ai-analyst` | `AiAnalystPage` | AI synthesis, research dossier, deep-dive technicals, evidence citations, valuation multiples, catalysts | `POST /api/voice/query`, `POST /api/analyst/research` | `OPEN_ANALYST`, `SWITCH_TAB`, `SEARCH_RESEARCH`, `EXPLAIN_FINANCIAL_CONCEPT` | `READ_ONLY` | Verified | Tab switching registered |
| `/money/ai-analyst/:symbol` | `AiAnalystPage` | Targeted stock research report, citations, generative commentary | `POST /api/voice/query` | `OPEN_ANALYST`, `ANALYZE_STOCK_MOVEMENT` | `READ_ONLY` | Verified | None |
| `/money/ai-analyst/:symbol/:tab` | `AiAnalystPage` | Deep sub-tab direct link (`overview`, `deep-dive`, `evidence`, `valuation`, `catalysts`) | Frontend route state | `OPEN_ANALYST`, `SWITCH_TAB` | `READ_ONLY` | Verified | Sub-tab routing registered |
| `/money/notifications` | `NotificationsPage` | Price threshold alerts, systemic trade notifications, mark read, delete alert | `GET /api/notifications`, `POST /api/notifications/clear` | `OPEN_NOTIFICATIONS`, `SET_PRICE_ALERT`, `REMOVE_ALERT`, `LIST_ALERTS` | `SAFE_UI` / `REVERSIBLE` | Verified | List alerts added |
| `/money/settings` | `SettingsPage` | User preferences, currency (INR/USD), speech rate, theme, API keys, risk limits | `GET /api/settings`, `PUT /api/settings` | `OPEN_SETTINGS`, `UPDATE_SETTINGS` | `REVERSIBLE` | Verified | Settings updates registered |
| Global Overlay | `AurumVoiceAssistant` | Orb, waveform, transcript, timeline, action cards, push-to-talk, universal natural language OS | Local Fast-Path, Semantic Discovery, `POST /api/voice/query` | `STOP_SPEAKING`, `CANCEL_ACTION`, `GENERAL_HELP`, `UNSUPPORTED_CAPABILITY` | `SAFE_UI` | Verified | Full v2 Discovery Engine |
| Global Backend | Quantitative ML Engine | Chronological walk-forward decision tree inference & backtesting | `POST /api/ml/predict`, `POST /api/ml/backtest` | `GET_ML_PREDICTION`, `EXPLAIN_ML_PREDICTION`, `RUN_BACKTEST`, `COMPARE_STRATEGY` | `READ_ONLY` | Verified | Explainability & strategy comparison |

---

## 2. Interactive Elements Discovered & Covered

1. **Market Filter Toggle**: `ALL` | `US` | `IN` (`SET_MARKET_FILTER`)
2. **Chart Timeframe Selectors**: `1D` | `1W` | `1M` | `3M` | `1Y` | `All` (`SET_TIMEFRAME`)
3. **AI Analyst Navigation Tabs**: `overview` | `deep-dive` | `evidence` | `valuation` | `catalysts` (`SWITCH_TAB`)
4. **Order Modals & Action Triggers**: Buy / Sell stock ticket (`PREVIEW_ORDER`)
5. **Emergency Kill Switch**: Immediate trading suspension & resumption (`TOGGLE_KILL_SWITCH`)
6. **Automation Bot Controls**: Turn automated paper trading on/off (`ENABLE_AUTOMATION`, `DISABLE_AUTOMATION`)
7. **Morning Briefing Audio**: Voice synthesizer briefing toggle (`TOGGLE_MORNING_BRIEFING`)
8. **Price Alerts**: Create threshold and remove alerts (`SET_PRICE_ALERT`, `REMOVE_ALERT`)
9. **Navigation**: Forward, backward, and direct deep-linking across all routes (`NAVIGATE_BACK`, `OPEN_*`)
10. **Voice Control**: Stop speech, cancel active execution, dismiss cards (`STOP_SPEAKING`, `CANCEL_ACTION`)

---

## 3. Financial Safety Gating Verification

- Spoken commands proposing financial trades (e.g. *"Buy 2 TCS"*, *"Sell 5 NVDA"*) are strictly routed to `PREVIEW_ORDER`.
- An on-screen **Order Preview Action Card** is generated with calculated total cost, fees, order type, and pre-trade risk engine validation.
- Direct broker execution via natural language or voice is **explicitly blocked**.
- Execution proceeds ONLY when the user clicks the explicit confirmation button on screen.
