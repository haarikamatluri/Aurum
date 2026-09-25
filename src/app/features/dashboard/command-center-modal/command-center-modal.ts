import { Component, ChangeDetectionStrategy, output, signal, inject, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { OrderModalComponent } from '../order-modal/order-modal';
import { AddHoldingRequest } from '../../../core/models/portfolio.model';
import { PortfolioService } from '../../../core/services/portfolio.service';
import { TradingService } from '../../../core/services/trading.service';
import { AutomationService } from '../../../core/services/automation.service';
import { BrokerSyncService } from '../../../core/services/broker-sync.service';
import { BrokerSyncModalComponent } from '../broker-sync-modal/broker-sync-modal';

type CommandView = 'DASHBOARD' | 'BUY' | 'SELL' | 'BROKER';

@Component({
  selector: 'app-command-center-modal',
  standalone: true,
  imports: [
    CommonModule, 
    DecimalPipe,
    OrderModalComponent,
    BrokerSyncModalComponent
  ],
  styleUrl: './command-center-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cmd-overlay" (click)="close.emit()">
      <div class="cmd-workspace" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="cmd-title">
        
        <header class="cmd-header">
          <div class="header-titles">
            <h2 id="cmd-title">AURUM COMMAND CENTER</h2>
            <p>Portfolio | Trading | Strategy | Broker | Data</p>
          </div>
          <button class="close-btn" (click)="close.emit()" aria-label="Close Command Center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </header>

        @if (activeView() === 'DASHBOARD') {
          <div class="cmd-dashboard">
            <!-- Quick Actions -->
            <section class="quick-actions-bar">
              <span class="qa-label">Quick Actions:</span>
              <button class="qa-btn buy-btn" (click)="activeView.set('BUY')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                + Buy Stock
              </button>
              <button class="qa-btn sell-btn" (click)="activeView.set('SELL')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                - Sell Stock
              </button>
              <button class="qa-btn" (click)="notifyNotImplemented('Analyze Stock')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Analyze Stock
              </button>
              <button class="qa-btn" (click)="notifyNotImplemented('Ask Aurum')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                Ask Aurum
              </button>
            </section>

            <!-- Dashboard Grid -->
            <div class="cmd-grid">
              
              <!-- Portfolio Overview -->
              <div class="cmd-card">
                <h3>Portfolio Snapshot</h3>
                <div class="stat-row">
                  <span>Total Value</span>
                  <strong>{{ portfolioService.totalValue() | currency }}</strong>
                </div>
                <div class="stat-row">
                  <span>Today's P&L</span>
                  <strong [class.positive]="portfolioService.todayPnL() >= 0" [class.negative]="portfolioService.todayPnL() < 0">
                    {{ portfolioService.todayPnL() >= 0 ? '+' : '' }}{{ portfolioService.todayPnL() | currency }}
                  </strong>
                </div>
                <div class="stat-row">
                  <span>Cash & Buying Power</span>
                  <strong>{{ portfolioService.cash() | currency }}</strong>
                </div>
                <div class="stat-row">
                  <span>Open Positions</span>
                  <strong>{{ portfolioService.holdings().length }}</strong>
                </div>
              </div>

              <!-- Trading Engine -->
              <div class="cmd-card">
                <h3>Trading Engine</h3>
                <div class="stat-row">
                  <span>Pending Orders</span>
                  <strong>0</strong>
                </div>
                <div class="stat-row">
                  <span>Executed Orders</span>
                  <strong>{{ tradingService.orders().length }}</strong>
                </div>
                <div class="stat-row">
                  <span>Kill Switch Status</span>
                  <strong [class.negative]="tradingService.killSwitchActive()" [class.positive]="!tradingService.killSwitchActive()">
                    {{ tradingService.killSwitchActive() ? 'HALTED' : 'READY' }}
                  </strong>
                </div>
                <button class="card-action-btn" (click)="tradingService.toggleKillSwitch()">
                  {{ tradingService.killSwitchActive() ? 'Resume Trading' : 'Halt Trading' }}
                </button>
              </div>

              <!-- Strategy & Automation -->
              <div class="cmd-card">
                <h3>Strategy & Automation</h3>
                <div class="stat-row">
                  <span>Automation Engine</span>
                  <strong class="positive">ONLINE</strong>
                </div>
                <div class="stat-row">
                  <span>Active Strategies</span>
                  <strong>{{ automationService.strategies().length }}</strong>
                </div>
                <div class="stat-row">
                  <span>Phase 4 Connection</span>
                  <strong class="positive">CONNECTED</strong>
                </div>
                <button class="card-action-btn" (click)="notifyNotImplemented('Open Automation settings')">Manage Automations</button>
              </div>

              <!-- Broker Connectivity -->
              <div class="cmd-card">
                <h3>Broker Connectivity</h3>
                <div class="stat-row">
                  <span>Broker Status</span>
                  <strong [class.positive]="brokerSync.status().isConnected" [class.neutral]="!brokerSync.status().isConnected">
                    {{ brokerSync.status().isConnected ? 'SYNCED' : 'DISCONNECTED' }}
                  </strong>
                </div>
                <div class="stat-row">
                  <span>Linked Accounts</span>
                  <strong>{{ brokerSync.status().isConnected ? 1 : 0 }}</strong>
                </div>
                <div class="stat-row">
                  <span>Last Sync</span>
                  <strong>{{ brokerSync.status().lastSyncTime | date:'shortTime' }}</strong>
                </div>
                <button class="card-action-btn" (click)="activeView.set('BROKER')">Sync Brokers</button>
              </div>

            </div>
          </div>
        } @else if (activeView() === 'BUY' || activeView() === 'SELL') {
          <!-- Order Panel View (Buy or Sell) -->
          <div class="order-view-container">
            <button class="back-btn" (click)="activeView.set('DASHBOARD')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
              Back to Command Center
            </button>
            <app-order-modal [initialSide]="activeView() === 'BUY' ? 'BUY' : 'SELL'" [isEmbedded]="true" (closeModal)="activeView.set('DASHBOARD')"></app-order-modal>
          </div>
        } @else if (activeView() === 'BROKER') {
          <!-- Broker Sync Panel View -->
          <div class="order-view-container">
            <button class="back-btn" (click)="activeView.set('DASHBOARD')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
              Back to Command Center
            </button>
            <app-broker-sync-modal [isEmbedded]="true" (closeModal)="activeView.set('DASHBOARD')" (holdingsImported)="brokerHoldingsImported.emit($event)"></app-broker-sync-modal>
          </div>
        }
      </div>
    </div>
  `
})
export class CommandCenterModalComponent {
  close = output<void>();
  stockAdded = output<AddHoldingRequest>();
  stocksImported = output<{ count: number }>();
  brokerHoldingsImported = output<number>();
  
  portfolioService = inject(PortfolioService);
  tradingService = inject(TradingService);
  automationService = inject(AutomationService);
  brokerSync = inject(BrokerSyncService);

  activeView = signal<CommandView>('DASHBOARD');

  notifyNotImplemented(feature: string) {
    alert(`${feature} is not available in the current phase.`);
  }
}
