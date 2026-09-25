# 🔐 AURUM — Vercel Environment Variables Reference

This reference documents every environment variable required or supported by the Aurum Financial Intelligence platform on Vercel.

---

## 🛠️ Required Production Variables

| Variable | Target Scope | Description |
| :--- | :--- | :--- |
| `JWT_SECRET` | Production, Preview | Secret key used to sign and verify session JWTs |
| `MONGODB_URI` | Production, Preview | MongoDB Atlas connection string (`mongodb+srv://...`) |
| `GEMINI_API_KEY` | Production, Preview | Google Gemini API key for AI Analyst & natural language synthesis |

---

## 📊 Market Data Provider Variables (Server-Side Only)

| Variable | Description | Provider |
| :--- | :--- | :--- |
| `FINNHUB_API_KEY` | US real-time quote, market news, and earnings calendar API key | Finnhub.io |
| `TWELVE_DATA_API_KEY` | US & global market secondary quote provider API key | Twelvedata.com |
| `UPSTOX_API_KEY` | Indian market (NSE/BSE) institutional market data API key | Upstox Developer Portal |
| `UPSTOX_ACCESS_TOKEN` | Indian market session access token | Upstox Developer Portal |
| `ALPHA_VANTAGE_API_KEY` | US & global fundamental data API key | Alphavantage.co |

---

## 🏦 Brokerage Integration Variables (Server-Side Only)

| Variable | Description |
| :--- | :--- |
| `KITE_API_KEY` | Zerodha Kite Connect API key (India market portfolio sync) |
| `KITE_API_SECRET` | Zerodha Kite Connect API secret |
| `WEBULL_APP_KEY` | Webull App key (US market portfolio sync) |
| `WEBULL_APP_SECRET` | Webull App secret |
| `WEBULL_ACCOUNT_ID` | Webull Account ID |

---

## 🔔 Push Notifications & Auth Variables

| Variable | Description |
| :--- | :--- |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID for "Sign in with Google" |
| `VAPID_PUBLIC_KEY` | Web push public VAPID key |
| `VAPID_PRIVATE_KEY` | Web push private VAPID key |

---

## 🛡️ Security Rules

1. **Server-Side Only**: All API keys, connection strings, and secrets MUST be set as environment variables in Vercel.
2. **Never Exposed to Client**: None of the above environment variables are prefixed with `NEXT_PUBLIC_` or `NG_APP_` and are NEVER bundled into client JavaScript.
