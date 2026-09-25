# 🗺️ AURUM — Vercel API Route Inventory

All Aurum backend endpoints are routed through the Vercel Serverless Function at `api/index.js` mapping directly to Express routes.

---

## 📈 1. Market Data & Quotes (`/api/quotes/*`, `/api/securities/*`)

| Method | Endpoint | Auth | Description | Providers | Expected Latency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/market/quote/:symbol` | Optional | Live market quote (price, change, change%, high, low) | Yahoo, Finnhub, TwelveData | < 300ms |
| `GET` | `/api/market/indices` | Optional | Major benchmark indices (Nifty 50, Sensex, S&P 500, Nasdaq) | NSE Gateway, Refinitiv | < 250ms |
| `GET` | `/api/securities/search` | Optional | Universal US + India security master search | Security Master Provider | < 200ms |

---

## 🤖 2. AI Analyst Engine (`/api/analyst/*`)

| Method | Endpoint | Auth | Description | Providers | Expected Latency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/analyst/analyze` | Optional | Ask Aurum & multi-factor AI financial intelligence | Quant Engine, Gemini | ~2.0s |
| `GET` | `/api/analyst/morning-brief` | Required | Morning Bell Briefing for portfolio & watchlists | Quant Engine, News | < 1.5s |
| `GET` | `/api/analyst/stock/:symbol/report` | Required | Complete 7-page institutional equity research report | Quant Engine, Gemini | ~2.0s |
| `GET` | `/api/analyst/news` | Optional | Institutional press newswire & sentiment analysis | Financial Newswire | < 400ms |
| `GET` | `/api/analyst/earnings/:symbol` | Optional | Historical earnings surprises & upcoming calendar | Finnhub | < 350ms |
| `GET` | `/api/analyst/filings/:symbol` | Optional | Corporate filings & SEC disclosure documents | Filings Database | < 400ms |
| `POST` | `/api/analyst/stress-test` | Required | Deterministic portfolio macro stress test | Math Engine | < 150ms |
| `GET` | `/api/analyst/compare` | Optional | Head-to-head stock quantitative comparison | Quant Engine | < 600ms |

---

## 🧠 3. Machine Learning Subsystem (`/api/ml/*`)

| Method | Endpoint | Auth | Description | Artifacts | Expected Latency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/ml/status` | Optional | Active ML models status & feature engineering pipeline | Model Runner | < 50ms |
| `GET` | `/api/ml/models` | Optional | Deployed model registry metadata | Model Registry | < 50ms |
| `POST` | `/api/ml/predict` | Optional | Real-time directional prediction for security | Ensemble V2 Model | < 100ms |
| `POST` | `/api/ml/backtest` | Optional | Strategy walk-forward backtest execution | Backtest Engine V2 | < 300ms |

---

## 💼 4. Portfolio & Watchlist (`/api/portfolio/*`, `/api/watchlist/*`, `/api/alerts/*`)

| Method | Endpoint | Auth | Description | Storage | Expected Latency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/portfolio/holdings` | Required | Active user portfolio positions & P&L | MongoDB / Memory | < 150ms |
| `POST` | `/api/portfolio/holdings` | Required | Add or update stock position in portfolio | MongoDB / Memory | < 200ms |
| `GET` | `/api/analyst/portfolio-intelligence` | Required | Portfolio sector exposure, risk & return breakdown | Math Engine | < 250ms |
| `GET` | `/api/watchlist` | Required | User watchlist symbols | MongoDB / Memory | < 100ms |
| `GET` | `/api/analyst/watchlist/intelligence` | Required | Ranked watchlist volume, gains & loss metrics | Aggregator | < 400ms |
| `GET` | `/api/analyst/alerts` | Required | Active user watchlist price & movement alerts | MongoDB / Memory | < 100ms |

---

## 🔐 5. Authentication & Voice (`/api/auth/*`, `/api/voice/*`)

| Method | Endpoint | Auth | Description | Expected Latency |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | None | Create user account with bcrypt password hashing | < 300ms |
| `POST` | `/api/auth/login` | None | Authenticate user & issue session JWT cookie | < 250ms |
| `POST` | `/api/voice/process` | Optional | Universal Voice OS natural language command processor | < 600ms |
