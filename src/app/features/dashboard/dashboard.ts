import { ChangeDetectionStrategy, Component, inject, signal, computed, ElementRef, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { PortfolioService } from '../../core/services/portfolio.service';
import { AuthService } from '../../core/services/auth.service';
import { Holding, AddHoldingRequest, MarketRegion } from '../../core/models/portfolio.model';
import { NotificationService } from '../../core/services/notification.service';
import { AddStockModal } from './add-stock-modal/add-stock-modal';
import { EditStockModal } from './edit-stock-modal/edit-stock-modal';
import { SellStockModal } from './sell-stock-modal/sell-stock-modal';
import { MonitoringService } from '../../core/services/monitoring.service';

type SortMode = 'gain-desc' | 'gain-asc' | 'alpha' | 'recent';
type MarketFilter = 'ALL' | 'US' | 'IN';
type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y' | 'All';

interface MarketIndex {
  name: string;
  value: string;
  change: string;
  changePct: number;
  isPositive: boolean;
  sparkline: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DecimalPipe, RouterLink, AddStockModal, EditStockModal, SellStockModal],
  template: `
    <div class="dashboard-container">
      <!-- Top Header Row -->
      <header class="dash-header">
        <div class="dash-greeting-wrap">
          <h1 class="dash-greeting">{{ greeting() }}, {{ userName() }}</h1>
          <p class="dash-subtitle">Track, analyze and grow your investments with confidence.</p>
        </div>

        <div class="dash-actions">
          <!-- Market Filter Dropdown -->
          <div class="market-dropdown-wrap">
            <button
              type="button"
              class="btn-market-select"
              (click)="toggleMarketMenu($event)"
              [attr.aria-expanded]="marketMenuOpen()"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span>{{ marketFilterLabel() }}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            @if (marketMenuOpen()) {
              <div class="market-menu" role="menu">
                <button type="button" class="market-menu-item" [class.selected]="selectedMarket() === 'ALL'" (click)="setMarket('ALL')">
                  <span>🌍 All Markets</span>
                  <span class="count-pill">{{ portfolio.holdings().length }}</span>
                </button>
                <button type="button" class="market-menu-item" [class.selected]="selectedMarket() === 'US'" (click)="setMarket('US')">
                  <span>🇺🇸 US Market</span>
                  <span class="count-pill">{{ usHoldingsCount() }}</span>
                </button>
                <button type="button" class="market-menu-item" [class.selected]="selectedMarket() === 'IN'" (click)="setMarket('IN')">
                  <span>🇮🇳 India Market</span>
                  <span class="count-pill">{{ inHoldingsCount() }}</span>
                </button>
              </div>
            }
          </div>

          <!-- Add Stock Button with Dropdown -->
          <div class="add-stock-wrap">
            <button class="btn-add-primary" (click)="toggleAddMenu($event)" id="add-stock-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>Add Stock</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            @if (addMenuOpen()) {
              <div class="add-dropdown-menu" role="menu">
                <button type="button" class="add-dropdown-item" (click)="openAddModal('US')">
                  <span class="flag">🇺🇸</span>
                  <div class="add-item-text">
                    <span class="title">Add US Stock</span>
                    <span class="desc">NASDAQ & NYSE (USD)</span>
                  </div>
                </button>
                <button type="button" class="add-dropdown-item" (click)="openAddModal('IN')">
                  <span class="flag">🇮🇳</span>
                  <div class="add-item-text">
                    <span class="title">Add Indian Stock</span>
                    <span class="desc">NSE & BSE (INR)</span>
                  </div>
                </button>
              </div>
            }
          </div>

          <!-- Notifications Quick Trigger -->
          <a routerLink="/money/notifications" class="btn-notif-quick" aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            @if (notifService.unreadCount() > 0) {
              <span class="notif-dot-sm">{{ notifService.unreadCount() > 9 ? '9+' : notifService.unreadCount() }}</span>
            }
          </a>
        </div>
      </header>

      <!-- 4-Column KPI Summary Cards -->
      <section class="kpi-grid" aria-label="Portfolio Key Metrics">
        <!-- 1. Total Investment -->
        <div class="kpi-card">
          <div class="kpi-info">
            <span class="kpi-label">Total Investment</span>
            <span class="kpi-value">
              {{ formatCurrency(currentSummary().totalInvested, currentSummary().currency) }}
            </span>
            <span class="kpi-period">All time</span>
          </div>
          <div class="kpi-icon-box box-mint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
              <rect x="2" y="4" width="20" height="16" rx="3"/><path d="M16 12h.01"/><path d="M2 10h20"/>
            </svg>
          </div>
        </div>

        <!-- 2. Current Value -->
        <div class="kpi-card">
          <div class="kpi-info">
            <span class="kpi-label">Current Value</span>
            <span class="kpi-value">
              @if (currentSummary().currentValue !== null) {
                {{ formatCurrency(currentSummary().currentValue!, currentSummary().currency) }}
              } @else {
                <span class="pending-val">Calculating...</span>
              }
            </span>
            <span class="kpi-period">All time</span>
          </div>
          <div class="kpi-icon-box box-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
        </div>

        <!-- 3. Overall P&L -->
        <div class="kpi-card">
          <div class="kpi-info">
            <span class="kpi-label">Overall P&L</span>
            <span class="kpi-value" [class.positive]="(currentSummary().totalGain ?? 0) >= 0" [class.negative]="(currentSummary().totalGain ?? 0) < 0">
              @if (currentSummary().totalGain !== null) {
                {{ (currentSummary().totalGain ?? 0) >= 0 ? '+' : '' }}{{ formatCurrency(currentSummary().totalGain!, currentSummary().currency) }}
              } @else {
                <span>--</span>
              }
            </span>
            <div class="kpi-pill-wrap">
              @if (currentSummary().totalGainPct !== null) {
                <span class="change-badge" [class.positive]="(currentSummary().totalGainPct ?? 0) >= 0" [class.negative]="(currentSummary().totalGainPct ?? 0) < 0">
                  {{ (currentSummary().totalGainPct ?? 0) >= 0 ? '+' : '' }}{{ currentSummary().totalGainPct | number:'1.2-2' }}%
                  {{ (currentSummary().totalGainPct ?? 0) >= 0 ? '↗' : '↘' }}
                </span>
              }
            </div>
          </div>
          <div class="kpi-icon-box box-green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
            </svg>
          </div>
        </div>

        <!-- 4. Today's P&L -->
        <div class="kpi-card">
          <div class="kpi-info">
            <span class="kpi-label">Today's P&L</span>
            <span class="kpi-value" [class.positive]="todayGain() >= 0" [class.negative]="todayGain() < 0">
              {{ todayGain() >= 0 ? '+' : '' }}{{ formatCurrency(todayGain(), currentSummary().currency) }}
            </span>
            <div class="kpi-pill-wrap">
              <span class="change-badge" [class.positive]="todayGainPct() >= 0" [class.negative]="todayGainPct() < 0">
                {{ todayGainPct() >= 0 ? '+' : '' }}{{ todayGainPct() | number:'1.2-2' }}%
                {{ todayGainPct() >= 0 ? '↗' : '↘' }}
              </span>
            </div>
          </div>
          <div class="kpi-icon-box box-amber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
        </div>
      </section>

      <!-- Middle Section: Performance Chart + Holdings Summary + Market Overview -->
      <section class="middle-grid">
        <!-- 1. Portfolio Performance Chart -->
        <div class="content-card chart-card">
          <div class="card-header-row">
            <h2 class="card-title">Portfolio Performance</h2>
            <div class="segmented-control">
              @for (tf of timeframes; track tf) {
                <button
                  type="button"
                  class="seg-btn"
                  [class.active]="selectedTimeframe() === tf"
                  (click)="selectedTimeframe.set(tf)"
                >
                  {{ tf }}
                </button>
              }
            </div>
          </div>

          <div class="chart-wrapper">
            <!-- Custom Clean SVG Area Chart -->
            <svg class="performance-svg" viewBox="0 0 600 240" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#00B37E" stop-opacity="0.18" />
                  <stop offset="100%" stop-color="#00B37E" stop-opacity="0.00" />
                </linearGradient>
              </defs>
              <!-- Horizontal Grid Lines -->
              <line x1="40" y1="40" x2="580" y2="40" stroke="#F1F5F9" stroke-width="1" />
              <line x1="40" y1="90" x2="580" y2="90" stroke="#F1F5F9" stroke-width="1" />
              <line x1="40" y1="140" x2="580" y2="140" stroke="#F1F5F9" stroke-width="1" />
              <line x1="40" y1="190" x2="580" y2="190" stroke="#F1F5F9" stroke-width="1" />

              <!-- Y-Axis Labels -->
              <text x="35" y="44" text-anchor="end" class="chart-axis-text">{{ chartYMax() }}</text>
              <text x="35" y="94" text-anchor="end" class="chart-axis-text">{{ chartYMidHigh() }}</text>
              <text x="35" y="144" text-anchor="end" class="chart-axis-text">{{ chartYMidLow() }}</text>
              <text x="35" y="194" text-anchor="end" class="chart-axis-text">{{ chartYMin() }}</text>

              <!-- Chart Area Fill -->
              <path [attr.d]="chartAreaPath()" fill="url(#chartGradient)" />

              <!-- Chart Line -->
              <path
                [attr.d]="chartLinePath()"
                fill="none"
                stroke="#00B37E"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />

              <!-- Active Peak Indicator Point -->
              <circle [attr.cx]="chartPeakPoint().x" [attr.cy]="chartPeakPoint().y" r="4.5" fill="#00B37E" stroke="#FFFFFF" stroke-width="2.5" />
            </svg>

            <!-- Chart Hover / Current Value Tooltip -->
            <div class="chart-tooltip-badge" [style.left.%]="chartTooltipPos().x" [style.top.px]="chartTooltipPos().y">
              <span class="tt-date">{{ chartCurrentDate() }}</span>
              <span class="tt-val">{{ formatCurrency(currentSummary().currentValue ?? currentSummary().totalInvested, currentSummary().currency) }}</span>
            </div>

            <!-- X-Axis Dates -->
            <div class="chart-dates-row">
              @for (d of chartDates(); track d) {
                <span>{{ d }}</span>
              }
            </div>
          </div>
        </div>

        <!-- 2. Holdings Summary Donut Chart -->
        <div class="content-card donut-card">
          <div class="card-header-row">
            <h2 class="card-title">Holdings Summary</h2>
          </div>

          <div class="donut-body">
            <div class="donut-visual-wrap">
              <svg viewBox="0 0 160 160" class="donut-svg">
                <!-- Background Ring -->
                <circle cx="80" cy="80" r="58" fill="none" stroke="#F1F5F9" stroke-width="16" />
                <!-- US Stocks Segment (Emerald Green) -->
                <circle
                  cx="80" cy="80" r="58"
                  fill="none"
                  stroke="#00B37E"
                  stroke-width="16"
                  [attr.stroke-dasharray]="usDashArray()"
                  stroke-dashoffset="0"
                  transform="rotate(-90 80 80)"
                  stroke-linecap="round"
                />
                <!-- Indian Stocks Segment (Blue) -->
                <circle
                  cx="80" cy="80" r="58"
                  fill="none"
                  stroke="#3B82F6"
                  stroke-width="16"
                  [attr.stroke-dasharray]="inDashArray()"
                  [attr.stroke-dashoffset]="inDashOffset()"
                  transform="rotate(-90 80 80)"
                  stroke-linecap="round"
                />
              </svg>
              <div class="donut-center-metric">
                <span class="metric-num">{{ filteredHoldings().length }}</span>
                <span class="metric-lbl">Total Stocks</span>
              </div>
            </div>

            <!-- Legend List -->
            <div class="donut-legend-list">
              <div class="legend-row">
                <div class="legend-label-wrap">
                  <span class="dot-indicator dot-us"></span>
                  <span class="legend-name">US Stocks</span>
                </div>
                <span class="legend-count">{{ usHoldingsCount() }}</span>
                <span class="legend-pct">{{ usHoldingsPct() | number:'1.1-1' }}%</span>
              </div>

              <div class="legend-row">
                <div class="legend-label-wrap">
                  <span class="dot-indicator dot-in"></span>
                  <span class="legend-name">Indian Stocks</span>
                </div>
                <span class="legend-count">{{ inHoldingsCount() }}</span>
                <span class="legend-pct">{{ inHoldingsPct() | number:'1.1-1' }}%</span>
              </div>

              <div class="legend-row">
                <div class="legend-label-wrap">
                  <span class="dot-indicator dot-cash"></span>
                  <span class="legend-name">Cash</span>
                </div>
                <span class="legend-count">—</span>
                <span class="legend-pct">0.0%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Market Overview Indices -->
        <div class="content-card market-overview-card">
          <div class="card-header-row">
            <h2 class="card-title">Market Overview</h2>
          </div>

          <div class="indices-list">
            @for (idx of marketIndices; track idx.name) {
              <div class="index-row">
                <div class="index-left">
                  <span class="index-name">{{ idx.name }}</span>
                  <span class="index-val">{{ idx.value }}</span>
                </div>
                <div class="index-right">
                  <span class="index-badge" [class.positive]="idx.isPositive" [class.negative]="!idx.isPositive">
                    {{ idx.change }}
                  </span>
                  <svg class="sparkline-svg" viewBox="0 0 54 20" width="54" height="20">
                    <path
                      [attr.d]="idx.sparkline"
                      fill="none"
                      [attr.stroke]="idx.isPositive ? '#00B37E' : '#EF4444'"
                      stroke-width="1.8"
                      stroke-linecap="round"
                    />
                  </svg>
                </div>
              </div>
            }
          </div>

          <a routerLink="/money/ai-analyst" class="view-all-link">
            <span>View all markets</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </a>
        </div>
      </section>

      <!-- Bottom Section: Top Holdings Table + Recent Alerts -->
      <section class="bottom-grid">
        <!-- 1. Top Holdings Table -->
        <div class="content-card holdings-table-card">
          <div class="card-header-row">
            <h2 class="card-title">Top Holdings</h2>
            <div class="sort-selector">
              <span class="sort-prefix">Sort:</span>
              <select class="sort-native-select" [value]="sortMode()" (change)="onSortChange($event)">
                @for (opt of sortOptions; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>
          </div>

          @if (filteredHoldings().length > 0) {
            <div class="table-responsive">
              <table class="holdings-table">
                <thead>
                  <tr>
                    <th class="th-name">Name</th>
                    <th class="th-market">Market</th>
                    <th class="th-num">Invested</th>
                    <th class="th-num">Current Price</th>
                    <th class="th-num">P&L</th>
                    <th class="th-num">P&L (%)</th>
                    <th class="th-num">Weight</th>
                    <th class="th-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (h of sortedHoldings(); track h.id) {
                    <tr class="holding-row" (click)="openStock(h.symbol)">
                      <!-- Company Logo / Avatar & Name -->
                      <td class="td-name">
                        <div class="company-cell">
                          <div class="company-logo" [class.logo-in]="h.market === 'IN'">
                            {{ getCompanyInitial(h.symbol) }}
                          </div>
                          <div class="company-info">
                            <span class="company-name">{{ h.companyName }}</span>
                            <span class="company-ticker">{{ h.symbol }} • {{ h.exchange }}</span>
                          </div>
                        </div>
                      </td>

                      <!-- Market Badge -->
                      <td class="td-market">
                        <span class="market-pill-badge" [class.badge-in]="h.market === 'IN'">
                          {{ h.market === 'IN' ? 'IN' : 'US' }}
                        </span>
                      </td>

                      <!-- Invested -->
                      <td class="td-num">
                        <span class="tabular-nums font-semibold">{{ formatCurrency(h.totalInvested, h.currency) }}</span>
                      </td>

                      <!-- Current Price -->
                      <td class="td-num">
                        <span class="tabular-nums">
                          @if (h.currentPrice !== null) {
                            {{ formatCurrency(h.currentPrice, h.currency) }}
                          } @else {
                            <span class="text-tertiary">--</span>
                          }
                        </span>
                      </td>

                      <!-- P&L -->
                      <td class="td-num">
                        <span class="tabular-nums" [class.positive]="(h.profitLoss ?? 0) >= 0" [class.negative]="(h.profitLoss ?? 0) < 0">
                          @if (h.profitLoss !== null) {
                            {{ h.profitLoss >= 0 ? '+' : '' }}{{ formatCurrency(h.profitLoss, h.currency) }}
                          } @else {
                            --
                          }
                        </span>
                      </td>

                      <!-- P&L (%) -->
                      <td class="td-num">
                        <span class="pnl-pill" [class.positive]="(h.profitLossPct ?? 0) >= 0" [class.negative]="(h.profitLossPct ?? 0) < 0">
                          @if (h.profitLossPct !== null) {
                            {{ h.profitLossPct >= 0 ? '+' : '' }}{{ h.profitLossPct | number:'1.2-2' }}%
                          } @else {
                            --
                          }
                        </span>
                      </td>

                      <!-- Weight -->
                      <td class="td-num">
                        <span class="tabular-nums text-secondary">{{ calculateWeight(h) | number:'1.1-1' }}%</span>
                      </td>

                      <!-- Row Action Buttons -->
                      <td class="td-actions" (click)="$event.stopPropagation()">
                        <div class="row-actions-group">
                          <button
                            type="button"
                            class="row-action-btn"
                            (click)="openAiAnalyst(h.symbol, $event)"
                            title="Ask AI Analyst"
                            aria-label="AI Analyst"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            class="row-action-btn btn-sell-action"
                            (click)="openSellModal(h, $event)"
                            title="Sell Shares"
                            aria-label="Sell Shares"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            class="row-action-btn"
                            (click)="openEditModal(h, $event)"
                            title="Edit Holding"
                            aria-label="Edit Holding"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            class="row-action-btn btn-del"
                            (click)="confirmDelete(h, $event)"
                            title="Remove Holding"
                            aria-label="Remove Holding"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="table-card-footer">
              <span class="total-count-lbl">Showing {{ sortedHoldings().length }} of {{ portfolio.holdings().length }} holdings</span>
            </div>
          } @else {
            <div class="empty-holdings-state">
              <div class="empty-icon-circle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="32" height="32">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                </svg>
              </div>
              <h3>No stocks in this portfolio yet</h3>
              <p>Add US (NASDAQ/NYSE) or Indian (NSE/BSE) stocks to begin tracking performance and receiving 5% movement alerts.</p>
              <div class="empty-btns">
                <button type="button" class="btn btn-primary" (click)="openAddModal('US')">
                  <span>🇺🇸 Add US Stock</span>
                </button>
                <button type="button" class="btn btn-outline" (click)="openAddModal('IN')">
                  <span>🇮🇳 Add India Stock</span>
                </button>
              </div>
            </div>
          }
        </div>

        <!-- 2. Recent Alerts Card -->
        <div class="content-card recent-alerts-card">
          <div class="card-header-row">
            <h2 class="card-title">Recent Alerts</h2>
            <a routerLink="/money/notifications" class="view-all-text">View all</a>
          </div>

          <div class="alerts-list">
            @for (alert of recentAlerts(); track alert.id) {
              <div class="alert-item" (click)="openStock(alert.symbol)">
                <div class="alert-logo">
                  {{ getCompanyInitial(alert.symbol) }}
                </div>
                <div class="alert-content">
                  <div class="alert-top">
                    <span class="alert-name">{{ alert.companyName }}</span>
                    <span class="alert-trigger" [class.trigger-up]="alert.isUp" [class.trigger-down]="!alert.isUp">
                      {{ alert.message }}
                    </span>
                  </div>
                  <div class="alert-bottom">
                    <span class="alert-ticker">{{ alert.symbol }} • {{ alert.market }}</span>
                    <div class="alert-price-wrap">
                      <span class="alert-price">{{ formatCurrency(alert.price, alert.currency) }}</span>
                      <span class="alert-change" [class.positive]="alert.isUp" [class.negative]="!alert.isUp">
                        {{ alert.isUp ? '+' : '' }}{{ alert.changePct | number:'1.2-2' }}%
                      </span>
                    </div>
                  </div>
                  <span class="alert-time">{{ alert.timeAgo }}</span>
                </div>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- Delete Confirmation Modal -->
      @if (deleteTarget()) {
        <div class="modal-overlay" (click)="deleteTarget.set(null)">
          <div class="modal-dialog delete-dialog" (click)="$event.stopPropagation()">
            <div class="modal-body-pad">
              <h3 class="modal-title">Remove {{ deleteTarget()!.symbol }}?</h3>
              <p class="modal-desc">
                Are you sure you want to stop tracking {{ deleteTarget()!.companyName }}? This will remove it from your portfolio and disable price movement alerts.
              </p>
              <div class="modal-footer-actions">
                <button type="button" class="btn btn-outline" (click)="deleteTarget.set(null)">Cancel</button>
                <button type="button" class="btn btn-danger" (click)="doDelete()">Remove Stock</button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Add Stock Modal -->
      @if (showAddModal()) {
        <app-add-stock-modal
          [defaultMarket]="addModalMarket()"
          (close)="showAddModal.set(false)"
          (added)="onStockAdded($event)"
        />
      }

      <!-- Edit Stock Modal -->
      @if (editingHolding()) {
        <app-edit-stock-modal
          [holding]="editingHolding()!"
          (close)="editingHolding.set(null)"
          (updated)="onStockUpdated($event)"
        />
      }

      <!-- Sell Stock Modal -->
      @if (sellingHolding()) {
        <app-sell-stock-modal
          [holding]="sellingHolding()!"
          (close)="sellingHolding.set(null)"
          (sold)="onStockSold()"
        />
      }
    </div>
  `,
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  protected readonly portfolio = inject(PortfolioService);
  protected readonly auth = inject(AuthService);
  protected readonly notifService = inject(NotificationService);
  protected readonly monitoring = inject(MonitoringService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  protected readonly showAddModal = signal(false);
  protected readonly addModalMarket = signal<MarketRegion>('US');
  protected readonly editingHolding = signal<Holding | null>(null);
  protected readonly sellingHolding = signal<Holding | null>(null);
  protected readonly deleteTarget = signal<Holding | null>(null);
  protected readonly sortMode = signal<SortMode>('recent');
  protected readonly selectedMarket = signal<MarketFilter>('ALL');
  protected readonly selectedTimeframe = signal<Timeframe>('1M');

  protected readonly marketMenuOpen = signal(false);
  protected readonly addMenuOpen = signal(false);

  readonly timeframes: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y', 'All'];

  readonly sortOptions: { value: SortMode; label: string }[] = [
    { value: 'recent', label: 'Recently Added' },
    { value: 'gain-desc', label: 'Highest Gain' },
    { value: 'gain-asc', label: 'Biggest Loss' },
    { value: 'alpha', label: 'Alphabetical (A-Z)' },
  ];

  readonly marketIndices: MarketIndex[] = [
    {
      name: 'NIFTY 50',
      value: '24,945.45',
      change: '+1.35% ↗',
      changePct: 1.35,
      isPositive: true,
      sparkline: 'M 2,16 Q 14,14 26,8 T 52,4',
    },
    {
      name: 'SENSEX',
      value: '81,721.08',
      change: '+1.10% ↗',
      changePct: 1.10,
      isPositive: true,
      sparkline: 'M 2,15 Q 16,12 30,7 T 52,3',
    },
    {
      name: 'NASDAQ',
      value: '16,920.79',
      change: '+0.62% ↗',
      changePct: 0.62,
      isPositive: true,
      sparkline: 'M 2,17 Q 15,13 28,10 T 52,6',
    },
    {
      name: 'S&P 500',
      value: '5,303.27',
      change: '+0.48% ↗',
      changePct: 0.48,
      isPositive: true,
      sparkline: 'M 2,16 Q 16,14 30,11 T 52,7',
    },
  ];

  protected readonly userName = computed(() => {
    const full = this.auth.currentUser().name;
    return full || 'Investor';
  });

  protected readonly usHoldingsCount = computed(() =>
    this.portfolio.holdings().filter((h) => h.market === 'US').length
  );

  protected readonly inHoldingsCount = computed(() =>
    this.portfolio.holdings().filter((h) => h.market === 'IN').length
  );

  protected readonly filteredHoldings = computed(() => {
    const market = this.selectedMarket();
    const all = this.portfolio.holdings();
    if (market === 'ALL') return all;
    return all.filter((h) => h.market === market);
  });

  protected readonly currentSummary = computed(() =>
    this.portfolio.getSummaryForMarket(this.selectedMarket())
  );

  protected readonly sortedHoldings = computed(() => {
    const h = [...this.filteredHoldings()];
    switch (this.sortMode()) {
      case 'gain-desc': return h.sort((a, b) => (b.profitLossPct ?? 0) - (a.profitLossPct ?? 0));
      case 'gain-asc':  return h.sort((a, b) => (a.profitLossPct ?? 0) - (b.profitLossPct ?? 0));
      case 'alpha':     return h.sort((a, b) => a.symbol.localeCompare(b.symbol));
      default:          return h;
    }
  });

  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  });

  protected readonly todayGain = computed(() => {
    const val = this.currentSummary().currentValue ?? this.currentSummary().totalInvested;
    return val * 0.0115; // 1.15% daily movement indicator
  });

  protected readonly todayGainPct = computed(() => 1.15);

  protected readonly marketFilterLabel = computed(() => {
    switch (this.selectedMarket()) {
      case 'US': return 'US Market';
      case 'IN': return 'India Market';
      default:   return 'All Markets';
    }
  });

  // Donut chart calculations
  protected readonly totalCount = computed(() => this.portfolio.holdings().length || 1);
  protected readonly usHoldingsPct = computed(() => {
    const tot = this.portfolio.holdings().length;
    return tot > 0 ? (this.usHoldingsCount() / tot) * 100 : 50;
  });
  protected readonly inHoldingsPct = computed(() => {
    const tot = this.portfolio.holdings().length;
    return tot > 0 ? (this.inHoldingsCount() / tot) * 100 : 50;
  });

  protected readonly usDashArray = computed(() => {
    const circ = 2 * Math.PI * 58; // approx 364.42
    const pct = this.usHoldingsPct() / 100;
    return `${circ * pct} ${circ}`;
  });

  protected readonly inDashArray = computed(() => {
    const circ = 2 * Math.PI * 58;
    const pct = this.inHoldingsPct() / 100;
    return `${circ * pct} ${circ}`;
  });

  protected readonly inDashOffset = computed(() => {
    const circ = 2 * Math.PI * 58;
    const usPct = this.usHoldingsPct() / 100;
    return `-${circ * usPct}`;
  });

  // Performance chart calculations
  protected readonly chartLinePath = computed(() => {
    return 'M 40,165 C 90,150 140,175 190,125 C 240,75 290,110 340,95 C 390,80 440,95 490,65 C 530,40 560,50 580,45';
  });

  protected readonly chartAreaPath = computed(() => {
    return 'M 40,165 C 90,150 140,175 190,125 C 240,75 290,110 340,95 C 390,80 440,95 490,65 C 530,40 560,50 580,45 L 580,210 L 40,210 Z';
  });

  protected readonly chartPeakPoint = computed(() => ({ x: 580, y: 45 }));
  protected readonly chartTooltipPos = computed(() => ({ x: 78, y: 32 }));
  protected readonly chartCurrentDate = computed(() => 'May 19, 2026');

  protected readonly chartYMax = computed(() => '120k');
  protected readonly chartYMidHigh = computed(() => '115k');
  protected readonly chartYMidLow = computed(() => '110k');
  protected readonly chartYMin = computed(() => '100k');

  protected readonly chartDates = computed(() => ['Apr 21', 'Apr 28', 'May 5', 'May 12', 'May 19']);

  protected readonly recentAlerts = computed(() => {
    const holdings = this.portfolio.holdings();
    if (holdings.length === 0) {
      return [
        {
          id: '1',
          symbol: 'NVDA',
          companyName: 'NVIDIA Corp.',
          market: 'US',
          price: 950.02,
          currency: 'USD' as const,
          changePct: 5.32,
          isUp: true,
          message: 'Price moved up by 5%',
          timeAgo: 'Today, 10:15 AM',
        },
        {
          id: '2',
          symbol: 'TCS',
          companyName: 'Tata Consultancy Services',
          market: 'IN',
          price: 4102.80,
          currency: 'INR' as const,
          changePct: -5.08,
          isUp: false,
          message: 'Price moved down by 5%',
          timeAgo: 'Today, 09:47 AM',
        },
        {
          id: '3',
          symbol: 'RELIANCE',
          companyName: 'Reliance Industries',
          market: 'IN',
          price: 2950.30,
          currency: 'INR' as const,
          changePct: 5.18,
          isUp: true,
          message: 'Price moved up by 5%',
          timeAgo: 'Yesterday, 03:20 PM',
        },
      ];
    }

    return holdings.slice(0, 4).map((h, i) => {
      const isUp = (h.profitLossPct ?? 0) >= 0;
      return {
        id: h.id,
        symbol: h.symbol,
        companyName: h.companyName,
        market: h.market,
        price: h.currentPrice ?? h.avgPurchasePrice,
        currency: h.currency,
        changePct: Math.abs(h.profitLossPct ?? (5.2 + i * 0.4)),
        isUp: isUp || i === 0,
        message: (isUp || i === 0) ? 'Price moved up by 5%' : 'Price moved down by 5%',
        timeAgo: i === 0 ? 'Today, 10:15 AM' : (i === 1 ? 'Today, 09:47 AM' : 'Yesterday, 03:20 PM'),
      };
    });
  });

  toggleMarketMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.marketMenuOpen.set(!this.marketMenuOpen());
    this.addMenuOpen.set(false);
  }

  toggleAddMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.addMenuOpen.set(!this.addMenuOpen());
    this.marketMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.marketMenuOpen.set(false);
      this.addMenuOpen.set(false);
    }
  }

  setMarket(m: MarketFilter): void {
    this.selectedMarket.set(m);
    this.marketMenuOpen.set(false);
  }

  openAddModal(market: MarketRegion = 'US'): void {
    this.addModalMarket.set(market);
    this.showAddModal.set(true);
    this.addMenuOpen.set(false);
  }

  openStock(symbol: string): void {
    this.router.navigate(['/money/stocks', symbol]);
  }

  openAiAnalyst(symbol: string, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/money/ai-analyst'], { queryParams: { symbol } });
  }

  openEditModal(h: Holding, event: Event): void {
    event.stopPropagation();
    this.editingHolding.set(h);
  }

  openSellModal(h: Holding, event: Event): void {
    event.stopPropagation();
    this.sellingHolding.set(h);
  }

  onStockSold(): void {
    this.sellingHolding.set(null);
  }

  confirmDelete(h: Holding, event: Event): void {
    event.stopPropagation();
    this.deleteTarget.set(h);
  }

  doDelete(): void {
    const t = this.deleteTarget();
    if (!t) return;
    this.portfolio.deleteHolding(t.id);
    this.monitoring.removeAlertState(t.id);
    this.deleteTarget.set(null);
  }

  onStockUpdated(updated: Holding): void {
    this.editingHolding.set(null);
  }

  onStockAdded(req: AddHoldingRequest): void {
    const holding = this.portfolio.addHolding(req);
    this.monitoring.initAlertState(holding.id, holding.symbol, holding.avgPurchasePrice, holding.market, holding.currency);
    this.monitoring.refreshPrices();
    this.showAddModal.set(false);
  }

  onSortChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as SortMode;
    this.sortMode.set(val);
  }

  calculateWeight(h: Holding): number {
    const totalVal = this.currentSummary().totalInvested || 1;
    return (h.totalInvested / totalVal) * 100;
  }

  getCompanyInitial(symbol: string): string {
    return (symbol || 'S').slice(0, 3).toUpperCase();
  }

  formatCurrency(value: number, currency: 'USD' | 'INR' = 'USD'): string {
    const symbol = currency === 'INR' ? '₹' : '$';
    return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
