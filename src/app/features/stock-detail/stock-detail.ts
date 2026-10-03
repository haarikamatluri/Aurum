import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { PortfolioService } from '../../core/services/portfolio.service';
import { NotificationService } from '../../core/services/notification.service';
import { CurrencyCode, Holding } from '../../core/models/portfolio.model';
import { EditStockModal } from '../dashboard/edit-stock-modal/edit-stock-modal';
import { SellStockModal } from '../dashboard/sell-stock-modal/sell-stock-modal';

@Component({
  selector: 'app-stock-detail',
  standalone: true,
  imports: [DecimalPipe, DatePipe, EditStockModal, SellStockModal],
  template: `
    @if (holding()) {
      <div class="stock-detail">
        <!-- Back -->
        <button class="back-btn" (click)="goBack()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back
        </button>

        <!-- Header -->
        <div class="detail-header">
          <div class="symbol-block">
            <h1 class="symbol">{{ holding()!.symbol }}</h1>
            <span class="company-name">{{ holding()!.companyName }}</span>
            <span class="exchange-badge" [class.india]="holding()!.market === 'IN'">
              {{ holding()!.market === 'IN' ? '🇮🇳 ' + holding()!.exchange : '🇺🇸 ' + holding()!.exchange }}
            </span>
          </div>

          <div class="price-block">
            @if (holding()!.currentPrice !== null) {
              <span class="current-price">{{ formatVal(holding()!.currentPrice!, holding()!.currency) }}</span>
              <span class="price-change"
                [class.positive]="(holding()!.profitLossPct ?? 0) >= 0"
                [class.negative]="(holding()!.profitLossPct ?? 0) < 0">
                {{ (holding()!.profitLossPct ?? 0) >= 0 ? '+' : '' }}{{ holding()!.profitLossPct | number:'1.2-2' }}%
              </span>
            } @else {
              <span class="current-price pending">Price unavailable</span>
              <span class="api-note">Connect market data API to see live price</span>
            }
          </div>
        </div>

        <!-- Investment summary cards -->
        <div class="cards-row">
          <div class="info-card">
            <span class="card-label">YOUR INVESTMENT</span>
            <span class="card-value">{{ formatVal(holding()!.totalInvested, holding()!.currency) }}</span>
            <span class="card-sub">{{ holding()!.shares | number:'1.0-4' }} shares @ {{ formatVal(holding()!.avgPurchasePrice, holding()!.currency) }} avg</span>
          </div>

          <div class="info-card">
            <span class="card-label">CURRENT VALUE</span>
            @if (holding()!.currentValue !== null) {
              <span class="card-value">{{ formatVal(holding()!.currentValue!, holding()!.currency) }}</span>
            } @else {
              <span class="card-value pending">--</span>
            }
          </div>

          <div class="info-card" [class.positive-card]="(holding()!.profitLoss ?? 0) > 0" [class.negative-card]="(holding()!.profitLoss ?? 0) < 0">
            <span class="card-label">GAIN / LOSS</span>
            @if (holding()!.profitLoss !== null) {
              <span class="card-value" [class.positive]="holding()!.profitLoss! > 0" [class.negative]="holding()!.profitLoss! < 0">
                {{ holding()!.profitLoss! >= 0 ? '+' : '' }}{{ formatVal(holding()!.profitLoss!, holding()!.currency) }}
              </span>
              <span class="card-sub" [class.positive]="holding()!.profitLoss! > 0" [class.negative]="holding()!.profitLoss! < 0">
                {{ holding()!.profitLossPct! >= 0 ? '+' : '' }}{{ holding()!.profitLossPct! | number:'1.2-2' }}%
              </span>
            } @else {
              <span class="card-value pending">--</span>
            }
          </div>

          <div class="info-card">
            <span class="card-label">5% ALERT REFERENCE</span>
            <span class="card-value">{{ formatVal(holding()!.avgPurchasePrice, holding()!.currency) }}</span>
            <span class="card-sub">Alerts trigger at ±5%, ±10%</span>
          </div>
        </div>

        <!-- AI Analyst Callout -->
        <div class="ai-cta">
          <div class="ai-cta-left">
            <div class="ai-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <h3>AI Market Intelligence for {{ holding()!.symbol }}</h3>
              <p>Ask about valuation, technical trends, risk metrics, and scenarios.</p>
            </div>
          </div>
          <button class="btn-ask-ai" (click)="openAiAnalyst()" id="ask-ai-detail-btn">
            Open AI Analyst
          </button>
        </div>

        <!-- Transaction history -->
        <div class="section">
          <h2 class="section-title">Transaction History (Buy & Sell)</h2>
          @if (transactions().length > 0) {
            <div class="tx-list">
              @for (t of transactions(); track t.id) {
                <div class="tx-row" [class.sell-row]="t.type === 'SELL'">
                  <div class="tx-type" [class.buy]="t.type === 'BUY'" [class.sell]="t.type === 'SELL'">{{ t.type }}</div>
                  <div class="tx-detail">
                    <span class="tx-shares">{{ t.shares | number:'1.0-4' }} shares</span>
                    <span class="tx-price">@ {{ formatVal(t.price, t.currency) }} per share</span>
                    @if (t.type === 'SELL' && t.realizedGain !== undefined && t.realizedGain !== null) {
                      <span class="tx-realized" [class.positive]="t.realizedGain >= 0" [class.negative]="t.realizedGain < 0">
                        Booked: {{ t.realizedGain >= 0 ? '+' : '' }}{{ formatVal(t.realizedGain, t.currency) }}
                        @if (t.realizedGainPct !== undefined && t.realizedGainPct !== null) {
                          ({{ t.realizedGain >= 0 ? '+' : '' }}{{ t.realizedGainPct | number:'1.2-2' }}%)
                        }
                      </span>
                    }
                  </div>
                  <div class="tx-right">
                    <span class="tx-total">{{ formatVal(t.shares * t.price, t.currency) }}</span>
                    <span class="tx-date">{{ t.date }}</span>
                  </div>
                </div>
              }
            </div>
          } @else {
            <p class="no-data">No transactions recorded.</p>
          }
        </div>

        <!-- 5% Alert history -->
        @if (stockAlerts().length > 0) {
          <div class="section">
            <h2 class="section-title">5% Threshold Alert History</h2>
            <div class="alerts-list">
              @for (n of stockAlerts(); track n.id) {
                <div class="alert-row" [class.up]="n.direction === 'UP'" [class.down]="n.direction === 'DOWN'">
                  <div class="alert-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                      @if (n.direction === 'UP') {
                        <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                      } @else {
                        <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                      }
                    </svg>
                  </div>
                  <span class="alert-msg">{{ n.message }}</span>
                  <span class="alert-time">{{ n.createdAt | date:'MMM d, h:mm a' }}</span>
                </div>
              }
            </div>
          </div>
        }

        <!-- Actions -->
        <div class="stock-action-zone">
          <button class="btn-sell-stock" (click)="showSellModal.set(true)" id="sell-stock-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            Sell Shares
          </button>
          <button class="btn-edit-stock" (click)="showEditModal.set(true)" id="edit-stock-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Holding (Shares & Cost)
          </button>
          <button class="btn-remove-stock" (click)="confirmDelete()" id="remove-stock-btn">
            Remove from portfolio
          </button>
        </div>
      </div>
    } @else {
      <div class="not-found">
        <h2>Stock not found</h2>
        <p>This stock is not in your portfolio.</p>
        <button class="btn-back" (click)="goBack()">Back to portfolio</button>
      </div>
    }

    <!-- Edit Modal -->
    @if (showEditModal() && holding()) {
      <app-edit-stock-modal
        [holding]="holding()!"
        (close)="showEditModal.set(false)"
        (updated)="showEditModal.set(false)"
      />
    }

    <!-- Sell Modal -->
    @if (showSellModal() && holding()) {
      <app-sell-stock-modal
        [holding]="holding()!"
        (close)="showSellModal.set(false)"
        (sold)="onStockSold()"
      />
    }

    <!-- Delete confirm -->
    @if (showDeleteConfirm()) {
      <div class="modal-overlay" (click)="showDeleteConfirm.set(false)">
        <div class="confirm-dialog" (click)="$event.stopPropagation()">
          <h3>Remove {{ holding()?.symbol }}?</h3>
          <p>This will stop monitoring and notifications for {{ holding()?.companyName }}.</p>
          <div class="confirm-actions">
            <button class="btn-cancel" (click)="showDeleteConfirm.set(false)">Cancel</button>
            <button class="btn-remove" (click)="doDelete()">Remove</button>
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './stock-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly portfolioService = inject(PortfolioService);
  private readonly notifService = inject(NotificationService);

  protected readonly showDeleteConfirm = signal(false);
  protected readonly showEditModal = signal(false);
  protected readonly showSellModal = signal(false);

  protected readonly holding = computed(() => {
    const symbol = this.route.snapshot.paramMap.get('symbol') ?? '';
    return this.portfolioService.getHoldingBySymbol(symbol) ?? null;
  });

  protected readonly transactions = computed(() => {
    const h = this.holding();
    if (!h) return [];
    return this.portfolioService.getTransactionsForHolding(h.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  protected readonly stockAlerts = computed(() => {
    const h = this.holding();
    if (!h) return [];
    return this.notifService.getForSymbol(h.symbol)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);
  });

  goBack(): void { this.router.navigate(['/money']); }

  openAiAnalyst(): void {
    const h = this.holding();
    if (!h) return;
    this.router.navigate(['/money/ai-analyst'], { queryParams: { symbol: h.symbol } });
  }

  onStockSold(): void {
    this.showSellModal.set(false);
    const symbol = this.route.snapshot.paramMap.get('symbol') ?? '';
    const updated = this.portfolioService.getHoldingBySymbol(symbol);
    if (!updated) {
      this.router.navigate(['/money']);
    }
  }

  confirmDelete(): void { this.showDeleteConfirm.set(true); }

  doDelete(): void {
    const h = this.holding();
    if (!h) return;
    this.portfolioService.deleteHolding(h.id);
    this.showDeleteConfirm.set(false);
    this.router.navigate(['/money']);
  }

  formatVal(val: number, currency: CurrencyCode = 'USD'): string {
    if (val === null || val === undefined || isNaN(val)) return '—';
    const absVal = Math.abs(val);
    const prefix = val < 0 ? '-' : '';

    if (currency === 'INR') {
      const inrStr = absVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${prefix}₹${inrStr}`;
    } else {
      const usdStr = absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${prefix}$${usdStr}`;
    }
  }
}
