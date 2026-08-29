import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { PortfolioService } from '../../core/services/portfolio.service';
import { AuthService } from '../../core/services/auth.service';
import { Holding, AddHoldingRequest, MarketRegion } from '../../core/models/portfolio.model';
import { AddStockModal } from './add-stock-modal/add-stock-modal';
import { EditStockModal } from './edit-stock-modal/edit-stock-modal';
import { MonitoringService } from '../../core/services/monitoring.service';

type SortMode = 'gain-desc' | 'gain-asc' | 'alpha' | 'recent';
type MarketFilter = 'ALL' | 'US' | 'IN';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DecimalPipe, AddStockModal, EditStockModal],
  template: `
    <div class="dashboard">
      <!-- Page header -->
      <div class="page-header">
        <div>
          <h1 class="greeting">{{ greeting() }}, {{ auth.currentUser().name.split(' ')[0] }}</h1>
          <p class="subline">Monitor your global investments across US & Indian markets.</p>
        </div>
        <div class="header-actions">
          <button class="btn-add" (click)="openAddModal('US')" id="add-us-stock-btn">
            <span class="flag">🇺🇸</span>
            <span>+ Add US Stock</span>
          </button>
          <button class="btn-add btn-add-india" (click)="openAddModal('IN')" id="add-india-stock-btn">
            <span class="flag">🇮🇳</span>
            <span>+ Add India Stock</span>
          </button>
        </div>
      </div>

      <!-- Market Filter Tabs -->
      <div class="market-filter-bar">
        <div class="market-pills">
          <button
            class="market-pill"
            [class.active]="selectedMarket() === 'ALL'"
            (click)="selectedMarket.set('ALL')"
          >
            <span>All Stocks</span>
            <span class="pill-count">{{ portfolio.holdings().length }}</span>
          </button>
          <button
            class="market-pill"
            [class.active]="selectedMarket() === 'US'"
            (click)="selectedMarket.set('US')"
          >
            <span class="flag">🇺🇸</span>
            <span>US Market</span>
            <span class="pill-count">{{ usHoldingsCount() }}</span>
          </button>
          <button
            class="market-pill"
            [class.active]="selectedMarket() === 'IN'"
            (click)="selectedMarket.set('IN')"
          >
            <span class="flag">🇮🇳</span>
            <span>India Market</span>
            <span class="pill-count">{{ inHoldingsCount() }}</span>
          </button>
        </div>
      </div>

      @if (filteredHoldings().length > 0) {
        <!-- Portfolio summary metrics -->
        <div class="summary-row">
          <div class="summary-card">
            <span class="summary-label">TOTAL INVESTED</span>
            <span class="summary-value">
              {{ formatCurrency(currentSummary().totalInvested, currentSummary().currency) }}
            </span>
          </div>
          <div class="summary-card">
            <span class="summary-label">CURRENT VALUE</span>
            <span class="summary-value">
              @if (currentSummary().currentValue !== null) {
                {{ formatCurrency(currentSummary().currentValue!, currentSummary().currency) }}
              } @else {
                <span class="pending">Awaiting prices</span>
              }
            </span>
          </div>
          <div class="summary-card">
            <span class="summary-label">TOTAL GAIN</span>
            <span class="summary-value"
              [class.positive]="(currentSummary().totalGain ?? 0) > 0"
              [class.negative]="(currentSummary().totalGain ?? 0) < 0">
              @if (currentSummary().totalGain !== null) {
                {{ formatCurrency(currentSummary().totalGain!, currentSummary().currency) }}
                <small>{{ currentSummary().totalGainPct! | number:'1.2-2' }}%</small>
              } @else {
                <span class="pending">--</span>
              }
            </span>
          </div>
          <div class="summary-card summary-card-muted">
            <span class="summary-label">HOLDINGS</span>
            <span class="summary-value">{{ filteredHoldings().length }}</span>
          </div>
        </div>

        <!-- Sort bar -->
        <div class="sort-bar">
          <span class="sort-label">Sort by</span>
          <div class="sort-pills">
            @for (opt of sortOptions; track opt.value) {
              <button class="sort-pill" [class.active]="sortMode() === opt.value" (click)="sortMode.set(opt.value)">
                {{ opt.label }}
              </button>
            }
          </div>
        </div>

        <!-- Stock cards grid -->
        <div class="stocks-grid">
          @for (h of sortedHoldings(); track h.id) {
            <div class="stock-card" (click)="openStock(h.symbol)">
              <!-- Card header -->
              <div class="card-header">
                <div class="card-symbol-block">
                  <div class="symbol-row">
                    <span class="card-symbol">{{ h.symbol }}</span>
                    <span class="market-tag" [class.india]="h.market === 'IN'">
                      {{ h.market === 'IN' ? '🇮🇳 ' + h.exchange : '🇺🇸 ' + h.exchange }}
                    </span>
                  </div>
                  <span class="card-company">{{ h.companyName }}</span>
                </div>
                <div class="card-price-block">
                  @if (h.currentPrice !== null) {
                    <span class="card-price">{{ formatCurrency(h.currentPrice, h.currency) }}</span>
                    <span class="card-change"
                      [class.positive]="(h.profitLossPct ?? 0) >= 0"
                      [class.negative]="(h.profitLossPct ?? 0) < 0">
                      {{ (h.profitLossPct ?? 0) >= 0 ? '+' : '' }}{{ h.profitLossPct | number:'1.2-2' }}%
                    </span>
                  } @else {
                    <span class="card-price pending">--</span>
                    <span class="card-change-pending">Awaiting API</span>
                  }
                </div>
              </div>

              <!-- Card stats -->
              <div class="card-stats">
                <div class="stat">
                  <span class="stat-label">Shares</span>
                  <span class="stat-value">{{ h.shares | number:'1.0-4' }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Avg Cost</span>
                  <span class="stat-value">{{ formatCurrency(h.avgPurchasePrice, h.currency) }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Invested</span>
                  <span class="stat-value">{{ formatCurrency(h.totalInvested, h.currency) }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Value</span>
                  <span class="stat-value">
                    @if (h.currentValue !== null) { {{ formatCurrency(h.currentValue, h.currency) }} }
                    @else { -- }
                  </span>
                </div>
              </div>

              <!-- Gain/loss bar -->
              <div class="card-pnl"
                [class.positive]="(h.profitLoss ?? 0) >= 0"
                [class.negative]="(h.profitLoss ?? 0) < 0"
                [class.pending]="h.profitLoss === null">
                @if (h.profitLoss !== null) {
                  <span>
                    {{ h.profitLoss >= 0 ? '+' : '' }}{{ formatCurrency(h.profitLoss, h.currency) }}
                  </span>
                  <span class="pnl-pct">
                    {{ h.profitLossPct! >= 0 ? '+' : '' }}{{ h.profitLossPct | number:'1.2-2' }}%
                  </span>
                } @else {
                  <span>Connect market data API for live ticks</span>
                }
              </div>

              <!-- Footer actions -->
              <div class="card-footer" (click)="$event.stopPropagation()">
                <button class="btn-ai" (click)="openAiAnalyst(h.symbol, $event)" id="ask-ai-{{ h.symbol }}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                  </svg>
                  Ask AI Analyst
                </button>
                <div class="card-actions-right">
                  <button class="btn-edit" (click)="openEditModal(h, $event)" [attr.aria-label]="'Edit ' + h.symbol" title="Edit holding">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button class="btn-delete" (click)="confirmDelete(h, $event)" [attr.aria-label]="'Remove ' + h.symbol" title="Remove holding">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      } @else {
        <!-- Empty state -->
        <div class="empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="48" height="48">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <h2>
            @if (selectedMarket() === 'IN') {
              No Indian stocks added yet
            } @else if (selectedMarket() === 'US') {
              No US stocks added yet
            } @else {
              Start monitoring your global investments
            }
          </h2>
          <p>Add stocks from the US (NASDAQ/NYSE) or India (NSE/BSE) to track price movements and get 5% alerts.</p>
          <div class="empty-actions">
            <button class="btn-add" (click)="openAddModal('US')">
              <span class="flag">🇺🇸</span> Add US Stock
            </button>
            <button class="btn-add btn-add-india" (click)="openAddModal('IN')">
              <span class="flag">🇮🇳</span> Add India Stock
            </button>
          </div>
        </div>
      }

      <!-- Delete confirm dialog -->
      @if (deleteTarget()) {
        <div class="modal-overlay" (click)="deleteTarget.set(null)">
          <div class="confirm-dialog" (click)="$event.stopPropagation()">
            <h3>Remove {{ deleteTarget()!.symbol }}?</h3>
            <p>This will stop monitoring and notifications for {{ deleteTarget()!.companyName }}.</p>
            <div class="confirm-actions">
              <button class="btn-cancel" (click)="deleteTarget.set(null)">Cancel</button>
              <button class="btn-remove" (click)="doDelete()">Remove</button>
            </div>
          </div>
        </div>
      }

      <!-- Add Stock Modal -->
      @if (showAddModal()) {
        <app-add-stock-modal
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
    </div>

    <!-- Disclaimer -->
    <div class="disclaimer">
      Money provides investment monitoring for informational purposes only. Not financial advice.
    </div>
  `,
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  protected readonly portfolio = inject(PortfolioService);
  protected readonly auth = inject(AuthService);
  protected readonly monitoring = inject(MonitoringService);
  private readonly router = inject(Router);

  protected readonly showAddModal = signal(false);
  protected readonly editingHolding = signal<Holding | null>(null);
  protected readonly deleteTarget = signal<Holding | null>(null);
  protected readonly sortMode = signal<SortMode>('recent');
  protected readonly selectedMarket = signal<MarketFilter>('ALL');

  protected readonly sortOptions: { value: SortMode; label: string }[] = [
    { value: 'recent', label: 'Recently Added' },
    { value: 'gain-desc', label: 'Highest Gain' },
    { value: 'gain-asc', label: 'Biggest Loss' },
    { value: 'alpha', label: 'Alphabetical' },
  ];

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

  openAddModal(market?: MarketRegion): void {
    this.showAddModal.set(true);
  }

  openStock(symbol: string): void {
    this.router.navigate(['/money/stocks', symbol]);
  }

  openAiAnalyst(symbol: string, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/money/ai-analyst'], { queryParams: { symbol } });
  }

  confirmDelete(h: Holding, event: Event): void {
    event.stopPropagation();
    this.deleteTarget.set(h);
  }

  openEditModal(h: Holding, event: Event): void {
    event.stopPropagation();
    this.editingHolding.set(h);
  }

  onStockUpdated(updated: Holding): void {
    this.editingHolding.set(null);
  }

  doDelete(): void {
    const t = this.deleteTarget();
    if (!t) return;
    this.portfolio.deleteHolding(t.id);
    this.monitoring.removeAlertState(t.id);
    this.deleteTarget.set(null);
  }

  onStockAdded(req: AddHoldingRequest): void {
    const holding = this.portfolio.addHolding(req);
    this.monitoring.initAlertState(holding.id, holding.symbol, holding.avgPurchasePrice, holding.market, holding.currency);
    this.monitoring.refreshPrices();
    this.showAddModal.set(false);
  }

  formatCurrency(value: number, currency: 'USD' | 'INR' = 'USD'): string {
    const symbol = currency === 'INR' ? '₹' : '$';
    return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
