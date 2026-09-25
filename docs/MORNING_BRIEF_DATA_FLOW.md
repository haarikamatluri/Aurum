# AURUM — MORNING BELL BRIEFING DATA FLOW & ARCHITECTURE

```text
                                EXTERNAL PROVIDERS
                (NSE/BSE Gateway • Refinitiv • Finnhub • Google Search)
                                         │
                                         ▼
                                PROVIDER ADAPTERS
       (market-data-provider.js • news-provider.js • earnings-provider.js)
                                         │
                                         ▼
                                DATA NORMALIZATION
               (Indices • Quotes • FX Rates • News • Earnings)
                                         │
                                         ▼
                               MORNING BRIEF ENGINE
                       (morning-briefing-engine.js)
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
         USER PORTFOLIO STORE                           USER WATCHLIST STORE
    (Mongo DB / Memory Store)                        (Mongo DB / Memory Store)
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                               AI / RESEARCH ANALYSIS
                             (Gemini Backend Caller)
                                         │
                                         ▼
                                 MORNING BRIEF API
                            (GET /api/analyst/morning-brief)
                                         │
                                         ▼
                                  ANGULAR SERVICE
                               (ai-analyst.service.ts)
                                         │
                                         ▼
                                  MORNING BRIEF UI
                            (ai-analyst.html & .ts)
```

## Section-by-Section Data Pipeline

1. **Overnight Global Markets (01)**
   - **Provider**: `market-data-provider.js` (`getMarketIndices`)
   - **Fields**: S&P 500, Nasdaq, Nikkei 225, Brent Crude, Gold, US 10Y Yield, USD/INR.
   - **UI Component**: Rendered in `.market-pill` grid with native currency badges.

2. **Indian Market Setup (02)**
   - **Provider**: `market-data-provider.js` (`getMarketIndices`)
   - **Fields**: NIFTY 50, SENSEX, BANK NIFTY.
   - **UI Component**: Rendered in `.market-pill` grid with INR `₹` currency badges.

3. **Portfolio Impact & Holdings Movement (03)**
   - **Provider**: `analyst-router.js` -> `getMemoryStore(userId)` / Mongo holdings collection.
   - **Calculation**: Iterates active holdings, fetches live quote per holding, converts FX if USD holding, computes total value, daily P&L, daily P&L %, top gainers, and top losers.
   - **UI Component**: Rendered in `.highlight-card` with real position count, P&L, and total value.

4. **Watchlist Movers (04)**
   - **Provider**: `analyst-router.js` -> `getUserWatchlist(userId)` / Mongo watchlists collection.
   - **Calculation**: Fetches live quotes, sorts by absolute daily change %, outputs top movers.

5. **Corporate Earnings & Events (05)**
   - **Provider**: `earnings-provider.js` (`getEarningsCalendar`).
   - **Calculation**: Retrieves upcoming earnings for user holdings & broader market.

6. **Macro Risks to Watch (06)**
   - **Provider**: `macro-provider.js` & yield/commodity signals.
   - **Output**: Real-time risk items for US 10Y Yields and Brent Crude.

7. **Today's Executive Action Focus (07)**
   - **Provider**: Gemini AI Synthesis / Factual setup rules.
   - **Output**: 3 strategic focus points.

8. **Overnight Verified News Catalysts (08)**
   - **Provider**: `news-provider.js` (Google Search Grounding / Financial Newswire).
   - **Output**: Real news articles with source, symbol tag, and clickable links.
