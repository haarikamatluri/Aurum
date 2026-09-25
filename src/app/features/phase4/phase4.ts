import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-phase4',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="phase4-workspace">
      <header class="status-bar">
        <div class="brand">AURUM PHASE 4</div>
        <div class="status-indicators">
          <div class="status-pill" [class.active]="marketHealthy()">
            <span class="dot"></span> Market Data
          </div>
          <div class="status-pill" [class.active]="mlHealthy()">
            <span class="dot"></span> ML Engine
          </div>
          <div class="status-pill" [class.active]="strategyHealthy()">
            <span class="dot"></span> Strategy
          </div>
          <div class="status-pill" [class.active]="riskHealthy()">
            <span class="dot"></span> Risk
          </div>
          <div class="status-pill" [class.active]="paperHealthy()">
            <span class="dot"></span> Paper
          </div>
          <div class="status-pill" [class.active]="autoHealthy()">
            <span class="dot"></span> Automation
          </div>
          <div class="status-pill" [class.active]="askAurumHealthy()">
            <span class="dot"></span> Ask Aurum
          </div>
        </div>
      </header>
      <div class="workspace-grid">
        <div class="main-content">
          <h1>Phase 4 ML + Strategy (Under Construction)</h1>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .phase4-workspace { padding: 20px; color: white; }
    .status-bar { display: flex; gap: 15px; margin-bottom: 20px; align-items: center; }
    .brand { font-weight: bold; margin-right: 20px; }
    .status-pill { display: flex; align-items: center; gap: 5px; opacity: 0.5; font-size: 12px; }
    .status-pill.active { opacity: 1; color: #4ade80; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Phase4Page implements OnInit {
  marketHealthy = signal(true);
  mlHealthy = signal(true);
  strategyHealthy = signal(true);
  riskHealthy = signal(true);
  paperHealthy = signal(true);
  autoHealthy = signal(true);
  askAurumHealthy = signal(true);
  selectedSymbol = signal<string | null>('TCS');
  ngOnInit() {}
}
