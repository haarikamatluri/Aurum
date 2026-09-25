# AURUM — AI ANALYST UNIVERSAL SECURITY SEARCH

## Architecture Overview

The Aurum AI Analyst feature integrates a universal, cross-market Security Master and live search system for US and Indian financial instruments.

```
┌─────────────────────────────────────────────────────────┐
│                    AI Analyst UI                        │
│         (Search Input, Sidebar, Stock Dossier)          │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                 PortfolioService / UI                   │
│              searchStocksRemote(query, mkt)             │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│            Backend Security Search APIs                 │
│              /api/securities/search                     │
│              /api/market/search                         │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│             Security Master & Market Data               │
│          (Yahoo Finance, Upstox, Finnhub, NSE/BSE)       │
└─────────────────────────────────────────────────────────┘
```

## Security Master Normalization Model

All securities resolve through a unified schema:

```typescript
interface Security {
  symbol: string;
  canonicalSymbol: string;
  companyName: string;
  exchange: 'NSE' | 'BSE' | 'NASDAQ' | 'NYSE' | 'AMEX' | string;
  market: 'IN' | 'US';
  currency: 'INR' | 'USD';
  status: 'ACTIVE' | 'INACTIVE';
  quoteSupported: boolean;
  fundamentalsSupported: boolean;
}
```

## Coverage & Entitlements

- **India Market (IN)**:
  - Exchanges: NSE, BSE
  - Equity & ETF coverage via provider integration (`YahooFinance` / `Upstox`).
  - Canonical resolution strips `.NS` / `.BO` suffixes while retaining exchange metadata.
- **US Market (US)**:
  - Exchanges: NASDAQ, NYSE, NYSE American.
  - Equities, ADRs, ETFs via provider integration (`YahooFinance` / `Finnhub`).

## APIs Provided

1. `GET /api/securities/search?q={query}&market={IN|US}`
   - Performs live debounced symbol and company name lookup.
   - Returns normalized array of matching securities.
2. `GET /api/securities/coverage`
   - Returns system health and indexed security counts for India and US markets.
