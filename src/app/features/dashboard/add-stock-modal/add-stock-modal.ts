import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { PortfolioService } from '../../../core/services/portfolio.service';
import { AddHoldingRequest, StockSearchResult, MarketRegion } from '../../../core/models/portfolio.model';

@Component({
  selector: 'app-add-stock-modal',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="overlay" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <!-- Header -->
        <div class="modal-header">
          <h2 id="modal-title">Add Stock</h2>
          <button type="button" class="close-btn" (click)="close.emit()" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Market Selection Segment -->
        <div class="market-selector">
          <button
            type="button"
            class="market-tab"
            [class.active]="selectedMarket() === 'US'"
            (click)="setMarket('US')"
          >
            <span class="flag">🇺🇸</span>
            <span>US Market (USD $)</span>
          </button>
          <button
            type="button"
            class="market-tab"
            [class.active]="selectedMarket() === 'IN'"
            (click)="setMarket('IN')"
          >
            <span class="flag">🇮🇳</span>
            <span>India Market (INR ₹)</span>
          </button>
        </div>

        <form class="modal-body" (ngSubmit)="submit()" #f="ngForm">
          <!-- Stock symbol search -->
          <div class="field">
            <label for="symbol-input" class="field-label">
              {{ selectedMarket() === 'IN' ? 'Indian Stock (NSE / BSE)' : 'US Stock (NASDAQ / NYSE)' }}
            </label>
            <div class="search-wrap">
              <input
                id="symbol-input"
                type="text"
                class="field-input"
                [placeholder]="selectedMarket() === 'IN' ? 'Search e.g. RELIANCE, TCS, INFY, TATA...' : 'Search e.g. AAPL, NVDA, MSFT, TSLA...'"
                [ngModel]="symbolQuery()"
                (ngModelChange)="onSymbolChange($event)"
                name="symbol"
                autocomplete="off"
                required
              >
              @if (searchResults().length > 0 && !selectedStock()) {
                <div class="search-dropdown">
                  @for (result of searchResults(); track result.symbol) {
                    <button type="button" class="search-result" (click)="selectStock(result)">
                      <div class="result-left">
                        <span class="result-symbol">{{ result.symbol }}</span>
                        <span class="result-exchange">{{ result.exchange }}</span>
                      </div>
                      <span class="result-name">{{ result.companyName }}</span>
                    </button>
                  }
                </div>
              }
            </div>

            @if (selectedStock()) {
              <div class="selected-stock">
                <div class="selected-info">
                  <span class="selected-symbol">{{ selectedStock()!.symbol }}</span>
                  <span class="selected-exchange">{{ selectedStock()!.exchange }}</span>
                  <span class="selected-market-badge">{{ selectedStock()!.market === 'IN' ? '🇮🇳 NSE' : '🇺🇸 US' }}</span>
                </div>
                <span class="selected-name">{{ selectedStock()!.companyName }}</span>
                <button type="button" class="clear-btn" (click)="clearSelection()">Change</button>
              </div>
            }

            @if (symbolQuery().length > 0 && searchResults().length === 0 && !selectedStock()) {
              <p class="field-error">
                No matching {{ selectedMarket() === 'IN' ? 'Indian' : 'US' }} stock found. Check the symbol or switch market tab above.
              </p>
            }
          </div>

          <!-- Quick suggestions if empty -->
          @if (!selectedStock() && symbolQuery().length === 0) {
            <div class="quick-picks">
              <span class="quick-label">Popular in {{ selectedMarket() === 'IN' ? 'India' : 'US' }}:</span>
              <div class="quick-tags">
                @for (item of quickPicks(); track item.symbol) {
                  <button type="button" class="quick-tag" (click)="selectStock(item)">
                    {{ item.symbol }}
                  </button>
                }
              </div>
            </div>
          }

          <!-- Shares -->
          <div class="field">
            <label for="shares-input" class="field-label">Number of Shares</label>
            <input
              id="shares-input"
              type="number"
              class="field-input field-input-mono"
              placeholder="e.g. 25"
              [ngModel]="shares()"
              (ngModelChange)="shares.set($event)"
              name="shares"
              min="0.0001"
              step="any"
              required
            >
          </div>

          <!-- Purchase price -->
          <div class="field">
            <label for="price-input" class="field-label">
              Bought Price (per share in {{ currencyCode() }})
            </label>
            <div class="input-prefix-wrap">
              <span class="input-prefix">{{ currencySymbol() }}</span>
              <input
                id="price-input"
                type="number"
                class="field-input field-input-prefixed field-input-mono"
                placeholder="0.00"
                [ngModel]="purchasePrice()"
                (ngModelChange)="purchasePrice.set($event)"
                name="price"
                min="0.01"
                step="any"
                required
              >
            </div>
          </div>

          <!-- Purchase date (optional) -->
          <div class="field">
            <label for="date-input" class="field-label">
              Purchase Date <span class="optional">(optional)</span>
            </label>
            <input
              id="date-input"
              type="date"
              class="field-input"
              [ngModel]="purchaseDate()"
              (ngModelChange)="purchaseDate.set($event)"
              name="date"
              [max]="today"
            >
          </div>

          <!-- Preview if existing holding -->
          @if (existingHolding()) {
            <div class="existing-notice">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              You already own {{ existingHolding()!.shares }} shares of {{ existingHolding()!.symbol }}.
              This purchase will be averaged into your position.
              @if ((shares() ?? 0) > 0 && (purchasePrice() ?? 0) > 0) {
                <br><strong>New average cost: {{ currencySymbol() }}{{ newAvgCost() | number:'1.2-2' }}</strong>
              }
            </div>
          }

          <!-- Actions -->
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="close.emit()">Cancel</button>
            <button type="submit" class="btn-primary" [disabled]="!canSubmit()">
              Add {{ selectedMarket() === 'IN' ? 'Indian' : 'US' }} Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styleUrl: './add-stock-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddStockModal {
  @Output() close = new EventEmitter<void>();
  @Output() added = new EventEmitter<AddHoldingRequest>();

  private readonly portfolioService = inject(PortfolioService);

  protected readonly selectedMarket = signal<MarketRegion>('US');
  protected readonly symbolQuery = signal('');
  protected readonly shares = signal<number | null>(null);
  protected readonly purchasePrice = signal<number | null>(null);
  protected readonly purchaseDate = signal('');
  protected readonly today = new Date().toISOString().split('T')[0];

  protected readonly selectedStock = signal<StockSearchResult | null>(null);
  protected readonly searchResults = signal<StockSearchResult[]>([]);

  protected readonly currencySymbol = computed(() => (this.selectedMarket() === 'IN' ? '₹' : '$'));
  protected readonly currencyCode = computed(() => (this.selectedMarket() === 'IN' ? 'INR' : 'USD'));

  protected readonly quickPicks = computed(() => {
    return this.portfolioService.searchStocks('', this.selectedMarket()).slice(0, 5);
  });

  protected readonly existingHolding = computed(() => {
    const s = this.selectedStock();
    if (!s) return null;
    return this.portfolioService.getHoldingBySymbol(s.symbol) ?? null;
  });

  protected readonly newAvgCost = computed(() => {
    const existing = this.existingHolding();
    const sh = this.shares() ?? 0;
    const pr = this.purchasePrice() ?? 0;
    if (!existing || sh <= 0 || pr <= 0) return 0;
    const newTotal = existing.totalInvested + sh * pr;
    const newShares = existing.shares + sh;
    return newTotal / newShares;
  });

  protected readonly canSubmit = computed(() => {
    const s = this.selectedStock();
    const sh = this.shares();
    const pr = this.purchasePrice();
    return !!s && sh !== null && Number(sh) > 0 && pr !== null && Number(pr) > 0;
  });

  setMarket(m: MarketRegion): void {
    if (this.selectedMarket() !== m) {
      this.selectedMarket.set(m);
      this.clearSelection();
    }
  }

  onSymbolChange(val: string): void {
    this.symbolQuery.set(val);
    if (this.selectedStock()) this.selectedStock.set(null);
    const q = val.trim();
    if (q.length < 1) {
      this.searchResults.set([]);
      return;
    }
    this.searchResults.set(this.portfolioService.searchStocks(q, this.selectedMarket()));
  }

  selectStock(result: StockSearchResult): void {
    this.selectedMarket.set(result.market);
    this.selectedStock.set(result);
    this.symbolQuery.set(result.symbol);
    this.searchResults.set([]);
  }

  clearSelection(): void {
    this.selectedStock.set(null);
    this.symbolQuery.set('');
    this.searchResults.set([]);
  }

  submit(): void {
    const stock = this.selectedStock();
    const sh = this.shares();
    const pr = this.purchasePrice();
    if (!stock || sh === null || Number(sh) <= 0 || pr === null || Number(pr) <= 0) return;
    this.added.emit({
      symbol: stock.symbol,
      companyName: stock.companyName,
      exchange: stock.exchange,
      market: stock.market,
      currency: stock.currency,
      shares: Number(sh),
      purchasePrice: Number(pr),
      purchaseDate: this.purchaseDate() || undefined,
    });
  }
}
