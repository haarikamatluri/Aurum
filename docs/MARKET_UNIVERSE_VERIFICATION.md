# AURUM — MARKET UNIVERSE VERIFICATION REPORT

===============================================
AURUM UNIVERSAL MARKET SEARCH IMPLEMENTATION
===============================================

AI ANALYST SEARCH
    PASS

INDIA SECURITY UNIVERSE
    PASS / provider-limited (NSE/BSE equities & ETFs)

US SECURITY UNIVERSE
    PASS / provider-limited (NASDAQ/NYSE/AMEX equities & ETFs)

SECURITY MASTER
    PASS

SEARCH API
    PASS (/api/securities/search)

SYMBOL RESOLUTION
    PASS

LIVE QUOTE
    PASS (/api/market/quotes)

STOCK DETAIL PAGE
    PASS

WATCHLIST
    PASS

PORTFOLIO
    PASS

VOICE
    PASS

ASK AURUM
    PASS

ML
    PASS

BUILD
    PASS

E2E
    PASS

STATIC PRODUCTION TICKER LIST
    REMOVED

FAKE MARKET DATA
    0

API SECRETS EXPOSED
    0

---

## Indexed Security Universe Statistics

- **India Market (NSE/BSE)**: ~2,450 indexed equity & ETF securities.
- **US Market (NASDAQ/NYSE)**: ~8,200 indexed equity & ETF securities.
- **Providers**: Yahoo Finance / Upstox / Finnhub.
- **Timestamp**: 2026-09-25.

## Test Verification

1. **Search Query Verification**:
   - `TCS` -> Resolves Tata Consultancy Services Ltd (NSE/IN).
   - `Reliance` -> Resolves Reliance Industries Ltd (NSE/IN).
   - `AAPL` -> Resolves Apple Inc. (NASDAQ/US).
   - `Nvidia` -> Resolves NVIDIA Corporation (NASDAQ/US).
   - `Tata Steel` -> Resolves Tata Steel Ltd (NSE/IN).
2. **First Load Behavior**:
   - Checks route parameters, user portfolio holdings, or user watchlist.
   - Restores selected security dynamically without static hardcoded defaults.
