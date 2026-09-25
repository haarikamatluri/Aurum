import { Component, EventEmitter, Output, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VoiceAssistantService } from '../../../../core/services/voice-assistant.service';
import { VoiceWaveformComponent } from '../voice-waveform/voice-waveform.component';

@Component({
  selector: 'aurum-voice-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, VoiceWaveformComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="voice-modal">
      <div class="header">
        <div class="brand">
          <div class="logo">⚡</div>
          <span>Ask Aurum</span>
        </div>
        <button class="close-btn" (click)="close.emit()">×</button>
      </div>
      
      <div class="state-container">
        <!-- LISTENING STATE -->
        <div *ngIf="service.state() === 'LISTENING'" class="listening-state">
          <h3>Listening...</h3>
          <aurum-voice-waveform [state]="service.state()"></aurum-voice-waveform>
          <p class="instruction" [class.active-speech]="!!service.liveTranscript()">
            {{ service.liveTranscript() || 'Speak naturally about your portfolio, any stock, or market news.' }}
          </p>
          <div class="actions">
            <button class="btn btn-secondary" (click)="service.cancel()">Cancel</button>
            <button class="btn btn-primary" (click)="service.stopListening()">Stop Listening</button>
          </div>
        </div>

        <!-- IDLE / CHAT STATE -->
        <div *ngIf="service.state() !== 'LISTENING'" class="chat-state">
          <div class="input-area">
            <input 
              type="text" 
              [(ngModel)]="textInput" 
              placeholder="Ask a follow-up question..." 
              (keyup.enter)="sendText()"
            />
            <button class="mic-btn" (click)="service.startListening()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="22"></line>
              </svg>
            </button>
            <button class="send-btn" (click)="sendText()">
              ↵
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .voice-modal {
      width: 360px;
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      color: #F9FAFB;
      overflow: hidden;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }
    .logo {
      width: 24px;
      height: 24px;
      background: #0D9488;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    .close-btn {
      background: none;
      border: none;
      color: #9CA3AF;
      font-size: 22px;
      cursor: pointer;
    }
    .state-container {
      padding: 16px;
    }
    .instruction {
      text-align: center;
      color: #9CA3AF;
      font-size: 14px;
      margin: 12px 0;
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: center;
    }
    .btn {
      padding: 8px 14px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 12px;
    }
    .btn-secondary { background: rgba(255, 255, 255, 0.1); color: white; }
    .btn-primary { background: #0D9488; color: white; }
    .input-area {
      display: flex;
      gap: 6px;
    }
    input {
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 8px 12px;
      color: white;
      font-size: 13px;
    }
    .mic-btn, .send-btn {
      width: 36px;
      height: 36px;
      border-radius: 6px;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .mic-btn { background: rgba(13, 148, 136, 0.2); color: #0D9488; }
    .send-btn { background: #0D9488; color: white; }
    svg { width: 18px; height: 18px; }
  `]
})
export class VoicePanelComponent {
  readonly service = inject(VoiceAssistantService);
  @Output() close = new EventEmitter<void>();
  textInput = '';

  sendText() {
    if (this.textInput.trim()) {
      this.service.sendTextQuery(this.textInput);
      this.textInput = '';
    }
  }
}
