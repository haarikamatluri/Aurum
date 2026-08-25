import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Holding } from '../../../core/models/portfolio.model';
import { PortfolioService } from '../../../core/services/portfolio.service';
import { MonitoringService } from '../../../core/services/monitoring.service';

@Component({
  selector: 'app-edit-stock-modal',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="overlay" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-left">
            <h2 id="edit-modal-title">Edit Holding</h2>
            <div class="stock-badge">
              <span class="symbol">{{ holding.symbol }}</span>
              <span class="exchange-tag" [class.india]="holding.market === 'IN'">
                {{ holding.market === 'IN' ? '🇮🇳 ' + holding.exchange : '🇺🇸 ' + holding.exchange }}
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
          <div class="company-name-bar">
            <span class="company-label">Company:</span>
            <span class="company-val">{{ holding.companyName }}</span>
          </div>

          <!-- Live Market Price info if available -->
          @if (holding.currentPrice !== null) {
            <div class="live-price-bar">
              <div class="live-info">
                <span class="live-dot"></span>
                <span class="live-text">Live Price:</span>
                <strong class="live-amount">{{ currencySymbol }}{{ holding.currentPrice | number:'1.2-2' }}</strong>
              </div>
              <button type="button" class="btn-use-live" (click)="useLivePrice()">Set as Bought Price</button>
            </div>
          }

          <!-- Shares Input -->
          <div class="field">
            <label for="edit-shares" class="field-label">Number of Shares</label>
            <div class="number-control-wrap">
              <button type="button" class="btn-step" (click)="stepShares(-1)" [disabled]="(shares() ?? 0) <= 1">-</button>
              <input
                id="edit-shares"
                type="number"
                class="field-input field-input-mono"
                [ngModel]="shares()"
                (ngModelChange)="shares.set($event)"
                name="shares"
                min="0.0001"
                step="any"
                required
              >
              <button type="button" class="btn-step" (click)="stepShares(1)">+</button>
            </div>
          </div>

          <!-- Bought Price per Share -->
          <div class="field">
            <label for="edit-price" class="field-label">
              Average Bought Price (per share in {{ holding.currency }})
            </label>
            <div class="input-prefix-wrap">
              <span class="input-prefix">{{ currencySymbol }}</span>
              <input
                id="edit-price"
                type="number"
                class="field-input field-input-prefixed field-input-mono"
                [ngModel]="avgPurchasePrice()"
                (ngModelChange)="avgPurchasePrice.set($event)"
                name="price"
                min="0.01"
                step="any"
                required
              >
            </div>
          </div>

          <!-- Calculated Preview -->
          <div class="preview-box">
            <div class="preview-row">
              <span class="preview-label">Total Invested:</span>
              <span class="preview-val">{{ currencySymbol }}{{ totalInvested() | number:'1.2-2' }}</span>
            </div>
            @if (holding.currentPrice !== null) {
              <div class="preview-row">
                <span class="preview-label">Current Value:</span>
                <span class="preview-val">{{ currencySymbol }}{{ currentValue() | number:'1.2-2' }}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">Estimated P&L:</span>
                <span class="preview-val"
                  [class.positive]="estProfitLoss() >= 0"
                  [class.negative]="estProfitLoss() < 0">
                  {{ estProfitLoss() >= 0 ? '+' : '' }}{{ currencySymbol }}{{ estProfitLoss() | number:'1.2-2' }}
                  ({{ estProfitLossPct() >= 0 ? '+' : '' }}{{ estProfitLossPct() | number:'1.2-2' }}%)
                </span>
              </div>
            }
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="close.emit()">Cancel</button>
            <button type="submit" class="btn-primary" [disabled]="!canSubmit()">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styleUrl: './edit-stock-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditStockModal implements OnInit {
  @Input({ required: true }) holding!: Holding;
  @Output() close = new EventEmitter<void>();
  @Output() updated = new EventEmitter<Holding>();

  private readonly portfolioService = inject(PortfolioService);
  private readonly monitoringService = inject(MonitoringService);

  protected readonly shares = signal<number | null>(null);
  protected readonly avgPurchasePrice = signal<number | null>(null);

  get currencySymbol(): string {
    return this.holding.currency === 'INR' ? '₹' : '$';
  }

  ngOnInit(): void {
    if (this.holding) {
      this.shares.set(this.holding.shares);
      this.avgPurchasePrice.set(this.holding.avgPurchasePrice);
    }
  }

  protected readonly totalInvested = computed(() => {
    const sh = this.shares() ?? 0;
    const pr = this.avgPurchasePrice() ?? 0;
    return sh * pr;
  });

  protected readonly currentValue = computed(() => {
    const sh = this.shares() ?? 0;
    const cp = this.holding.currentPrice ?? 0;
    return sh * cp;
  });

  protected readonly estProfitLoss = computed(() => {
    return this.currentValue() - this.totalInvested();
  });

  protected readonly estProfitLossPct = computed(() => {
    const pr = this.avgPurchasePrice() ?? 0;
    const cp = this.holding.currentPrice ?? 0;
    if (pr <= 0) return 0;
    return ((cp - pr) / pr) * 100;
  });

  protected readonly canSubmit = computed(() => {
    const sh = this.shares();
    const pr = this.avgPurchasePrice();
    return sh !== null && Number(sh) > 0 && pr !== null && Number(pr) > 0;
  });

  stepShares(delta: number): void {
    const cur = this.shares() ?? 0;
    const next = Math.max(1, cur + delta);
    this.shares.set(next);
  }

  useLivePrice(): void {
    if (this.holding.currentPrice) {
      this.avgPurchasePrice.set(this.holding.currentPrice);
    }
  }

  submit(): void {
    const sh = this.shares();
    const pr = this.avgPurchasePrice();
    if (!sh || Number(sh) <= 0 || !pr || Number(pr) <= 0) return;

    const result = this.portfolioService.updateHolding(this.holding.id, {
      shares: Number(sh),
      avgPurchasePrice: Number(pr),
    });

    if (result) {
      this.monitoringService.updateReferencePrice(this.holding.id, Number(pr));
      this.monitoringService.refreshPrices();
      this.updated.emit(result);
    }
    this.close.emit();
  }
}
