import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VoicePreferences } from '../../../../core/services/voice-assistant.service';

@Component({
  selector: 'aurum-voice-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="settings-modal-backdrop" (click)="close.emit()">
      <div class="settings-panel" (click)="$event.stopPropagation()">
        <div class="settings-header">
          <div class="header-title">
            <span class="gear-icon">⚙️</span>
            <h3>Voice Operating Settings</h3>
          </div>
          <button type="button" class="btn-close" (click)="close.emit()">×</button>
        </div>

        <div class="settings-body">
          <!-- Speech Rate -->
          <div class="setting-item">
            <label class="setting-label">Speech Rate (Speed)</label>
            <div class="rate-selector">
              <button
                type="button"
                class="rate-btn"
                [class.active]="localPrefs.speechRate === 0.9"
                (click)="setRate(0.9)"
              >
                0.9x
              </button>
              <button
                type="button"
                class="rate-btn"
                [class.active]="localPrefs.speechRate === 1.05"
                (click)="setRate(1.05)"
              >
                1.0x (Optimal)
              </button>
              <button
                type="button"
                class="rate-btn"
                [class.active]="localPrefs.speechRate === 1.25"
                (click)="setRate(1.25)"
              >
                1.25x (Fast)
              </button>
            </div>
          </div>

          <!-- Auto Speak -->
          <div class="setting-item-toggle">
            <div class="toggle-text">
              <span class="toggle-title">Auto-Speak Responses</span>
              <span class="toggle-desc">Speaks concise answers aloud immediately</span>
            </div>
            <input
              type="checkbox"
              [(ngModel)]="localPrefs.autoPlay"
              (change)="save()"
              class="toggle-checkbox"
            />
          </div>

          <!-- Wake Mode -->
          <div class="setting-item-toggle">
            <div class="toggle-text">
              <span class="toggle-title">Wake Phrase ("Hey Aurum")</span>
              <span class="toggle-desc">Listen for speech trigger in active sessions</span>
            </div>
            <input
              type="checkbox"
              [(ngModel)]="localPrefs.wakeModeEnabled"
              (change)="save()"
              class="toggle-checkbox"
            />
          </div>

          <!-- Hotkey Notice -->
          <div class="hotkey-box">
            <span class="hotkey-label">Keyboard Operating Shortcut</span>
            <div class="hotkey-badge">
              <code>Ctrl</code> + <code>Space</code> to activate / finish speaking
            </div>
            <div class="hotkey-badge">
              <code>Esc</code> to immediately halt speech & dismiss
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fade-in 0.2s ease;
    }

    .settings-panel {
      width: 360px;
      background: #0F172A;
      border: 1px solid rgba(13, 148, 136, 0.4);
      border-radius: 14px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(13, 148, 136, 0.25);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .settings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(15, 23, 42, 0.8);
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #F1F5F9;
      }
    }

    .btn-close {
      background: none;
      border: none;
      color: #94A3B8;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      &:hover { color: white; }
    }

    .settings-body {
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .setting-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .setting-label {
      font-size: 12px;
      color: #94A3B8;
      font-weight: 500;
    }

    .rate-selector {
      display: flex;
      gap: 8px;
    }

    .rate-btn {
      flex: 1;
      padding: 6px 10px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      color: #CBD5E1;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
      &.active {
        background: #0D9488;
        border-color: #14B8A6;
        color: white;
        font-weight: 600;
      }
    }

    .setting-item-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .toggle-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .toggle-title {
      font-size: 13px;
      font-weight: 500;
      color: #E2E8F0;
    }

    .toggle-desc {
      font-size: 11px;
      color: #94A3B8;
    }

    .toggle-checkbox {
      width: 18px;
      height: 18px;
      accent-color: #0D9488;
      cursor: pointer;
    }

    .hotkey-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .hotkey-label {
      font-size: 11px;
      font-weight: 600;
      color: #38BDF8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .hotkey-badge {
      font-size: 11px;
      color: #CBD5E1;
      code {
        background: rgba(255, 255, 255, 0.1);
        padding: 1px 5px;
        border-radius: 4px;
        font-family: inherit;
        font-weight: 600;
        color: #F8FAFC;
      }
    }

    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `]
})
export class VoiceSettingsComponent implements OnInit {
  @Input() preferences!: VoicePreferences;
  @Output() close = new EventEmitter<void>();
  @Output() preferencesChanged = new EventEmitter<Partial<VoicePreferences>>();

  localPrefs: VoicePreferences = {
    speechRate: 1.05,
    autoPlay: true,
    showTranscript: true,
    pushToTalk: false,
    wakeModeEnabled: false
  };

  ngOnInit() {
    if (this.preferences) {
      this.localPrefs = { ...this.preferences };
    }
  }

  setRate(rate: number) {
    this.localPrefs.speechRate = rate;
    this.save();
  }

  save() {
    this.preferencesChanged.emit(this.localPrefs);
  }
}
