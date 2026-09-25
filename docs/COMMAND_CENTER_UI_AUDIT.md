# Command Center UI Audit

## Current State
- **Layout**: Modal overlay with dark theme (`#1A1A1A` background, `#D4AF37` accents).
- **Navigation**: Sidebar with tabs (Trading Engine, Strategy Automation, Broker Sync, Add Stock, Bulk Import).
- **Issues**: 
  - Dark theme clashes with Portfolio's light theme.
  - "Buy Stock" and "Sell Stock" are not immediately accessible (hidden inside Trading Engine).
  - Uses tabs which hides important statuses.
  - Lacks unified overview.

## Target State
- **Layout**: Full-screen or large centered workspace using light theme (white background, subtle borders, shadows from Portfolio tokens).
- **Structure**:
  - Quick Actions Bar (+ Buy Stock, - Sell Stock, Analyze, Watchlist, Ask Aurum)
  - Portfolio Snapshot
  - Trading Section
  - Strategy & Automation Section
  - Broker Connectivity
  - Data & Intelligence (ML / Watchlist / Ask Aurum)
  - Audit & Safety (Kill Switch, Risk Status, Logs)
- **Design Tokens**: Reuse variables from `src/styles.scss` or `dashboard.scss` (e.g., `--text-primary`, `--bg-primary`, `--border`, `--surface-hover`).

## Component Modifications required
1. `command-center-modal.ts` & `.scss` - Complete rewrite to use dashboard-like light layout.
2. `order-modal.ts` / Trading Engine - Convert to inline elements or slide-outs using light theme instead of dark modals.
3. Replace hardcoded mock values with backend API outputs.
4. Add actual integration for ML, Automation, Ask Aurum.
