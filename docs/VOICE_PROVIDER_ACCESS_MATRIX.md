# AURUM VOICE PROVIDER ACCESS MATRIX

## Provider Infrastructure & Capability Mapping

The Aurum Voice Operating System routes natural language requests to server-side provider adapters.

Credentials and API keys remain protected in the server environment variables.

---

| Provider Name | Supported Markets | Supported Capabilities | Authentication Status | Data Freshness |
| :--- | :--- | :--- | :--- | :--- |
| **Security Master Provider** | US, IN, Global | Security lookup, ticker resolution, exchange mapping, ISIN search | Active | Real-Time / Cached (5m) |
| **Yahoo Finance Market Provider** | US, IN, Global | Live quotes, 1D/1W/1M/1Y/Max charts, historical OHLCV, market movers | Active | Real-Time (1s - 15s) |
| **Finnhub Financial Provider** | US, Global | Institutional company news, US fundamentals, earnings calendars, SEC filings | Active (Key configured) | Real-Time / 15m |
| **Upstox Brokerage Provider** | IN (NSE / BSE) | Indian equities quotes, live portfolio sync, order placement | Active (Server OAuth) | Real-Time |
| **Gemini AI Synthesis Engine** | Global | Multi-source evidence synthesis, movement reasoning, stock reports | Active (Server Gemini API) | Dynamic Reasoning |
| **Aurum ML Ensemble v2** | US, IN | Machine learning price prediction, model agreement score, 60d backtest | Active (Internal Model) | Dynamic |
| **Deterministic Risk Engine** | US, IN | Portfolio stress test simulations, sector drawdown estimates | Active (Internal Engine) | Real-Time |

---

## Data Availability & Fallback Protocol

```
                        Request: "Give me everything about TCS"
                                       │
                      ┌────────────────┴────────────────┐
                      ▼                                 ▼
             SecurityMaster Lookup           Quote Provider (Yahoo/NSE)
                      │                                 │
                      ├─────────────────────────────────┤
                      ▼                                 ▼
          Fundamentals & Technicals               News & Filings Provider
                      │                                 │
                      └────────────────┬────────────────┘
                                       ▼
                       AI Synthesis & UI Synchronization
```

When an optional provider (such as filings for an obscure unlisted ticker) is unavailable:
1. Aurum gracefully reports data availability without failing the primary quote or analysis.
2. Voice feedback clearly communicates available sections while acknowledging omitted ones.
3. Zero dummy or synthetic values are hallucinated.
