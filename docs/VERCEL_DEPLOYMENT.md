# 🚀 AURUM — Vercel Production Deployment Guide

This guide details the complete architecture, setup, and deployment procedure for hosting **Aurum Financial Intelligence Platform** on **Vercel**.

---

## 🏗️ 1. Architecture Overview

Aurum is deployed on Vercel using a serverless hybrid model:

```mermaid
graph TD
    Client["Browser / Angular SPA"] -->|Static Assets & Routes| VercelCDN["Vercel Edge CDN"]
    Client -->|/api/* HTTP Requests| VercelFunc["Vercel Serverless Function (api/index.js)"]
    VercelFunc -->|Express App Handler| Express["Aurum Node/Express Router"]
    Express -->|Mongo Connection Pool| Mongo["MongoDB Atlas Cluster"]
    Express -->|Server-side API Calls| Gemini["Google Gemini API"]
    Express -->|Server-side API Calls| MarketProviders["Finnhub / TwelveData / Upstox / Yahoo"]
```

- **Frontend**: Angular SPA compiled to `dist/portfolio-intelligence/browser` and served via Vercel Edge CDN with client-side SPA routing fallback to `/index.html`.
- **Backend**: Express API server running inside Vercel Serverless Node.js Functions (`api/index.js`). All `/api/*` requests route dynamically to Express handlers.
- **Database**: External MongoDB Atlas cluster connected securely via connection-pooled connection string (`MONGODB_URI`).
- **External Providers**: Finnhub, Twelve Data, Upstox, Alpha Vantage, and Google Gemini accessed **strictly server-side** with zero credential exposure to the client browser.

---

## 📋 2. Prerequisites & Vercel Project Setup

1. **GitHub Repository**: Ensure your code is pushed to `aeccentric/Aurum` on GitHub.
2. **MongoDB Atlas Database**: Set up a free or dedicated MongoDB cluster and obtain the connection string (`mongodb+srv://...`).
3. **Vercel Account**: Sign up at [vercel.com](https://vercel.com).

---

## ⚙️ 3. Environment Variables Configuration

In Vercel Project Settings -> **Environment Variables**, add the following key-value pairs:

| Variable Name | Description | Example / Source |
| :--- | :--- | :--- |
| `JWT_SECRET` | 64-char string for signing JWT sessions | `randomBytes(32).toString('hex')` |
| `MONGODB_URI` | MongoDB Atlas cluster connection string | `mongodb+srv://user:pass@cluster.mongodb.net/?...` |
| `MONGODB_DB_NAME` | Database name (default `portfolio_intelligence`) | `portfolio_intelligence` |
| `GEMINI_API_KEY` | Server-side Gemini AI model API key | `AIzaSy...` (aistudio.google.com) |
| `FINNHUB_API_KEY` | US Quotes & Earnings market data key | Finnhub.io |
| `TWELVE_DATA_API_KEY` | Global quote fallback key | Twelvedata.com |
| `UPSTOX_API_KEY` | India Market real-time gateway key | Upstox Developer Portal |
| `UPSTOX_ACCESS_TOKEN` | India Market access token | Upstox Developer Portal |
| `GOOGLE_CLIENT_ID` | Optional: Google OAuth Client ID | Google Cloud Console |

---

## 🚀 4. Deployment Steps

### Option A: Deployment via Vercel Dashboard (Recommended)

1. Go to [vercel.com/new](https://vercel.com/new) and import `aeccentric/Aurum`.
2. Configure project settings:
   - **Framework Preset**: `Angular`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/portfolio-intelligence/browser`
3. Expand **Environment Variables** and paste your production variables from Section 3.
4. Click **Deploy**.

### Option B: Deployment via Vercel CLI

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy to production
vercel --prod
```

---

## 🔄 5. Rollback Procedure

If a production issue occurs:
1. Go to Vercel Dashboard -> **Deployments**.
2. Locate the last working deployment.
3. Click the `...` menu and select **Instant Rollback**.
4. Confirm rollback. Deployment reverts instantly within < 1 second.
