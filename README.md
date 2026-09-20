# Portfolio Intelligence — Personal Investment OS

A frontend-only Angular implementation of a personal investment intelligence
platform: portfolio monitoring, risk analysis, predictive/model signals,
scenario simulation, and a conversational AI market analyst.

> **This build renders simulated data.** Every screen carries a visible
> "Demo data" indicator. No real brokerage, market data, or account
> information is used or transmitted anywhere.

## Stack

Angular 22 (standalone components, signals, zoneless change detection) ·
TypeScript · RxJS · SCSS design tokens · [lightweight-charts](https://tradingview.github.io/lightweight-charts/)
for the financial charts · a small hand-built stroke-icon set (no icon
package dependency).

## Getting started

```bash
npm install
npm start        # ng serve, http://localhost:4200
npm run build     # production build → dist/portfolio-intelligence/browser
```

Sign-in is mocked — any email/password on `/login` works.

## Architecture

```
src/app/
├── core/
│   ├── models/      Domain types shared across the app (Portfolio, Market,
│   │                 Stock, Risk, Prediction, Scenario, Alert, AI, News, User)
│   ├── services/     One service per domain, each returning Observables.
│   │                 This is the seam where real HTTP calls replace mocks.
│   ├── mock/         Mock-only: seeded RNG, the security universe, and
│   │                 MarketEngine (an in-memory "live market" simulator).
│   └── guards/       Route auth guard.
├── shared/
│   ├── ui/           Reusable presentational components (kpi-card, charts,
│   │                 tables, badges, modal, tabs, skeleton, ai-chat, ...).
│   ├── pipes/        signedPercent, signedCurrency, compactNumber, relativeTime.
│   ├── directives/   Tooltip directive for unfamiliar financial terms.
│   └── utils/        Chart color palette, technical-indicator math, date grouping.
├── layout/           App shell: sidebar, topbar, mobile bottom nav, AI panel.
└── features/         One folder per route (dashboard, portfolio, transactions,
                       markets, watchlist, stocks/:symbol, risk, predictions,
                       scenarios, alerts, research, ai-analyst, settings, login).
```

### Design tokens

All color/spacing/radius/shadow values are CSS custom properties defined in
`src/styles/_tokens.scss`, with a light-theme override block under
`:root[data-theme="light"]`. `ThemeService` resolves the user's Dark/Light/System
preference and stamps `data-theme` on `<html>`; Settings → Appearance drives it.

### Mock data layer

`core/mock/market-engine.ts` is the single in-memory source of truth for every
quote and index. It ticks on an interval so prices, indices, and the topbar
ticker feel alive without a backend. Every `core/services/*.ts` service wraps
this (plus small per-domain mock modules) behind `Observable`-returning
methods that mirror the real REST contracts documented below — so swapping
the implementation for `HttpClient` calls later does not require touching any
component.

## Connecting the real backend

Each service in `core/services/` is designed to become a thin `HttpClient`
wrapper. The intended contracts (per the original product spec):

```
GET  /api/portfolio/summary
GET  /api/portfolio/positions
GET  /api/portfolio/performance
GET  /api/portfolio/allocation
GET  /api/market/indices
GET  /api/market/quote/{symbol}
GET  /api/market/sectors
GET  /api/stocks/{symbol}
GET  /api/stocks/{symbol}/technical
GET  /api/stocks/{symbol}/fundamentals
GET  /api/stocks/{symbol}/news
GET  /api/risk/portfolio
GET  /api/predictions/{symbol}
POST /api/scenarios
POST /api/ai/chat
GET  /api/ai/conversations
GET  /api/alerts
POST /api/alerts
```

To integrate: replace the body of each service method with an `HttpClient`
call returning the same shape declared in `core/models/`, delete the
corresponding `core/mock/*` usage, and leave the public method signatures —
and therefore every component that consumes them — untouched.

`AiAnalystService.sendMessage()` is the one to point at the future LLM
orchestrator (`POST /api/ai/chat`); it already returns the rich
`ChatMessage` shape (facts / calculations / model signals / stock cards /
portfolio impact / sources / suggested follow-ups) the orchestrator is
expected to produce.

## Not implemented (by design)

Real brokerage connections, automated trading, real money transfers, actual
buy/sell execution, production ML inference, and live market-data
subscriptions are all out of scope for this frontend milestone — every
number on screen is simulated.
