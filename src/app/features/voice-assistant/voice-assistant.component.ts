import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VoiceAssistantService } from '../../core/services/voice-assistant.service';
import {
  AurumVoiceOrbComponent,
  VoiceWaveformComponent,
  VoiceCardComponent,
  VoiceTimelineComponent,
  VoiceSettingsComponent
} from './components';

@Component({
  selector: 'aurum-voice-assistant',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AurumVoiceOrbComponent,
    VoiceWaveformComponent,
    VoiceCardComponent,
    VoiceTimelineComponent,
    VoiceSettingsComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="voice-operating-layer" [class.expanded]="isExpanded()" [class.listening]="state() === 'LISTENING'">
      
      <!-- COMPACT CAPSULE BAR (Default minimal floating controller) -->
      @if (!isExpanded()) {
        <div class="compact-capsule" (click)="toggleExpanded()">
          <aurum-voice-orb [state]="state()"></aurum-voice-orb>
          
          <div class="capsule-info">
            <span class="capsule-state">{{ stateLabel() }}</span>
            <span class="capsule-context">
              @if (liveTranscript()) {
                "{{ liveTranscript() }}"
              } @else {
                {{ contextSnapshot().symbol ? contextSnapshot().symbol + ' • ' : '' }}Ctrl+Space
              }
            </span>
          </div>

          <aurum-voice-waveform [state]="state()"></aurum-voice-waveform>

          <button
            type="button"
            class="capsule-mic-btn"
            [class.active]="state() === 'LISTENING'"
            (click)="$event.stopPropagation(); toggleListening()"
            [title]="state() === 'LISTENING' ? 'Finish Speaking' : 'Start Voice Input (Ctrl+Space)'"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="22"></line>
            </svg>
          </button>
        </div>
      }

      <!-- EXPANDED COMMAND DECK (Full Interactive Operating Layer) -->
      @if (isExpanded()) {
        <div class="command-deck">
          <!-- Deck Header -->
          <div class="deck-header">
            <div class="deck-title-wrap">
              <aurum-voice-orb [state]="state()"></aurum-voice-orb>
              <div class="title-meta">
                <span class="brand-title">Aurum Intelligence Core</span>
                <span class="brand-sub">OPERATING LAYER • {{ stateLabel() }}</span>
              </div>
            </div>

            <div class="deck-header-actions">
              <!-- Telemetry Latency Badge -->
              <span class="latency-badge" title="Perceived Voice-to-Action Latency">
                ⚡ {{ lastTelemetry()?.totalPerceivedLatencyMs || averageLatency() }}ms
              </span>

              <!-- Settings Button -->
              <button
                type="button"
                class="btn-icon"
                (click)="showSettings.set(true)"
                title="Voice Settings"
              >
                ⚙️
              </button>

              <!-- Minimize Deck -->
              <button
                type="button"
                class="btn-icon"
                (click)="toggleExpanded()"
                title="Minimize (Escape)"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Live Transcript Stream Area -->
          <div class="transcript-display">
            @if (liveTranscript()) {
              <div class="streaming-text">
                <span class="speech-quote">“</span>{{ liveTranscript() }}<span class="cursor-blink">|</span>
              </div>
            } @else {
              <div class="idle-prompt">
                Speak any financial command, e.g. <em>"Show TCS"</em>, <em>"Why is it moving?"</em>, <em>"Portfolio P&L"</em>, or <em>"Buy 2 TCS"</em>.
              </div>
            }
          </div>

          <!-- Waveform Bar -->
          <div class="deck-waveform-wrap">
            <aurum-voice-waveform [state]="state()"></aurum-voice-waveform>
          </div>

          <!-- Interactive Action Card -->
          <aurum-voice-card
            [card]="activeCard()"
            (dismiss)="voiceService.dismissActiveCard()"
            (actionClick)="handleCardAction($event)"
          ></aurum-voice-card>

          <!-- Timeline Audit Steps -->
          <aurum-voice-timeline [steps]="timeline()"></aurum-voice-timeline>

          <!-- Quick Suggestion Chips -->
          <div class="quick-chips">
            <button type="button" class="chip" (click)="runQuickCommand('Show TCS')">Show TCS</button>
            <button type="button" class="chip" (click)="runQuickCommand('Why is TCS moving today?')">Why is TCS moving?</button>
            <button type="button" class="chip" (click)="runQuickCommand('What\\'s my portfolio return?')">Portfolio Return</button>
            <button type="button" class="chip" (click)="runQuickCommand('What\\'s hurting my portfolio today?')">Biggest Loser</button>
            <button type="button" class="chip" (click)="runQuickCommand('Set alert for NVDA at 170')">Alert NVDA 170</button>
            <button type="button" class="chip" (click)="runQuickCommand('Buy 2 TCS')">Buy 2 TCS</button>
            <button type="button" class="chip chip-danger" (click)="runQuickCommand('Stop')">Stop</button>
          </div>

          <!-- Bottom Control & Text Input Bar -->
          <div class="deck-bottom-bar">
            <div class="input-wrap">
              <input
                type="text"
                [(ngModel)]="textQuery"
                placeholder="Type command or question..."
                (keyup.enter)="submitTextInput()"
              />
              <button type="button" class="btn-send" (click)="submitTextInput()" [disabled]="!textQuery.trim()">
                ↵
              </button>
            </div>

            <!-- Big Mic Action Button -->
            <button
              type="button"
              class="btn-deck-mic"
              [class.listening]="state() === 'LISTENING'"
              (click)="toggleListening()"
              [title]="state() === 'LISTENING' ? 'Stop Listening' : 'Speak (Ctrl+Space)'"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="22"></line>
              </svg>
            </button>
          </div>
        </div>
      }

      <!-- Settings Panel Modal -->
      @if (showSettings()) {
        <aurum-voice-settings
          [preferences]="voiceService.getPreferences()"
          (close)="showSettings.set(false)"
          (preferencesChanged)="handlePreferencesChanged($event)"
        ></aurum-voice-settings>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    /* COMPACT CAPSULE BAR */
    .compact-capsule {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(13, 148, 136, 0.4);
      border-radius: 40px;
      padding: 6px 10px 6px 6px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(13, 148, 136, 0.25);
      cursor: pointer;
      backdrop-filter: blur(12px);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        transform: translateY(-2px);
        border-color: #14B8A6;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 25px rgba(20, 184, 166, 0.35);
      }
    }

    .capsule-info {
      display: flex;
      flex-direction: column;
      max-width: 140px;
    }

    .capsule-state {
      font-size: 12px;
      font-weight: 600;
      color: #F1F5F9;
      line-height: 1.2;
    }

    .capsule-context {
      font-size: 10px;
      color: #94A3B8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .capsule-mic-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: rgba(13, 148, 136, 0.2);
      color: #2DD4BF;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: #0D9488;
        color: white;
      }

      &.active {
        background: #0284C7;
        color: white;
        box-shadow: 0 0 12px rgba(56, 189, 248, 0.7);
        animation: pulse-mic 1s infinite alternate;
      }
    }

    /* EXPANDED COMMAND DECK */
    .command-deck {
      width: 380px;
      max-height: 85vh;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(13, 148, 136, 0.5);
      border-radius: 16px;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.7), 0 0 30px rgba(13, 148, 136, 0.25);
      backdrop-filter: blur(16px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: deck-appear 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .deck-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(15, 23, 42, 0.85);
    }

    .deck-title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .title-meta {
      display: flex;
      flex-direction: column;
    }

    .brand-title {
      font-size: 13px;
      font-weight: 700;
      color: #F8FAFC;
      letter-spacing: 0.3px;
    }

    .brand-sub {
      font-size: 9px;
      font-weight: 600;
      color: #2DD4BF;
      letter-spacing: 0.6px;
    }

    .deck-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .latency-badge {
      font-size: 10px;
      font-weight: 700;
      color: #38BDF8;
      background: rgba(56, 189, 248, 0.15);
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }

    .btn-icon {
      background: none;
      border: none;
      color: #94A3B8;
      cursor: pointer;
      font-size: 14px;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
      &:hover { color: #F8FAFC; background: rgba(255, 255, 255, 0.05); }
    }

    /* Live Transcript Display */
    .transcript-display {
      padding: 14px 16px;
      min-height: 52px;
      display: flex;
      align-items: center;
      background: rgba(15, 23, 42, 0.4);
    }

    .streaming-text {
      font-size: 14px;
      font-weight: 500;
      color: #F1F5F9;
      line-height: 1.4;
    }

    .speech-quote {
      color: #2DD4BF;
      font-size: 18px;
      margin-right: 4px;
    }

    .cursor-blink {
      color: #2DD4BF;
      animation: blink 0.8s infinite;
    }

    .idle-prompt {
      font-size: 12px;
      color: #94A3B8;
      line-height: 1.5;
      em {
        color: #2DD4BF;
        font-style: normal;
      }
    }

    .deck-waveform-wrap {
      display: flex;
      justify-content: center;
      padding: 4px 16px;
    }

    /* Quick Chips */
    .quick-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 16px;
    }

    .chip {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: #CBD5E1;
      font-size: 10px;
      padding: 4px 8px;
      cursor: pointer;
      transition: all 0.2s;
      &:hover {
        background: rgba(13, 148, 136, 0.2);
        border-color: #0D9488;
        color: #2DD4BF;
      }
      &.chip-danger {
        border-color: rgba(239, 68, 68, 0.3);
        color: #F87171;
        &:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: #EF4444;
        }
      }
    }

    /* Deck Bottom Bar */
    .deck-bottom-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px 14px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .input-wrap {
      flex: 1;
      display: flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 0 8px;

      input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #F8FAFC;
        font-size: 12px;
        padding: 8px 4px;
        &::placeholder { color: #64748B; }
      }
    }

    .btn-send {
      background: none;
      border: none;
      color: #2DD4BF;
      font-size: 14px;
      cursor: pointer;
      padding: 2px 4px;
      &:disabled { opacity: 0.3; cursor: default; }
    }

    .btn-deck-mic {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: none;
      background: #0D9488;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;

      &:hover { background: #0F766E; }

      &.listening {
        background: #0284C7;
        box-shadow: 0 0 14px rgba(56, 189, 248, 0.8);
        animation: pulse-mic 1s infinite alternate;
      }
    }

    @keyframes pulse-mic {
      from { transform: scale(1); }
      to { transform: scale(1.08); }
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    @keyframes deck-appear {
      from { opacity: 0; transform: translateY(12px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @media (max-width: 480px) {
      :host {
        bottom: 16px;
        right: 16px;
        left: 16px;
      }
      .command-deck {
        width: 100%;
      }
    }
  `]
})
export class VoiceAssistantComponent {
  readonly voiceService = inject(VoiceAssistantService);

  readonly isExpanded = signal<boolean>(false);
  readonly showSettings = signal<boolean>(false);
  textQuery = '';

  readonly state = this.voiceService.state;
  readonly stateLabel = this.voiceService.stateLabel;
  readonly liveTranscript = this.voiceService.liveTranscript;
  readonly activeCard = this.voiceService.activeCard;
  readonly timeline = this.voiceService.timeline;
  readonly lastTelemetry = this.voiceService.lastTelemetry;
  readonly averageLatency = this.voiceService.averageLatency;
  readonly contextSnapshot = this.voiceService.contextSnapshot;

  toggleExpanded() {
    this.isExpanded.update((v) => !v);
  }

  toggleListening() {
    if (this.state() === 'LISTENING') {
      this.voiceService.stopListening();
    } else {
      this.voiceService.startListening();
      this.isExpanded.set(true);
    }
  }

  submitTextInput() {
    if (this.textQuery.trim()) {
      this.voiceService.sendTextQuery(this.textQuery);
      this.textQuery = '';
      this.isExpanded.set(true);
    }
  }

  runQuickCommand(cmd: string) {
    this.voiceService.sendTextQuery(cmd);
    this.isExpanded.set(true);
  }

  handleCardAction(event: { actionKey: string; card: any }) {
    this.voiceService.executeCardAction(event.actionKey, event.card);
  }

  handlePreferencesChanged(prefs: any) {
    this.voiceService.savePreferences(prefs);
    this.showSettings.set(false);
  }
}
