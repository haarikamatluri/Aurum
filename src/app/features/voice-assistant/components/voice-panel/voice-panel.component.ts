import { Component, EventEmitter, Output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VoiceAssistantService, VoiceState } from '../../../../core/services/voice-assistant.service';
import { VoiceWaveformComponent } from '../voice-waveform/voice-waveform.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'aurum-voice-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, VoiceWaveformComponent],
  template: `
    <div class="voice-modal">
      <div class="header">
        <div class="brand">
          <div class="logo">⚡</div>
          <span>Antigravity Voice Bot</span>
        </div>
        <button class="close-btn" (click)="close.emit()">×</button>
      </div>
      
      <div class="state-container">
        <!-- LISTENING STATE -->
        <div *ngIf="state === 'LISTENING'" class="listening-state">
          <h3>Listening...</h3>
          <aurum-voice-waveform [state]="state"></aurum-voice-waveform>
          <p class="instruction" [class.active-speech]="!!liveTranscript">
            {{ liveTranscript || 'Speak naturally about your portfolio, any stock, or market news.' }}
          </p>
          <div class="actions">
            <button class="btn btn-secondary" (click)="service.cancel()">Cancel</button>
            <button class="btn btn-primary" (click)="service.stopListening()">Stop Listening</button>
          </div>
        </div>

        <!-- PROCESSING STATE -->
        <div *ngIf="state === 'PROCESSING'" class="processing-state">
          <h3>Analyzing your request...</h3>
          <div class="orb"></div>
          <ul class="progress-list">
            <li><span class="check">✓</span> Understanding your question</li>
            <li><span class="check">✓</span> Fetching data</li>
            <li class="active"><span class="spinner"></span> Analyzing with Gemini</li>
          </ul>
        </div>

        <!-- SPEAKING STATE -->
        <div *ngIf="state === 'SPEAKING'" class="speaking-state">
          <h3>Here's what I found...</h3>
          <aurum-voice-waveform [state]="state"></aurum-voice-waveform>
          <p class="transcript">{{ latestAnswer }}</p>
          <div class="actions">
            <button class="btn btn-secondary" (click)="service.toggleMute()">Mute</button>
            <button class="btn btn-secondary" (click)="service.pause()">Pause</button>
            <button class="btn btn-primary" (click)="service.cancel()">Stop</button>
          </div>
        </div>

        <!-- IDLE / ERROR / CHAT STATE -->
        <div *ngIf="state === 'IDLE' || state === 'ERROR'" class="chat-state">
          <div class="chat-history">
            <div *ngFor="let msg of chatHistory" [class]="'msg ' + msg.role">
              <div class="msg-content">{{ msg.content }}</div>
            </div>
          </div>
          
          <div *ngIf="state === 'ERROR'" class="error-msg">
            An error occurred. Please try again.
          </div>

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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .voice-modal {
      width: 380px;
      height: 500px;
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
      padding: 16px;
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
      font-size: 24px;
      cursor: pointer;
    }
    .state-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 24px;
      overflow-y: auto;
    }
    h3 {
      text-align: center;
      font-size: 20px;
      margin-bottom: 24px;
      font-weight: 500;
    }
    .instruction {
      text-align: center;
      color: #9CA3AF;
      font-size: 14px;
      margin-top: 24px;
      margin-bottom: 24px;
    }
    .actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: auto;
    }
    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      border: none;
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }
    .btn-primary {
      background: #0D9488;
      color: white;
    }
    
    .chat-state {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .chat-history {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;
    }
    .msg {
      max-width: 85%;
      padding: 12px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.4;
    }
    .msg.user {
      align-self: flex-end;
      background: #0D9488;
      color: white;
      border-bottom-right-radius: 4px;
    }
    .msg.assistant {
      align-self: flex-start;
      background: rgba(255, 255, 255, 0.1);
      color: #F9FAFB;
      border-bottom-left-radius: 4px;
    }
    
    .input-area {
      display: flex;
      gap: 8px;
      margin-top: auto;
    }
    input {
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 12px;
      color: white;
    }
    .mic-btn, .send-btn {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .mic-btn {
      background: rgba(13, 148, 136, 0.2);
      color: #0D9488;
    }
    .send-btn {
      background: #0D9488;
      color: white;
    }
    svg {
      width: 20px;
      height: 20px;
    }
    
    .progress-list {
      list-style: none;
      padding: 0;
      margin-top: 32px;
    }
    .progress-list li {
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      color: #9CA3AF;
    }
    .progress-list li.active {
      color: white;
    }
    .check {
      color: #10B981;
    }
    .orb {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: radial-gradient(circle, #0D9488 0%, transparent 70%);
      margin: 0 auto;
      animation: pulse-orb 2s infinite alternate;
    }
    @keyframes pulse-orb {
      0% { transform: scale(0.8); opacity: 0.5; }
      100% { transform: scale(1.2); opacity: 1; }
    }
  `]
})
export class VoicePanelComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  
  state: VoiceState = 'IDLE';
  chatHistory: any[] = [];
  latestAnswer = '';
  liveTranscript = '';
  textInput = '';
  
  private subs = new Subscription();

  constructor(public service: VoiceAssistantService) {}

  ngOnInit() {
    this.subs.add(
      this.service.state$.subscribe(s => this.state = s)
    );
    this.subs.add(
      this.service.liveTranscript$.subscribe(t => this.liveTranscript = t)
    );
    this.subs.add(
      this.service.chatHistory$.subscribe(h => {
        this.chatHistory = h;
        const lastAsstMsg = h.slice().reverse().find(m => m.role === 'assistant');
        if (lastAsstMsg) {
          this.latestAnswer = lastAsstMsg.content;
        }
      })
    );
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  sendText() {
    if (this.textInput.trim()) {
      this.service.sendTextQuery(this.textInput);
      this.textInput = '';
    }
  }
}
