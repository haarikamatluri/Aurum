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
import { TradingService, OrderPreview } from '../../../core/services/trading.service';

@Component({
  selector: 'app-order-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrl: './order-modal.scss',
  template: `
    <div class="modal-backdrop" (click)="onBackdropClick($event)">
      <div class="modal-container">
        
        <!-- Header -->
        <div class="modal-header">
          <div class="header-titles">
            <div class="badge-tag">Phase 3 Production Trading Engine</div>
            <h2>Order Ticket & Risk Execution</h2>
            <p>Institutional pre-trade risk engine, idempotency guards, and manual order confirmation.</p>
          </div>
          <button type="button" class="close-btn" (click)="closeModal.emit()" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Emergency Kill Switch Bar -->
        <div class="kill-switch-bar" [class.active]="tradingService.killSwitchActive()">
          <div class="ks-text">
            <strong>{{ tradingService.killSwitchActive() ? '🚨 EMERGENCY KILL SWITCH ACTIVE' : '🛡️ Emergency Risk Kill Switch' }}</strong>
            <small>{{ tradingService.killSwitchActive() ? tradingService.killSwitchReason() : 'All pre-trade risk rules and order validation limits are active.' }}</small>
          </div>
          <button
            type="button"
            class="ks-toggle-btn"
            [class.btn-danger]="!tradingService.killSwitchActive()"
            [class.btn-success]="tradingService.killSwitchActive()"
            (click)="handleToggleKillSwitch()"
          >
            {{ tradingService.killSwitchActive() ? 'Resume Trading' : 'Halt Trading (Kill Switch)' }}
          </button>
        </div>

        <!-- Subnav Tabs -->
        <div class="modal-subnav">
          <button type="button" class="subnav-tab" [class.active]="activeTab() === 'TICKET'" (click)="activeTab.set('TICKET')">
            📝 Order Ticket
          </button>
          <button type="button" class="subnav-tab" [class.active]="activeTab() === 'LIVE_ORDERS'" (click)="activeTab.set('LIVE_ORDERS')">
            📋 Executed Orders ({{ tradingService.orders().length }})
          </button>
          <button type="button" class="subnav-tab" [class.active]="activeTab() === 'AUDIT'" (click)="activeTab.set('AUDIT')">
            📜 Audit Logs
          </button>
        </div>

        <!-- TAB 1: ORDER TICKET FORM / CONFIRMATION -->
        @if (activeTab() === 'TICKET') {
          @if (!previewData()) {
            <div class="ticket-form">
              
              <!-- Side Selector -->
              <div class="side-selector">
                <button
                  type="button"
                  class="side-btn buy-btn"
                  [class.active]="side() === 'BUY'"
                  (click)="side.set('BUY')"
                >
                  BUY
                </button>
                <button
                  type="button"
                  class="side-btn sell-btn"
                  [class.active]="side() === 'SELL'"
                  (click)="side.set('SELL')"
                >
                  SELL
                </button>
              </div>

              <!-- Ticket Inputs -->
              <div class="ticket-grid">
                <div class="form-group">
                  <label>Ticker Symbol</label>
                  <input type="text" [(ngModel)]="symbol" placeholder="e.g. TCS, NVDA, RELIANCE" />
                </div>

                <div class="form-group">
                  <label>Quantity (Shares)</label>
                  <input type="number" [(ngModel)]="quantity" min="1" />
                </div>

                <div class="form-group">
                  <label>Order Type</label>
                  <select [(ngModel)]="orderType">
                    <option value="MARKET">MARKET</option>
                    <option value="LIMIT">LIMIT</option>
                  </select>
                </div>

                @if (orderType === 'LIMIT') {
                  <div class="form-group">
                    <label>Limit Price</label>
                    <input type="number" [(ngModel)]="price" placeholder="Limit price per share" />
                  </div>
                }
              </div>

              @if (errorMessage()) {
                <div class="error-banner">{{ errorMessage() }}</div>
              }

              <div class="actions-row">
                <button type="button" class="btn btn-secondary" (click)="closeModal.emit()">Cancel</button>
                <button
                  type="button"
                  class="btn btn-primary"
                  [disabled]="isGeneratingPreview() || tradingService.killSwitchActive()"
                  (click)="handleGeneratePreview()"
                >
                  @if (isGeneratingPreview()) {
                    <span class="spinner"></span> Validating...
                  } @else {
                    Review & Preview Order Ticket &rarr;
                  }
                </button>
              </div>
            </div>
          } @else {
            <!-- Order Ticket Review & Explicit Confirmation Screen -->
            <div class="ticket-review">
              <div class="review-card" [class.card-buy]="previewData()!.side === 'BUY'" [class.card-sell]="previewData()!.side === 'SELL'">
                <div class="rc-header">
                  <span class="side-pill" [class.pill-buy]="previewData()!.side === 'BUY'" [class.pill-sell]="previewData()!.side === 'SELL'">
                    {{ previewData()!.side }}
                  </span>
                  <h3>{{ previewData()!.quantity }} shares of {{ previewData()!.symbol }}</h3>
                  <span class="exch-pill">{{ previewData()!.exchange }}</span>
                </div>

                <div class="rc-body">
                  <div class="rc-item">
                    <span class="lbl">Order Type:</span>
                    <span class="val"><strong>{{ previewData()!.orderType }}</strong></span>
                  </div>
                  <div class="rc-item">
                    <span class="lbl">Estimated Price:</span>
                    <span class="val">{{ previewData()!.currency === 'INR' ? '₹' : '$' }}{{ previewData()!.estimatedPrice | number:'1.2-2' }}</span>
                  </div>
                  <div class="rc-item">
                    <span class="lbl">Estimated Value:</span>
                    <span class="val">{{ previewData()!.currency === 'INR' ? '₹' : '$' }}{{ previewData()!.estimatedValue | number:'1.2-2' }}</span>
                  </div>
                  <div class="rc-item">
                    <span class="lbl">Estimated Fees (0.1%):</span>
                    <span class="val">{{ previewData()!.currency === 'INR' ? '₹' : '$' }}{{ previewData()!.estimatedFees | number:'1.2-2' }}</span>
                  </div>
                  <div class="rc-item total-row">
                    <span class="lbl">Total Estimated Cost:</span>
                    <span class="val highlight">{{ previewData()!.currency === 'INR' ? '₹' : '$' }}{{ previewData()!.totalCost | number:'1.2-2' }}</span>
                  </div>
                </div>

                <!-- Pre-trade Risk Check Decision Box -->
                <div class="risk-decision-box" [class.risk-passed]="previewData()!.riskCheck.passed" [class.risk-failed]="!previewData()!.riskCheck.passed">
                  <strong>Risk Engine Status: {{ previewData()!.riskCheck.code }}</strong>
                  <p>{{ previewData()!.riskCheck.reason }}</p>
                </div>
              </div>

              @if (errorMessage()) {
                <div class="error-banner">{{ errorMessage() }}</div>
              }

              <div class="review-actions">
                <button type="button" class="btn btn-secondary" (click)="previewData.set(null)">&larr; Edit Order</button>
                <button
                  type="button"
                  class="btn confirm-exec-btn"
                  [class.btn-buy]="previewData()!.side === 'BUY'"
                  [class.btn-sell]="previewData()!.side === 'SELL'"
                  [disabled]="!previewData()!.riskCheck.passed || isExecuting() || tradingService.killSwitchActive()"
                  (click)="handleConfirmExecution()"
                >
                  @if (isExecuting()) {
                    <span class="spinner"></span> Executing Order...
                  } @else {
                    Confirm & Execute {{ previewData()!.side }} {{ previewData()!.quantity }} {{ previewData()!.symbol }}
                  }
                </button>
              </div>
            </div>
          }
        }

        <!-- TAB 2: LIVE EXECUTED ORDERS -->
        @if (activeTab() === 'LIVE_ORDERS') {
          <div class="executed-orders-tab">
            <div class="tab-intro">
              <h3>Executed Order State Machine Logs</h3>
              <p>Tracking order state transitions (FILLED, CANCELLED, REJECTED) with execution timestamps.</p>
            </div>
            <div class="table-scroll-wrap">
              <table class="holdings-preview-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Time</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  @for (ord of tradingService.orders(); track ord.orderId) {
                    <tr>
                      <td><code>{{ ord.orderId }}</code></td>
                      <td><strong>{{ ord.symbol }}</strong></td>
                      <td>
                        <span class="side-tag" [class.buy-tag]="ord.side === 'BUY'" [class.sell-tag]="ord.side === 'SELL'">{{ ord.side }}</span>
                      </td>
                      <td>{{ ord.quantity }}</td>
                      <td>{{ ord.currency === 'INR' ? '₹' : '$' }}{{ ord.price | number:'1.2-2' }}</td>
                      <td>
                        <span class="status-pill" [class.st-complete]="ord.status === 'FILLED'" [class.st-cancelled]="ord.status === 'CANCELLED'">
                          {{ ord.status }}
                        </span>
                      </td>
                      <td><small>{{ ord.executedAt | date:'shortTime' }}</small></td>
                      <td>
                        @if (ord.status === 'OPEN' || ord.status === 'SUBMITTED') {
                          <button type="button" class="btn-sm-danger" (click)="handleCancelOrder(ord.orderId)">Cancel</button>
                        } @else {
                          <span class="muted-text">—</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- TAB 3: AUDIT TRAIL LOGS -->
        @if (activeTab() === 'AUDIT') {
          <div class="audit-tab">
            <div class="tab-intro">
              <h3>Production Audit Log</h3>
              <p>Immutable event log recording pre-trade risk evaluation, execution timestamps, and user actions.</p>
            </div>
            <div class="table-scroll-wrap">
              <table class="holdings-preview-table">
                <thead>
                  <tr>
                    <th>Audit ID</th>
                    <th>Event Type</th>
                    <th>User</th>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  @for (log of tradingService.auditLogs(); track log.id) {
                    <tr>
                      <td><code>{{ log.id.slice(0, 12) }}</code></td>
                      <td><span class="audit-event-pill">{{ log.eventType }}</span></td>
                      <td><small>{{ log.userId }}</small></td>
                      <td><strong>{{ log.symbol || 'SYSTEM' }}</strong></td>
                      <td>{{ log.side || '—' }}</td>
                      <td><span class="status-pill st-complete">{{ log.status || 'OK' }}</span></td>
                      <td><small>{{ log.timestamp | date:'mediumTime' }}</small></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderModalComponent implements OnInit {
  isEmbedded = input<boolean>(false);
  @HostBinding('class.embedded-mode') get embedded() { return this.isEmbedded(); }

  protected readonly tradingService = inject(TradingService);

  readonly closeModal = output<void>();
  readonly orderExecuted = output<void>();

  // Optional preset symbol & side from parent button
  readonly initialSymbol = input<string>('TCS');
  readonly initialSide = input<'BUY' | 'SELL'>('BUY');

  readonly activeTab = signal<'TICKET' | 'LIVE_ORDERS' | 'AUDIT'>('TICKET');
  readonly side = signal<'BUY' | 'SELL'>('BUY');
  readonly isGeneratingPreview = signal<boolean>(false);
  readonly isExecuting = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  readonly previewData = signal<OrderPreview | null>(null);

  symbol = 'TCS';
  quantity = 10;
  orderType: 'MARKET' | 'LIMIT' = 'MARKET';
  price?: number;

  ngOnInit(): void {
    if (this.initialSymbol()) this.symbol = this.initialSymbol().toUpperCase();
    if (this.initialSide()) this.side.set(this.initialSide());
    this.tradingService.checkKillSwitch();
    this.tradingService.loadOrders();
    this.tradingService.loadAuditLogs();
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.isEmbedded()) return;
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal.emit();
    }
  }

  async handleToggleKillSwitch(): Promise<void> {
    const currentState = this.tradingService.killSwitchActive();
    await this.tradingService.toggleKillSwitch(!currentState, !currentState ? 'Manual Emergency Halt' : 'Resumed by User');
  }

  async handleGeneratePreview(): Promise<void> {
    this.errorMessage.set('');
    this.isGeneratingPreview.set(true);

    try {
      const preview = await this.tradingService.previewOrder({
        symbol: this.symbol,
        side: this.side(),
        quantity: this.quantity,
        orderType: this.orderType,
        price: this.orderType === 'LIMIT' ? this.price : undefined
      });
      this.previewData.set(preview);
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Failed to generate order preview.');
    } finally {
      this.isGeneratingPreview.set(false);
    }
  }

  async handleConfirmExecution(): Promise<void> {
    const p = this.previewData();
    if (!p) return;
    this.errorMessage.set('');
    this.isExecuting.set(true);

    try {
      await this.tradingService.executeConfirmedOrder(p);
      this.orderExecuted.emit();
      this.activeTab.set('LIVE_ORDERS');
      this.previewData.set(null);
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Order execution rejected.');
    } finally {
      this.isExecuting.set(false);
    }
  }

  async handleCancelOrder(orderId: string): Promise<void> {
    try {
      await this.tradingService.cancelOrder(orderId);
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Failed to cancel order.');
    }
  }
}
