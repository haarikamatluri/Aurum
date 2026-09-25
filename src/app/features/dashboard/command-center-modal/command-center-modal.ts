import { Component, ChangeDetectionStrategy, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderModalComponent } from '../order-modal/order-modal';
import { AutomationModalComponent } from '../automation-modal/automation-modal';
import { BrokerSyncModalComponent } from '../broker-sync-modal/broker-sync-modal';
import { AddStockModal } from '../add-stock-modal/add-stock-modal';
import { ImportSheetsModal } from '../import-sheets-modal/import-sheets-modal';
import { AddHoldingRequest } from '../../../core/models/portfolio.model';

type CommandTab = 'ORDER' | 'AUTOMATION' | 'BROKER' | 'ADD' | 'IMPORT';

@Component({
  selector: 'app-command-center-modal',
  standalone: true,
  imports: [
    CommonModule, 
    OrderModalComponent, 
    AutomationModalComponent, 
    BrokerSyncModalComponent, 
    AddStockModal, 
    ImportSheetsModal
  ],
  styleUrl: './command-center-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cmd-overlay" (click)="close.emit()">
      <div class="cmd-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="cmd-title">
        
        <!-- Sidebar Navigation -->
        <aside class="cmd-sidebar">
          <div class="cmd-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            <span id="cmd-title">AURUM COMMAND</span>
          </div>

          <nav class="cmd-nav">
            <button class="nav-item" [class.active]="activeTab() === 'ORDER'" (click)="activeTab.set('ORDER')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <line x1="12" y1="2" x2="12" y2="22"/><line x1="17" y1="5" x2="22" y2="10"/><line x1="22" y1="10" x2="17" y2="15"/><line x1="7" y1="19" x2="2" y2="14"/><line x1="2" y1="14" x2="7" y2="9"/>
              </svg>
              <span>Trading Engine</span>
            </button>
            
            <button class="nav-item" [class.active]="activeTab() === 'AUTOMATION'" (click)="activeTab.set('AUTOMATION')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
              </svg>
              <span>Strategy Automation</span>
            </button>
            
            <button class="nav-item" [class.active]="activeTab() === 'BROKER'" (click)="activeTab.set('BROKER')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span>Broker Sync</span>
            </button>
            
            <button class="nav-item" [class.active]="activeTab() === 'ADD'" (click)="activeTab.set('ADD')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              <span>Add Stock</span>
            </button>

            <button class="nav-item" [class.active]="activeTab() === 'IMPORT'" (click)="activeTab.set('IMPORT')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span>Bulk Import</span>
            </button>
          </nav>
        </aside>

        <!-- Main Content Area -->
        <main class="cmd-content">
          <button class="cmd-close-btn" (click)="close.emit()" aria-label="Close Command Center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <div class="cmd-scroll-area">
            @if (activeTab() === 'ORDER') {
              <app-order-modal [isEmbedded]="true" (close)="close.emit()"></app-order-modal>
            }
            @if (activeTab() === 'AUTOMATION') {
              <app-automation-modal [isEmbedded]="true" (close)="close.emit()"></app-automation-modal>
            }
            @if (activeTab() === 'BROKER') {
              <app-broker-sync-modal [isEmbedded]="true" (closeModal)="close.emit()" (holdingsImported)="brokerHoldingsImported.emit($event)"></app-broker-sync-modal>
            }
            @if (activeTab() === 'ADD') {
              <app-add-stock-modal [isEmbedded]="true" (close)="close.emit()" (added)="stockAdded.emit($event)"></app-add-stock-modal>
            }
            @if (activeTab() === 'IMPORT') {
              <app-import-sheets-modal [isEmbedded]="true" (close)="close.emit()" (imported)="stocksImported.emit($event)"></app-import-sheets-modal>
            }
          </div>
        </main>
      </div>
    </div>
  `
})
export class CommandCenterModalComponent {
  close = output<void>();
  stockAdded = output<AddHoldingRequest>();
  stocksImported = output<{ count: number }>();
  brokerHoldingsImported = output<number>();
  
  activeTab = signal<CommandTab>('ORDER');
}
