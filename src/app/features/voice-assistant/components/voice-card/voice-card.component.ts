import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActionCardData } from '../../../../core/services/voice/command-orchestrator.service';

@Component({
  selector: 'aurum-voice-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (card) {
      <div class="voice-card" [attr.data-type]="card.type">
        <!-- Top Row: Card Title & Close -->
        <div class="card-header">
          <div class="card-title-wrap">
            <span class="card-icon">
              @switch (card.type) {
                @case ('STOCK_QUOTE') { 📈 }
                @case ('ORDER_PREVIEW') { ⚡ }
                @case ('ALERT_CREATED') { 🔔 }
                @case ('PORTFOLIO_PULSE') { 💼 }
                @case ('RESEARCH_EVIDENCE') { 🧠 }
                @case ('AUTOMATION_STATUS') { 🤖 }
                @default { ℹ️ }
              }
            </span>
            <span class="card-title">{{ card.title }}</span>
          </div>
          <button type="button" class="btn-dismiss" (click)="dismiss.emit()" title="Dismiss">×</button>
        </div>

        <!-- Metric Highlight (Price / Change) -->
        @if (card.price !== undefined) {
          <div class="metric-row">
            <span class="metric-price">
              {{ card.currency === 'INR' ? '₹' : '$' }}{{ card.price | number:'1.2-2' }}
            </span>
            @if (card.changePct !== undefined) {
              <span class="metric-change" [class.positive]="card.changePct >= 0" [class.negative]="card.changePct < 0">
                {{ card.changePct >= 0 ? '+' : '' }}{{ card.changePct | number:'1.2-2' }}%
              </span>
            }
          </div>
        }

        <!-- Summary text -->
        <p class="summary-text">{{ card.summaryText }}</p>

        <!-- Risk / Confirmation Badge for Orders -->
        @if (card.type === 'ORDER_PREVIEW') {
          <div class="risk-badge-box">
            <span class="risk-pill">🛡️ Pre-Trade Risk Checks Passed</span>
            <span class="risk-note">Explicit user confirmation required before order dispatch.</span>
          </div>
        }

        <!-- Action Buttons -->
        @if (card.actions && card.actions.length > 0) {
          <div class="card-actions">
            @for (act of card.actions; track act.actionKey) {
              <button
                type="button"
                class="card-btn"
                [class.btn-primary]="act.primary"
                [class.btn-secondary]="!act.primary"
                (click)="actionClick.emit({ actionKey: act.actionKey, card: card })"
              >
                {{ act.label }}
              </button>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .voice-card {
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(13, 148, 136, 0.4);
      border-radius: 12px;
      padding: 14px 16px;
      margin-top: 10px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 15px rgba(13, 148, 136, 0.2);
      backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
      gap: 10px;
      animation: card-appear 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    [data-type='ORDER_PREVIEW'] {
      border-color: rgba(245, 158, 11, 0.6);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 18px rgba(245, 158, 11, 0.25);
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .card-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card-icon {
      font-size: 15px;
    }

    .card-title {
      font-size: 13px;
      font-weight: 600;
      color: #E2E8F0;
      letter-spacing: 0.2px;
    }

    .btn-dismiss {
      background: none;
      border: none;
      color: #94A3B8;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      padding: 0 4px;
      transition: color 0.2s;
      &:hover { color: #F1F5F9; }
    }

    .metric-row {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }

    .metric-price {
      font-size: 20px;
      font-weight: 700;
      color: #F8FAFC;
      letter-spacing: -0.5px;
    }

    .metric-change {
      font-size: 13px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      &.positive { color: #34D399; background: rgba(52, 211, 153, 0.15); }
      &.negative { color: #F87171; background: rgba(248, 113, 113, 0.15); }
    }

    .summary-text {
      font-size: 12px;
      line-height: 1.5;
      color: #CBD5E1;
      margin: 0;
    }

    .risk-badge-box {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 6px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .risk-pill {
      font-size: 11px;
      font-weight: 700;
      color: #FBBF24;
    }

    .risk-note {
      font-size: 10px;
      color: #D1D5DB;
    }

    .card-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }

    .card-btn {
      flex: 1;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-primary {
      background: #0D9488;
      color: white;
      &:hover { background: #0F766E; }
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #E2E8F0;
      &:hover { background: rgba(255, 255, 255, 0.15); }
    }

    @keyframes card-appear {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class VoiceCardComponent {
  @Input() card: ActionCardData | null = null;
  @Output() dismiss = new EventEmitter<void>();
  @Output() actionClick = new EventEmitter<{ actionKey: string; card: ActionCardData }>();
}
