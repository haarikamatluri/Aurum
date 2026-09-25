# ✅ AURUM — Vercel Production Checklist

Use this checklist before and after every production release to Vercel.

---

## 🔒 1. Security & Credentials Audit
- [x] **Zero Client Secrets**: Verified that `GEMINI_API_KEY`, `FINNHUB_API_KEY`, `UPSTOX_API_KEY`, and `MONGODB_URI` exist **only in server environment variables**.
- [x] **No Secrets in Bundle**: Inspected `dist/portfolio-intelligence/browser` assets for any leaked strings or keys.
- [x] **JWT Secret Strength**: `JWT_SECRET` configured in production with at least 32 bytes of entropy.
- [x] **Rate Limiters Active**: `authLimiter` and `marketLimiter` active on Express API routes.
- [x] **Security Headers**: `vercel.json` headers enforce `X-Content-Type-Options`, `X-Frame-Options`, and `X-XSS-Protection`.

---

## 📦 2. Build & Routing Verification
- [x] **Angular Production Build**: `npm run build` generates `dist/portfolio-intelligence/browser` with **0 errors**.
- [x] **Vercel Rewrite Configuration**: `vercel.json` rewrites `/api/(.*)` to `/api/index.js` serverless function.
- [x] **SPA Routing Fallback**: `vercel.json` routes `/(.*)` to `/index.html` for Angular client-side routes (`/money`, `/money/ai-analyst`, `/money/stocks/:symbol`).
- [x] **Serverless Function Export**: `api/index.js` correctly exports `module.exports = app` from `server.js`.
- [x] **Conditional Listener**: `server.js` checks `require.main === module` before calling `app.listen()` to prevent port-binding errors on serverless invocations.

---

## 💾 3. Database & Connection Pooling
- [x] **MongoDB Atlas Connection**: `ensureDbConnected()` uses connection pooling (`maxPoolSize: 10`) for serverless cold start efficiency.
- [x] **DB Middleware**: Serverless request middleware auto-checks and resumes MongoDB connection on invocation.
- [x] **In-Memory Fallback**: System gracefully falls back to deterministic memory store if MongoDB is offline or disconnected.

---

## 📈 4. Market Data & Multi-Currency Verification
- [x] **US Market (USD / $)**: `AAPL`, `NVDA`, `MSFT` format price with `$` symbol and NASDAQ exchange tags.
- [x] **India Market (INR / ₹)**: `TCS`, `INFY`, `TATASTEEL`, `RELIANCE` format price with `₹` symbol and NSE exchange tags.
- [x] **Currency Metadata Grounding**: Currency comes dynamically from security quote metadata, never hardcoded.

---

## 🤖 5. AI Analyst & Voice OS Verification
- [x] **Model Fail-Fast Guard**: Gemini API calls timeout after 1.5s per model attempt to prevent hanging.
- [x] **Instant Quantitative Fallback**: Fused recommendation engine generates structured outputs (`BUY/HOLD/SELL`, Score, Key Drivers, Key Risks) in **< 2.5 seconds** even if Gemini is rate limited.
- [x] **Ask Aurum Integration**: Connected to `/api/analyst/analyze` with multi-intent support.
- [x] **Morning Bell Briefing**: Integrated with holdings & watchlists via `/api/analyst/morning-brief`.
