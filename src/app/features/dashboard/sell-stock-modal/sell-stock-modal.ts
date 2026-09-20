import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, signal, computed, input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { PortfolioService } from '../../../core/services/portfolio.service';
import { Holding } from '../../../core/models/portfolio.model';

@Component({
  selector: 'app-sell-stock-modal',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="overlay" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="sell-modal-title">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-left">
            <h2 id="sell-modal-title">Sell {{ holding().symbol }}</h2>
            <div class="stock-badge">
              <span class="symbol">{{ holding().symbol }}</span>
              <span class="exchange-tag" [class.india]="holding().market === 'IN'">
                {{ holding().market === 'IN' ? '🇮🇳 ' + holding().exchange : '🇺🇸 ' + holding().exchange }}
              </span>
            </div>
          </div>
          <button type="button" class="close-btn" (click)="close.emit()" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form class="modal-body" (ngSubmit)="submit()">
          <!-- Position Overview -->
          <div class="position-info-bar">
            <div class="info-item">
              <span class="info-lbl">Shares Owned</span>
              <span class="info-val">{{ holding().shares | number:'1.0-4' }}</span>
            </div>
            <div class="info-item">
              <span class="info-lbl">Avg Buy Price</span>
              <span class="info-val">{{ currencySymbol() }}{{ holding().avgPurchasePrice | number:'1.2-2' }}</span>
            </div>
            @if (holding().currentPrice !== null) {
              <div class="info-item">
                <span class="info-lbl">Live Market Price</span>
                <span class="info-val live">{{ currencySymbol() }}{{ holding().currentPrice! | number:'1.2-2' }}</span>
              </div>
            }
          </div>

          <!-- Quick Percentage Chips -->
          <div class="field">
            <label class="field-label">Quick Quantity</label>
            <div class="pct-chips">
              <button type="button" class="pct-btn" (click)="setSharesPct(0.25)">25%</button>
              <button type="button" class="pct-btn" (click)="setSharesPct(0.50)">50%</button>
              <button type="button" class="pct-btn" (click)="setSharesPct(0.75)">75%</button>
              <button type="button" class="pct-btn pct-all" (click)="setSharesPct(1.0)">100% (All)</button>
            </div>
          </div>

          <!-- Shares to sell -->
          <div class="field">
            <label for="sell-shares" class="field-label">
              Shares to Sell
              <span class="max-hint">Max: {{ holding().shares }}</span>
            </label>
            <input
              id="sell-shares"
              type="number"
              class="field-input field-input-mono"
              placeholder="e.g. 10"
              [ngModel]="shares()"
              (ngModelChange)="shares.set($event)"
              name="shares"
              min="0.0001"
              [max]="holding().shares"
              step="any"
              required
              autofocus
            >
            @if (sharesError()) {
              <div class="field-error">{{ sharesError() }}</div>
            }
          </div>

          <!-- Sell Price -->
          <div class="field">
            <div class="field-label-row">
              <label for="sell-price" class="field-label">Selling Price per Share</label>
              @if (holding().currentPrice !== null) {
                <button type="button" class="btn-use-live" (click)="useLivePrice()">
                  Use Live Price ({{ currencySymbol() }}{{ holding().currentPrice! | number:'1.2-2' }})
                </button>
              }
            </div>
            <div class="input-prefix-wrap">
              <span class="input-prefix">{{ currencySymbol() }}</span>
              <input
                id="sell-price"
                type="number"
                class="field-input field-input-mono field-input-prefixed"
                placeholder="e.g. 175.50"
                [ngModel]="sellPrice()"
                (ngModelChange)="sellPrice.set($event)"
                name="sellPrice"
                min="0.01"
                step="any"
                required
              >
            </div>
          </div>

          <!-- Sale Date -->
          <div class="field">
            <label for="sell-date" class="field-label">Sale Date</label>
            <input
              id="sell-date"
              type="date"
              class="field-input"
              [ngModel]="sellDate()"
              (ngModelChange)="sellDate.set($event)"
              name="sellDate"
              [max]="today"
            >
          </div>

          <!-- Realized P&L Preview Card -->
          @if (canCalculatePreview()) {
            <div class="pnl-preview-card" [class.gain]="realizedGain() >= 0" [class.loss]="realizedGain() < 0">
              <div class="preview-row">
                <span class="prev-lbl">Total Proceeds:</span>
                <span class="prev-val font-semibold">{{ currencySymbol() }}{{ totalProceeds() | number:'1.2-2' }}</span>
              </div>
              <div class="preview-row">
                <span class="prev-lbl">Cost Basis:</span>
                <span class="prev-val">{{ currencySymbol() }}{{ costBasis() | number:'1.2-2' }}</span>
              </div>
              <div class="preview-divider"></div>
              <div class="preview-row total-row">
                <span class="prev-lbl">Booked Profit / Loss:</span>
                <span class="prev-val pnl-val" [class.positive]="realizedGain() >= 0" [class.negative]="realizedGain() < 0">
                  {{ realizedGain() >= 0 ? '+' : '' }}{{ currencySymbol() }}{{ realizedGain() | number:'1.2-2' }}
                  ({{ realizedGain() >= 0 ? '+' : '' }}{{ realizedGainPct() | number:'1.2-2' }}%)
                </span>
              </div>
              @if (isFullSell()) {
                <div class="exit-notice">⚡ This will fully close your position in {{ holding().symbol }}.</div>
              }
            </div>
          }

          <!-- Actions -->
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="close.emit()">Cancel</button>
            <button type="submit" class="btn-sell" [disabled]="!isValid() || submitting()">
              {{ submitting() ? 'Recording Sale…' : (isFullSell() ? 'Sell All & Close Position' : 'Confirm Sale') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styleUrl: './sell-stock-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SellStockModal implements OnInit {
  readonly holding = input.required<Holding>();
  @Output() close = new EventEmitter<void>();
  @Output() sold = new EventEmitter<void>();

  private readonly portfolioService = inject(PortfolioService);

  protected readonly shares = signal<number | null>(null);
  protected readonly sellPrice = signal<number | null>(null);
  protected readonly sellDate = signal<string>(new Date().toISOString().split('T')[0]);
  protected readonly submitting = signal(false);
  protected readonly today = new Date().toISOString().split('T')[0];

  protected readonly currencySymbol = computed(() => (this.holding().currency === 'INR' ? '₹' : '$'));

  ngOnInit(): void {
    if (this.holding().currentPrice !== null) {
      this.sellPrice.set(this.holding().currentPrice);
    } else {
      this.sellPrice.set(this.holding().avgPurchasePrice);
    }
  }

  protected setSharesPct(pct: number): void {
    const total = this.holding().shares;
    if (pct === 1.0) {
      this.shares.set(total);
    } else {
      const sh = Math.round(total * pct * 10000) / 10000;
      this.shares.set(sh > 0 ? sh : total);
    }
  }

  protected useLivePrice(): void {
    if (this.holding().currentPrice !== null) {
      this.sellPrice.set(this.holding().currentPrice);
    }
  }

  protected readonly isFullSell = computed(() => {
    const sh = this.shares();
    return sh !== null && sh >= this.holding().shares;
  });

  protected readonly costBasis = computed(() => {
    const sh = this.shares() ?? 0;
    return sh * this.holding().avgPurchasePrice;
  });

  protected readonly totalProceeds = computed(() => {
    const sh = this.shares() ?? 0;
    const pr = this.sellPrice() ?? 0;
    return sh * pr;
  });

  protected readonly realizedGain = computed(() => {
    return this.totalProceeds() - this.costBasis();
  });

  protected readonly realizedGainPct = computed(() => {
    const avg = this.holding().avgPurchasePrice;
    const pr = this.sellPrice() ?? 0;
    return avg > 0 ? ((pr - avg) / avg) * 100 : 0;
  });

  protected readonly canCalculatePreview = computed(() => {
    return (this.shares() ?? 0) > 0 && (this.sellPrice() ?? 0) > 0;
  });

  protected readonly sharesError = computed(() => {
    const sh = this.shares();
    if (sh === null) return null;
    if (sh <= 0) return 'Shares must be greater than 0';
    if (sh > this.holding().shares) return `Cannot sell more than ${this.holding().shares} shares owned`;
    return null;
  });

  protected readonly isValid = computed(() => {
    const sh = this.shares();
    const pr = this.sellPrice();
    return sh !== null && sh > 0 && sh <= this.holding().shares && pr !== null && pr > 0;
  });

  protected submit(): void {
    if (!this.isValid() || this.submitting()) return;
    this.submitting.set(true);

    try {
      this.portfolioService.sellHolding({
        holdingId: this.holding().id,
        shares: this.shares()!,
        sellPrice: this.sellPrice()!,
        sellDate: this.sellDate(),
      });
      this.sold.emit();
      this.close.emit();
    } finally {
      this.submitting.set(false);
    }
  }
}
