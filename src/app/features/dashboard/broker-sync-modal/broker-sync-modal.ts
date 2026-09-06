import {
  Component,
  ChangeDetectionStrategy,
  output,
  inject,
  signal,
  computed,
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
            <div class="badge-tag">Institutional Integration</div>
            <h2>Direct Broker Portfolio Sync</h2>
            <p>Connect your verified demat/brokerage account to import holdings directly.</p>
          </div>
          <button type="button" class="close-btn" (click)="closeModal.emit()" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Broker Selector Tabs -->
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
      </div>
    </div>
  `,
  styleUrls: ['./broker-sync-modal.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrokerSyncModalComponent {
  private readonly brokerSyncService = inject(BrokerSyncService);

  readonly closeModal = output<void>();
  readonly holdingsImported = output<number>();

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

  onBackdropClick(event: MouseEvent): void {
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
