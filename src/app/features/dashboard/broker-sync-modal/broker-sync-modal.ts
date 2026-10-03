import {
  Component,
  ChangeDetectionStrategy,
  output,
  inject,
  signal,
  computed,
  OnInit,
  input,
  HostBinding
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BrokerSyncService,
  BrokerHolding,
} from '../../../core/services/broker-sync.service';

@Component({
  selector: 'app-broker-sync-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="onBackdropClick($event)">
      <div class="modal-container">
        
        <!-- Header -->
        <div class="modal-header">
          <div class="header-titles">
            <div class="badge-tag">Phase 2 Brokerage Connectivity</div>
            <h2>Direct Broker Account Sync & Audit</h2>
            <p>Read-only OAuth integration for demat holdings, positions, margin balances, and order history.</p>
          </div>
          <button type="button" class="close-btn" (click)="closeModal.emit()" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Phase 2 Safety Rule Banner -->
        <div class="phase2-safety-banner">
          <span class="lock-icon">🔒</span>
          <div class="banner-text">
            <strong>Read-Only Access Active (Phase 2)</strong>
            <span>All connected accounts operate in read-only audit mode. Order placement (Buy/Sell) will be unlocked in <strong>Phase 3</strong>.</span>
          </div>
        </div>

        <!-- Sub-Navigation Tabs -->
        <div class="modal-subnav">
          <button type="button" class="subnav-tab" [class.active]="activeTab() === 'CONNECT'" (click)="activeTab.set('CONNECT')">
            🔌 Connect Broker
          </button>
          <button type="button" class="subnav-tab" [class.active]="activeTab() === 'BALANCES'" (click)="activeTab.set('BALANCES')">
            💵 Balances & Margin
          </button>
          <button type="button" class="subnav-tab" [class.active]="activeTab() === 'POSITIONS'" (click)="activeTab.set('POSITIONS')">
            📊 Open Positions
          </button>
          <button type="button" class="subnav-tab" [class.active]="activeTab() === 'ORDERS'" (click)="activeTab.set('ORDERS')">
            📜 Order Logs
          </button>
          <button type="button" class="subnav-tab" [class.active]="activeTab() === 'RECONCILIATION'" (click)="activeTab.set('RECONCILIATION')">
            🛡️ Audit & Reconcile
          </button>
        </div>

        <!-- TAB 1: CONNECT BROKER -->
        @if (activeTab() === 'CONNECT') {
          @if (syncStep() === 'SELECT_BROKER') {
            <div class="broker-selection">
              <div
                class="broker-card"
                [class.active]="selectedBroker() === 'zerodha'"
                (click)="selectedBroker.set('zerodha')"
              >
                <div class="broker-icon kite-icon">🪁</div>
                <div class="broker-info">
                  <h3>Zerodha Kite Connect</h3>
                  <span class="region-pill in-pill">🇮🇳 India (NSE / BSE)</span>
                  <p>Sync equity holdings, demat CNC delivery positions, and weighted average prices.</p>
                </div>
              </div>

              <div
                class="broker-card"
                [class.active]="selectedBroker() === 'webull'"
                (click)="selectedBroker.set('webull')"
              >
                <div class="broker-icon webull-icon">🐂</div>
                <div class="broker-info">
                  <h3>Webull Financial</h3>
                  <span class="region-pill us-pill">🇺🇸 US (NASDAQ / NYSE)</span>
                  <p>Sync US blue-chip and high-growth equities with real-time portfolio cost basis.</p>
                </div>
              </div>

              <!-- Credentials Form -->
              <div class="credentials-card">
                <div class="sandbox-toggle-row">
                  <label class="toggle-container">
                    <input type="checkbox" [(ngModel)]="isSandboxMode" />
                    <span class="toggle-slider"></span>
                  </label>
                  <div class="toggle-meta">
                    <strong>Instant Demo / Sandbox Mode</strong>
                    <small>Test integration immediately with realistic portfolio holdings without API keys.</small>
                  </div>
                </div>

                @if (!isSandboxMode) {
                  <div class="api-fields">
                    @if (selectedBroker() === 'zerodha') {
                      <div class="form-group">
                        <label>Kite API Key</label>
                        <input type="text" [(ngModel)]="apiKey" placeholder="e.g. abcd1234kitekey" />
                      </div>
                      <div class="form-group">
                        <label>Kite API Secret</label>
                        <input type="password" [(ngModel)]="apiSecret" placeholder="••••••••••••••••" />
                      </div>
                      <div class="form-group">
                        <label>Request Token</label>
                        <input type="text" [(ngModel)]="requestToken" placeholder="From Kite login redirect" />
                      </div>
                    } @else {
                      <div class="form-group">
                        <label>Webull App Key</label>
                        <input type="text" [(ngModel)]="appKey" placeholder="e.g. wb_app_991823" />
                      </div>
                      <div class="form-group">
                        <label>Webull App Secret</label>
                        <input type="password" [(ngModel)]="appSecret" placeholder="••••••••••••••••" />
                      </div>
                      <div class="form-group">
                        <label>Account ID</label>
                        <input type="text" [(ngModel)]="accountId" placeholder="e.g. 58192834" />
                      </div>
                    }
                  </div>
                }

                @if (errorMessage()) {
                  <div class="error-banner">{{ errorMessage() }}</div>
                }

                <div class="actions-row">
                  <button class="btn btn-secondary" (click)="closeModal.emit()">Cancel</button>
                  <button
                    class="btn btn-primary"
                    [disabled]="isConnecting()"
                    (click)="handleConnectAndFetch()"
                  >
                    @if (isConnecting()) {
                      <span class="spinner"></span> Connecting...
                    } @else {
                      Sync {{ selectedBroker() === 'zerodha' ? 'Zerodha' : 'Webull' }} Holdings &rarr;
                    }
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- Preview & Select Holdings Step -->
          @if (syncStep() === 'PREVIEW_HOLDINGS') {
            <div class="preview-step">
              <div class="preview-banner">
                <div class="preview-meta">
                  <span class="source-tag">Connected: {{ selectedBroker() === 'zerodha' ? 'Zerodha Kite' : 'Webull' }}</span>
                  <h3>Discovered {{ holdingsList().length }} demat holdings</h3>
                  <p>Select which positions you would like to import into your Aurum portfolio.</p>
                </div>
                <button class="select-all-btn" (click)="toggleSelectAll()">
                  {{ allSelected() ? 'Deselect All' : 'Select All' }}
                </button>
              </div>

              <div class="table-scroll-wrap">
                <table class="holdings-preview-table">
                  <thead>
                    <tr>
                      <th width="40"></th>
                      <th>Asset</th>
                      <th>Market</th>
                      <th>Quantity</th>
                      <th>Avg Buy Price</th>
                      <th>Total Capital</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (h of holdingsList(); track h.symbol) {
                      <tr [class.row-selected]="h.selected" (click)="toggleHolding(h)">
                        <td class="checkbox-cell" (click)="$event.stopPropagation()">
                          <input type="checkbox" [(ngModel)]="h.selected" />
                        </td>
                        <td>
                          <div class="sym-name">
                            <strong>{{ h.symbol }}</strong>
                            <small>{{ h.companyName }}</small>
                          </div>
                        </td>
                        <td>
                          <span class="badge" [class.badge-in]="h.market === 'IN'" [class.badge-us]="h.market === 'US'">
                            {{ h.exchange }}
                          </span>
                        </td>
                        <td>{{ h.shares }}</td>
                        <td>{{ h.currency === 'INR' ? '₹' : '$' }}{{ h.purchasePrice | number : '1.2-2' }}</td>
                        <td><strong>{{ h.currency === 'INR' ? '₹' : '$' }}{{ (h.shares * h.purchasePrice) | number : '1.0-0' }}</strong></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <div class="preview-actions">
                <button class="btn btn-secondary" (click)="syncStep.set('SELECT_BROKER')">&larr; Back</button>
                <button
                  class="btn btn-primary import-confirm-btn"
                  [disabled]="selectedCount() === 0 || isImporting()"
                  (click)="handleImportConfirmed()"
                >
                  @if (isImporting()) {
                    <span class="spinner"></span> Importing...
                  } @else {
                    Import {{ selectedCount() }} Selected Holdings
                  }
                </button>
              </div>
            </div>
          }
        }

        <!-- TAB 2: BALANCES & MARGIN -->
        @if (activeTab() === 'BALANCES') {
          <div class="balances-tab">
            <div class="tab-intro">
              <h3>Broker Account Balances & Margin Allocation</h3>
              <p>Authoritative funds available directly from connected demat/brokerage sessions.</p>
            </div>
            <div class="balances-grid">
              @for (b of brokerSyncService.balances(); track b.brokerId) {
                <div class="balance-card">
                  <div class="b-header">
                    <strong>{{ b.brokerName }}</strong>
                    <span class="cur-pill">{{ b.currency }}</span>
                  </div>
                  <div class="b-body">
                    <div class="b-item">
                      <span class="lbl">Available Cash:</span>
                      <span class="val highlight">{{ b.currency === 'INR' ? '₹' : '$' }}{{ b.availableCash | number:'1.2-2' }}</span>
                    </div>
                    <div class="b-item">
                      <span class="lbl">Invested Capital:</span>
                      <span class="val">{{ b.currency === 'INR' ? '₹' : '$' }}{{ b.investedAmount | number:'1.2-2' }}</span>
                    </div>
                    <div class="b-item">
                      <span class="lbl">Total Collateral:</span>
                      <span class="val">{{ b.currency === 'INR' ? '₹' : '$' }}{{ b.totalCollateral | number:'1.2-2' }}</span>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- TAB 3: OPEN POSITIONS -->
        @if (activeTab() === 'POSITIONS') {
          <div class="positions-tab">
            <div class="tab-intro">
              <h3>Live Open Positions</h3>
              <p>Delivery (CNC) and intraday holdings reported by connected broker endpoints.</p>
            </div>
            <div class="table-scroll-wrap">
              <table class="holdings-preview-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Exchange</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Buy Avg</th>
                    <th>Current Price</th>
                    <th>Unrealized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  @for (pos of brokerSyncService.positions(); track pos.id) {
                    <tr>
                      <td><strong>{{ pos.symbol }}</strong></td>
                      <td><span class="badge">{{ pos.exchange }}</span></td>
                      <td><span class="product-tag">{{ pos.productType }}</span></td>
                      <td>{{ pos.quantity }}</td>
                      <td>{{ pos.currency === 'INR' ? '₹' : '$' }}{{ pos.buyAveragePrice | number:'1.2-2' }}</td>
                      <td>{{ pos.currency === 'INR' ? '₹' : '$' }}{{ pos.currentPrice | number:'1.2-2' }}</td>
                      <td [class.pos-green]="pos.unrealizedPL >= 0" [class.pos-red]="pos.unrealizedPL < 0">
                        <strong>{{ pos.unrealizedPL >= 0 ? '+' : '' }}{{ pos.currency === 'INR' ? '₹' : '$' }}{{ pos.unrealizedPL | number:'1.2-2' }} ({{ pos.unrealizedPLPct | number:'1.2-2' }}%)</strong>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- TAB 4: ORDER LOGS (READ-ONLY) -->
        @if (activeTab() === 'ORDERS') {
          <div class="orders-tab">
            <div class="tab-intro">
              <h3>Read-Only Broker Order History</h3>
              <p>Historical order transactions synchronized directly from connected broker accounts.</p>
            </div>
            <div class="table-scroll-wrap">
              <table class="holdings-preview-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  @for (ord of brokerSyncService.orderHistory(); track ord.orderId) {
                    <tr>
                      <td><code>{{ ord.orderId }}</code></td>
                      <td><strong>{{ ord.symbol }}</strong></td>
                      <td>
                        <span class="side-tag" [class.buy-tag]="ord.side === 'BUY'" [class.sell-tag]="ord.side === 'SELL'">{{ ord.side }}</span>
                      </td>
                      <td>{{ ord.orderType }}</td>
                      <td>{{ ord.quantity }}</td>
                      <td>{{ ord.currency === 'INR' ? '₹' : '$' }}{{ ord.price | number:'1.2-2' }}</td>
                      <td>
                        <span class="status-pill" [class.st-complete]="ord.status === 'COMPLETE'" [class.st-cancelled]="ord.status === 'CANCELLED'">
                          {{ ord.status }}
                        </span>
                      </td>
                      <td><small>{{ ord.timestamp | date:'short' }}</small></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- TAB 5: RECONCILIATION AUDIT -->
        @if (activeTab() === 'RECONCILIATION') {
          <div class="reconciliation-tab">
            <div class="tab-intro">
              <h3>Portfolio Reconciliation & Discrepancy Audit</h3>
              <p>Auditing local Aurum portfolio positions against authoritative broker records.</p>
            </div>
            
            @if (brokerSyncService.reconciliationReport(); as report) {
              <div class="reconcile-status-box" [class.box-ok]="report.status === 'RECONCILED'">
                <div class="box-icon">{{ report.status === 'RECONCILED' ? '✅' : '⚠️' }}</div>
                <div class="box-meta">
                  <h4>Status: {{ report.status }}</h4>
                  <p>Matched: {{ report.matchedCount }} assets | Discrepancies: {{ report.mismatchCount }}</p>
                </div>
              </div>

              <div class="table-scroll-wrap">
                <table class="holdings-preview-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Aurum Qty</th>
                      <th>Broker Qty</th>
                      <th>Aurum Avg</th>
                      <th>Broker Avg</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of report.details; track item.symbol) {
                      <tr>
                        <td><strong>{{ item.symbol }}</strong></td>
                        <td>{{ item.aurumQuantity }}</td>
                        <td>{{ item.brokerQuantity }}</td>
                        <td>₹{{ item.aurumAvgPrice | number:'1.2-2' }}</td>
                        <td>₹{{ item.brokerAvgPrice | number:'1.2-2' }}</td>
                        <td>
                          <span class="status-pill st-complete">{{ item.status }}</span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }

      </div>
    </div>
  `,
  styleUrls: ['./broker-sync-modal.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrokerSyncModalComponent implements OnInit {
  isEmbedded = input<boolean>(false);
  @HostBinding('class.embedded-mode') get embedded() { return this.isEmbedded(); }

  protected readonly brokerSyncService = inject(BrokerSyncService);

  readonly closeModal = output<void>();
  readonly holdingsImported = output<number>();

  readonly activeTab = signal<'CONNECT' | 'BALANCES' | 'POSITIONS' | 'ORDERS' | 'RECONCILIATION'>('CONNECT');
  readonly selectedBroker = signal<'zerodha' | 'webull'>('zerodha');
  readonly syncStep = signal<'SELECT_BROKER' | 'PREVIEW_HOLDINGS'>('SELECT_BROKER');
  readonly isConnecting = signal<boolean>(false);
  readonly isImporting = signal<boolean>(false);
  readonly errorMessage = signal<string>('');

  isSandboxMode = true;

  // Zerodha Form
  apiKey = '';
  apiSecret = '';
  requestToken = '';

  // Webull Form
  appKey = '';
  appSecret = '';
  accountId = '';

  readonly holdingsList = signal<BrokerHolding[]>([]);

  readonly selectedCount = computed(() => {
    return this.holdingsList().filter((h) => h.selected).length;
  });

  readonly allSelected = computed(() => {
    const list = this.holdingsList();
    return list.length > 0 && list.every((h) => h.selected);
  });

  ngOnInit(): void {
    this.brokerSyncService.loadPhase2BrokerData();
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.isEmbedded()) return;
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal.emit();
    }
  }

  async handleConnectAndFetch(): Promise<void> {
    this.errorMessage.set('');
    this.isConnecting.set(true);

    try {
      let holdings: BrokerHolding[] = [];
      if (this.selectedBroker() === 'zerodha') {
        holdings = await this.brokerSyncService.connectZerodha({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret,
          requestToken: this.requestToken,
          isSandbox: this.isSandboxMode,
        });
      } else {
        holdings = await this.brokerSyncService.connectWebull({
          appKey: this.appKey,
          appSecret: this.appSecret,
          accountId: this.accountId,
          isSandbox: this.isSandboxMode,
        });
      }

      this.holdingsList.set(holdings);
      this.syncStep.set('PREVIEW_HOLDINGS');
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Connection failed. Please check credentials.');
    } finally {
      this.isConnecting.set(false);
    }
  }

  toggleHolding(h: BrokerHolding): void {
    h.selected = !h.selected;
    this.holdingsList.set([...this.holdingsList()]);
  }

  toggleSelectAll(): void {
    const nextState = !this.allSelected();
    const updated = this.holdingsList().map((h) => ({ ...h, selected: nextState }));
    this.holdingsList.set(updated);
  }

  async handleImportConfirmed(): Promise<void> {
    this.isImporting.set(true);
    try {
      const count = await this.brokerSyncService.importSelectedHoldings(this.holdingsList());
      this.holdingsImported.emit(count);
      this.closeModal.emit();
    } finally {
      this.isImporting.set(false);
    }
  }
}
